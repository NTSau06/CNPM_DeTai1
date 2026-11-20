"""Cấu hình và tiện ích cổng thanh toán vé.

Hai phương thức:
- ``mock``: cổng thanh toán mô phỏng chạy ngay trong ứng dụng, dùng để demo.
- ``vnpay``: VNPay sandbox/production theo chuẩn vnp_Version 2.1.0, chỉ bật khi
  có đủ VNPAY_TMN_CODE và VNPAY_HASH_SECRET trong biến môi trường.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

VIETNAM_TZ = timezone(timedelta(hours=7))
VNPAY_SANDBOX_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
PAYMENT_TIMEOUT_MINUTES = 15


@dataclass(frozen=True)
class PaymentSettings:
    mock_enabled: bool = True
    vnpay_tmn_code: str = ""
    vnpay_hash_secret: str = ""
    vnpay_url: str = VNPAY_SANDBOX_URL
    # Địa chỉ công khai của Gateway để VNPay chuyển trình duyệt về (…/api/v1).
    public_api_url: str = "http://localhost:8000/api/v1"
    # Trang web nhận kết quả sau khi Gateway xử lý xong.
    frontend_url: str = "http://localhost:5173"

    @property
    def vnpay_enabled(self) -> bool:
        return bool(self.vnpay_tmn_code and self.vnpay_hash_secret)

    def methods(self) -> list[str]:
        methods = []
        if self.mock_enabled:
            methods.append("mock")
        if self.vnpay_enabled:
            methods.append("vnpay")
        return methods

    @classmethod
    def from_env(cls) -> "PaymentSettings":
        return cls(
            mock_enabled=os.getenv("PAYMENT_MOCK_ENABLED", "true").strip().lower()
            not in {"0", "false", "no"},
            vnpay_tmn_code=os.getenv("VNPAY_TMN_CODE", "").strip(),
            vnpay_hash_secret=os.getenv("VNPAY_HASH_SECRET", "").strip(),
            vnpay_url=os.getenv("VNPAY_URL", VNPAY_SANDBOX_URL).strip(),
            public_api_url=os.getenv("PUBLIC_API_URL", "http://localhost:8000/api/v1")
            .strip()
            .rstrip("/"),
            frontend_url=os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/"),
        )


def _vnpay_query(params: dict[str, str]) -> str:
    return "&".join(
        f"{urllib.parse.quote_plus(str(key))}={urllib.parse.quote_plus(str(value))}"
        for key, value in sorted(params.items())
        if value not in (None, "")
    )


def vnpay_signature(params: dict[str, str], secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), _vnpay_query(params).encode("utf-8"), hashlib.sha512
    ).hexdigest()


def build_vnpay_url(
    settings: PaymentSettings,
    *,
    order_id: str,
    amount_vnd: int,
    client_ip: str,
    order_info: str,
    locale: str = "vn",
    now: datetime | None = None,
) -> str:
    created = (now or datetime.now(VIETNAM_TZ)).astimezone(VIETNAM_TZ)
    params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.vnpay_tmn_code,
        # VNPay yêu cầu số tiền nhân 100 (không có phần thập phân).
        "vnp_Amount": str(amount_vnd * 100),
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": order_id,
        "vnp_OrderInfo": order_info,
        "vnp_OrderType": "other",
        "vnp_Locale": "vn" if locale == "vi" else "en",
        "vnp_ReturnUrl": f"{settings.public_api_url}/payments/vnpay/return",
        "vnp_IpAddr": client_ip or "127.0.0.1",
        "vnp_CreateDate": created.strftime("%Y%m%d%H%M%S"),
        "vnp_ExpireDate": (created + timedelta(minutes=PAYMENT_TIMEOUT_MINUTES)).strftime(
            "%Y%m%d%H%M%S"
        ),
    }
    signature = vnpay_signature(params, settings.vnpay_hash_secret)
    return f"{settings.vnpay_url}?{_vnpay_query(params)}&vnp_SecureHash={signature}"


def verify_vnpay_params(settings: PaymentSettings, query: dict[str, str]) -> bool:
    """Kiểm tra chữ ký trên dữ liệu VNPay gửi về (return URL hoặc IPN)."""
    received = query.get("vnp_SecureHash", "")
    data = {
        key: value
        for key, value in query.items()
        if key.startswith("vnp_") and key not in {"vnp_SecureHash", "vnp_SecureHashType"}
    }
    if not received or not settings.vnpay_enabled:
        return False
    expected = vnpay_signature(data, settings.vnpay_hash_secret)
    return hmac.compare_digest(expected.lower(), received.lower())


def vnpay_succeeded(query: dict[str, str]) -> bool:
    return query.get("vnp_ResponseCode") == "00" and query.get(
        "vnp_TransactionStatus", "00"
    ) == "00"
