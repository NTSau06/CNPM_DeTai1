"""Kiểm thử API và nghiệp vụ backend mà không cần service bên ngoài."""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api_gateway.api import _distance_meters
from api_gateway.auth import AuthRepository
from api_gateway.main import create_app as create_gateway_app
from services.analytics_service.main import create_app as create_analytics_app
from services.common.database import Database
from services.common.errors import PlaceValidationError
from services.common.schemas import Place, Tour, TourCreate
from services.narration_service.application import NarrationReader
from services.poi_service.main import create_app as create_poi_app
from services.poi_service.repository import PlaceRepository
from services.tour_service.application import TourPlanner
from services.tour_service.repository import TourRepository

SEED = Path(__file__).parents[1] / "services" / "poi_service" / "data" / "places.json"


def test_auth_repository_migrates_existing_accounts_for_admin_role(
    database: Database,
) -> None:
    database.ensure_exists()
    with database.connect() as connection:
        connection.execute(
            """
            CREATE TABLE dbo.users (
                id NVARCHAR(64) NOT NULL PRIMARY KEY,
                full_name NVARCHAR(200) NOT NULL,
                email NVARCHAR(320) NOT NULL UNIQUE,
                phone NVARCHAR(50) NOT NULL,
                password_salt VARBINARY(64) NOT NULL,
                password_hash VARBINARY(128) NOT NULL
            )
            """
        )

    AuthRepository(database).initialize()

    with database.connect() as connection:
        admin_column = connection.execute(
            "SELECT COL_LENGTH(N'dbo.users', N'is_admin')"
        ).fetchone()[0]
    assert admin_column is not None


def test_poi_api_returns_all_seven_locales(database: Database) -> None:
    app = create_poi_app(database, SEED)
    with TestClient(app) as client:
        response = client.get("/internal/v1/places")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 14
    assert all(item["id"] != "truong-son-cemetery" for item in payload["items"])
    assert {"dark-cave", "tien-son-cave", "ozo-park"} <= {
        item["id"] for item in payload["items"]
    }
    assert set(payload["items"][0]["copy"]) == {
        "vi",
        "en",
        "ja",
        "fr",
        "zh-CN",
        "ko-KR",
        "es",
    }


def test_poi_repository_preserves_admin_changes_across_restarts(database: Database) -> None:
    repository = PlaceRepository(database, SEED)
    repository.initialize()
    place = repository.get("phong-nha-cave")
    assert place is not None
    vietnamese_copy = place.localized_copy["vi"].model_copy(
        update={"title": "Tiêu đề do quản trị cập nhật"}
    )
    place.localized_copy["vi"] = vietnamese_copy
    repository.save(place)
    assert repository.delete("tien-son-cave")

    repository.initialize()

    updated_place = repository.get("phong-nha-cave")
    assert updated_place is not None
    assert updated_place.localized_copy["vi"].title == "Tiêu đề do quản trị cập nhật"
    assert repository.get("tien-son-cave") is None


def test_poi_admin_api_creates_updates_and_deletes_places(database: Database) -> None:
    app = create_poi_app(database, SEED)
    with TestClient(app) as client:
        original = client.get("/internal/v1/places/phong-nha-cave").json()
        original["id"] = "test-admin-place"
        created = client.post("/internal/v1/admin/places", json=original)
        assert created.status_code == 201

        updated_place = {**original, "duration": 12}
        updated = client.put("/internal/v1/admin/places/test-admin-place", json=updated_place)
        deleted = client.delete("/internal/v1/admin/places/test-admin-place")
        missing = client.get("/internal/v1/places/test-admin-place")

    assert updated.status_code == 200
    assert updated.json()["duration"] == 12
    assert deleted.status_code == 204
    assert missing.status_code == 404


def test_poi_repository_keeps_at_least_one_place(database: Database) -> None:
    repository = PlaceRepository(database, SEED)
    repository.initialize()
    with repository.database.connect() as connection:
        connection.execute("DELETE FROM places WHERE id != 'phong-nha-cave'")

    assert not repository.delete("phong-nha-cave")
    assert repository.get("phong-nha-cave") is not None


