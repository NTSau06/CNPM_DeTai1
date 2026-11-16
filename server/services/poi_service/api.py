"""Cung cấp API nội bộ để liệt kê, lấy và kiểm tra địa điểm."""
from fastapi import APIRouter, HTTPException, Query, Request, Response, status
import pyodbc

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


@router.post(
    "/internal/v1/admin/places",
    response_model=Place,
    status_code=status.HTTP_201_CREATED,
)
def create_place(payload: Place, request: Request) -> Place:
    if catalog(request).get_place(payload.id) is not None:
        raise HTTPException(status_code=409, detail="A place with this ID already exists.")
    return catalog(request).repository.save(payload)


@router.put("/internal/v1/admin/places/{place_id}", response_model=Place)
def update_place(place_id: str, payload: Place, request: Request) -> Place:
    if place_id != payload.id:
        raise HTTPException(status_code=422, detail="Place ID cannot be changed.")
    if catalog(request).get_place(place_id) is None:
        raise HTTPException(status_code=404, detail="Place not found.")
    return catalog(request).repository.save(payload)


@router.delete(
    "/internal/v1/admin/places/{place_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_place(place_id: str, request: Request) -> Response:
    place_catalog = catalog(request)
    try:
        deleted = place_catalog.repository.delete(place_id)
    except pyodbc.IntegrityError as exc:
        if "547" not in str(exc):
            raise
        raise HTTPException(
            status_code=409,
            detail="This place has ticket orders, visits or ratings and cannot be deleted.",
        ) from exc
    if not deleted:
        if place_catalog.get_place(place_id) is not None:
            raise HTTPException(status_code=409, detail="The last place cannot be deleted.")
        raise HTTPException(status_code=404, detail="Place not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
