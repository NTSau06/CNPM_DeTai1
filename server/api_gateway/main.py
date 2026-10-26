"""Tạo FastAPI Gateway công khai và cấu hình middleware dùng chung."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_gateway.api import router
from api_gateway.auth import AuthRepository


def create_app(
    service_urls: dict[str, str] | None = None,
    auth_database_path: Path | None = None,
) -> FastAPI:
    urls = service_urls or {
        "poi": os.getenv("POI_SERVICE_URL", "http://localhost:8001"),
        "tour": os.getenv("TOUR_SERVICE_URL", "http://localhost:8002"),
        "narration": os.getenv("NARRATION_SERVICE_URL", "http://localhost:8003"),
        "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://localhost:8004"),
    }

    auth_repository = AuthRepository(
        auth_database_path
        or Path(os.getenv("AUTH_DATABASE_PATH", "server/var/accounts.sqlite"))
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        auth_repository.initialize()
        yield

    app = FastAPI(
        title="Quảng Trị — API Gateway",
        version="1.0.0",
        description="Public API cho web PWA và ứng dụng React Native.",
        lifespan=lifespan,
    )
    allowed_origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:19006",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.state.service_urls = urls
    app.state.auth_repository = auth_repository
    app.include_router(router)
    return app


app = create_app()
