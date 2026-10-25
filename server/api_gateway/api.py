import math
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response, status

from api_gateway.proxy import request_service
from api_gateway.schemas import VisitSubmission
from services.analytics_service.schemas import RatingCreate
from services.common.schemas import Locale, TourCreate

router = APIRouter(prefix="/api/v1")


def service_url(request: Request, name: str) -> str:
    return request.app.state.service_urls[name]


@router.post("/analytics/visits", status_code=status.HTTP_201_CREATED)
async def record_visit(payload: VisitSubmission, request: Request) -> dict:
    place = await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{payload.place_id}",
    )
    longitude, latitude = payload.coordinates
    place_longitude, place_latitude = place["coordinates"]
    if _distance_meters(longitude, latitude, place_longitude, place_latitude) > 85:
        raise HTTPException(status_code=422, detail="You must be within 85 m of the place.")
    return await request_service(
        service_url(request, "analytics"),
        "POST",
        "/internal/v1/analytics/visits",
        json={
            "placeId": payload.place_id,
            "visitorId": str(payload.visitor_id),
        },
    )


@router.get("/places/{place_id}/analytics")
async def get_place_analytics(place_id: str, request: Request) -> dict:
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{place_id}",
    )
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        f"/internal/v1/analytics/places/{place_id}",
    )


@router.get("/places/{place_id}/ratings")
async def get_ratings(place_id: str, request: Request) -> dict:
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{place_id}",
    )
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        f"/internal/v1/analytics/ratings/{place_id}",
    )


@router.post("/analytics/ratings", status_code=status.HTTP_201_CREATED)
async def save_rating(payload: RatingCreate, request: Request) -> dict:
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{payload.place_id}",
    )
    return await request_service(
        service_url(request, "analytics"),
        "POST",
        "/internal/v1/analytics/ratings",
        json=payload.model_dump(mode="json", by_alias=True),
    )


@router.get("/places")
async def list_places(
    request: Request,
    category: Annotated[
        str | None, Query(pattern="^(landmark|food|craft|rest)$")
    ] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
) -> dict:
    return await request_service(
        service_url(request, "poi"),
        "GET",
        "/internal/v1/places",
        params={"category": category, "q": q},
    )


@router.get("/places/{place_id}")
async def get_place(place_id: str, request: Request) -> dict:
    return await request_service(
        service_url(request, "poi"), "GET", f"/internal/v1/places/{place_id}"
    )


@router.get("/narrations/{place_id}")
async def get_narration(
    place_id: str,
    request: Request,
    locale: Locale = Query(default="vi"),
) -> dict:
    return await request_service(
        service_url(request, "narration"),
        "GET",
        f"/internal/v1/narrations/{place_id}",
        params={"locale": locale},
    )


@router.get("/tours")
async def list_tours(request: Request) -> dict:
    return await request_service(
        service_url(request, "tour"), "GET", "/internal/v1/tours"
    )


@router.post("/tours", status_code=status.HTTP_201_CREATED)
async def create_tour(payload: TourCreate, request: Request) -> dict:
    return await request_service(
        service_url(request, "tour"),
        "POST",
        "/internal/v1/tours",
        json=payload.model_dump(mode="json", by_alias=True),
    )


@router.delete("/tours/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tour(tour_id: str, request: Request) -> Response:
    await request_service(
        service_url(request, "tour"), "DELETE", f"/internal/v1/tours/{tour_id}"
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api-gateway"}


def _distance_meters(
    longitude_a: float,
    latitude_a: float,
    longitude_b: float,
    latitude_b: float,
) -> float:
    radians = math.pi / 180
    latitude_delta = (latitude_b - latitude_a) * radians
    longitude_delta = (longitude_b - longitude_a) * radians
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(latitude_a * radians)
        * math.cos(latitude_b * radians)
        * math.sin(longitude_delta / 2) ** 2
    )
    value = min(1, max(0, value))
    return 6_371_000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
