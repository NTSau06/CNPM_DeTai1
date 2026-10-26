"""Tạo ứng dụng Tour Service, repository và kết nối tới POI Service."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI

from services.tour_service.api import router
from services.tour_service.application import HttpPlaceResolver, TourPlanner
from services.tour_service.repository import TourRepository


def create_app(
    database_path: Path | None = None,
    poi_service_url: str | None = None,
) -> FastAPI:
    repository = TourRepository(
        database_path
        or Path(os.getenv("TOUR_DATABASE_PATH", "server/var/tour-service.sqlite"))
    )
    resolver = HttpPlaceResolver(
        poi_service_url or os.getenv("POI_SERVICE_URL", "http://localhost:8001")
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        yield

    app = FastAPI(
        title="Quảng Trị — Tour Service",
        version="1.0.0",
        description="Lưu hành trình và kiểm tra điểm dừng qua POI Service.",
        lifespan=lifespan,
    )
    app.state.planner = TourPlanner(repository, resolver)
    app.include_router(router)
    return app


app = create_app()
