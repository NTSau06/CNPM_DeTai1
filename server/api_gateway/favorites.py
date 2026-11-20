"""Lưu danh sách địa điểm yêu thích theo tài khoản."""
from __future__ import annotations

from datetime import datetime, timezone

from services.common.database import Database
from services.common.relationships import apply_relationships

MAX_FAVORITES = 200


class FavoriteRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.user_favorites', N'U') IS NULL
                CREATE TABLE dbo.user_favorites (
                    user_id NVARCHAR(64) NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
                    place_id NVARCHAR(120) NOT NULL,
                    created_at NVARCHAR(40) NOT NULL,
                    CONSTRAINT PK_user_favorites PRIMARY KEY (user_id, place_id)
                )
                """
            )
        apply_relationships(self.database)

    def list(self, user_id: str) -> list[dict]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT place_id, created_at FROM user_favorites
                WHERE user_id = ?
                ORDER BY created_at DESC, place_id
                """,
                user_id,
            ).fetchall()
        return [{"placeId": row[0], "createdAt": row[1]} for row in rows]

    def add(self, user_id: str, place_id: str) -> dict:
        """Thêm (idempotent). Ném ValueError khi vượt giới hạn số lượng."""
        created_at = (
            datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        )
        with self.database.connect() as connection:
            existing = connection.execute(
                "SELECT created_at FROM user_favorites WITH (UPDLOCK, HOLDLOCK) "
                "WHERE user_id = ? AND place_id = ?",
                user_id,
                place_id,
            ).fetchone()
            if existing is not None:
                return {"placeId": place_id, "createdAt": existing[0]}
            count = connection.execute(
                "SELECT COUNT(*) FROM user_favorites WHERE user_id = ?", user_id
            ).fetchone()[0]
            if count >= MAX_FAVORITES:
                raise ValueError(f"You can save at most {MAX_FAVORITES} favorite places.")
            connection.execute(
                "INSERT INTO user_favorites (user_id, place_id, created_at) VALUES (?, ?, ?)",
                user_id,
                place_id,
                created_at,
            )
        return {"placeId": place_id, "createdAt": created_at}

    def remove(self, user_id: str, place_id: str) -> bool:
        with self.database.connect() as connection:
            cursor = connection.execute(
                "DELETE FROM user_favorites WHERE user_id = ? AND place_id = ?",
                user_id,
                place_id,
            )
            return cursor.rowcount > 0
