"""Định nghĩa các model Pydantic dùng chung giữa backend service."""
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
    audio_url: str | None = Field(default=None, alias="audioUrl", max_length=2048)

    @field_validator("audio_url")
    @classmethod
    def validate_audio_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if value and not (value.startswith(("https://", "http://")) or (value.startswith("/") and not value.startswith("//"))):
            raise ValueError("Audio must use an HTTP(S) URL or a local absolute path")
        return value


class PlaceDetailSection(BaseModel):
    heading: str
    body: str


class PlaceDetailImage(BaseModel):
    src: str
    alt: str
    caption: str


class Place(BaseModel):
    id: str
    category: Category
    coordinates: tuple[float, float]
    duration: Annotated[int, Field(ge=1, le=240)]
    image: str
    localized_copy: dict[Locale, LocalizedCopy] = Field(alias="copy")
    detail_sections: list[PlaceDetailSection] = Field(default_factory=list, alias="detailSections")
    detail_image: PlaceDetailImage | None = Field(default=None, alias="detailImage")


class PlaceCollection(BaseModel):
    items: list[Place]
    total: int


class TourCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID | None = None
    place_ids: Annotated[list[str], Field(alias="placeIds", min_length=1, max_length=30)]
    created_at: int | None = Field(default=None, alias="createdAt", ge=0)
    owner_id: str | None = Field(default=None, alias="ownerId")

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
