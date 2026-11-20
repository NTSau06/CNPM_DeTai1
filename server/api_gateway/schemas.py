"""Kiểm tra dữ liệu yêu cầu trước khi chuyển vào xử lý nghiệp vụ."""
from __future__ import annotations

import re
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VisitSubmission(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: Annotated[str, Field(alias="placeId", min_length=1, max_length=120)]
    visitor_id: Annotated[UUID, Field(alias="visitorId")]
    coordinates: Annotated[
        tuple[
            Annotated[float, Field(ge=-180, le=180)],
            Annotated[float, Field(ge=-90, le=90)],
        ],
        Field(min_length=2, max_length=2),
    ]


class RegisterRequest(BaseModel):
    full_name: Annotated[str, Field(alias="fullName", min_length=1, max_length=80)]
    email: Annotated[str, Field(min_length=3, max_length=254)]
    phone: Annotated[str, Field(default="", max_length=20)]
    password: Annotated[str, Field(min_length=8, max_length=128)]

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value.strip()) is None:
            raise ValueError("Enter a valid email address.")
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: Annotated[str, Field(min_length=3, max_length=254)]
    password: Annotated[str, Field(min_length=8, max_length=128)]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class TicketOrderCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    place_id: Annotated[str, Field(alias="placeId", min_length=1, max_length=120)]
    quantity: Annotated[int, Field(ge=1, le=10)]


class TicketPriceUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Giá vé do admin tự đặt; giới hạn rộng để tránh nhập nhầm số quá lớn.
    price_vnd: Annotated[int | None, Field(alias="priceVnd", ge=1_000, le=10_000_000)]


class RatingSubmission(BaseModel):
    """Đánh giá gửi từ client; danh tính lấy từ phiên đăng nhập, không lấy từ client."""

    model_config = ConfigDict(populate_by_name=True)

    place_id: Annotated[str, Field(alias="placeId", min_length=1, max_length=120)]
    rating: Annotated[int, Field(ge=1, le=5)]
    review: Annotated[str, Field(max_length=500)] = ""


class PaymentStart(BaseModel):
    method: Literal["mock", "vnpay"]
    locale: Annotated[str, Field(max_length=10)] = "vi"


class MockPaymentResult(BaseModel):
    success: bool


class AccountDeletion(BaseModel):
    password: Annotated[str, Field(min_length=8, max_length=128)]


class UserLockUpdate(BaseModel):
    locked: bool

class ProfileUpdate(BaseModel):
    full_name: Annotated[str, Field(alias="fullName", min_length=1, max_length=80)]
    phone: Annotated[str, Field(default="", max_length=20)]
    birth_date: Annotated[str, Field(alias="birthDate", default="", max_length=10)]
    gender: Literal["female", "male", "other", "prefer-not-to-say", ""] = ""
    address: Annotated[str, Field(default="", max_length=160)]

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value: str) -> str:
        if value and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
            raise ValueError("Birth date must use YYYY-MM-DD.")
        return value


class PairingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    language: Literal["vi", "en", "ja", "fr", "zh-CN", "ko-KR", "es"] = "vi"
    place_id: Annotated[str | None, Field(alias="placeId", default=None, max_length=120)]
    path: Annotated[str, Field(default="/explore", min_length=1, max_length=200)]

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str) -> str:
        # Chỉ cho phép đường dẫn nội bộ của ứng dụng để tránh chuyển hướng ra trang ngoài.
        if re.fullmatch(r"/(?!/)[A-Za-z0-9\-._~/?=&%]*", value) is None or "://" in value:
            raise ValueError("Path must be an in-app path.")
        return value


class PasswordChange(BaseModel):
    current_password: Annotated[
        str, Field(alias="currentPassword", min_length=8, max_length=128)
    ]
    new_password: Annotated[str, Field(alias="newPassword", min_length=8, max_length=128)]
