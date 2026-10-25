from __future__ import annotations

import hashlib
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from services.analytics_service.schemas import (
    PlaceAnalytics,
    RatingCreate,
    RatingReview,
    RatingSummary,
    VisitCreate,
)


class AnalyticsRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS visits (
                    visitor_hash TEXT NOT NULL,
                    place_id TEXT NOT NULL,
                    visit_date TEXT NOT NULL,
                    PRIMARY KEY (visitor_hash, place_id, visit_date)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS ratings (
                    visitor_hash TEXT NOT NULL,
                    place_id TEXT NOT NULL,
                    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                    review TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (visitor_hash, place_id)
                )
                """
            )

    def record_visit(self, visit: VisitCreate) -> bool:
        today = datetime.now(timezone.utc).date().isoformat()
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO visits (visitor_hash, place_id, visit_date)
                VALUES (?, ?, ?)
                """,
                (_visitor_hash(visit.visitor_id), visit.place_id, today),
            )
        return cursor.rowcount == 1

    def save_rating(self, payload: RatingCreate) -> None:
        updated_at = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                INSERT INTO ratings (visitor_hash, place_id, rating, review, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(visitor_hash, place_id) DO UPDATE SET
                    rating = excluded.rating,
                    review = excluded.review,
                    updated_at = excluded.updated_at
                """,
                (
                    _visitor_hash(payload.visitor_id),
                    payload.place_id,
                    payload.rating,
                    payload.review.strip(),
                    updated_at,
                ),
            )

    def rating_summary(self, place_id: str) -> RatingSummary:
        with sqlite3.connect(self.database_path) as connection:
            summary = connection.execute(
                """
                SELECT AVG(rating), COUNT(*)
                FROM ratings
                WHERE place_id = ?
                """,
                (place_id,),
            ).fetchone()
            rows = connection.execute(
                """
                SELECT rating, review, updated_at
                FROM ratings
                WHERE place_id = ? AND review != ''
                ORDER BY updated_at DESC
                LIMIT 20
                """,
                (place_id,),
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
        with sqlite3.connect(self.database_path) as connection:
            visits = connection.execute(
                """
                SELECT COUNT(*)
                FROM visits
                WHERE place_id = ? AND visit_date >= ?
                """,
                (place_id, start_date),
            ).fetchone()
            rating = connection.execute(
                """
                SELECT AVG(rating), COUNT(*)
                FROM ratings
                WHERE place_id = ?
                """,
                (place_id,),
            ).fetchone()
        return PlaceAnalytics(
            placeId=place_id,
            visits=visits[0],
            averageRating=round(rating[0], 2) if rating[0] is not None else None,
            ratingCount=rating[1],
        )


def _visitor_hash(visitor_id: UUID) -> str:
    return hashlib.sha256(str(visitor_id).encode("ascii")).hexdigest()
