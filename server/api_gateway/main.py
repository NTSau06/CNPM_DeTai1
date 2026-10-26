"""Tạo FastAPI Gateway công khai và cấu hình middleware dùng chung."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_gateway.api import router
from api_gateway.admin_auth import AdminAuthRepository
from api_gateway.auth import AuthRepository
from api_gateway.tickets import TicketRepository


def create_app(
    service_urls: dict[str, str] | None = None,
    auth_database_path: Path | None = None,
    admin_email: str | None = None,
    admin_password: str | None = None,
    admin_database_path: Path | None = None,
) -> FastAPI:
    urls = service_urls or {
        "poi": os.getenv("POI_SERVICE_URL", "http://localhost:8001"),
        "tour": os.getenv("TOUR_SERVICE_URL", "http://localhost:8002"),
        "narration": os.getenv("NARRATION_SERVICE_URL", "http://localhost:8003"),
        "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://localhost:8004"),
    }

    database_path = auth_database_path or Path(
        os.getenv("AUTH_DATABASE_PATH", "server/var/accounts.sqlite")
    )
    admin_db_path = admin_database_path or Path(
        os.getenv("ADMIN_DATABASE_PATH", str(database_path.with_name("admin_accounts.sqlite")))
    )
    if admin_db_path.resolve() == database_path.resolve():
        raise RuntimeError("ADMIN_DATABASE_PATH must be separate from AUTH_DATABASE_PATH.")
    auth_repository = AuthRepository(database_path)
    admin_auth_repository = AdminAuthRepository(admin_db_path)
    ticket_repository = TicketRepository(database_path)
    configured_admin_email = admin_email if admin_email is not None else os.getenv("ADMIN_EMAIL", "")
    configured_admin_password = (
        admin_password if admin_password is not None else os.getenv("ADMIN_PASSWORD", "")
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        auth_repository.initialize()
        admin_auth_repository.initialize(
            configured_admin_email,
            configured_admin_password,
            database_path,
        )
        ticket_repository.initialize()
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
    app.state.admin_auth_repository = admin_auth_repository
    app.state.ticket_repository = ticket_repository
    app.include_router(router)
    return app


app = create_app()