def test_poi_api_filters_catalog(database: Database) -> None:
    app = create_poi_app(database, SEED)
    with TestClient(app) as client:
        response = client.get("/internal/v1/places?category=landmark")
    assert response.status_code == 200
    assert all(item["category"] == "landmark" for item in response.json()["items"])


class FakePlaceResolver:
    def __init__(self, places: list[Place]) -> None:
        self.places = places

    async def resolve(self, place_ids: list[str]) -> list[Place]:
        return [place for place in self.places if place.id in place_ids]


def test_tour_service_validates_stops_and_persists_distance(database: Database) -> None:
    repository = PlaceRepository(database, SEED)
    repository.initialize()
    first = repository.get("phong-nha-cave")
    second = repository.get("thien-duong-cave")
    assert first is not None and second is not None
    planner = TourPlanner(
        TourRepository(database),
        FakePlaceResolver([first, second]),
    )
    planner.repository.initialize()
    tour = asyncio.run(planner.create_tour(TourCreate(placeIds=[first.id, second.id])))
    assert tour.distance_km > 0
    assert tour.duration_minutes == first.duration + second.duration
    assert planner.list_tours().total == 1
    assert planner.delete_tour(tour.id)


def test_tour_service_rejects_unknown_stop(database: Database) -> None:
    planner = TourPlanner(
        TourRepository(database),
        FakePlaceResolver([]),
    )
    planner.repository.initialize()
    with pytest.raises(PlaceValidationError):
        asyncio.run(planner.create_tour(TourCreate(placeIds=["not-a-place"])))


def test_tour_repository_scopes_saved_tours_to_their_owner(database: Database) -> None:
    repository = TourRepository(database)
    repository.initialize()
    first = Tour(
        id="tour-a",
        placeIds=["phong-nha-cave"],
        createdAt=1,
        distanceKm=0,
        durationMinutes=4,
    )
    repository.save(first, "account-a")
    assert repository.list("account-a") == [first]
    assert repository.list("account-b") == []
    with pytest.raises(ValueError):
        repository.save(first, "account-b")
    assert not repository.delete(first.id, "account-b")
    assert repository.delete(first.id, "account-a")


class RepositoryPlaceReader:
    def __init__(self, repository: PlaceRepository) -> None:
        self.repository = repository

    async def get_place(self, place_id: str) -> Place | None:
        return self.repository.get(place_id)


def test_narration_service_selects_requested_locale(database: Database) -> None:
    repository = PlaceRepository(database, SEED)
    repository.initialize()
    narration = asyncio.run(
        NarrationReader(RepositoryPlaceReader(repository)).get_narration(
            "phong-nha-cave", "ja"
        )
    )
    assert narration.locale == "ja"
    assert narration.speech_locale == "ja-JP"
    assert narration.text


def test_analytics_counts_visits_and_ratings_per_place(database: Database) -> None:
    app = create_analytics_app(database)
    visitor_id = "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"
    with TestClient(app) as client:
        first_visit = client.post(
            "/internal/v1/analytics/visits",
            json={"placeId": "phong-nha-cave", "visitorId": visitor_id},
        )
        duplicate_visit = client.post(
            "/internal/v1/analytics/visits",
            json={"placeId": "phong-nha-cave", "visitorId": visitor_id},
        )
        rating = client.post(
            "/internal/v1/analytics/ratings",
            json={
                "placeId": "phong-nha-cave",
                "visitorId": visitor_id,
                "rating": 5,
                "review": "Cảnh đẹp",
            },
        )
        client.post(
            "/internal/v1/analytics/ratings",
            json={
                "placeId": "phong-nha-cave",
                "visitorId": visitor_id,
                "rating": 4,
                "review": "Cập nhật đánh giá",
            },
        )
        analytics = client.get("/internal/v1/analytics/places/phong-nha-cave")

    assert first_visit.status_code == 201
    assert first_visit.json() == {"recorded": True}
    assert duplicate_visit.json() == {"recorded": False}
    assert rating.status_code == 201
    assert analytics.status_code == 200
    assert analytics.json() == {
        "placeId": "phong-nha-cave",
        "visits": 1,
        "averageRating": 4.0,
        "ratingCount": 1,
    }


