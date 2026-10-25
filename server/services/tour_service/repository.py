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
                    tour_json TEXT NOT NULL
                )
                """
            )

    def save(self, tour: Tour) -> Tour:
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                INSERT INTO tours (id, created_at, tour_json)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    created_at = excluded.created_at,
                    tour_json = excluded.tour_json
                """,
                (
                    tour.id,
                    tour.created_at,
                    tour.model_dump_json(by_alias=True),
                ),
            )
        return tour

    def list(self) -> list[Tour]:
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute(
                "SELECT tour_json FROM tours ORDER BY created_at DESC, id DESC"
            ).fetchall()
        return [Tour.model_validate(json.loads(row[0])) for row in rows]

    def delete(self, tour_id: str) -> bool:
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute("DELETE FROM tours WHERE id = ?", (tour_id,))
        return cursor.rowcount > 0
