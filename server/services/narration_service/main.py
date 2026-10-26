"""Tạo ứng dụng Narration Service và cấu hình kết nối tới POI Service."""
from __future__ import annotations

import os

import httpx
from fastapi import FastAPI

from services.common.errors import ServiceUnavailableError
from services.common.schemas import Place
from services.narration_service.api import router
from services.narration_service.application import NarrationReader


class HttpPlaceReader:
    def __init__(self, base_url: str, timeout_seconds: float = 3.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def get_place(self, place_id: str) -> Place | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    f"{self.base_url}/internal/v1/places/{place_id}"
                )
        except httpx.RequestError as error:
            raise ServiceUnavailableError("POI service is unavailable.") from error
        if response.status_code == 404:
            return None
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise ServiceUnavailableError("POI service could not load the place.") from error
        return Place.model_validate(response.json())


def create_app(place_service_url: str | None = None) -> FastAPI:
    app = FastAPI(
        title="Quảng Trị — Narration Service",
        version="1.0.0",
        description="Phân phối nội dung thuyết minh và locale đọc từ POI Service.",
    )
    app.state.reader = NarrationReader(
        HttpPlaceReader(
            place_service_url
            or os.getenv("POI_SERVICE_URL", "http://localhost:8001")
        )
    )
    app.include_router(router)
    return app


app = create_app()
