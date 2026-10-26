"""Định nghĩa schema kiểm tra dữ liệu vào/ra của Analytics API."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VisitCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: Annotated[str, Field(alias="placeId", min_length=1, max_length=120)]
    visitor_id: Annotated[UUID, Field(alias="visitorId")]


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

    place_id: str = Field(alias="placeId")
    rating: int
    review: str
    created_at: str = Field(alias="createdAt")


class AdminAnalyticsSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    visits_last_30_days: int = Field(alias="visitsLast30Days")
    total_ratings: int = Field(alias="totalRatings")
    average_rating: float | None = Field(alias="averageRating")
    places: list[AdminPlaceAnalytics]
    latest_reviews: list[AdminReview] = Field(alias="latestReviews")
