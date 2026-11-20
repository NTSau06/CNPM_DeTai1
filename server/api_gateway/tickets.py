"""Persist ticket prices, user orders, and sales summaries."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from services.common.database import Database
from services.common.relationships import apply_relationships

DEFAULT_TICKET_PRICES_VND = {
    "phong-nha-cave": 150_000,
    "thien-duong-cave": 150_000,
    "dark-cave": 150_000,
    "tien-son-cave": 70_000,
    "ozo-park": 150_000,
    "nhat-le-beach": 70_000,
    "dong-hoi-market": 70_000,
    "bao-ninh-village": 70_000,
    "vinh-moc-tunnels": 100_000,
    "hien-luong-bridge": 70_000,
    "quang-tri-citadel": 70_000,
    "cua-tung-beach": 70_000,
    "nuoc-mooc-spring": 120_000,
    "da-nhay-beach": 70_000,
}


ORDER_COLUMNS = (
    "id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at, status, cancelled_at, "
    "payment_method, payment_ref, paid_at, expires_at"
)

# Vòng đời đơn vé: pending (chờ thanh toán) -> paid | cancelled | expired.
# Đơn tạo trước khi có thanh toán mang trạng thái cũ 'booked' và được chuyển thành 'paid'.
PAYMENT_TIMEOUT = timedelta(minutes=15)
PAYMENT_METHODS = ("mock", "vnpay")


class PaymentError(Exception):
    """Lỗi nghiệp vụ khi thanh toán; ``code`` dùng để chọn mã HTTP/IPN phù hợp."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class TicketRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.ticket_prices', N'U') IS NULL
                CREATE TABLE dbo.ticket_prices (
                    place_id NVARCHAR(120) NOT NULL PRIMARY KEY,
                    price_vnd INT NULL
                )
                """
            )
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.ticket_orders', N'U') IS NULL
                CREATE TABLE dbo.ticket_orders (
                    id NVARCHAR(64) NOT NULL PRIMARY KEY,
                    user_id NVARCHAR(64) NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
                    place_id NVARCHAR(120) NOT NULL,
                    quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 10),
                    unit_price_vnd INT NOT NULL,
                    total_price_vnd INT NOT NULL,
                    created_at NVARCHAR(40) NOT NULL,
                    status NVARCHAR(16) NOT NULL DEFAULT 'pending',
                    cancelled_at NVARCHAR(40) NULL,
                    payment_method NVARCHAR(16) NULL,
                    payment_ref NVARCHAR(100) NULL,
                    paid_at NVARCHAR(40) NULL,
                    expires_at NVARCHAR(40) NULL
                )
                """
            )
            # Nâng cấp bảng cũ: thêm trạng thái đơn và thông tin thanh toán.
            connection.execute(
                """
                IF COL_LENGTH(N'dbo.ticket_orders', N'status') IS NULL
                ALTER TABLE dbo.ticket_orders
                ADD status NVARCHAR(16) NOT NULL DEFAULT 'paid'
                """
            )
            for column, definition in (
                ("cancelled_at", "NVARCHAR(40) NULL"),
                ("payment_method", "NVARCHAR(16) NULL"),
                ("payment_ref", "NVARCHAR(100) NULL"),
                ("paid_at", "NVARCHAR(40) NULL"),
                ("expires_at", "NVARCHAR(40) NULL"),
            ):
                connection.execute(
                    f"""
                    IF COL_LENGTH(N'dbo.ticket_orders', N'{column}') IS NULL
                    ALTER TABLE dbo.ticket_orders ADD {column} {definition}
                    """
                )
            # Đơn cũ (trước khi có thanh toán) được coi là đã thanh toán.
            connection.execute(
                "UPDATE ticket_orders SET status = 'paid', paid_at = created_at "
                "WHERE status = 'booked'"
            )
            # Do not recreate prices for places removed by an administrator.
            place_ids = None
            if connection.execute("SELECT OBJECT_ID(N'dbo.places', N'U')").fetchone()[0]:
                place_ids = {row[0] for row in connection.execute("SELECT id FROM dbo.places")}
            for place_id, price_vnd in DEFAULT_TICKET_PRICES_VND.items():
                if place_ids is not None and place_id not in place_ids:
                    continue
                connection.execute(
                    """
                    IF NOT EXISTS (SELECT 1 FROM dbo.ticket_prices WHERE place_id = ?)
                    INSERT INTO dbo.ticket_prices (place_id, price_vnd) VALUES (?, ?)
                    """,
                    place_id,
                    place_id,
                    price_vnd,
                )

        apply_relationships(self.database)

    def set_price(self, place_id: str, price_vnd: int | None) -> None:
        with self.database.connect() as connection:
            updated = connection.execute(
                "UPDATE ticket_prices SET price_vnd = ? WHERE place_id = ?",
                price_vnd,
                place_id,
            ).rowcount
            if updated == 0:
                connection.execute(
                    "INSERT INTO ticket_prices (place_id, price_vnd) VALUES (?, ?)",
                    place_id,
                    price_vnd,
                )

    def prices(self) -> list[dict]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT place_id, price_vnd FROM ticket_prices ORDER BY place_id"
            ).fetchall()
        return [{"placeId": row[0], "priceVnd": row[1]} for row in rows]

    def create_order(self, user_id: str, place_id: str, quantity: int) -> dict:
        """Tạo đơn ở trạng thái chờ thanh toán, giữ chỗ trong PAYMENT_TIMEOUT."""
        # Mã đơn chỉ gồm chữ số hex để dùng trực tiếp làm vnp_TxnRef của VNPay.
        order_id = secrets.token_hex(8)
        now = datetime.now(timezone.utc)
        created_at = _iso(now)
        expires_at = _iso(now + PAYMENT_TIMEOUT)
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT price_vnd FROM ticket_prices WITH (HOLDLOCK) WHERE place_id = ?",
                place_id,
            ).fetchone()
            if row is None or row[0] is None or row[0] <= 0:
                raise ValueError("Tickets are not available for this place.")
            unit_price_vnd = row[0]
            total_price_vnd = unit_price_vnd * quantity
            connection.execute(
                """
                INSERT INTO ticket_orders (
                    id, user_id, place_id, quantity, unit_price_vnd,
                    total_price_vnd, created_at, status, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """,
                order_id,
                user_id,
                place_id,
                quantity,
                unit_price_vnd,
                total_price_vnd,
                created_at,
                expires_at,
            )
        return _order_record(
            (
                order_id, place_id, quantity, unit_price_vnd, total_price_vnd,
                created_at, "pending", None, None, None, None, expires_at,
            )
        )

    @staticmethod
    def _expire_stale(connection) -> None:
        connection.execute(
            "UPDATE ticket_orders SET status = 'expired' "
            "WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?",
            _utc_now(),
        )

    def user_orders(self, user_id: str) -> list[dict]:
        with self.database.connect() as connection:
            self._expire_stale(connection)
            rows = connection.execute(
                f"""
                SELECT {ORDER_COLUMNS}
                FROM ticket_orders
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                user_id,
            ).fetchall()
        return [_order_record(row) for row in rows]

    def get_order(self, order_id: str, user_id: str | None = None) -> dict | None:
        with self.database.connect() as connection:
            self._expire_stale(connection)
            row = connection.execute(
                f"SELECT {ORDER_COLUMNS}, user_id FROM ticket_orders WHERE id = ?",
                order_id,
            ).fetchone()
        if row is None or (user_id is not None and row[12] != user_id):
            return None
        return _order_record(row)

    def start_payment(self, user_id: str, order_id: str, method: str) -> dict:
        """Ghi nhận phương thức thanh toán người dùng chọn cho đơn đang chờ."""
        if method not in PAYMENT_METHODS:
            raise PaymentError("invalid_method", "Unsupported payment method.")
        with self.database.connect() as connection:
            self._expire_stale(connection)
            row = connection.execute(
                f"SELECT {ORDER_COLUMNS} FROM ticket_orders WITH (UPDLOCK, HOLDLOCK) "
                "WHERE id = ? AND user_id = ?",
                order_id,
                user_id,
            ).fetchone()
            if row is None:
                raise PaymentError("not_found", "Ticket order not found.")
            if row[6] != "pending":
                raise PaymentError("not_pending", _not_pending_message(row[6]))
            connection.execute(
                "UPDATE ticket_orders SET payment_method = ? WHERE id = ?", method, order_id
            )
        return _order_record((*tuple(row)[:8], method, *tuple(row)[9:12]))

    def mark_paid(
        self,
        order_id: str,
        *,
        method: str,
        reference: str,
        amount_vnd: int | None = None,
        user_id: str | None = None,
    ) -> dict:
        """Xác nhận thanh toán thành công (idempotent với cùng mã giao dịch)."""
        paid_at = _utc_now()
        with self.database.connect() as connection:
            self._expire_stale(connection)
            row = connection.execute(
                f"SELECT {ORDER_COLUMNS}, user_id FROM ticket_orders WITH (UPDLOCK, HOLDLOCK) "
                "WHERE id = ?",
                order_id,
            ).fetchone()
            if row is None or (user_id is not None and row[12] != user_id):
                raise PaymentError("not_found", "Ticket order not found.")
            if amount_vnd is not None and amount_vnd != row[4]:
                raise PaymentError("invalid_amount", "Paid amount does not match the order.")
            if row[6] == "paid":
                raise PaymentError("already_paid", "This ticket order has already been paid.")
            # Đơn vừa hết hạn vẫn nhận kết quả thanh toán thành công từ cổng
            # (tiền đã bị trừ), để tránh mất vé của khách.
            if row[6] not in {"pending", "expired"}:
                raise PaymentError("not_pending", _not_pending_message(row[6]))
            connection.execute(
                """
                UPDATE ticket_orders
                SET status = 'paid', paid_at = ?, payment_method = ?, payment_ref = ?
                WHERE id = ?
                """,
                paid_at,
                method,
                reference[:100],
                order_id,
            )
        return _order_record((*tuple(row)[:6], "paid", None, method, reference[:100], paid_at, row[11]))

    def cancel_order(self, user_id: str, order_id: str) -> dict | None:
        """Hủy đơn đang chờ hoặc đã thanh toán (hoàn tiền mô phỏng).

        Trả về None nếu không tìm thấy đơn; ném ValueError khi đơn không còn hủy được.
        """
        cancelled_at = _utc_now()
        with self.database.connect() as connection:
            self._expire_stale(connection)
            row = connection.execute(
                f"""
                SELECT {ORDER_COLUMNS}
                FROM ticket_orders WITH (UPDLOCK, HOLDLOCK)
                WHERE id = ? AND user_id = ?
                """,
                order_id,
                user_id,
            ).fetchone()
            if row is None:
                return None
            if row[6] == "cancelled":
                raise ValueError("This ticket order has already been cancelled.")
            if row[6] == "expired":
                raise ValueError("This ticket order has expired.")
            connection.execute(
                """
                UPDATE ticket_orders SET status = 'cancelled', cancelled_at = ?
                WHERE id = ?
                """,
                cancelled_at,
                order_id,
            )
        return _order_record((*tuple(row)[:6], "cancelled", cancelled_at, *tuple(row)[8:12]))

    def sales_summary(self, period_days: int | None = None) -> dict:
        """Tổng hợp vé đã thanh toán, có thể lọc theo số ngày gần nhất."""
        since = ""
        if period_days is not None:
            since = _iso(datetime.now(timezone.utc) - timedelta(days=period_days))
        with self.database.connect() as connection:
            self._expire_stale(connection)
            totals = connection.execute(
                """
                SELECT COALESCE(SUM(quantity), 0), COUNT(*),
                       COALESCE(SUM(total_price_vnd), 0)
                FROM ticket_orders
                WHERE status = 'paid' AND created_at >= ?
                """,
                since,
            ).fetchone()
            status_counts = dict(
                connection.execute(
                    """
                    SELECT status, COUNT(*) FROM ticket_orders
                    WHERE created_at >= ?
                    GROUP BY status
                    """,
                    since,
                ).fetchall()
            )
            by_place = connection.execute(
                """
                SELECT place_id, SUM(quantity), SUM(total_price_vnd)
                FROM ticket_orders
                WHERE status = 'paid' AND created_at >= ?
                GROUP BY place_id
                ORDER BY SUM(quantity) DESC, place_id
                """,
                since,
            ).fetchall()
            recent = connection.execute(
                f"""
                SELECT TOP 20 {ORDER_COLUMNS}
                FROM ticket_orders
                WHERE created_at >= ?
                ORDER BY created_at DESC, id DESC
                """,
                since,
            ).fetchall()
        return {
            "periodDays": period_days,
            "totalTicketsSold": totals[0],
            "totalOrders": totals[1],
            "pendingOrders": status_counts.get("pending", 0),
            "cancelledOrders": status_counts.get("cancelled", 0),
            "expiredOrders": status_counts.get("expired", 0),
            "totalRevenueVnd": totals[2],
            "places": [
                {
                    "placeId": row[0],
                    "ticketsSold": row[1],
                    "revenueVnd": row[2],
                }
                for row in by_place
            ],
            "recentOrders": [_order_record(row) for row in recent],
        }


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _utc_now() -> str:
    return _iso(datetime.now(timezone.utc))


def _not_pending_message(status: str) -> str:
    return {
        "cancelled": "This ticket order has been cancelled.",
        "expired": "This ticket order has expired. Please book again.",
        "paid": "This ticket order has already been paid.",
    }.get(status, "This ticket order cannot be paid.")


def _order_record(row: tuple) -> dict:
    return {
        "id": row[0],
        # Mã vé hiển thị cho du khách đọc/đối chiếu tại quầy.
        "ticketCode": "QT-" + row[0].replace("-", "").replace("_", "")[:8].upper(),
        "placeId": row[1],
        "quantity": row[2],
        "unitPriceVnd": row[3],
        "totalPriceVnd": row[4],
        "createdAt": row[5],
        "status": row[6],
        "cancelledAt": row[7],
        "paymentMethod": row[8],
        "paymentRef": row[9],
        "paidAt": row[10],
        "expiresAt": row[11],
    }
