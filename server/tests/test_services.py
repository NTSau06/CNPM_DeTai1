"""Kiểm thử API và nghiệp vụ backend mà không cần service bên ngoài."""
from __future__ import annotations

import asyncio
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api_gateway.api import _distance_meters
from api_gateway.main import create_app as create_gateway_app
from services.analytics_service.main import create_app as create_analytics_app
from services.common.errors import PlaceValidationError
from services.common.schemas import Place, Tour, TourCreate
from services.narration_service.application import NarrationReader
from services.poi_service.main import create_app as create_poi_app
from services.poi_service.repository import PlaceRepository
from services.tour_service.application import TourPlanner
from services.tour_service.repository import TourRepository

SEED = Path(__file__).parents[1] / "services" / "poi_service" / "data" / "places.json"


def test_poi_api_returns_all_seven_locales(tmp_path: Path) -> None:
    app = create_poi_app(tmp_path / "poi.sqlite", SEED)
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


def test_poi_repository_removes_places_missing_from_seed(tmp_path: Path) -> None:
    repository = PlaceRepository(tmp_path / "poi.sqlite", SEED)
    repository.initialize()
    with sqlite3.connect(repository.database_path) as connection:
        connection.execute(
            """
            INSERT INTO places (id, category, content_json)
            SELECT 'truong-son-cemetery', category, content_json
            FROM places WHERE id = 'phong-nha-cave'
            """
        )

    repository.initialize()

    assert "truong-son-cemetery" not in {place.id for place in repository.list()}


def test_poi_api_filters_catalog(tmp_path: Path) -> None:
    app = create_poi_app(tmp_path / "poi.sqlite", SEED)
    with TestClient(app) as client:
        response = client.get("/internal/v1/places?category=landmark")
    assert response.status_code == 200
    assert all(item["category"] == "landmark" for item in response.json()["items"])


class FakePlaceResolver:
    def __init__(self, places: list[Place]) -> None:
        self.places = places

    async def resolve(self, place_ids: list[str]) -> list[Place]:
        return [place for place in self.places if place.id in place_ids]


def test_tour_service_validates_stops_and_persists_distance(tmp_path: Path) -> None:
    repository = PlaceRepository(tmp_path / "poi.sqlite", SEED)
    repository.initialize()
    first = repository.get("phong-nha-cave")
    second = repository.get("thien-duong-cave")
    assert first is not None and second is not None
    planner = TourPlanner(
        TourRepository(tmp_path / "tours.sqlite"),
        FakePlaceResolver([first, second]),
    )
    planner.repository.initialize()
    tour = asyncio.run(planner.create_tour(TourCreate(placeIds=[first.id, second.id])))
    assert tour.distance_km > 0
    assert tour.duration_minutes == first.duration + second.duration
    assert planner.list_tours().total == 1
    assert planner.delete_tour(tour.id)


def test_tour_service_rejects_unknown_stop(tmp_path: Path) -> None:
    planner = TourPlanner(
        TourRepository(tmp_path / "tours.sqlite"),
        FakePlaceResolver([]),
    )
    planner.repository.initialize()
    with pytest.raises(PlaceValidationError):
        asyncio.run(planner.create_tour(TourCreate(placeIds=["not-a-place"])))


def test_tour_repository_scopes_saved_tours_to_their_owner(tmp_path: Path) -> None:
    repository = TourRepository(tmp_path / "tours.sqlite")
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


def test_narration_service_selects_requested_locale(tmp_path: Path) -> None:
    repository = PlaceRepository(tmp_path / "poi.sqlite", SEED)
    repository.initialize()
    narration = asyncio.run(
        NarrationReader(RepositoryPlaceReader(repository)).get_narration(
            "phong-nha-cave", "ja"
        )
    )
    assert narration.locale == "ja"
    assert narration.speech_locale == "ja-JP"
    assert narration.text


def test_analytics_counts_visits_and_ratings_per_place(tmp_path: Path) -> None:
    app = create_analytics_app(tmp_path / "analytics.sqlite")
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


def test_visit_distance_uses_meters() -> None:
    assert _distance_meters(0, 0, 0, 0) == 0
    assert 80 < _distance_meters(0, 0, 0.0008, 0) < 90


def test_gateway_exposes_place_analytics_and_validates_visit_location(
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
        tmp_path / "accounts.sqlite",
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


def test_gateway_requires_accounts_and_scopes_tours(
    tmp_path: Path,
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
        tmp_path / "accounts.sqlite",
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
