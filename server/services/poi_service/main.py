"""Tạo ứng dụng POI Service và khởi tạo danh mục địa điểm ban đầu."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI

from services.poi_service.api import router
from services.poi_service.application import PlaceCatalog
from services.poi_service.repository import PlaceRepository

DEFAULT_SEED = Path(__file__).parent / "data" / "places.json"


def create_app(
    database_path: Path | None = None, seed_path: Path = DEFAULT_SEED
) -> FastAPI:
    repository = PlaceRepository(
        database_path
        or Path(os.getenv("POI_DATABASE_PATH", "server/var/poi-service.sqlite")),
        seed_path,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        yield

    app = FastAPI(
        title="Quảng Trị — POI Service",
        version="1.0.0",
        description="Danh mục điểm tham quan và nội dung thuyết minh đa ngôn ngữ.",
        lifespan=lifespan,
    )
    app.state.catalog = PlaceCatalog(repository)
    app.include_router(router)
    return app


app = create_app()
