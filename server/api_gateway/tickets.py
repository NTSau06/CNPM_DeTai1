"""Persist ticket prices, user orders, and sales summaries."""
from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_TICKET_PRICES_VND = {
    "phong-nha-cave": 150_000,
    "thien-duong-cave": 150_000,
    "dark-cave": 150_000,
    "tien-son-cave": 70_000,
    "ozo-park": 150_000,
    "nhat-le-beach": 70_000,
    "dong-hoi-market": 70_000,
    "bao-ninh-village": 70_000,
    "vinh-moc-tunnels": 100_000,
    "hien-luong-bridge": 70_000,
    "quang-tri-citadel": 70_000,
    "cua-tung-beach": 70_000,
    "nuoc-mooc-spring": 120_000,
    "da-nhay-beach": 70_000,
}


class TicketRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS ticket_prices (
                    place_id TEXT PRIMARY KEY,
                    price_vnd INTEGER
                );
                CREATE TABLE IF NOT EXISTS ticket_orders (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id),
                    place_id TEXT NOT NULL,
                    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
                    unit_price_vnd INTEGER NOT NULL,
                    total_price_vnd INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            connection.executemany(
                """
                INSERT OR IGNORE INTO ticket_prices (place_id, price_vnd)
                VALUES (?, ?)
                """,
                DEFAULT_TICKET_PRICES_VND.items(),
            )

    def set_price(self, place_id: str, price_vnd: int | None) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                INSERT INTO ticket_prices (place_id, price_vnd)
                VALUES (?, ?)
                ON CONFLICT(place_id) DO UPDATE SET price_vnd = excluded.price_vnd
                """,
                (place_id, price_vnd),
            )

    def prices(self) -> list[dict]:
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute(
                "SELECT place_id, price_vnd FROM ticket_prices ORDER BY place_id"
            ).fetchall()
        return [{"placeId": row[0], "priceVnd": row[1]} for row in rows]

    def create_order(self, user_id: str, place_id: str, quantity: int) -> dict:
        order_id = secrets.token_urlsafe(12)
        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        with sqlite3.connect(self.database_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT price_vnd FROM ticket_prices WHERE place_id = ?",
                (place_id,),
            ).fetchone()
            if row is None or row[0] is None or row[0] <= 0:
                raise ValueError("Tickets are not available for this place.")
            unit_price_vnd = row[0]
            total_price_vnd = unit_price_vnd * quantity
            connection.execute(
                """
                INSERT INTO ticket_orders (
                    id, user_id, place_id, quantity, unit_price_vnd,
                    total_price_vnd, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    user_id,
                    place_id,
                    quantity,
                    unit_price_vnd,
                    total_price_vnd,
                    created_at,
                ),
            )
        return {
            "id": order_id,
            "placeId": place_id,
            "quantity": quantity,
            "unitPriceVnd": unit_price_vnd,
            "totalPriceVnd": total_price_vnd,
            "createdAt": created_at,
        }

    def user_orders(self, user_id: str) -> list[dict]:
        with sqlite3.connect(self.database_path) as connection:
            rows = connection.execute(
                """
                SELECT id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at
                FROM ticket_orders
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (user_id,),
            ).fetchall()
        return [_order_record(row) for row in rows]

    def sales_summary(self) -> dict:
        with sqlite3.connect(self.database_path) as connection:
            totals = connection.execute(
                """
                SELECT COALESCE(SUM(quantity), 0), COUNT(*),
                       COALESCE(SUM(total_price_vnd), 0)
                FROM ticket_orders
                """
            ).fetchone()
            by_place = connection.execute(
                """
                SELECT place_id, SUM(quantity), SUM(total_price_vnd)
                FROM ticket_orders
                GROUP BY place_id
                ORDER BY SUM(quantity) DESC, place_id
                """
            ).fetchall()
            recent = connection.execute(
                """
                SELECT id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at
                FROM ticket_orders
                ORDER BY created_at DESC, id DESC
                LIMIT 20
                """
            ).fetchall()
        return {
            "totalTicketsSold": totals[0],
            "totalOrders": totals[1],
            "totalRevenueVnd": totals[2],
            "places": [
                {
                    "placeId": row[0],
                    "ticketsSold": row[1],
                    "revenueVnd": row[2],
                }
                for row in by_place
            ],
            "recentOrders": [_order_record(row) for row in recent],
        }


def _order_record(row: tuple) -> dict:
    return {
        "id": row[0],
        "placeId": row[1],
        "quantity": row[2],
        "unitPriceVnd": row[3],
        "totalPriceVnd": row[4],
        "createdAt": row[5],
    }