def test_analytics_admin_summary_aggregates_visits_ratings_and_reviews(
    database: Database,
) -> None:
    app = create_analytics_app(database)
    visitor_ids = [
        "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d",
        "2c7b7a37-1bb4-4f40-b241-54e39ef45e37",
    ]
    with TestClient(app) as client:
        for visitor_id, rating in zip(visitor_ids, (5, 4), strict=True):
            client.post(
                "/internal/v1/analytics/visits",
                json={"placeId": "phong-nha-cave", "visitorId": visitor_id},
            )
            client.post(
                "/internal/v1/analytics/ratings",
                json={
                    "placeId": "phong-nha-cave",
                    "visitorId": visitor_id,
                    "rating": rating,
                    "review": f"Nhận xét {rating}",
                },
            )
        response = client.get("/internal/v1/analytics/admin/summary")

    assert response.status_code == 200
    summary = response.json()
    assert summary["visitsLast30Days"] == 2
    assert summary["totalRatings"] == 2
    assert summary["averageRating"] == 4.5
    assert summary["places"] == [
        {
            "placeId": "phong-nha-cave",
            "visits": 2,
            "averageRating": 4.5,
            "ratingCount": 2,
        }
    ]
    assert len(summary["latestReviews"]) == 2


def test_analytics_tracks_unique_online_visitors_and_drops_inactive_ones(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = create_analytics_app(database)
    monkeypatch.setattr("services.analytics_service.repository.time.time", lambda: 1000)
    with TestClient(app) as client:
        first = client.post(
            "/internal/v1/analytics/presence",
            json={"visitorId": "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"},
        )
        client.post(
            "/internal/v1/analytics/presence",
            json={"visitorId": "a2f928ee-338f-4f0c-91b1-30e8d9db22cf"},
        )
        duplicate = client.post(
            "/internal/v1/analytics/presence",
            json={"visitorId": "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"},
        )
        count = client.get("/internal/v1/analytics/presence")
        monkeypatch.setattr("services.analytics_service.repository.time.time", lambda: 1031)
        expired_count = client.get("/internal/v1/analytics/presence")

    assert first.status_code == duplicate.status_code == 204
    assert count.json() == {"onlineVisitors": 2}
    assert expired_count.json() == {"onlineVisitors": 0}


def test_analytics_presence_drops_immediately_when_visitor_leaves(
    database: Database,
) -> None:
    app = create_analytics_app(database)
    first_id = "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"
    second_id = "a2f928ee-338f-4f0c-91b1-30e8d9db22cf"
    with TestClient(app) as client:
        client.post("/internal/v1/analytics/presence", json={"visitorId": first_id})
        client.post("/internal/v1/analytics/presence", json={"visitorId": second_id})
        both = client.get("/internal/v1/analytics/presence").json()
        left = client.post("/internal/v1/analytics/presence/leave", json={"visitorId": second_id})
        remaining = client.get("/internal/v1/analytics/presence").json()
        client.post("/internal/v1/analytics/presence", json={"visitorId": second_id})
        rejoined = client.get("/internal/v1/analytics/presence").json()

    assert both == {"onlineVisitors": 2}
    assert left.status_code == 204
    assert remaining == {"onlineVisitors": 1}
    assert rejoined == {"onlineVisitors": 2}


def test_visit_distance_uses_meters() -> None:
    assert _distance_meters(0, 0, 0, 0) == 0
    assert 80 < _distance_meters(0, 0, 0.0008, 0) < 90


def test_gateway_exposes_place_analytics_and_validates_visit_location(
    database: Database,
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
        if base_url == "poi":
            return {"coordinates": [0, 0]}
        if path.endswith("/analytics/places/phong-nha-cave"):
            return {
                "placeId": "phong-nha-cave",
                "visits": 3,
                "averageRating": 4.5,
                "ratingCount": 2,
            }
        return {"recorded": True}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        database,
    )
    with TestClient(app) as client:
        analytics = client.get("/api/v1/places/phong-nha-cave/analytics")
        assert client.get("/api/v1/analytics/admin/dashboard").status_code == 404
        assert client.post("/api/v1/analytics/admin/login").status_code == 404
        accepted_visit = client.post(
            "/api/v1/analytics/visits",
            json={
                "placeId": "phong-nha-cave",
                "visitorId": "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d",
                "coordinates": [0, 0],
            },
        )
        distant_visit = client.post(
            "/api/v1/analytics/visits",
            json={
                "placeId": "phong-nha-cave",
                "visitorId": "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d",
                "coordinates": [0.001, 0],
            },
        )

    assert analytics.status_code == 200
    assert analytics.json()["visits"] == 3
    assert accepted_visit.status_code == 201
    assert distant_visit.status_code == 422


def test_gateway_presence_is_public_but_dashboard_requires_admin(
    database: Database,
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
        return {"onlineVisitors": 4}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        database,
    )
    with TestClient(app) as client:
        public_count = client.get("/api/v1/analytics/presence")
        heartbeat = client.post(
            "/api/v1/analytics/presence",
            json={"visitorId": "fb0bbd7e-926c-4e38-a9cb-ec57a66e314d"},
        )
        regular_account = client.post(
            "/api/v1/auth/register",
            json={"fullName": "User", "email": "user@example.com", "password": "valid-password"},
        )
        admin_account = client.post(
            "/api/v1/auth/register",
            json={"fullName": "Admin", "email": "admin@example.com", "password": "valid-password"},
        )
        with database.connect() as connection:
            connection.execute(
                "UPDATE users SET is_admin = 1 WHERE id = ?",
                (admin_account.json()["user"]["id"],),
            )
        no_auth = client.get("/api/v1/admin/analytics/online")
        regular_user = client.get(
            "/api/v1/admin/analytics/online",
            headers={"Authorization": f"Bearer {regular_account.json()['token']}"},
        )
        admin_user = client.get(
            "/api/v1/admin/analytics/online",
            headers={"Authorization": f"Bearer {admin_account.json()['token']}"},
        )

    assert public_count.json() == {"onlineVisitors": 4}
    assert heartbeat.status_code == 204
    assert no_auth.status_code == 401
    assert regular_user.status_code == 403
    assert admin_user.status_code == 200
    assert admin_user.json() == {"onlineVisitors": 4}


def test_admin_overview_and_user_management_require_admin(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    forwarded: list[tuple[str, str]] = []

    async def fake_request_service(
        base_url: str,
        method: str,
        path: str,
        *,
        params: dict[str, str | None] | None = None,
        json: dict | None = None,
    ) -> dict:
        forwarded.append((method, path))
        if path == "/internal/v1/places":
            return {"items": [{"id": "one"}], "total": 1}
        if path.endswith("/analytics/admin/summary"):
            return {
                "visitsLast30Days": 7,
                "totalRatings": 2,
                "averageRating": 4.0,
                "places": [{"placeId": "one", "visits": 7, "averageRating": 4.0, "ratingCount": 2}],
                "latestReviews": [],
            }
        if path.endswith("/analytics/places/one"):
            return {"placeId": "one", "visits": 7, "averageRating": 4.0, "ratingCount": 2}
        if path.endswith("/analytics/presence"):
            return {"onlineVisitors": 3}
        return {}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {"poi": "poi", "tour": "tour", "narration": "narration", "analytics": "analytics"},
        database,
    )
    with TestClient(app) as client:
        admin = client.post(
            "/api/v1/auth/register",
            json={"fullName": "Admin", "email": "admin@example.com", "password": "valid-password"},
        ).json()
        user = client.post(
            "/api/v1/auth/register",
            json={"fullName": "User", "email": "user@example.com", "password": "valid-password"},
        ).json()
        with database.connect() as connection:
            connection.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (admin["user"]["id"],))

        assert client.get("/api/v1/admin/users").status_code == 401
        headers = {"Authorization": f"Bearer {admin['token']}"}
        overview = client.get("/api/v1/admin/overview", headers=headers)
        users = client.get("/api/v1/admin/users", headers=headers)
        deleted = client.delete(f"/api/v1/admin/users/{user['user']['id']}", headers=headers)

    assert overview.status_code == 200
    overview_data = overview.json()
    assert overview_data["onlineVisitors"] == 3
    assert overview_data["placeCount"] == 1
    assert overview_data["visits"] == 7
    assert overview_data["ratingCount"] == 2
    assert overview_data["accountCount"] == 1
    assert overview_data["activeAccountCount"] == 1
    assert "tickets" in overview_data
    assert users.status_code == 200
    assert users.json()["total"] == 2
    assert deleted.status_code == 204
    assert ("DELETE", f"/internal/v1/admin/tours/owner/{user['user']['id']}") in forwarded


