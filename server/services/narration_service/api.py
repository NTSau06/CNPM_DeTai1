"""Cung cấp API lấy nội dung thuyết minh theo địa điểm và ngôn ngữ."""
from fastapi import APIRouter, HTTPException, Query, Request

from services.common.errors import ServiceUnavailableError
from services.common.schemas import Locale, Narration
from services.narration_service.application import NarrationReader

router = APIRouter()


def reader(request: Request) -> NarrationReader:
    return request.app.state.reader


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "narration-service"}


@router.get("/internal/v1/narrations/{place_id}", response_model=Narration)
async def get_narration(
    place_id: str,
    request: Request,
    locale: Locale = Query(default="vi"),
) -> Narration:
    try:
        return await reader(request).get_narration(place_id, locale)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Narration not found.") from error
    except ServiceUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
