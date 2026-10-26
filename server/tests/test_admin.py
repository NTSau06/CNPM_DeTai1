"""Kiểm thử API và số liệu dành cho trang quản trị."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api_gateway.main import create_app as create_gateway_app
from api_gateway.auth import AuthRepository
from api_gateway.tickets import TicketRepository


def test_active_accounts_include_valid_sessions_and_count_accounts_once(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "accounts.sqlite"
    repository = AuthRepository(database_path)
    repository.initialize()
    repository.register("Test User", "user@example.com", "0123456789", "valid-password")
    repository.login("user@example.com", "valid-password")

    with sqlite3.connect(database_path) as connection:
        connection.execute("UPDATE auth_sessions SET last_seen_at = 0")

    assert repository.account_metrics()["activeAccountCount"] == 1

    with sqlite3.connect(database_path) as connection:
        connection.execute("UPDATE auth_sessions SET expires_at = 0")

    assert repository.account_metrics()["activeAccountCount"] == 0


def test_ticket_prices_keep_admin_updates_after_gateway_reinitializes(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "accounts.sqlite"
    AuthRepository(database_path).initialize()
    repository = TicketRepository(database_path)
    repository.initialize()
    repository.set_price("phong-nha-cave", 100_000)

    restarted_repository = TicketRepository(database_path)
    restarted_repository.initialize()

    assert next(
        item["priceVnd"]
        for item in restarted_repository.prices()
        if item["placeId"] == "phong-nha-cave"
    ) == 100_000


def test_admin_overview_is_protected_and_counts_active_accounts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request_service(
        base_url: str,
        method: str,
        path: str,
        *,
        params: dict[str, str | None] | None = None,
        json: dict | None = None,
    ) -> dict:
        assert path == "/internal/v1/analytics/admin/summary"
        return {
            "visitsLast30Days": 2,
            "totalRatings": 1,
            "averageRating": 4.0,
            "places": [],
            "latestReviews": [],
        }

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        tmp_path / "accounts.sqlite",
        admin_email="admin@example.com",
        admin_password="long-admin-password",
    )
    with TestClient(app) as client:
        assert client.get("/api/v1/admin/overview").status_code == 401
        user = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Normal User",
                "email": "user@example.com",
                "password": "valid-password",
            },
        )
        admin = client.post(
            "/api/v1/admin/login",
            json={"email": "admin@example.com", "password": "long-admin-password"},
        )
        assert user.status_code == 201
        assert admin.status_code == 200
        user_token = user.json()["token"]
        admin_token = admin.json()["token"]
        assert client.post(
            "/api/v1/auth/heartbeat",
            headers={"Authorization": f"Bearer {user_token}"},
        ).json() == {"active": True}
        assert client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": f"Bearer {user_token}"},
        ).status_code == 401
        assert client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        ).status_code == 401
        overview = client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    assert overview.status_code == 200
    assert overview.json()["accountCount"] == 1
    assert overview.json()["activeAccountCount"] == 1
    assert overview.json()["analytics"]["visitsLast30Days"] == 2
    assert overview.json()["tickets"]["totalTicketsSold"] == 0


def test_legacy_admin_is_migrated_to_separate_database(tmp_path: Path) -> None:
    user_database = tmp_path / "accounts.sqlite"
    legacy_repository = AuthRepository(user_database)
    legacy_repository.initialize()
    legacy_repository.register(
        "Legacy Administrator",
        "admin@example.com",
        "",
        "long-admin-password",
    )
    with sqlite3.connect(user_database) as connection:
        connection.execute(
            "UPDATE users SET role = 'admin' WHERE email = ?",
            ("admin@example.com",),
        )

    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        user_database,
        admin_email="admin@example.com",
        admin_password="long-admin-password",
    )
    with TestClient(app) as client:
        admin = client.post(
            "/api/v1/admin/login",
            json={"email": "admin@example.com", "password": "long-admin-password"},
        )
        user_login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "long-admin-password"},
        )
        assert admin.status_code == 200
        assert user_login.status_code == 401
        assert app.state.admin_auth_repository.database_path != user_database
        assert app.state.auth_repository.account_metrics()["accountCount"] == 0

    with sqlite3.connect(user_database) as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM users WHERE email = ?",
            ("admin@example.com",),
        ).fetchone()[0] == 0
    with sqlite3.connect(app.state.admin_auth_repository.database_path) as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM admins WHERE email = ?",
            ("admin@example.com",),
        ).fetchone()[0] == 1


def test_user_and_admin_can_share_email_without_sharing_credentials(
    tmp_path: Path,
) -> None:
    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        tmp_path / "accounts.sqlite",
        admin_email="shared@example.com",
        admin_password="long-admin-password",
    )
    with TestClient(app) as client:
        user = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Shared Email User",
                "email": "shared@example.com",
                "password": "different-user-password",
            },
        )
        admin = client.post(
            "/api/v1/admin/login",
            json={"email": "shared@example.com", "password": "long-admin-password"},
        )
        assert user.status_code == 201
        assert admin.status_code == 200
        assert client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": f"Bearer {user.json()['token']}"},
        ).status_code == 401
        assert client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {admin.json()['token']}"},
        ).status_code == 401


def test_ticket_orders_require_login_and_admin_controls_price(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request_service(
        base_url: str,
        method: str,
        path: str,
        *,
        params: dict[str, str | None] | None = None,
        json: dict | None = None,
    ) -> dict:
        assert method == "GET"
        assert path == "/internal/v1/places/phong-nha-cave"
        return {"id": "phong-nha-cave"}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        tmp_path / "accounts.sqlite",
        admin_email="admin@example.com",
        admin_password="long-admin-password",
    )
    with TestClient(app) as client:
        user = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Ticket User",
                "email": "ticket-user@example.com",
                "password": "valid-password",
            },
        ).json()
        admin = client.post(
            "/api/v1/admin/login",
            json={"email": "admin@example.com", "password": "long-admin-password"},
        ).json()
        assert user.get("token")
        assert admin.get("token")
        user_headers = {"Authorization": f"******"}
        admin_headers = {"Authorization": f"******"}
        user_headers = {"Authorization": "Bearer " + user["token"]}
        admin_headers = {"Authorization": "Bearer " + admin["token"]}
        assert client.get("/api/v1/auth/me", headers=user_headers).status_code == 200
        other_user = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Another User",
                "email": "another-ticket-user@example.com",
                "password": "valid-password",
            },
        ).json()
        other_headers = {"Authorization": "Bearer " + other_user["token"]}
        assert client.get("/api/v1/admin/tickets", headers=user_headers).status_code == 401

        assert client.post(
            "/api/v1/tickets/orders",
            json={"placeId": "phong-nha-cave", "quantity": 2},
        ).status_code == 401
        prices = client.get("/api/v1/tickets/prices").json()["items"]
        assert next(item["priceVnd"] for item in prices if item["placeId"] == "phong-nha-cave") == 150000
        assert client.put(
            "/api/v1/admin/tickets/prices/phong-nha-cave",
            headers=user_headers,
            json={"priceVnd": 100000},
        ).status_code == 401
        assert client.put(
            "/api/v1/admin/tickets/prices/phong-nha-cave",
            headers=admin_headers,
            json={"priceVnd": 69999},
        ).status_code == 422
        assert client.put(
            "/api/v1/admin/tickets/prices/phong-nha-cave",
            headers=admin_headers,
            json={"priceVnd": 150001},
        ).status_code == 422
        configured = client.put(
            "/api/v1/admin/tickets/prices/phong-nha-cave",
            headers=admin_headers,
            json={"priceVnd": 100000},
        )
        assert configured.status_code == 200
        order = client.post(
            "/api/v1/tickets/orders",
            headers=user_headers,
            json={"placeId": "phong-nha-cave", "quantity": 2},
        )
        assert order.status_code == 201
        assert order.json()["totalPriceVnd"] == 200000
        assert client.get("/api/v1/tickets/orders", headers=user_headers).json()["total"] == 2
        assert client.get("/api/v1/tickets/orders", headers=other_headers).json()["total"] == 0
        closed = client.put(
            "/api/v1/admin/tickets/prices/phong-nha-cave",
            headers=admin_headers,
            json={"priceVnd": None},
        )
        assert closed.status_code == 200
        assert client.post(
            "/api/v1/tickets/orders",
            headers=user_headers,
            json={"placeId": "phong-nha-cave", "quantity": 1},
        ).status_code == 409
        sales = client.get("/api/v1/admin/tickets", headers=admin_headers)

    assert sales.status_code == 200
    assert sales.json()["totalTicketsSold"] == 2
    assert sales.json()["totalRevenueVnd"] == 200000
