from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from services.common.schemas import Place


class PlaceRepository:
    def __init__(self, database_path: Path, seed_path: Path) -> None:
        self.database_path = database_path
        self.seed_path = seed_path

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS places (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    content_json TEXT NOT NULL
                )
                """
            )
            seed = json.loads(self.seed_path.read_text(encoding="utf-8"))
            connection.executemany(
                """
                INSERT INTO places (id, category, content_json)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    category = excluded.category,
                    content_json = excluded.content_json
                """,
                [
                    (item["id"], item["category"], json.dumps(item, ensure_ascii=False))
                    for item in seed
                ],
            )
            seed_ids = [item["id"] for item in seed]
            if seed_ids:
                placeholders = ",".join("?" for _ in seed_ids)
                connection.execute(
                    f"DELETE FROM places WHERE id NOT IN ({placeholders})",
                    seed_ids,
                )
            else:
                connection.execute("DELETE FROM places")

    def list(self, category: str | None = None, query: str | None = None) -> list[Place]:
        sql = "SELECT content_json FROM places"
        parameters: list[str] = []
        filters: list[str] = []
        if category:
            filters.append("category = ?")
            parameters.append(category)
        if query:
            filters.append("content_json LIKE ? COLLATE NOCASE")
            parameters.append(f"%{query}%")
        if filters:
            sql += " WHERE " + " AND ".join(filters)
        sql += " ORDER BY id"
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute(sql, parameters).fetchall()
        return [Place.model_validate(json.loads(row[0])) for row in rows]

    def get(self, place_id: str) -> Place | None:
        with sqlite3.connect(self.database_path) as connection:
            row = connection.execute(
                "SELECT content_json FROM places WHERE id = ?", (place_id,)
            ).fetchone()
        return Place.model_validate(json.loads(row[0])) if row else None

    def get_many(self, place_ids: list[str]) -> list[Place]:
        placeholders = ",".join("?" for _ in place_ids)
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute(
                f"SELECT content_json FROM places WHERE id IN ({placeholders})",
                place_ids,
            ).fetchall()
        places_by_id = {
            place.id: place
            for place in (Place.model_validate(json.loads(row[0])) for row in rows)
        }
        return [places_by_id[place_id] for place_id in place_ids if place_id in places_by_id]

    def validate_ids(self, place_ids: list[str]) -> list[str]:
        placeholders = ",".join("?" for _ in place_ids)
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute(
                f"SELECT id FROM places WHERE id IN ({placeholders})", place_ids
            ).fetchall()
        return [row[0] for row in rows]

    def to_seed_record(self, place: Place) -> dict[str, Any]:
        return place.model_dump(mode="json")
