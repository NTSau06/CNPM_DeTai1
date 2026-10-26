"""Chuyển tiếp yêu cầu tới service nội bộ và xử lý lỗi phản hồi."""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException


async def request_service(
    base_url: str,
    method: str,
    path: str,
    *,
    params: dict[str, str | None] | None = None,
    json: dict[str, Any] | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=5.0) as client:
            response = await client.request(
                method,
                path,
                params={key: value for key, value in (params or {}).items() if value is not None},
                json=json,
            )
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail="A dependent service timed out.") from error
    except httpx.RequestError as error:
        raise HTTPException(status_code=503, detail="A dependent service is unavailable.") from error

    if response.is_error:
        try:
            detail = response.json().get("detail", "The service request failed.")
        except ValueError:
            detail = "The service returned an invalid error response."
        raise HTTPException(status_code=response.status_code, detail=detail)

    if response.status_code == 204:
        return None
    try:
        return response.json()
    except ValueError as error:
        raise HTTPException(status_code=502, detail="A dependent service returned invalid JSON.") from error
