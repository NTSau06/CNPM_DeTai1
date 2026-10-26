"""Kiểm tra tích hợp API qua Gateway khi các service đang chạy."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")


def request(
    path: str,
    method: str = "GET",
    payload: dict | None = None,
    token: str | None = None,
) -> tuple[int, dict | None]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request_message = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request_message, timeout=10) as response:
            body = response.read()
            return response.status, json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        body = error.read()
        return error.code, json.loads(body) if body else None


def main() -> None:
    status, places = request("/places")
    assert status == 200 and places is not None and places["total"] == 14
    assert set(places["items"][0]["copy"]) == {
        "vi",
        "en",
        "ja",
        "fr",
        "zh-CN",
        "ko-KR",
        "es",
    }

    status, narration = request("/narrations/phong-nha-cave?locale=ja")
    assert status == 200 and narration is not None
    assert narration["locale"] == "ja" and narration["speechLocale"] == "ja-JP"

    email = f"smoke-{uuid.uuid4()}@example.com"
    status, account = request(
        "/auth/register",
        "POST",
        {"fullName": "Smoke Test", "email": email, "password": "Smoke-test-123"},
    )
    assert status == 201 and account is not None
    token = account["token"]
    status, _ = request("/tours")
    assert status == 401
    tour_id = str(uuid.uuid4())
    status, tour = request(
        "/tours",
        "POST",
        {
            "id": tour_id,
            "createdAt": 1_800_000_000_000,
            "placeIds": ["phong-nha-cave", "thien-duong-cave"],
        },
        token,
    )
    assert status == 201 and tour is not None
    assert tour["id"] == tour_id and tour["distanceKm"] > 0
    assert tour["durationMinutes"] == 12
    status, user_tours = request("/tours", token=token)
    assert status == 200 and user_tours is not None and user_tours["total"] == 1
    status, _ = request(f"/tours/{tour_id}", "DELETE", token=token)
    assert status == 204
    status, error = request("/tours", "POST", {"placeIds": ["not-a-place"]}, token)
    assert status == 422 and error is not None

    place = places["items"][0]
    visitor_id = str(uuid.uuid4())
    visit_payload = {
        "placeId": place["id"],
        "visitorId": visitor_id,
        "coordinates": place["coordinates"],
    }
    status, visit = request("/analytics/visits", "POST", visit_payload)
    assert status == 201 and visit == {"recorded": True}
    status, duplicate = request("/analytics/visits", "POST", visit_payload)
    assert status == 201 and duplicate == {"recorded": False}

    status, rating = request(
        "/analytics/ratings",
        "POST",
        {
            "placeId": place["id"],
            "visitorId": str(uuid.uuid4()),
            "rating": 5,
            "review": "Smoke test review",
        },
    )
    assert status == 201 and rating is not None
    assert rating["totalRatings"] == 1 and rating["averageRating"] == 5

    status, analytics = request(f"/places/{place['id']}/analytics")
    assert status == 200 and analytics is not None
    assert analytics["visits"] == 1
    assert analytics["averageRating"] == 5
    print("Backend integration smoke checks passed.")


if __name__ == "__main__":
    main()
