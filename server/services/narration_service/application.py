"""Tạo nội dung thuyết minh đa ngôn ngữ từ dữ liệu của POI Service."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Protocol

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


@lru_cache(maxsize=1)
def bundled_scripts() -> dict:
    return json.loads(
        (Path(__file__).parent / "data" / "narrationScripts.json").read_text(encoding="utf-8")
    )


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
        entry = bundled_scripts().get(place.id, {}).get(locale)
        text = copy.narration
        if entry and text in (entry["originalNarration"], entry["text"]):
            text = entry["text"]
        return Narration(
            placeId=place.id,
            locale=locale,
            title=copy.title,
            text=text,
            speechLocale=SPEECH_LOCALES[locale],
        )