def test_gateway_place_management_requires_admin_and_forwards_changes(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    forwarded: list[tuple[str, str, dict | None]] = []

    async def fake_request_service(
        base_url: str,
        method: str,
        path: str,
        *,
        params: dict[str, str | None] | None = None,
        json: dict | None = None,
    ) -> dict:
        forwarded.append((method, path, json))
        return json or {}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {"poi": "poi", "tour": "tour", "narration": "narration", "analytics": "analytics"},
        database,
    )
    place = {
        "id": "admin-created-place",
        "category": "landmark",
        "coordinates": [106.0, 17.0],
        "duration": 8,
        "image": "cave",
        "copy": {"vi": {"title": "Điểm mới", "subtitle": "", "narration": "Nội dung"}},
        "detailSections": [{"heading": "Lưu ý", "body": "Đi theo lối tham quan."}],
        "detailImage": {"src": "https://example.com/place.jpg", "alt": "Ảnh địa điểm", "caption": "Ảnh"},
    }
    with TestClient(app) as client:
        account = client.post(
            "/api/v1/auth/register",
            json={"fullName": "Admin", "email": "admin@example.com", "password": "valid-password"},
        ).json()
        with database.connect() as connection:
            connection.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (account["user"]["id"],))
        headers = {"Authorization": f"Bearer {account['token']}"}
        unauthorized = client.post("/api/v1/admin/places", json=place)
        created = client.post("/api/v1/admin/places", headers=headers, json=place)
        updated = client.put(
            "/api/v1/admin/places/admin-created-place",
            headers=headers,
            json={**place, "duration": 10},
        )
        deleted = client.delete("/api/v1/admin/places/admin-created-place", headers=headers)

    assert unauthorized.status_code == 401
    assert created.status_code == 201
    assert updated.status_code == 200
    assert deleted.status_code == 204
    assert [item[0] for item in forwarded] == ["POST", "PUT", "DELETE"]


