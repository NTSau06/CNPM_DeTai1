"""Tạo ứng dụng Analytics Service và khởi tạo kho SQLite."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from services.analytics_service.api import router
from services.common.database import Database
from services.analytics_service.repository import AnalyticsRepository


def create_app(database: Database | None = None) -> FastAPI:
    repository = AnalyticsRepository(database or Database())

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        yield

    app = FastAPI(
        title="Quảng Trị — Analytics Service",
        version="1.0.0",
        description="Anonymous presence, visit counts and place ratings.",
        lifespan=lifespan,
    )
    app.state.repository = repository
    app.include_router(router)
    return app


app = create_app()
