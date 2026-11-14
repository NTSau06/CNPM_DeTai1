"""Kiểm thử ghép nối máy tính - điện thoại bằng mã QR."""
from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from api_gateway.main import create_app as create_gateway_app
from services.common.database import Database


@pytest.fixture
def client(database: Database) -> Iterator[TestClient]:
    app = create_gateway_app(
        {"poi": "poi", "tour": "tour", "narration": "narration", "analytics": "analytics"},
        database,
        admin_email="",
        admin_password="",
    )
    with TestClient(app) as test_client:
        yield test_client


def _register(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"fullName": "Desk User", "email": "desk@example.com", "password": "valid-password"},
    )
    assert response.status_code == 201
    return response.json()["token"]


def test_guest_pairing_is_claimed_once_and_reports_status(client: TestClient) -> None:
    created = client.post(
        "/api/v1/pairing",
        json={"language": "ja", "placeId": "phong-nha-cave", "path": "/explore"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["signedIn"] is False
    assert body["expiresIn"] == 180
    code = body["code"]
    assert len(code) >= 24

    assert client.get(f"/api/v1/pairing/{code}").json()["status"] == "pending"

    claimed = client.post(f"/api/v1/pairing/{code}/claim")
    assert claimed.status_code == 200
    assert claimed.json() == {
        "language": "ja",
        "placeId": "phong-nha-cave",
        "path": "/explore",
        "token": None,
        "user": None,
    }
    assert client.get(f"/api/v1/pairing/{code}").json()["status"] == "claimed"
    assert client.post(f"/api/v1/pairing/{code}/claim").status_code == 410


def test_signed_in_pairing_issues_a_separate_phone_session(client: TestClient) -> None:
    desktop_token = _register(client)
    created = client.post(
        "/api/v1/pairing",
        json={"language": "vi"},
        headers={"Authorization": f"Bearer {desktop_token}"},
    )
    assert created.json()["signedIn"] is True

    claimed = client.post(f"/api/v1/pairing/{created.json()['code']}/claim").json()
    phone_token = claimed["token"]
    assert phone_token and phone_token != desktop_token
    assert claimed["user"]["email"] == "desk@example.com"
    assert claimed["path"] == "/explore"

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {phone_token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "desk@example.com"


def test_invalid_desktop_token_creates_guest_pairing(client: TestClient) -> None:
    created = client.post(
        "/api/v1/pairing",
        json={"language": "en"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert created.status_code == 201
    assert created.json()["signedIn"] is False


def test_expired_pairing_cannot_be_claimed(client: TestClient, database: Database) -> None:
    code = client.post("/api/v1/pairing", json={"language": "vi"}).json()["code"]
    with database.connect() as connection:
        connection.execute("UPDATE device_pairings SET expires_at = 0")

    assert client.get(f"/api/v1/pairing/{code}").json()["status"] == "expired"
    assert client.post(f"/api/v1/pairing/{code}/claim").status_code == 410


def test_unknown_pairing_code_is_rejected(client: TestClient) -> None:
    assert client.get("/api/v1/pairing/unknown-code").status_code == 404
    assert client.post("/api/v1/pairing/unknown-code/claim").status_code == 410


@pytest.mark.parametrize(
    "path",
    ["https://evil.example.com", "//evil.example.com", "explore", "/\\evil.example.com"],
)
def test_pairing_rejects_external_paths(client: TestClient, path: str) -> None:
    response = client.post("/api/v1/pairing", json={"language": "vi", "path": path})
    assert response.status_code == 422
