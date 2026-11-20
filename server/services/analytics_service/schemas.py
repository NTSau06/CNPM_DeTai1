"""Định nghĩa schema kiểm tra dữ liệu vào/ra của Analytics API."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VisitCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: Annotated[str, Field(alias="placeId", min_length=1, max_length=120)]
    visitor_id: Annotated[UUID, Field(alias="visitorId")]


class PresenceHeartbeat(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    visitor_id: Annotated[UUID, Field(alias="visitorId")]


class OnlineVisitorCount(BaseModel):
    online_visitors: int = Field(alias="onlineVisitors")


class RatingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: Annotated[str, Field(alias="placeId", min_length=1, max_length=120)]
    visitor_id: Annotated[UUID, Field(alias="visitorId")]
    rating: Annotated[int, Field(ge=1, le=5)]
    review: Annotated[str, Field(max_length=500)] = ""


class PlaceAnalytics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: str = Field(alias="placeId")
    visits: int
    average_rating: float | None = Field(alias="averageRating")
    rating_count: int = Field(alias="ratingCount")


class RatingReview(BaseModel):
    rating: int
    review: str
    created_at: str = Field(alias="createdAt")


class RatingSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: str = Field(alias="placeId")
    average_rating: float | None = Field(alias="averageRating")
    total_ratings: int = Field(alias="totalRatings")
    reviews: list[RatingReview]


class AdminPlaceAnalytics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: str = Field(alias="placeId")
    visits: int
    average_rating: float | None = Field(alias="averageRating")
    rating_count: int = Field(alias="ratingCount")


class AdminReview(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Mã băm của người đánh giá, dùng làm khóa để admin xóa đánh giá vi phạm.
    id: str
    place_id: str = Field(alias="placeId")
    rating: int
    review: str
    created_at: str = Field(alias="createdAt")


class AdminAnalyticsSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    period_days: int = Field(default=30, alias="periodDays")
    # Giữ tên trường cũ để client hiện tại không bị lỗi; giá trị theo period_days.
    visits_last_30_days: int = Field(alias="visitsLast30Days")
    total_ratings: int = Field(alias="totalRatings")
    average_rating: float | None = Field(alias="averageRating")
    places: list[AdminPlaceAnalytics]
    latest_reviews: list[AdminReview] = Field(alias="latestReviews")


class AdminReviewCollection(BaseModel):
    items: list[AdminReview]
    total: int


class OwnRating(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: str = Field(alias="placeId")
    rating: int | None
    review: str
