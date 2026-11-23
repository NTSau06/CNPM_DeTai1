"""Kiểm thử các chức năng bổ sung: hủy vé, đánh giá theo tài khoản, kiểm duyệt
đánh giá, giới hạn đăng nhập sai, khóa và tự xóa tài khoản, lọc thống kê."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api_gateway.main import create_app as create_gateway_app
from api_gateway.rate_limit import LoginRateLimiter
from services.analytics_service.main import create_app as create_analytics_app
from services.common.database import Database

SERVICE_URLS = {
    "poi": "poi",
    "tour": "tour",
    "narration": "narration",
    "analytics": "analytics",
}


def _gateway(database: Database) -> TestClient:
    app = create_gateway_app(
        SERVICE_URLS,
        database,
        admin_email="admin@example.com",
        admin_password="long-admin-password",
    )
    return TestClient(app)


def _register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"fullName": "Test User", "email": email, "password": "valid-password"},
    )
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["token"]}


def _admin(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/admin/login",
        json={"email": "admin@example.com", "password": "long-admin-password"},
    )
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["token"]}


def test_rate_limiter_blocks_after_max_failures_and_resets() -> None:
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60)
    assert limiter.retry_after("k") == 0
    limiter.record_failure("k")
    assert limiter.retry_after("k") == 0
    limiter.record_failure("k")
    assert limiter.retry_after("k") > 0
    limiter.reset("k")
    assert limiter.retry_after("k") == 0


def test_repeated_wrong_passwords_are_throttled(database: Database) -> None:
    with _gateway(database) as client:
        _register(client, "throttle@example.com")
        wrong = {"email": "throttle@example.com", "password": "wrong-password"}
        for _ in range(5):
            assert client.post("/api/v1/auth/login", json=wrong).status_code == 401
        blocked = client.post("/api/v1/auth/login", json=wrong)
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers
        # Mật khẩu đúng cũng bị chặn cho tới khi hết thời gian khóa.
        assert client.post(
            "/api/v1/auth/login",
            json={"email": "throttle@example.com", "password": "valid-password"},
        ).status_code == 429


def test_user_can_cancel_own_ticket_once_and_sales_exclude_it(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request_service(base_url, method, path, *, params=None, json=None):
        return {"id": "phong-nha-cave"}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    with _gateway(database) as client:
        user = _register(client, "buyer@example.com")
        other = _register(client, "other@example.com")
        admin = _admin(client)
        order = client.post(
            "/api/v1/tickets/orders",
            headers=user,
            json={"placeId": "phong-nha-cave", "quantity": 3},
        ).json()
        assert order["status"] == "pending"
        assert order["ticketCode"].startswith("QT-")

        cancel_path = f"/api/v1/tickets/orders/{order['id']}/cancel"
        assert client.post(cancel_path).status_code == 401
        assert client.post(cancel_path, headers=other).status_code == 404
        cancelled = client.post(cancel_path, headers=user)
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"
        assert client.post(cancel_path, headers=user).status_code == 409

        mine = client.get("/api/v1/tickets/orders", headers=user).json()
        assert mine["total"] == 0
        assert mine["items"][0]["status"] == "cancelled"

        sales = client.get("/api/v1/admin/tickets?days=30", headers=admin).json()
        assert sales["totalTicketsSold"] == 0
        assert sales["cancelledOrders"] == 1
        assert client.get("/api/v1/admin/tickets?days=12", headers=admin).status_code == 422


def test_ratings_require_account_and_use_one_identity_per_account(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    forwarded: list[dict] = []

    async def fake_request_service(base_url, method, path, *, params=None, json=None):
        if path.startswith("/internal/v1/places/"):
            return {"id": "phong-nha-cave"}
        if path == "/internal/v1/analytics/ratings":
            forwarded.append(json)
            return {"placeId": "phong-nha-cave", "averageRating": 5, "totalRatings": 1, "reviews": []}
        raise AssertionError(path)

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    payload = {"placeId": "phong-nha-cave", "rating": 5, "review": "Đẹp"}
    with _gateway(database) as client:
        assert client.post("/api/v1/analytics/ratings", json=payload).status_code == 401
        user = _register(client, "rater@example.com")
        # visitorId do client gửi lên bị bỏ qua.
        spoofed = {**payload, "visitorId": "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"}
        assert client.post("/api/v1/analytics/ratings", headers=user, json=spoofed).status_code == 201
        assert client.post("/api/v1/analytics/ratings", headers=user, json=payload).status_code == 201
        assert client.post(
            "/api/v1/analytics/ratings", headers=_admin(client), json=payload
        ).status_code == 403

    assert len(forwarded) == 2
    assert forwarded[0]["visitorId"] == forwarded[1]["visitorId"]
    assert forwarded[0]["visitorId"] != "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"


def test_analytics_service_lists_and_deletes_reviews(database: Database) -> None:
    with TestClient(create_analytics_app(database)) as client:
        visitor_id = "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"
        client.post(
            "/internal/v1/analytics/ratings",
            json={"placeId": "phong-nha-cave", "visitorId": visitor_id, "rating": 1, "review": "spam"},
        )
        own = client.get(
            f"/internal/v1/analytics/ratings/phong-nha-cave/visitors/{visitor_id}"
        ).json()
        assert own["rating"] == 1 and own["review"] == "spam"

        reviews = client.get("/internal/v1/analytics/admin/reviews").json()
        assert reviews["total"] == 1
        review_id = reviews["items"][0]["id"]
        summary = client.get("/internal/v1/analytics/admin/summary?days=7").json()
        assert summary["periodDays"] == 7
        assert summary["latestReviews"][0]["id"] == review_id

        deleted = client.delete(f"/internal/v1/analytics/ratings/phong-nha-cave/{review_id}")
        assert deleted.status_code == 204
        assert client.delete(
            f"/internal/v1/analytics/ratings/phong-nha-cave/{review_id}"
        ).status_code == 404
        assert client.get("/internal/v1/analytics/ratings/phong-nha-cave").json()["totalRatings"] == 0


def test_admin_can_lock_and_unlock_user(database: Database) -> None:
    with _gateway(database) as client:
        user = _register(client, "locked@example.com")
        admin = _admin(client)
        user_id = client.get("/api/v1/auth/me", headers=user).json()["id"]

        assert client.put(
            f"/api/v1/admin/users/{user_id}/lock", headers=user, json={"locked": True}
        ).status_code == 403
        locked = client.put(
            f"/api/v1/admin/users/{user_id}/lock", headers=admin, json={"locked": True}
        )
        assert locked.status_code == 200 and locked.json()["isLocked"] is True
        # Phiên cũ bị thu hồi và không đăng nhập lại được.
        assert client.get("/api/v1/auth/me", headers=user).status_code == 401
        login = {"email": "locked@example.com", "password": "valid-password"}
        assert client.post("/api/v1/auth/login", json=login).status_code == 403

        client.put(f"/api/v1/admin/users/{user_id}/lock", headers=admin, json={"locked": False})
        assert client.post("/api/v1/auth/login", json=login).status_code == 200


def test_user_can_delete_own_account_with_password(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    async def fake_request_service(base_url, method, path, *, params=None, json=None):
        calls.append(f"{method} {path}")
        return None

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    with _gateway(database) as client:
        user = _register(client, "leaving@example.com")
        user_id = client.get("/api/v1/auth/me", headers=user).json()["id"]
        assert client.request(
            "DELETE", "/api/v1/auth/me", headers=user, json={"password": "wrong-password"}
        ).status_code == 403
        assert client.request(
            "DELETE", "/api/v1/auth/me", headers=user, json={"password": "valid-password"}
        ).status_code == 204
        assert client.post(
            "/api/v1/auth/login",
            json={"email": "leaving@example.com", "password": "valid-password"},
        ).status_code == 401

    assert calls == [f"DELETE /internal/v1/admin/tours/owner/{user_id}"]


def _place_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_request_service(base_url, method, path, *, params=None, json=None):
        if path.startswith("/internal/v1/places/missing"):
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Place not found.")
        return {"id": path.rsplit("/", 1)[-1]}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)


def test_favorites_are_per_account_and_idempotent(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _place_lookup(monkeypatch)
    with _gateway(database) as client:
        assert client.get("/api/v1/favorites").status_code == 401
        user = _register(client, "fan@example.com")
        other = _register(client, "other-fan@example.com")
        assert client.put("/api/v1/favorites/phong-nha-cave", headers=user).status_code == 200
        assert client.put("/api/v1/favorites/phong-nha-cave", headers=user).status_code == 200
        assert client.put("/api/v1/favorites/vinh-moc-tunnels", headers=user).status_code == 200
        assert client.put("/api/v1/favorites/missing-place", headers=user).status_code == 404

        mine = client.get("/api/v1/favorites", headers=user).json()
        assert mine["total"] == 2
        assert {item["placeId"] for item in mine["items"]} == {"phong-nha-cave", "vinh-moc-tunnels"}
        assert client.get("/api/v1/favorites", headers=other).json()["total"] == 0

        assert client.delete("/api/v1/favorites/phong-nha-cave", headers=user).status_code == 204
        assert client.delete("/api/v1/favorites/phong-nha-cave", headers=user).status_code == 204
        assert [item["placeId"] for item in client.get("/api/v1/favorites", headers=user).json()["items"]] == [
            "vinh-moc-tunnels"
        ]


def _pending_order(client: TestClient, headers: dict[str, str], quantity: int = 2) -> dict:
    response = client.post(
        "/api/v1/tickets/orders",
        headers=headers,
        json={"placeId": "phong-nha-cave", "quantity": quantity},
    )
    assert response.status_code == 201
    return response.json()


def test_qr_payment_page_confirms_order(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _place_lookup(monkeypatch)
    with _gateway(database) as client:
        user = _register(client, "qr-user@example.com")
        admin = _admin(client)
        order = _pending_order(client, user)
        info = client.get(f"/api/v1/tickets/orders/{order['id']}/payment", headers=user)
        assert info.status_code == 200
        code = info.json()["order"]["paymentCode"]
        assert code.startswith("QT")

        # Trang xác nhận mở trên điện thoại không cần đăng nhập nhưng phải có đúng mã của đơn.
        wrong = client.get(f"/api/v1/payments/qr/{order['id']}", params={"code": "QT0000000000"})
        assert wrong.status_code == 404
        assert client.get(f"/api/v1/payments/qr/{order['id']}", params={"code": "bad"}).status_code == 422
        view = client.get(f"/api/v1/payments/qr/{order['id']}", params={"code": code}).json()
        assert view["status"] == "pending" and view["totalPriceVnd"] == order["totalPriceVnd"]
        assert "paymentCode" not in view

        confirm = f"/api/v1/payments/qr/{order['id']}/confirm"
        assert client.post(confirm, json={"code": "QT0000000000"}).status_code == 404
        paid = client.post(confirm, json={"code": code.lower()}).json()
        assert paid["status"] == "paid"
        again = client.post(confirm, json={"code": code})
        assert again.status_code == 200 and again.json()["status"] == "paid"
        latest = client.get(f"/api/v1/tickets/orders/{order['id']}", headers=user).json()
        assert latest["status"] == "paid" and latest["paymentMethod"] == "qr"
        sales = client.get("/api/v1/admin/tickets", headers=admin).json()
        assert sales["totalTicketsSold"] == 2


def test_unpaid_orders_expire_and_cannot_be_paid(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _place_lookup(monkeypatch)
    with _gateway(database) as client:
        user = _register(client, "late@example.com")
        order = _pending_order(client, user)
        code = client.get(f"/api/v1/tickets/orders/{order['id']}/payment", headers=user).json()["order"]["paymentCode"]
        with database.connect() as connection:
            connection.execute(
                "UPDATE ticket_orders SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?",
                order["id"],
            )
        assert client.get(f"/api/v1/tickets/orders/{order['id']}", headers=user).json()["status"] == "expired"
        confirm = client.post(f"/api/v1/payments/qr/{order['id']}/confirm", json={"code": code})
        assert confirm.status_code == 409
        assert client.get(f"/api/v1/tickets/orders/{order['id']}", headers=user).json()["status"] == "expired"


@pytest.mark.parametrize(
    "bad_email",
    [
        "",
        "not-an-email",
        "a@.com",
        "a@b..c",
        "a@b..com",
        "a@b.",
        ".a@b.com",
        "a.@b.com",
        "a..b@c.com",
        "a@-domain.com",
        "a@domain-.com",
        "a@domain.c",
        "a@domain.123",
        "a@dom_ain.com",
        "a@b!c.com",
        "a b@gmail.com",
        "a@b@c.com",
    ],
)
def test_strict_email_validation_rejects_invalid_addresses(
    database: Database,
    bad_email: str,
) -> None:
    with _gateway(database) as client:
        reg = client.post(
            "/api/v1/auth/register",
            json={"fullName": "Bad Email", "email": bad_email, "password": "valid-password"},
        )
        assert reg.status_code == 422

        user = _register(client, "valid-user@example.com")
        upd = client.put(
            "/api/v1/auth/me",
            headers=user,
            json={"fullName": "Valid User", "email": bad_email},
        )
        assert upd.status_code == 422


def test_user_can_update_email_uniquely_and_admin_sees_it(database: Database) -> None:
    with _gateway(database) as client:
        user_a = _register(client, "alice@example.com")
        _register(client, "bob@example.com")
        admin = _admin(client)

        # Trùng email của tài khoản khác -> 409 Conflict.
        duplicate = client.put(
            "/api/v1/auth/me",
            headers=user_a,
            json={"fullName": "Alice", "email": "BOB@example.com"},
        )
        assert duplicate.status_code == 409

        # Đổi sang email hợp lệ mới -> 200 OK và chuẩn hóa chữ thường.
        updated = client.put(
            "/api/v1/auth/me",
            headers=user_a,
            json={
                "fullName": "Alice Nguyen",
                "email": "  Alice.New+tag@Sub.Domain.vn  ",
                "phone": "0901234567",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["email"] == "alice.new+tag@sub.domain.vn"

        # Giữ nguyên email của chính mình hoặc bỏ qua trường email vẫn hợp lệ.
        keep_same = client.put(
            "/api/v1/auth/me",
            headers=user_a,
            json={"fullName": "Alice Nguyen", "email": "alice.new+tag@sub.domain.vn"},
        )
        assert keep_same.status_code == 200
        omit_email = client.put(
            "/api/v1/auth/me",
            headers=user_a,
            json={"fullName": "Alice Updated"},
        )
        assert omit_email.status_code == 200
        assert omit_email.json()["email"] == "alice.new+tag@sub.domain.vn"

        # Danh sách tài khoản bên Admin phản ánh email mới ngay lập tức.
        admin_users = client.get("/api/v1/admin/users", headers=admin).json()["items"]
        emails = {item["email"] for item in admin_users}
        assert "alice.new+tag@sub.domain.vn" in emails
        assert "alice@example.com" not in emails

        # Đăng nhập bằng email cũ thất bại, email mới thành công.
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": "alice@example.com", "password": "valid-password"},
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": "alice.new+tag@sub.domain.vn", "password": "valid-password"},
            ).status_code
            == 200
        )
