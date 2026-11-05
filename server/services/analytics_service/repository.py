"""Lưu lượt ghé/đánh giá và tính thống kê từng địa điểm bằng SQL Server."""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pyodbc

from services.analytics_service.schemas import (
    AdminAnalyticsSummary,
    AdminPlaceAnalytics,
    AdminReview,
    PresenceHeartbeat,
    PlaceAnalytics,
    RatingCreate,
    RatingReview,
    RatingSummary,
    VisitCreate,
)
from services.common.database import Database


# Thiết bị không gửi heartbeat quá thời gian này sẽ bị coi là đã rời trang.
PRESENCE_TTL_SECONDS = 30


class AnalyticsRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.visits', N'U') IS NULL
                CREATE TABLE dbo.visits (
                    visitor_hash NVARCHAR(64) NOT NULL,
                    place_id NVARCHAR(120) NOT NULL,
                    visit_date NVARCHAR(10) NOT NULL,
                    PRIMARY KEY (visitor_hash, place_id, visit_date)
                )
                """
            )
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.ratings', N'U') IS NULL
                CREATE TABLE dbo.ratings (
                    visitor_hash NVARCHAR(64) NOT NULL,
                    place_id NVARCHAR(120) NOT NULL,
                    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                    review NVARCHAR(MAX) NOT NULL,
                    updated_at NVARCHAR(40) NOT NULL,
                    PRIMARY KEY (visitor_hash, place_id)
                )
                """
            )
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.visitor_presence', N'U') IS NULL
                CREATE TABLE dbo.visitor_presence (
                    visitor_hash NVARCHAR(64) NOT NULL PRIMARY KEY,
                    last_seen_at BIGINT NOT NULL
                )
                """
            )

    def heartbeat(self, presence: PresenceHeartbeat) -> None:
        last_seen_at = int(time.time())
        visitor_hash = _visitor_hash(presence.visitor_id)
        with self.database.connect() as connection:
            updated = connection.execute(
                "UPDATE visitor_presence SET last_seen_at = ? WHERE visitor_hash = ?",
                last_seen_at,
                visitor_hash,
            ).rowcount
            if updated == 0:
                try:
                    connection.execute(
                        "INSERT INTO visitor_presence (visitor_hash, last_seen_at) VALUES (?, ?)",
                        visitor_hash,
                        last_seen_at,
                    )
                except pyodbc.IntegrityError:
                    # Một heartbeat khác vừa chèn cùng visitor; cập nhật lại.
                    connection.execute(
                        "UPDATE visitor_presence SET last_seen_at = ? WHERE visitor_hash = ?",
                        last_seen_at,
                        visitor_hash,
                    )
            connection.execute(
                "DELETE FROM visitor_presence WHERE last_seen_at < ?",
                last_seen_at - PRESENCE_TTL_SECONDS,
            )

    def leave(self, presence: PresenceHeartbeat) -> None:
        """Xóa thiết bị khỏi danh sách online ngay khi người dùng rời trang."""
        with self.database.connect() as connection:
            connection.execute(
                "DELETE FROM visitor_presence WHERE visitor_hash = ?",
                _visitor_hash(presence.visitor_id),
            )

    def online_visitor_count(self) -> int:
        now = int(time.time())
        with self.database.connect() as connection:
            connection.execute(
                "DELETE FROM visitor_presence WHERE last_seen_at < ?",
                now - PRESENCE_TTL_SECONDS,
            )
            row = connection.execute(
                "SELECT COUNT(*) FROM visitor_presence WHERE last_seen_at >= ?",
                now - PRESENCE_TTL_SECONDS,
            ).fetchone()
        return int(row[0])

    def record_visit(self, visit: VisitCreate) -> bool:
        today = datetime.now(timezone.utc).date().isoformat()
        with self.database.connect() as connection:
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO visits (visitor_hash, place_id, visit_date)
                    VALUES (?, ?, ?)
                    """,
                    _visitor_hash(visit.visitor_id),
                    visit.place_id,
                    today,
                )
            except pyodbc.IntegrityError:
                return False
            return cursor.rowcount == 1

    def save_rating(self, payload: RatingCreate) -> None:
        updated_at = datetime.now(timezone.utc).isoformat()
        visitor_hash = _visitor_hash(payload.visitor_id)
        review = payload.review.strip()
        with self.database.connect() as connection:
            exists = connection.execute(
                """
                SELECT 1 FROM ratings WITH (UPDLOCK, HOLDLOCK)
                WHERE visitor_hash = ? AND place_id = ?
                """,
                visitor_hash,
                payload.place_id,
            ).fetchone()
            if exists:
                connection.execute(
                    """
                    UPDATE ratings
                    SET rating = ?, review = ?, updated_at = ?
                    WHERE visitor_hash = ? AND place_id = ?
                    """,
                    payload.rating,
                    review,
                    updated_at,
                    visitor_hash,
                    payload.place_id,
                )
            else:
                connection.execute(
                    """
                    INSERT INTO ratings (visitor_hash, place_id, rating, review, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    visitor_hash,
                    payload.place_id,
                    payload.rating,
                    review,
                    updated_at,
                )

    def rating_summary(self, place_id: str) -> RatingSummary:
        with self.database.connect() as connection:
            summary = connection.execute(
                """
                SELECT AVG(CAST(rating AS FLOAT)), COUNT(*)
                FROM ratings
                WHERE place_id = ?
                """,
                place_id,
            ).fetchone()
            rows = connection.execute(
                """
                SELECT TOP 20 rating, review, updated_at
                FROM ratings
                WHERE place_id = ? AND review <> ''
                ORDER BY updated_at DESC
                """,
                place_id,
            ).fetchall()
        return RatingSummary(
            placeId=place_id,
            averageRating=round(summary[0], 2) if summary[0] is not None else None,
            totalRatings=summary[1],
            reviews=[
                RatingReview(rating=row[0], review=row[1], createdAt=row[2])
                for row in rows
            ],
        )

    def place_analytics(self, place_id: str, period_days: int = 30) -> PlaceAnalytics:
        today = datetime.now(timezone.utc).date()
        start_date = (today - timedelta(days=period_days - 1)).isoformat()
        with self.database.connect() as connection:
            visits = connection.execute(
                """
                SELECT COUNT(*)
                FROM visits
                WHERE place_id = ? AND visit_date >= ?
                """,
                place_id,
                start_date,
            ).fetchone()
            rating = connection.execute(
                """
                SELECT AVG(CAST(rating AS FLOAT)), COUNT(*)
                FROM ratings
                WHERE place_id = ?
                """,
                place_id,
            ).fetchone()
        return PlaceAnalytics(
            placeId=place_id,
            visits=visits[0],
            averageRating=round(rating[0], 2) if rating[0] is not None else None,
            ratingCount=rating[1],
        )

    def admin_summary(self, period_days: int = 30) -> AdminAnalyticsSummary:
        today = datetime.now(timezone.utc).date()
        start_date = (today - timedelta(days=period_days - 1)).isoformat()
        with self.database.connect() as connection:
            visits_total = connection.execute(
                "SELECT COUNT(*) FROM visits WHERE visit_date >= ?",
                start_date,
            ).fetchone()[0]
            rating_total, overall_average = connection.execute(
                "SELECT COUNT(*), AVG(CAST(rating AS FLOAT)) FROM ratings"
            ).fetchone()
            place_rows = connection.execute(
                """
                SELECT place_id, COUNT(*)
                FROM visits
                WHERE visit_date >= ?
                GROUP BY place_id
                """,
                start_date,
            ).fetchall()
            rating_rows = connection.execute(
                """
                SELECT place_id, AVG(CAST(rating AS FLOAT)), COUNT(*)
                FROM ratings
                GROUP BY place_id
                """
            ).fetchall()
            recent_rows = connection.execute(
                """
                SELECT TOP 8 place_id, rating, review, updated_at
                FROM ratings
                WHERE review <> ''
                ORDER BY updated_at DESC
                """
            ).fetchall()

        ratings_by_place = {
            row[0]: (round(row[1], 2), row[2]) for row in rating_rows
        }
        visits_by_place = {row[0]: row[1] for row in place_rows}
        place_ids = visits_by_place.keys() | ratings_by_place.keys()
        places = [
            AdminPlaceAnalytics(
                placeId=place_id,
                visits=visits_by_place.get(place_id, 0),
                averageRating=ratings_by_place.get(place_id, (None, 0))[0],
                ratingCount=ratings_by_place.get(place_id, (None, 0))[1],
            )
            for place_id in place_ids
        ]
        places.sort(key=lambda item: (-item.visits, item.place_id))
        return AdminAnalyticsSummary(
            visitsLast30Days=visits_total,
            totalRatings=rating_total,
            averageRating=round(overall_average, 2) if overall_average is not None else None,
            places=places,
            latestReviews=[
                AdminReview(
                    placeId=row[0],
                    rating=row[1],
                    review=row[2],
                    createdAt=row[3],
                )
                for row in recent_rows
            ],
        )


def _visitor_hash(visitor_id: UUID) -> str:
    return hashlib.sha256(str(visitor_id).encode("ascii")).hexdigest()
