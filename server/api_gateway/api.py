"""Cung cấp API công khai và điều phối yêu cầu giữa các backend service."""
import math
import uuid
from typing import Annotated

import pyodbc

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status

from api_gateway.auth import AccountLockedError
from api_gateway.pairing import PAIRING_TTL_SECONDS
from api_gateway.proxy import request_service
from api_gateway.tickets import PaymentError
from api_gateway.schemas import (
    AccountDeletion,
    LoginRequest,
    PairingCreate,
    PasswordChange,
    ProfileUpdate,
    QrPaymentConfirm,
    RatingSubmission,
    RegisterRequest,
    TicketOrderCreate,
    TicketPriceUpdate,
    UserLockUpdate,
    VisitSubmission,
)
from services.analytics_service.schemas import PresenceHeartbeat
from services.common.schemas import Locale, Place, TourCreate

router = APIRouter(prefix="/api/v1")


def service_url(request: Request, name: str) -> str:
    return request.app.state.service_urls[name]


def authenticated_user(
    request: Request,
    authorization: str | None,
) -> dict:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to manage saved tours.")
    user = request.app.state.auth_repository.authenticate(authorization[7:])
    if user is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return user


def admin_user(request: Request, authorization: str | None) -> dict:
    user = authenticated_user(request, authorization)
    if not user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Admin access is required.")
    return user


administrator = admin_user

# Không gian tên cố định để quy đổi tài khoản thành mã người đánh giá ổn định.
RATING_NAMESPACE = uuid.UUID("5f0c3c2e-8f2d-4a53-9a51-2f4d1c7d9b10")
ALLOWED_PERIODS = {7, 30, 90, 365}


def rating_visitor_id(user_id: str) -> uuid.UUID:
    """Mỗi tài khoản chỉ có một đánh giá cho mỗi địa điểm."""
    return uuid.uuid5(RATING_NAMESPACE, f"user:{user_id}")


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _check_login_limit(request: Request, key: str) -> None:
    retry_after = request.app.state.login_limiter.retry_after(key)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Too many failed sign-in attempts. "
                f"Try again in {max(1, retry_after // 60)} minute(s)."
            ),
            headers={"Retry-After": str(retry_after)},
        )


def _attempt_login(request: Request, payload: LoginRequest, scope: str) -> tuple[str, dict] | None:
    email = payload.email.strip().lower()
    key = f"{scope}:{_client_ip(request)}:{email}"
    _check_login_limit(request, key)
    try:
        result = request.app.state.auth_repository.login(email, payload.password)
    except AccountLockedError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    if result is None:
        request.app.state.login_limiter.record_failure(key)
        return None
    request.app.state.login_limiter.reset(key)
    return result


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request) -> dict:
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Enter your name.")
    try:
        token, user = request.app.state.auth_repository.register(
            full_name,
            email,
            payload.phone.strip(),
            payload.password,
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"token": token, "user": user}


@router.post("/auth/login")
def login(payload: LoginRequest, request: Request) -> dict:
    result = _attempt_login(request, payload, "user")
    if result is None:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    token, user = result
    return {"token": token, "user": user}


@router.post("/admin/login")
def admin_login(payload: LoginRequest, request: Request) -> dict:
    result = _attempt_login(request, payload, "admin")
    if result is None or not result[1]["isAdmin"]:
        if result is not None:
            request.app.state.auth_repository.revoke(result[0])
        raise HTTPException(status_code=401, detail="Admin email or password is incorrect.")
    token, admin = result
    return {"token": token, "user": admin}