def test_gateway_requires_accounts_and_scopes_tours(
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    forwarded: list[dict] = []

    async def fake_request_service(
        base_url: str,
        method: str,
        path: str,
        *,
        params: dict[str, str | None] | None = None,
        json: dict | None = None,
    ) -> dict:
        forwarded.append({"baseUrl": base_url, "method": method, "path": path, "params": params, "json": json})
        if method == "POST":
            return {
                "id": json.get("id", "created-tour"),
                "placeIds": json["placeIds"],
                "createdAt": json.get("createdAt", 1),
                "distanceKm": 1.2,
                "durationMinutes": 6,
            }
        if method == "DELETE":
            return {}
        return {"items": [], "total": 0}

    monkeypatch.setattr("api_gateway.api.request_service", fake_request_service)
    app = create_gateway_app(
        {
            "poi": "poi",
            "tour": "tour",
            "narration": "narration",
            "analytics": "analytics",
        },
        database,
    )
    with TestClient(app) as client:
        first = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Account A",
                "email": "a@example.com",
                "password": "valid-password",
            },
        )
        second = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Account B",
                "email": "b@example.com",
                "password": "valid-password",
            },
        )
        assert first.status_code == 201
        assert second.status_code == 201
        first_token = first.json()["token"]
        first_id = first.json()["user"]["id"]
        second_token = second.json()["token"]
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "A@EXAMPLE.COM", "password": "valid-password"},
        )
        assert login.status_code == 200
        assert login.json()["user"]["id"] == first_id
        assert client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {first_token}"},
        ).json()["email"] == "a@example.com"
        assert client.post(
            "/api/v1/auth/login",
            json={"email": "a@example.com", "password": "wrong-password"},
        ).status_code == 401

        assert client.get("/api/v1/tours").status_code == 401
        first_tours = client.get(
            "/api/v1/tours", headers={"Authorization": f"Bearer {first_token}"}
        )
        second_tours = client.get(
            "/api/v1/tours", headers={"Authorization": f"Bearer {second_token}"}
        )
        assert first_tours.status_code == second_tours.status_code == 200
        assert forwarded[-2]["params"] == {"userId": first_id}
        assert forwarded[-1]["params"] == {"userId": second.json()["user"]["id"]}

        created = client.post(
            "/api/v1/tours",
            headers={"Authorization": f"Bearer {first_token}"},
            json={"placeIds": ["phong-nha-cave"]},
        )
        assert created.status_code == 201
        assert forwarded[-1]["json"]["ownerId"] == first_id

        duplicate = client.post(
            "/api/v1/auth/register",
            json={
                "fullName": "Duplicate",
                "email": "A@example.com",
                "password": "valid-password",
            },
        )
        assert duplicate.status_code == 409
        logged_out = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {first_token}"},
        )
        assert logged_out.status_code == 204
        assert client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {first_token}"},
        ).status_code == 401


