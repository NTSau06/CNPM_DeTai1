"""Kiểm thử các chức năng bổ sung: hủy vé, đánh giá theo tài khoản, kiểm duyệt
đánh giá, giới hạn đăng nhập sai, khóa và tự xóa tài khoản, lọc thống kê."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api_gateway.main import create_app as create_gateway_app
from api_gateway.payments import (
    PaymentSettings,
    build_vnpay_url,
    verify_vnpay_params,
    vnpay_signature,
)
from api_gateway.rate_limit import LoginRateLimiter
from services.analytics_service.main import create_app as create_analytics_app
from services.common.database import Database

SERVICE_URLS = {
    "poi": "poi",
    "tour": "tour",
    "narration": "narration",
    "analytics": "analytics",
}


VNPAY_SETTINGS = PaymentSettings(
    mock_enabled=True,
    vnpay_tmn_code="TESTCODE",
    vnpay_hash_secret="TESTSECRET",
    public_api_url="http://gateway.test/api/v1",
    frontend_url="http://web.test",
)


def _gateway(database: Database, payments: PaymentSettings | None = None) -> TestClient:
    app = create_gateway_app(
        SERVICE_URLS,
        database,
        admin_email="admin@example.com",
        admin_password="long-admin-password",
        payment_settings=payments or PaymentSettings(),
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


def test_mock_payment_flow_marks_order_paid_once(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _place_lookup(monkeypatch)
    with _gateway(database) as client:
        assert client.get("/api/v1/payments/methods").json() == {"methods": ["mock"]}
        user = _register(client, "payer@example.com")
        other = _register(client, "not-payer@example.com")
        admin = _admin(client)
        order = _pending_order(client, user)
        assert order["status"] == "pending" and order["expiresAt"]

        pay = f"/api/v1/tickets/orders/{order['id']}/pay"
        assert client.post(pay, headers=user, json={"method": "vnpay"}).status_code == 422
        assert client.post(pay, headers=other, json={"method": "mock"}).status_code == 404
        started = client.post(pay, headers=user, json={"method": "mock"}).json()
        assert started["external"] is False

        mock = f"/api/v1/tickets/orders/{order['id']}/mock-payment"
        declined = client.post(mock, headers=user, json={"success": False}).json()
        assert declined["status"] == "pending"
        paid = client.post(mock, headers=user, json={"success": True}).json()
        assert paid["status"] == "paid" and paid["paymentRef"].startswith("MOCK-")
        assert client.post(mock, headers=user, json={"success": True}).status_code == 409
        assert client.post(pay, headers=user, json={"method": "mock"}).status_code == 409

        sales = client.get("/api/v1/admin/tickets", headers=admin).json()
        assert sales["totalTicketsSold"] == 2
        assert sales["pendingOrders"] == 0


def test_unpaid_orders_expire_and_cannot_be_paid(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _place_lookup(monkeypatch)
    with _gateway(database) as client:
        user = _register(client, "late@example.com")
        order = _pending_order(client, user)
        with database.connect() as connection:
            connection.execute(
                "UPDATE ticket_orders SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?",
                order["id"],
            )
        assert client.get(f"/api/v1/tickets/orders/{order['id']}", headers=user).json()["status"] == "expired"
        assert client.post(
            f"/api/v1/tickets/orders/{order['id']}/pay", headers=user, json={"method": "mock"}
        ).status_code == 409


def test_vnpay_signature_round_trip_and_tampering() -> None:
    url = build_vnpay_url(
        VNPAY_SETTINGS,
        order_id="abc123",
        amount_vnd=150_000,
        client_ip="1.2.3.4",
        order_info="Thanh toan ve QT-ABC",
    )
    assert url.startswith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?")
    from urllib.parse import parse_qsl, urlsplit

    params = dict(parse_qsl(urlsplit(url).query))
    assert params["vnp_Amount"] == "15000000"
    assert params["vnp_ReturnUrl"] == "http://gateway.test/api/v1/payments/vnpay/return"
    assert verify_vnpay_params(VNPAY_SETTINGS, params)
    assert not verify_vnpay_params(VNPAY_SETTINGS, {**params, "vnp_Amount": "100"})
    assert not verify_vnpay_params(PaymentSettings(), params)


def _signed(params: dict[str, str]) -> dict[str, str]:
    return {**params, "vnp_SecureHash": vnpay_signature(params, VNPAY_SETTINGS.vnpay_hash_secret)}


def test_vnpay_ipn_and_return_confirm_payment(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _place_lookup(monkeypatch)
    with _gateway(database, VNPAY_SETTINGS) as client:
        assert client.get("/api/v1/payments/methods").json() == {"methods": ["mock", "vnpay"]}
        user = _register(client, "vnpay@example.com")
        order = _pending_order(client, user)
        started = client.post(
            f"/api/v1/tickets/orders/{order['id']}/pay", headers=user, json={"method": "vnpay"}
        ).json()
        assert started["external"] is True and "vnp_SecureHash=" in started["redirectUrl"]

        base = {
            "vnp_TxnRef": order["id"],
            "vnp_Amount": str(order["totalPriceVnd"] * 100),
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_TransactionNo": "14123456",
        }
        assert client.get("/api/v1/payments/vnpay/ipn", params={**base, "vnp_SecureHash": "bad"}).json()["RspCode"] == "97"
        assert client.get(
            "/api/v1/payments/vnpay/ipn", params=_signed({**base, "vnp_Amount": "100"})
        ).json()["RspCode"] == "04"
        assert client.get(
            "/api/v1/payments/vnpay/ipn", params=_signed({**base, "vnp_TxnRef": "missing"})
        ).json()["RspCode"] == "01"
        assert client.get("/api/v1/payments/vnpay/ipn", params=_signed(base)).json()["RspCode"] == "00"
        assert client.get("/api/v1/payments/vnpay/ipn", params=_signed(base)).json()["RspCode"] == "02"

        returned = client.get(
            "/api/v1/payments/vnpay/return", params=_signed(base), follow_redirects=False
        )
        assert returned.status_code == 302
        assert returned.headers["location"] == f"http://web.test/tickets?payment=success&order={order['id']}"
        paid = client.get(f"/api/v1/tickets/orders/{order['id']}", headers=user).json()
        assert paid["status"] == "paid" and paid["paymentRef"] == "14123456"
