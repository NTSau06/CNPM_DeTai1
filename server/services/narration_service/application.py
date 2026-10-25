from __future__ import annotations

from typing import Protocol

from services.common.errors import ServiceUnavailableError
from services.common.schemas import Locale, Narration, Place

SPEECH_LOCALES: dict[str, str] = {
    "vi": "vi-VN",
    "en": "en-US",
    "ja": "ja-JP",
    "fr": "fr-FR",
    "zh-CN": "zh-CN",
    "ko-KR": "ko-KR",
    "es": "es-ES",
}


class PlaceReader(Protocol):
    async def get_place(self, place_id: str) -> Place | None: ...


class NarrationReader:
    def __init__(self, place_reader: PlaceReader) -> None:
        self.place_reader = place_reader

    async def get_narration(self, place_id: str, locale: Locale) -> Narration:
        place = await self.place_reader.get_place(place_id)
        if place is None:
            raise KeyError(place_id)
        copy = place.localized_copy.get(locale)
        if copy is None:
            raise KeyError(f"Locale {locale} is not available for place {place_id}.")
        return Narration(
            placeId=place.id,
            locale=locale,
            title=copy.title,
            text=copy.narration,
            speechLocale=SPEECH_LOCALES[locale],
        )
