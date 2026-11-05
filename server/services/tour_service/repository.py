"""Lưu và truy vấn hành trình trong cơ sở dữ liệu SQL Server."""
from __future__ import annotations

import json

from services.common.database import Database
from services.common.schemas import Tour


class TourRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.tours', N'U') IS NULL
                CREATE TABLE dbo.tours (
                    id NVARCHAR(120) NOT NULL PRIMARY KEY,
                    created_at BIGINT NOT NULL,
                    owner_id NVARCHAR(64) NULL,
                    tour_json NVARCHAR(MAX) NOT NULL
                )
                """
            )
            connection.execute(
                """
                IF COL_LENGTH(N'dbo.tours', N'owner_id') IS NULL
                ALTER TABLE dbo.tours ADD owner_id NVARCHAR(64) NULL
                """
            )

    def save(self, tour: Tour, owner_id: str | None = None) -> Tour:
        tour_json = tour.model_dump_json(by_alias=True)
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT owner_id FROM tours WITH (UPDLOCK, HOLDLOCK) WHERE id = ?",
                tour.id,
            ).fetchone()
            if row is None:
                connection.execute(
                    """
                    INSERT INTO tours (id, created_at, owner_id, tour_json)
                    VALUES (?, ?, ?, ?)
                    """,
                    tour.id,
                    tour.created_at,
                    owner_id,
                    tour_json,
                )
            elif row[0] != owner_id:
                raise ValueError("Tour ID already belongs to another account.")
            else:
                connection.execute(
                    """
                    UPDATE tours SET created_at = ?, tour_json = ?
                    WHERE id = ?
                    """,
                    tour.created_at,
                    tour_json,
                    tour.id,
                )
        return tour

    def list(self, owner_id: str | None = None) -> list[Tour]:
        with self.database.connect() as connection:
            if owner_id is None:
                rows = connection.execute(
                    "SELECT tour_json FROM tours ORDER BY created_at DESC, id DESC"
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT tour_json FROM tours
                    WHERE owner_id = ?
                    ORDER BY created_at DESC, id DESC
                    """,
                    owner_id,
                ).fetchall()
        return [Tour.model_validate(json.loads(row[0])) for row in rows]

    def delete(self, tour_id: str, owner_id: str | None = None) -> bool:
        with self.database.connect() as connection:
            if owner_id is None:
                cursor = connection.execute("DELETE FROM tours WHERE id = ?", tour_id)
            else:
                cursor = connection.execute(
                    "DELETE FROM tours WHERE id = ? AND owner_id = ?", tour_id, owner_id
                )
            return cursor.rowcount > 0

    def delete_for_owner(self, owner_id: str) -> int:
        with self.database.connect() as connection:
            cursor = connection.execute("DELETE FROM tours WHERE owner_id = ?", owner_id)
            return cursor.rowcount
