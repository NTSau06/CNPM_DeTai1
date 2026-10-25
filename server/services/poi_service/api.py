from fastapi import APIRouter, HTTPException, Query, Request

from services.common.schemas import (
    Place,
    PlaceCollection,
    PlaceValidationRequest,
    PlaceValidationResponse,
)
from services.poi_service.application import PlaceCatalog

router = APIRouter()


def catalog(request: Request) -> PlaceCatalog:
    return request.app.state.catalog


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "poi-service"}


@router.get("/internal/v1/places", response_model=PlaceCollection)
def list_places(
    request: Request,
    category: str | None = Query(default=None, pattern="^(landmark|food|craft|rest)$"),
    q: str | None = Query(default=None, min_length=1, max_length=120),
) -> PlaceCollection:
    return catalog(request).list_places(category=category, query=q)


@router.get("/internal/v1/places/{place_id}", response_model=Place)
def get_place(place_id: str, request: Request) -> Place:
    place = catalog(request).get_place(place_id)
    if place is None:
        raise HTTPException(status_code=404, detail="Place not found.")
    return place


@router.post("/internal/v1/places/resolve", response_model=PlaceCollection)
def resolve_places(
    payload: PlaceValidationRequest, request: Request
) -> PlaceCollection:
    items = catalog(request).get_places(payload.place_ids)
    return PlaceCollection(items=items, total=len(items))


@router.post("/internal/v1/places/validate", response_model=PlaceValidationResponse)
def validate_places(
    payload: PlaceValidationRequest, request: Request
) -> PlaceValidationResponse:
    valid_ids = catalog(request).validate_place_ids(payload.place_ids)
    valid_set = set(valid_ids)
    return PlaceValidationResponse(
        validIds=valid_ids,
        missingIds=[place_id for place_id in payload.place_ids if place_id not in valid_set],
    )