def test_profile_persists_and_password_can_be_changed(database: Database) -> None:
    app = create_gateway_app(
        {"poi": "poi", "tour": "tour", "narration": "narration", "analytics": "analytics"},
        database,
    )
    with TestClient(app) as client:
        registered = client.post(
            "/api/v1/auth/register",
            json={"fullName": "An", "email": "an@example.com", "password": "old-password"},
        ).json()
        headers = {"Authorization": f"Bearer {registered['token']}"}

        assert client.put("/api/v1/auth/me", json={"fullName": "An"}).status_code == 401
        updated = client.put(
            "/api/v1/auth/me",
            headers=headers,
            json={
                "fullName": "Nguyen An",
                "phone": "0900000000",
                "birthDate": "2000-01-31",
                "gender": "female",
                "address": "Quang Tri",
            },
        )
        assert updated.status_code == 200
        profile = client.get("/api/v1/auth/me", headers=headers).json()
        assert profile["fullName"] == "Nguyen An"
        assert profile["birthDate"] == "2000-01-31"
        assert profile["gender"] == "female"
        assert profile["address"] == "Quang Tri"
        assert client.put(
            "/api/v1/auth/me",
            headers=headers,
            json={"fullName": "An", "birthDate": "31/01/2000"},
        ).status_code == 422

        wrong = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={"currentPassword": "bad-password", "newPassword": "new-password"},
        )
        assert wrong.status_code == 403
        same = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={"currentPassword": "old-password", "newPassword": "old-password"},
        )
        assert same.status_code == 422
        changed = client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={"currentPassword": "old-password", "newPassword": "new-password"},
        )
        assert changed.status_code == 200
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
        new_headers = {"Authorization": f"Bearer {changed.json()['token']}"}
        assert client.get("/api/v1/auth/me", headers=new_headers).status_code == 200
        assert client.post(
            "/api/v1/auth/login", json={"email": "an@example.com", "password": "old-password"}
        ).status_code == 401
        assert client.post(
            "/api/v1/auth/login", json={"email": "an@example.com", "password": "new-password"}
        ).status_code == 200
