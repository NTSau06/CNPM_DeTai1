"""Tạo FastAPI Gateway công khai và cấu hình middleware dùng chung."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_gateway.api import router
from api_gateway.auth import AuthRepository
from api_gateway.favorites import FavoriteRepository
from api_gateway.pairing import PairingRepository
from api_gateway.payments import PaymentSettings
from api_gateway.rate_limit import LoginRateLimiter
from api_gateway.tickets import TicketRepository
from services.common.database import Database


def create_app(
    service_urls: dict[str, str] | None = None,
    database: Database | None = None,
    admin_email: str | None = None,
    admin_password: str | None = None,
    payment_settings: PaymentSettings | None = None,
) -> FastAPI:
    urls = service_urls or {
        "poi": os.getenv("POI_SERVICE_URL", "http://localhost:8001"),
        "tour": os.getenv("TOUR_SERVICE_URL", "http://localhost:8002"),
        "narration": os.getenv("NARRATION_SERVICE_URL", "http://localhost:8003"),
        "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://localhost:8004"),
    }

    shared_database = database or Database()
    auth_repository = AuthRepository(shared_database)
    ticket_repository = TicketRepository(shared_database)
    pairing_repository = PairingRepository(shared_database)
    favorite_repository = FavoriteRepository(shared_database)
    configured_admin_email = admin_email if admin_email is not None else os.getenv("ADMIN_EMAIL", "")
    configured_admin_password = (
        admin_password if admin_password is not None else os.getenv("ADMIN_PASSWORD", "")
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        auth_repository.initialize()
        auth_repository.ensure_admin(configured_admin_email, configured_admin_password)
        ticket_repository.initialize()
        pairing_repository.initialize()
        favorite_repository.initialize()
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
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.state.service_urls = urls
    app.state.auth_repository = auth_repository
    app.state.ticket_repository = ticket_repository
    app.state.pairing_repository = pairing_repository
    app.state.favorite_repository = favorite_repository
    app.state.payment_settings = payment_settings or PaymentSettings.from_env()
    app.state.login_limiter = LoginRateLimiter(
        max_failures=int(os.getenv("LOGIN_MAX_FAILURES", "5")),
        window_seconds=int(os.getenv("LOGIN_LOCK_SECONDS", str(15 * 60))),
    )
    app.include_router(router)
    return app


app = create_app()