@router.post("/admin/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    administrator(request, authorization)
    if authorization is None:
        raise HTTPException(status_code=401, detail="Administrator sign-in is required.")
    request.app.state.auth_repository.revoke(authorization[7:])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/auth/me")
def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    return authenticated_user(request, authorization)


@router.post("/auth/heartbeat")
def heartbeat(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, bool]:
    authenticated_user(request, authorization)
    if authorization is None or not request.app.state.auth_repository.heartbeat(
        authorization[7:]
    ):
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return {"active": True}
@router.put("/auth/me")
def update_current_user(
    payload: ProfileUpdate,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Enter your name.")
    try:
        updated = request.app.state.auth_repository.update_profile(
            user["id"],
            full_name,
            payload.phone.strip(),
            payload.birth_date,
            payload.gender,
            payload.address.strip(),
            email=payload.email,
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return updated


@router.post("/auth/change-password")
def change_password(
    payload: PasswordChange,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    limit_key = f"password:{user['id']}"
    _check_login_limit(request, limit_key)
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=422, detail="The new password must differ from the current one."
        )
    token = request.app.state.auth_repository.change_password(
        user["id"], payload.current_password, payload.new_password
    )
    if token is None:
        request.app.state.login_limiter.record_failure(limit_key)
        raise HTTPException(status_code=403, detail="Current password is incorrect.")
    request.app.state.login_limiter.reset(limit_key)
    return {"token": token, "user": user}


@router.delete("/auth/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    payload: AccountDeletion,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    """Người dùng tự xóa tài khoản; cần nhập lại mật khẩu để xác nhận."""
    user = authenticated_user(request, authorization)
    if user["isAdmin"]:
        raise HTTPException(
            status_code=422, detail="Administrator accounts cannot be deleted here."
        )
    limit_key = f"password:{user['id']}"
    _check_login_limit(request, limit_key)
    if not request.app.state.auth_repository.verify_password(user["id"], payload.password):
        request.app.state.login_limiter.record_failure(limit_key)
        raise HTTPException(status_code=403, detail="Password is incorrect.")
    await request_service(
        service_url(request, "tour"),
        "DELETE",
        f"/internal/v1/admin/tours/owner/{user['id']}",
    )
    if not request.app.state.auth_repository.delete_user(user["id"]):
        raise HTTPException(status_code=404, detail="User not found.")
    request.app.state.login_limiter.reset(limit_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    authenticated_user(request, authorization)
    if authorization is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    request.app.state.auth_repository.revoke(authorization[7:])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/admin/overview")
async def admin_overview(
    request: Request,
    authorization: str | None = Header(default=None),
    days: int = Query(default=30),
) -> dict:
    administrator(request, authorization)
    if days not in ALLOWED_PERIODS:
        raise HTTPException(status_code=422, detail="days must be one of 7, 30, 90, 365.")
    if authorization is None or not request.app.state.auth_repository.heartbeat(
        authorization[7:]
    ):
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    analytics = await request_service(
        service_url(request, "analytics"),
        "GET",
        "/internal/v1/analytics/admin/summary",
        params={"days": str(days)},
    )
    places = await request_service(
        service_url(request, "poi"),
        "GET",
        "/internal/v1/places",
    )
    online = await get_online_visitors(request)
    return {
        **request.app.state.auth_repository.account_metrics(),
        "analytics": analytics,
        "tickets": request.app.state.ticket_repository.sales_summary(days),
        "periodDays": days,
        "onlineVisitors": online["onlineVisitors"],
        "placeCount": places["total"],
        "visits": analytics["visitsLast30Days"],
        "ratingCount": analytics["totalRatings"],
    }


@router.get("/tickets/prices")
def ticket_prices(request: Request) -> dict:
    return {"items": request.app.state.ticket_repository.prices()}


@router.post("/tickets/orders", status_code=status.HTTP_201_CREATED)
async def create_ticket_order(
    payload: TicketOrderCreate,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{payload.place_id}",
    )
    try:
        order = request.app.state.ticket_repository.create_order(
            user["id"], payload.place_id, payload.quantity
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return order


@router.get("/tickets/orders")
def get_ticket_orders(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    items = request.app.state.ticket_repository.user_orders(user["id"])
    return {
        "items": items,
        "total": sum(item["quantity"] for item in items if item["status"] == "paid"),
    }


@router.get("/tickets/orders/{order_id}")
def get_ticket_order(
    order_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    order = request.app.state.ticket_repository.get_order(order_id, user["id"])
    if order is None:
        raise HTTPException(status_code=404, detail="Ticket order not found.")
    return order


PAYMENT_ERROR_STATUS = {
    "not_found": 404,
    "invalid_method": 422,
    "invalid_amount": 422,
    "already_paid": 409,
    "not_pending": 409,
}


def _payment_http_error(error: PaymentError) -> HTTPException:
    return HTTPException(status_code=PAYMENT_ERROR_STATUS.get(error.code, 409), detail=str(error))


@router.get("/tickets/orders/{order_id}/payment")
def get_ticket_payment(
    order_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    """Đơn kèm mã thanh toán để web tạo mã QR mở trang xác nhận thanh toán trên điện thoại."""
    user = authenticated_user(request, authorization)
    order = request.app.state.ticket_repository.ensure_payment_code(user["id"], order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Ticket order not found.")
    return {"order": order}


def _qr_payment_order(request: Request, order_id: str, code: str) -> dict:
    """Đơn của trang xác nhận mở từ mã QR; mã thanh toán phải khớp đúng đơn."""
    order = request.app.state.ticket_repository.get_by_payment_code(code.upper())
    if order is None or order["id"] != order_id:
        raise HTTPException(status_code=404, detail="Ticket order not found.")
    return order


def _qr_payment_view(order: dict) -> dict:
    # Trang này mở trên điện thoại chưa đăng nhập nên chỉ trả thông tin tối thiểu.
    return {
        "orderId": order["id"],
        "ticketCode": order["ticketCode"],
        "placeId": order["placeId"],
        "quantity": order["quantity"],
        "totalPriceVnd": order["totalPriceVnd"],
        "status": order["status"],
    }


@router.get("/payments/qr/{order_id}")
def get_qr_payment(
    order_id: str,
    request: Request,
    code: str = Query(pattern=r"^[Qq][Tt][0-9A-Fa-f]{10}$"),
) -> dict:
    return _qr_payment_view(_qr_payment_order(request, order_id, code))


@router.post("/payments/qr/{order_id}/confirm")
def confirm_qr_payment(order_id: str, payload: QrPaymentConfirm, request: Request) -> dict:
    """Xác nhận thanh toán từ trang mở bằng mã QR (thanh toán mô phỏng, không chuyển tiền thật)."""
    order = _qr_payment_order(request, order_id, payload.code)
    if order["status"] == "paid":
        return _qr_payment_view(order)
    if order["status"] != "pending":
        # Đơn đã hủy hoặc quá 15 phút thì phải đặt đơn mới.
        raise HTTPException(status_code=409, detail="This ticket order is no longer awaiting payment.")
    try:
        paid = request.app.state.ticket_repository.mark_paid(
            order["id"], method="qr", reference=f"QR-{payload.code.upper()}"
        )
    except PaymentError as error:
        raise _payment_http_error(error) from error
    return _qr_payment_view(paid)


@router.get("/favorites")
def list_favorites(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    items = request.app.state.favorite_repository.list(user["id"])
    return {"items": items, "total": len(items)}


@router.put("/favorites/{place_id}")
async def add_favorite(
    place_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    await request_service(service_url(request, "poi"), "GET", f"/internal/v1/places/{place_id}")
    try:
        return request.app.state.favorite_repository.add(user["id"], place_id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.delete("/favorites/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    place_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    user = authenticated_user(request, authorization)
    request.app.state.favorite_repository.remove(user["id"], place_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tickets/orders/{order_id}/cancel")
def cancel_ticket_order(
    order_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    try:
        order = request.app.state.ticket_repository.cancel_order(user["id"], order_id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if order is None:
        raise HTTPException(status_code=404, detail="Ticket order not found.")
    return order


@router.put("/admin/tickets/prices/{place_id}")
async def update_ticket_price(
    place_id: str,
    payload: TicketPriceUpdate,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    administrator(request, authorization)
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{place_id}",
    )
    request.app.state.ticket_repository.set_price(place_id, payload.price_vnd)
    return {"placeId": place_id, "priceVnd": payload.price_vnd}


@router.get("/admin/tickets")
def get_ticket_sales(
    request: Request,
    authorization: str | None = Header(default=None),
    days: int | None = Query(default=None),
) -> dict:
    administrator(request, authorization)
    if days is not None and days not in ALLOWED_PERIODS:
        raise HTTPException(status_code=422, detail="days must be one of 7, 30, 90, 365.")
    return request.app.state.ticket_repository.sales_summary(days)


@router.post("/analytics/visits", status_code=status.HTTP_201_CREATED)
async def record_visit(payload: VisitSubmission, request: Request) -> dict:
    place = await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{payload.place_id}",
    )
    longitude, latitude = payload.coordinates
    place_longitude, place_latitude = place["coordinates"]
    if _distance_meters(longitude, latitude, place_longitude, place_latitude) > 85:
        raise HTTPException(status_code=422, detail="You must be within 85 m of the place.")
    return await request_service(
        service_url(request, "analytics"),
        "POST",
        "/internal/v1/analytics/visits",
        json={
            "placeId": payload.place_id,
            "visitorId": str(payload.visitor_id),
        },
    )


@router.get("/places/{place_id}/analytics")
async def get_place_analytics(place_id: str, request: Request) -> dict:
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{place_id}",
    )
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        f"/internal/v1/analytics/places/{place_id}",
    )


@router.get("/places/{place_id}/ratings")
async def get_ratings(place_id: str, request: Request) -> dict:
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{place_id}",
    )
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        f"/internal/v1/analytics/ratings/{place_id}",
    )


@router.get("/places/{place_id}/ratings/mine")
async def get_my_rating(
    place_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        f"/internal/v1/analytics/ratings/{place_id}/visitors/{rating_visitor_id(user['id'])}",
    )


@router.post("/analytics/ratings", status_code=status.HTTP_201_CREATED)
async def save_rating(
    payload: RatingSubmission,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    """Chỉ tài khoản đã đăng nhập mới được đánh giá; mỗi tài khoản một đánh giá/điểm."""
    user = authenticated_user(request, authorization)
    if user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Administrators cannot submit ratings.")
    await request_service(
        service_url(request, "poi"),
        "GET",
        f"/internal/v1/places/{payload.place_id}",
    )
    return await request_service(
        service_url(request, "analytics"),
        "POST",
        "/internal/v1/analytics/ratings",
        json={
            "placeId": payload.place_id,
            "visitorId": str(rating_visitor_id(user["id"])),
            "rating": payload.rating,
            "review": payload.review,
        },
    )


@router.get("/admin/reviews")
async def list_admin_reviews(
    request: Request,
    authorization: str | None = Header(default=None),
    place_id: str | None = Query(default=None, alias="placeId", max_length=120),
) -> dict:
    admin_user(request, authorization)
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        "/internal/v1/analytics/admin/reviews",
        params={"placeId": place_id},
    )


@router.delete(
    "/admin/reviews/{place_id}/{review_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_admin_review(
    place_id: str,
    review_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    admin_user(request, authorization)
    await request_service(
        service_url(request, "analytics"),
        "DELETE",
        f"/internal/v1/analytics/ratings/{place_id}/{review_id}",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/analytics/presence", status_code=status.HTTP_204_NO_CONTENT)
async def update_presence(payload: PresenceHeartbeat, request: Request) -> Response:
    await request_service(
        service_url(request, "analytics"),
        "POST",
        "/internal/v1/analytics/presence",
        json=payload.model_dump(mode="json", by_alias=True),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/analytics/presence/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_presence(payload: PresenceHeartbeat, request: Request) -> Response:
    await request_service(
        service_url(request, "analytics"),
        "POST",
        "/internal/v1/analytics/presence/leave",
        json=payload.model_dump(mode="json", by_alias=True),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/analytics/presence")
async def get_online_visitors(request: Request) -> dict:
    return await request_service(
        service_url(request, "analytics"),
        "GET",
        "/internal/v1/analytics/presence",
    )


@router.get("/admin/analytics/online")
async def get_admin_online_visitors(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    admin_user(request, authorization)
    return await get_online_visitors(request)


@router.get("/admin/users")
def get_admin_users(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    admin_user(request, authorization)
    items = request.app.state.auth_repository.list_users()
    return {"items": items, "total": len(items)}


@router.put("/admin/users/{user_id}/lock")
def lock_admin_user(
    user_id: str,
    payload: UserLockUpdate,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    """Khóa hoặc mở khóa tài khoản người dùng thường (không áp dụng cho admin)."""
    current_admin = admin_user(request, authorization)
    if user_id == current_admin["id"]:
        raise HTTPException(status_code=422, detail="You cannot lock your own account.")
    user = request.app.state.auth_repository.set_locked(user_id, payload.locked)
    if user is None:
        raise HTTPException(
            status_code=404, detail="User not found or is an administrator account."
        )
    return user


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(
    user_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    current_admin = admin_user(request, authorization)
    if user_id == current_admin["id"]:
        raise HTTPException(status_code=422, detail="You cannot delete your own account.")
    users = request.app.state.auth_repository.list_users()
    target = next((user for user in users if user["id"] == user_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if target["isAdmin"] and sum(user["isAdmin"] for user in users) <= 1:
        raise HTTPException(status_code=409, detail="The last admin account cannot be deleted.")
    await request_service(
        service_url(request, "tour"),
        "DELETE",
        f"/internal/v1/admin/tours/owner/{user_id}",
    )
    if not request.app.state.auth_repository.delete_user(user_id):
        if any(user["id"] == user_id for user in request.app.state.auth_repository.list_users()):
            raise HTTPException(status_code=409, detail="The last admin account cannot be deleted.")
        raise HTTPException(status_code=404, detail="User not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/admin/places", status_code=status.HTTP_201_CREATED)
async def create_admin_place(
    payload: Place,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    admin_user(request, authorization)
    return await request_service(
        service_url(request, "poi"),
        "POST",
        "/internal/v1/admin/places",
        json=payload.model_dump(mode="json", by_alias=True),
    )


@router.put("/admin/places/{place_id}")
async def update_admin_place(
    place_id: str,
    payload: Place,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    admin_user(request, authorization)
    return await request_service(
        service_url(request, "poi"),
        "PUT",
        f"/internal/v1/admin/places/{place_id}",
        json=payload.model_dump(mode="json", by_alias=True),
    )


@router.delete("/admin/places/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_place(
    place_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    admin_user(request, authorization)
    await request_service(
        service_url(request, "poi"),
        "DELETE",
        f"/internal/v1/admin/places/{place_id}",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/places")
async def list_places(
    request: Request,
    category: Annotated[
        str | None, Query(pattern="^(landmark|food|craft|rest)$")
    ] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
) -> dict:
    return await request_service(
        service_url(request, "poi"),
        "GET",
        "/internal/v1/places",
        params={"category": category, "q": q},
    )


@router.get("/places/{place_id}")
async def get_place(place_id: str, request: Request) -> dict:
    return await request_service(
        service_url(request, "poi"), "GET", f"/internal/v1/places/{place_id}"
    )


@router.get("/narrations/{place_id}")
async def get_narration(
    place_id: str,
    request: Request,
    locale: Locale = Query(default="vi"),
) -> dict:
    return await request_service(
        service_url(request, "narration"),
        "GET",
        f"/internal/v1/narrations/{place_id}",
        params={"locale": locale},
    )


@router.get("/tours")
async def list_tours(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    return await request_service(
        service_url(request, "tour"),
        "GET",
        "/internal/v1/tours",
        params={"userId": user["id"]},
    )


@router.post("/tours", status_code=status.HTTP_201_CREATED)
async def create_tour(
    payload: TourCreate,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    user = authenticated_user(request, authorization)
    tour_payload = payload.model_dump(mode="json", by_alias=True, exclude_none=True)
    tour_payload["ownerId"] = user["id"]
    return await request_service(
        service_url(request, "tour"),
        "POST",
        "/internal/v1/tours",
        json=tour_payload,
    )


@router.delete("/tours/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tour(
    tour_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    user = authenticated_user(request, authorization)
    await request_service(
        service_url(request, "tour"),
        "DELETE",
        f"/internal/v1/tours/{tour_id}",
        params={"userId": user["id"]},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/pairing", status_code=status.HTTP_201_CREATED)
def create_pairing(
    payload: PairingCreate,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict:
    """Máy tính tạo mã QR; nếu đang đăng nhập thì điện thoại sẽ được cấp phiên riêng."""
    user_id = None
    if authorization is not None and authorization.startswith("Bearer "):
        user = request.app.state.auth_repository.authenticate(authorization[7:])
        if user is not None:
            user_id = user["id"]
    try:
        code, expires_at = request.app.state.pairing_repository.create(
            user_id,
            payload.language,
            payload.place_id,
            payload.path,
        )
    except pyodbc.IntegrityError as exc:
        if "547" not in str(exc):
            raise
        raise HTTPException(
            status_code=409, detail="The account or place no longer exists. Refresh and retry."
        ) from exc
    return {
        "code": code,
        "expiresAt": expires_at,
        "expiresIn": PAIRING_TTL_SECONDS,
        "signedIn": user_id is not None,
    }


@router.get("/pairing/{code}")
def get_pairing_status(code: str, request: Request) -> dict:
    result = request.app.state.pairing_repository.status(code)
    if result is None:
        raise HTTPException(status_code=404, detail="Pairing code was not found.")
    return result


@router.post("/pairing/{code}/claim")
def claim_pairing(code: str, request: Request) -> dict:
    """Điện thoại dùng mã QR đúng một lần để nhận ngôn ngữ, địa điểm và phiên đăng nhập."""
    pairing = request.app.state.pairing_repository.claim(code)
    if pairing is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This QR code has expired or was already used.",
        )
    result: dict = {
        "language": pairing["language"],
        "placeId": pairing["placeId"],
        "path": pairing["path"],
        "token": None,
        "user": None,
    }
    if pairing["userId"] is not None:
        session = request.app.state.auth_repository.issue_session(pairing["userId"])
        if session is not None:
            result["token"], result["user"] = session
    return result


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api-gateway"}


def _distance_meters(
    longitude_a: float,
    latitude_a: float,
    longitude_b: float,
    latitude_b: float,
) -> float:
    radians = math.pi / 180
    latitude_delta = (latitude_b - latitude_a) * radians
    longitude_delta = (longitude_b - longitude_a) * radians
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(latitude_a * radians)
        * math.cos(latitude_b * radians)
        * math.sin(longitude_delta / 2) ** 2
    )
    value = min(1, max(0, value))
    return 6_371_000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
