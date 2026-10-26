"""Tạo ứng dụng Analytics Service và khởi tạo kho SQLite."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI

from services.analytics_service.api import router
from services.analytics_service.repository import AnalyticsRepository


def create_app(database_path: Path | None = None) -> FastAPI:
    repository = AnalyticsRepository(
        database_path
        or Path(
            os.getenv("ANALYTICS_DATABASE_PATH", "server/var/analytics-service.sqlite")
        )
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        yield

    app = FastAPI(
        title="Quảng Trị — Analytics Service",
        version="1.0.0",
        description="Anonymous visit counts and place ratings.",
        lifespan=lifespan,
    )
    app.state.repository = repository
    app.include_router(router)
    return app


app = create_app()
