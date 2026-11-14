"""Lưu phiên ghép nối máy tính - điện thoại tạo từ mã QR."""
from __future__ import annotations

import hashlib
import secrets
import time

from services.common.database import Database

PAIRING_TTL_SECONDS = 3 * 60
# Giữ phiên đã quét thêm một lúc để máy tính kịp đọc trạng thái "claimed".
PAIRING_RETENTION_SECONDS = 10 * 60


class PairingRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.device_pairings', N'U') IS NULL
                CREATE TABLE dbo.device_pairings (
                    code_hash NVARCHAR(64) NOT NULL PRIMARY KEY,
                    user_id NVARCHAR(64) NULL
                        REFERENCES dbo.users(id) ON DELETE CASCADE,
                    language NVARCHAR(10) NOT NULL,
                    place_id NVARCHAR(120) NULL,
                    path NVARCHAR(200) NOT NULL,
                    status NVARCHAR(10) NOT NULL DEFAULT 'pending',
                    created_at BIGINT NOT NULL,
                    expires_at BIGINT NOT NULL,
                    claimed_at BIGINT NULL
                )
                """
            )

    def create(
        self,
        user_id: str | None,
        language: str,
        place_id: str | None,
        path: str,
    ) -> tuple[str, int]:
        """Tạo mã dùng một lần; chỉ lưu bản băm của mã trong database."""
        code = secrets.token_urlsafe(24)
        now = int(time.time())
        expires_at = now + PAIRING_TTL_SECONDS
        with self.database.connect() as connection:
            connection.execute(
                "DELETE FROM device_pairings WHERE expires_at <= ?",
                now - PAIRING_RETENTION_SECONDS,
            )
            connection.execute(
                """
                INSERT INTO device_pairings (
                    code_hash, user_id, language, place_id, path, status, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                _hash_code(code),
                user_id,
                language,
                place_id,
                path,
                now,
                expires_at,
            )
        return code, expires_at

    def status(self, code: str) -> dict | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT status, expires_at FROM device_pairings WHERE code_hash = ?",
                _hash_code(code),
            ).fetchone()
        if row is None:
            return None
        status, expires_at = row
        if status == "pending" and expires_at <= int(time.time()):
            status = "expired"
        return {"status": status, "expiresAt": expires_at}

    def claim(self, code: str) -> dict | None:
        """Đánh dấu đã quét đúng một lần; trả None nếu mã sai, đã dùng hoặc hết hạn."""
        now = int(time.time())
        with self.database.connect() as connection:
            row = connection.execute(
                """
                UPDATE device_pairings
                SET status = 'claimed', claimed_at = ?
                OUTPUT inserted.user_id, inserted.language, inserted.place_id, inserted.path
                WHERE code_hash = ? AND status = 'pending' AND expires_at > ?
                """,
                now,
                _hash_code(code),
                now,
            ).fetchone()
        if row is None:
            return None
        return {
            "userId": row[0],
            "language": row[1],
            "placeId": row[2],
            "path": row[3],
        }


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()
