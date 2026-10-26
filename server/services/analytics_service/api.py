"""Định nghĩa API nội bộ để ghi lượt ghé và quản lý thống kê."""
from __future__ import annotations

from fastapi import APIRouter, Request

from services.analytics_service.repository import AnalyticsRepository
from services.analytics_service.schemas import (
    PlaceAnalytics,
    RatingCreate,
    RatingSummary,
    VisitCreate,
)

router = APIRouter()


def repository(request: Request) -> AnalyticsRepository:
    return request.app.state.repository


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analytics-service"}


@router.post("/internal/v1/analytics/visits", status_code=201)
def record_visit(payload: VisitCreate, request: Request) -> dict[str, bool]:
    return {"recorded": repository(request).record_visit(payload)}


@router.post("/internal/v1/analytics/ratings", status_code=201)
def save_rating(payload: RatingCreate, request: Request) -> RatingSummary:
    repository(request).save_rating(payload)
    return repository(request).rating_summary(payload.place_id)


@router.get(
    "/internal/v1/analytics/ratings/{place_id}", response_model=RatingSummary
)
def get_rating(place_id: str, request: Request) -> RatingSummary:
    return repository(request).rating_summary(place_id)


@router.get(
    "/internal/v1/analytics/places/{place_id}", response_model=PlaceAnalytics
)
def get_place_analytics(place_id: str, request: Request) -> PlaceAnalytics:
    return repository(request).place_analytics(place_id)
