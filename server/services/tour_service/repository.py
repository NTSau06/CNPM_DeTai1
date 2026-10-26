"""Lưu và truy vấn hành trình trong cơ sở dữ liệu SQLite."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from services.common.schemas import Tour


class TourRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS tours (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    owner_id TEXT,
                    tour_json TEXT NOT NULL
                )
                """
            )
            columns = {
                row[1] for row in connection.execute("PRAGMA table_info(tours)")
            }
            if "owner_id" not in columns:
                connection.execute("ALTER TABLE tours ADD COLUMN owner_id TEXT")

    def save(self, tour: Tour, owner_id: str | None = None) -> Tour:
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute(
                """
                INSERT INTO tours (id, created_at, owner_id, tour_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    created_at = excluded.created_at,
                    owner_id = excluded.owner_id,
                    tour_json = excluded.tour_json
                WHERE tours.owner_id IS excluded.owner_id
                """,
                (
                    tour.id,
                    tour.created_at,
                    owner_id,
                    tour.model_dump_json(by_alias=True),
                ),
            )
            if cursor.rowcount == 0:
                raise ValueError("Tour ID already belongs to another account.")
        return tour

    def list(self, owner_id: str | None = None) -> list[Tour]:
        with sqlite3.connect(self.database_path) as connection:
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
                    (owner_id,),
                ).fetchall()
        return [Tour.model_validate(json.loads(row[0])) for row in rows]

    def delete(self, tour_id: str, owner_id: str | None = None) -> bool:
        with sqlite3.connect(self.database_path) as connection:
            if owner_id is None:
                cursor = connection.execute("DELETE FROM tours WHERE id = ?", (tour_id,))
            else:
                cursor = connection.execute(
                    "DELETE FROM tours WHERE id = ? AND owner_id = ?",
                    (tour_id, owner_id),
                )
        return cursor.rowcount > 0
