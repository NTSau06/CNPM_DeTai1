"""Định nghĩa API nội bộ để ghi lượt ghé và quản lý thống kê."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response

from services.analytics_service.repository import AnalyticsRepository
from services.analytics_service.schemas import (
    AdminAnalyticsSummary,
    AdminReviewCollection,
    OwnRating,
    OnlineVisitorCount,
    PresenceHeartbeat,
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


@router.post("/internal/v1/analytics/presence", status_code=204)
def heartbeat(payload: PresenceHeartbeat, request: Request) -> None:
    repository(request).heartbeat(payload)


@router.post("/internal/v1/analytics/presence/leave", status_code=204)
def leave(payload: PresenceHeartbeat, request: Request) -> None:
    repository(request).leave(payload)


@router.get(
    "/internal/v1/analytics/presence",
    response_model=OnlineVisitorCount,
    response_model_by_alias=True,
)
def online_visitor_count(request: Request) -> OnlineVisitorCount:
    return OnlineVisitorCount(onlineVisitors=repository(request).online_visitor_count())


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
    "/internal/v1/analytics/ratings/{place_id}/visitors/{visitor_id}",
    response_model=OwnRating,
)
def get_own_rating(place_id: str, visitor_id: UUID, request: Request) -> OwnRating:
    return repository(request).own_rating(place_id, visitor_id)


@router.delete("/internal/v1/analytics/ratings/{place_id}/{rating_id}", status_code=204)
def delete_rating(place_id: str, rating_id: str, request: Request) -> Response:
    if not repository(request).delete_rating(place_id, rating_id):
        raise HTTPException(status_code=404, detail="Rating not found.")
    return Response(status_code=204)


@router.get("/internal/v1/analytics/admin/reviews", response_model=AdminReviewCollection)
def list_reviews(
    request: Request,
    place_id: str | None = Query(default=None, alias="placeId", max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
) -> AdminReviewCollection:
    return repository(request).list_reviews(place_id, limit)


@router.get(
    "/internal/v1/analytics/places/{place_id}", response_model=PlaceAnalytics
)
def get_place_analytics(place_id: str, request: Request) -> PlaceAnalytics:
    return repository(request).place_analytics(place_id)


@router.get(
    "/internal/v1/analytics/admin/summary",
    response_model=AdminAnalyticsSummary,
)
def get_admin_summary(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
) -> AdminAnalyticsSummary:
    return repository(request).admin_summary(days)
