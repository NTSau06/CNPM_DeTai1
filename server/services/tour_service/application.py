from __future__ import annotations

import math
import time
import uuid
from typing import Protocol

from services.common.errors import PlaceValidationError, ServiceUnavailableError
from services.common.schemas import Place, Tour, TourCollection, TourCreate
from services.tour_service.repository import TourRepository


class PlaceResolver(Protocol):
    async def resolve(self, place_ids: list[str]) -> list[Place]: ...


class HttpPlaceResolver:
    def __init__(self, base_url: str, timeout_seconds: float = 3.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def resolve(self, place_ids: list[str]) -> list[Place]:
        import httpx

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/internal/v1/places/resolve",
                    json={"placeIds": place_ids},
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise ServiceUnavailableError("POI service rejected tour validation.") from error
        except httpx.RequestError as error:
            raise ServiceUnavailableError("POI service is unavailable.") from error
        return [
            Place.model_validate(item)
            for item in response.json()["items"]
        ]


class TourPlanner:
    def __init__(
        self,
        repository: TourRepository,
        place_resolver: PlaceResolver,
    ) -> None:
        self.repository = repository
        self.place_resolver = place_resolver

    async def create_tour(self, payload: TourCreate) -> Tour:
        places = await self.place_resolver.resolve(payload.place_ids)
        places_by_id = {place.id: place for place in places}
        missing_ids = [
            place_id for place_id in payload.place_ids if place_id not in places_by_id
        ]
        if missing_ids:
            raise PlaceValidationError(
                f"Unknown place IDs: {', '.join(missing_ids)}."
            )

        coordinates = {
            place_id: places_by_id[place_id].coordinates
            for place_id in payload.place_ids
        }
        distance_km = sum(
            _haversine_km(coordinates[first], coordinates[second])
            for first, second in zip(payload.place_ids, payload.place_ids[1:])
        )
        return self.repository.save(
            Tour(
                id=str(payload.id or uuid.uuid4()),
                placeIds=payload.place_ids,
                createdAt=payload.created_at or int(time.time() * 1000),
                distanceKm=round(distance_km, 2),
                durationMinutes=sum(
                    places_by_id[place_id].duration for place_id in payload.place_ids
                ),
            )
        )

    def list_tours(self) -> TourCollection:
        items = self.repository.list()
        return TourCollection(items=items, total=len(items))

    def delete_tour(self, tour_id: str) -> bool:
        return self.repository.delete(tour_id)


def _haversine_km(
    first: tuple[float, float], second: tuple[float, float]
) -> float:
    longitude_a, latitude_a = map(math.radians, first)
    longitude_b, latitude_b = map(math.radians, second)
    latitude_delta = latitude_b - latitude_a
    longitude_delta = longitude_b - longitude_a
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(latitude_a)
        * math.cos(latitude_b)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 6371 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
