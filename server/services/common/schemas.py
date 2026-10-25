from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

Locale = Literal["vi", "en", "ja", "fr", "zh-CN", "ko-KR", "es"]
Category = Literal["landmark", "food", "craft", "rest"]


class LocalizedCopy(BaseModel):
    title: str
    subtitle: str
    narration: str


class Place(BaseModel):
    id: str
    category: Category
    coordinates: tuple[float, float]
    duration: Annotated[int, Field(ge=1, le=240)]
    image: str
    localized_copy: dict[Locale, LocalizedCopy] = Field(alias="copy")


class PlaceCollection(BaseModel):
    items: list[Place]
    total: int


class TourCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID | None = None
    place_ids: Annotated[list[str], Field(alias="placeIds", min_length=1, max_length=30)]
    created_at: int | None = Field(default=None, alias="createdAt", ge=0)

    @field_validator("place_ids")
    @classmethod
    def require_unique_places(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("A tour cannot contain duplicate places.")
        return value


class Tour(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    place_ids: list[str] = Field(alias="placeIds")
    created_at: int = Field(alias="createdAt")
    distance_km: float = Field(alias="distanceKm", ge=0)
    duration_minutes: int = Field(alias="durationMinutes", ge=0)


class TourCollection(BaseModel):
    items: list[Tour]
    total: int


class PlaceValidationRequest(BaseModel):
    place_ids: Annotated[list[str], Field(alias="placeIds", min_length=1, max_length=30)]


class PlaceValidationResponse(BaseModel):
    valid_ids: list[str] = Field(alias="validIds")
    missing_ids: list[str] = Field(alias="missingIds")


class Narration(BaseModel):
    place_id: str = Field(alias="placeId")
    locale: Locale
    title: str
    text: str
    speech_locale: str = Field(alias="speechLocale")


class NarrationResponse(BaseModel):
    items: list[Narration]
    total: int
