"""Nạp, cập nhật và truy vấn danh mục địa điểm lưu trong SQL Server."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from services.common.database import Database
from services.common.schemas import Place


class PlaceRepository:
    def __init__(self, database: Database, seed_path: Path) -> None:
        self.database = database
        self.seed_path = seed_path

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.places', N'U') IS NULL
                CREATE TABLE dbo.places (
                    id NVARCHAR(120) NOT NULL PRIMARY KEY,
                    category NVARCHAR(60) NOT NULL,
                    content_json NVARCHAR(MAX) NOT NULL
                )
                """
            )
            seed = json.loads(self.seed_path.read_text(encoding="utf-8"))
            count = connection.execute("SELECT COUNT(*) FROM places").fetchone()[0]
            if count == 0:
                connection.cursor().executemany(
                    """
                    INSERT INTO places (id, category, content_json)
                    VALUES (?, ?, ?)
                    """,
                    [
                        (item["id"], item["category"], json.dumps(item, ensure_ascii=False))
                        for item in seed
                    ],
                )

    def list(self, category: str | None = None, query: str | None = None) -> list[Place]:
        sql = "SELECT content_json FROM places"
        parameters: list[str] = []
        filters: list[str] = []
        if category:
            filters.append("category = ?")
            parameters.append(category)
        if query:
            filters.append("content_json LIKE ? COLLATE Latin1_General_100_CI_AS")
            parameters.append(f"%{query}%")
        if filters:
            sql += " WHERE " + " AND ".join(filters)
        sql += " ORDER BY id"
        with self.database.connect() as connection:
            rows = connection.execute(sql, parameters).fetchall()
        return [Place.model_validate(json.loads(row[0])) for row in rows]

    def get(self, place_id: str) -> Place | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT content_json FROM places WHERE id = ?", place_id
            ).fetchone()
        return Place.model_validate(json.loads(row[0])) if row else None

    def save(self, place: Place) -> Place:
        content_json = place.model_dump_json(by_alias=True)
        with self.database.connect() as connection:
            exists = connection.execute(
                "SELECT 1 FROM places WITH (UPDLOCK, HOLDLOCK) WHERE id = ?", place.id
            ).fetchone()
            if exists:
                connection.execute(
                    "UPDATE places SET category = ?, content_json = ? WHERE id = ?",
                    place.category,
                    content_json,
                    place.id,
                )
            else:
                connection.execute(
                    "INSERT INTO places (id, category, content_json) VALUES (?, ?, ?)",
                    place.id,
                    place.category,
                    content_json,
                )
        return place

    def delete(self, place_id: str) -> bool:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                DELETE FROM places
                WHERE id = ? AND (SELECT COUNT(*) FROM places) > 1
                """,
                place_id,
            )
            return cursor.rowcount > 0

    def get_many(self, place_ids: list[str]) -> list[Place]:
        if not place_ids:
            return []
        placeholders = ",".join("?" for _ in place_ids)
        with self.database.connect() as connection:
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
        if not place_ids:
            return []
        placeholders = ",".join("?" for _ in place_ids)
        with self.database.connect() as connection:
            rows = connection.execute(
                f"SELECT id FROM places WHERE id IN ({placeholders})", place_ids
            ).fetchall()
        return [row[0] for row in rows]

    def to_seed_record(self, place: Place) -> dict[str, Any]:
        return place.model_dump(mode="json")
