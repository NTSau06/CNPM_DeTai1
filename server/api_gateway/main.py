from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_gateway.api import router


def create_app(service_urls: dict[str, str] | None = None) -> FastAPI:
    urls = service_urls or {
        "poi": os.getenv("POI_SERVICE_URL", "http://localhost:8001"),
        "tour": os.getenv("TOUR_SERVICE_URL", "http://localhost:8002"),
        "narration": os.getenv("NARRATION_SERVICE_URL", "http://localhost:8003"),
        "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://localhost:8004"),
    }

    app = FastAPI(
        title="Quảng Trị — API Gateway",
        version="1.0.0",
        description="Public API cho web PWA và ứng dụng React Native.",
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
    app.include_router(router)
    return app


app = create_app()
