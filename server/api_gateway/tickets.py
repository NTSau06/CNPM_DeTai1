"""Persist ticket prices, user orders, and sales summaries."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from services.common.database import Database

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
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.ticket_prices', N'U') IS NULL
                CREATE TABLE dbo.ticket_prices (
                    place_id NVARCHAR(120) NOT NULL PRIMARY KEY,
                    price_vnd INT NULL
                )
                """
            )
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.ticket_orders', N'U') IS NULL
                CREATE TABLE dbo.ticket_orders (
                    id NVARCHAR(64) NOT NULL PRIMARY KEY,
                    user_id NVARCHAR(64) NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
                    place_id NVARCHAR(120) NOT NULL,
                    quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 10),
                    unit_price_vnd INT NOT NULL,
                    total_price_vnd INT NOT NULL,
                    created_at NVARCHAR(40) NOT NULL
                )
                """
            )
            for place_id, price_vnd in DEFAULT_TICKET_PRICES_VND.items():
                connection.execute(
                    """
                    IF NOT EXISTS (SELECT 1 FROM dbo.ticket_prices WHERE place_id = ?)
                    INSERT INTO dbo.ticket_prices (place_id, price_vnd) VALUES (?, ?)
                    """,
                    place_id,
                    place_id,
                    price_vnd,
                )

    def set_price(self, place_id: str, price_vnd: int | None) -> None:
        with self.database.connect() as connection:
            updated = connection.execute(
                "UPDATE ticket_prices SET price_vnd = ? WHERE place_id = ?",
                price_vnd,
                place_id,
            ).rowcount
            if updated == 0:
                connection.execute(
                    "INSERT INTO ticket_prices (place_id, price_vnd) VALUES (?, ?)",
                    place_id,
                    price_vnd,
                )

    def prices(self) -> list[dict]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT place_id, price_vnd FROM ticket_prices ORDER BY place_id"
            ).fetchall()
        return [{"placeId": row[0], "priceVnd": row[1]} for row in rows]

    def create_order(self, user_id: str, place_id: str, quantity: int) -> dict:
        order_id = secrets.token_urlsafe(12)
        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT price_vnd FROM ticket_prices WITH (HOLDLOCK) WHERE place_id = ?",
                place_id,
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
                order_id,
                user_id,
                place_id,
                quantity,
                unit_price_vnd,
                total_price_vnd,
                created_at,
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
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at
                FROM ticket_orders
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                user_id,
            ).fetchall()
        return [_order_record(row) for row in rows]

    def sales_summary(self) -> dict:
        with self.database.connect() as connection:
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
                SELECT TOP 20 id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at
                FROM ticket_orders
                ORDER BY created_at DESC, id DESC
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
