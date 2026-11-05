"""Lưu tài khoản, mật khẩu băm và phiên đăng nhập cho API Gateway."""
from __future__ import annotations

import hashlib
import secrets
import time

import pyodbc

from services.common.database import Database


class AuthRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize(self) -> None:
        self.database.ensure_exists()
        with self.database.connect() as connection:
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.users', N'U') IS NULL
                CREATE TABLE dbo.users (
                    id NVARCHAR(64) NOT NULL PRIMARY KEY,
                    full_name NVARCHAR(200) NOT NULL,
                    email NVARCHAR(320) NOT NULL UNIQUE,
                    phone NVARCHAR(50) NOT NULL,
                    password_salt VARBINARY(64) NOT NULL,
                    password_hash VARBINARY(128) NOT NULL,
                    is_admin INT NOT NULL DEFAULT 0,
                    birth_date NVARCHAR(10) NOT NULL DEFAULT '',
                    gender NVARCHAR(30) NOT NULL DEFAULT '',
                    address NVARCHAR(500) NOT NULL DEFAULT ''
                )
                """
            )
            connection.execute(
                """
                IF OBJECT_ID(N'dbo.auth_sessions', N'U') IS NULL
                CREATE TABLE dbo.auth_sessions (
                    token_hash NVARCHAR(64) NOT NULL PRIMARY KEY,
                    user_id NVARCHAR(64) NOT NULL
                        REFERENCES dbo.users(id) ON DELETE CASCADE,
                    expires_at BIGINT NOT NULL,
                    last_seen_at BIGINT NULL
                )
                """
            )
            connection.execute(
                """
                IF COL_LENGTH(N'dbo.auth_sessions', N'last_seen_at') IS NULL
                ALTER TABLE dbo.auth_sessions ADD last_seen_at BIGINT NULL
                """
            )
            # Nâng cấp bảng users cũ chưa có các cột hồ sơ/quyền quản trị.
            connection.execute(
                """
                IF COL_LENGTH(N'dbo.users', N'is_admin') IS NULL
                ALTER TABLE dbo.users ADD is_admin INT NOT NULL DEFAULT 0
                """
            )
            for column, size in (("birth_date", 10), ("gender", 30), ("address", 500)):
                connection.execute(
                    f"""
                    IF COL_LENGTH(N'dbo.users', N'{column}') IS NULL
                    ALTER TABLE dbo.users
                    ADD {column} NVARCHAR({size}) NOT NULL DEFAULT ''
                    """
                )

    def register(self, full_name: str, email: str, phone: str, password: str) -> tuple[str, dict]:
        salt = secrets.token_bytes(16)
        password_hash = _hash_password(password, salt)
        user_id = secrets.token_hex(16)
        with self.database.connect() as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO users (id, full_name, email, phone, password_salt, password_hash)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    user_id,
                    full_name,
                    email,
                    phone,
                    salt,
                    password_hash,
                )
            except pyodbc.IntegrityError as error:
                raise ValueError("An account with this email already exists.") from error
        user = self._get_user(user_id)
        if user is None:
            raise RuntimeError("Registered account could not be loaded.")
        return self._create_session(user_id), user

    def login(self, email: str, password: str) -> tuple[str, dict] | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT id, password_salt, password_hash FROM users WHERE email = ?",
                email,
            ).fetchone()
        if row is None:
            return None
        user_id, salt, stored_hash = row
        if not secrets.compare_digest(
            _hash_password(password, bytes(salt)), bytes(stored_hash)
        ):
            return None
        user = self._get_user(user_id)
        if user is None:
            raise RuntimeError("Authenticated account could not be loaded.")
        return self._create_session(user_id), user

    def authenticate(self, token: str) -> dict | None:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = int(time.time())
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT users.id
                FROM auth_sessions
                JOIN users ON users.id = auth_sessions.user_id
                WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
                """,
                token_hash,
                now,
            ).fetchone()
            if row is None:
                connection.execute(
                    "DELETE FROM auth_sessions WHERE token_hash = ? OR expires_at <= ?",
                    token_hash,
                    now,
                )
                return None
        return self._get_user(row[0])

    def list_users(self) -> list[dict]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, full_name, email, phone, is_admin
                FROM users
                ORDER BY full_name, email
                """
            ).fetchall()
        return [
            {
                "id": row[0],
                "fullName": row[1],
                "email": row[2],
                "phone": row[3],
                "isAdmin": bool(row[4]),
            }
            for row in rows
        ]

    def delete_user(self, user_id: str) -> bool:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT is_admin FROM users WITH (UPDLOCK, HOLDLOCK) WHERE id = ?",
                user_id,
            ).fetchone()
            if row is None:
                return False
            if row[0] and connection.execute(
                "SELECT COUNT(*) FROM users WITH (UPDLOCK, HOLDLOCK) WHERE is_admin = 1"
            ).fetchone()[0] <= 1:
                return False
            connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", user_id)
            cursor = connection.execute("DELETE FROM users WHERE id = ?", user_id)
            return cursor.rowcount > 0

    def update_profile(
        self,
        user_id: str,
        full_name: str,
        phone: str,
        birth_date: str,
        gender: str,
        address: str,
    ) -> dict | None:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE users
                SET full_name = ?, phone = ?, birth_date = ?, gender = ?, address = ?
                WHERE id = ?
                """,
                full_name,
                phone,
                birth_date,
                gender,
                address,
                user_id,
            )
            if cursor.rowcount == 0:
                return None
        return self._get_user(user_id)

    def change_password(
        self, user_id: str, current_password: str, new_password: str
    ) -> str | None:
        """Đổi mật khẩu, thu hồi mọi phiên cũ và trả về token phiên mới."""
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT password_salt, password_hash FROM users WHERE id = ?",
                user_id,
            ).fetchone()
            if row is None or not secrets.compare_digest(
                _hash_password(current_password, bytes(row[0])), bytes(row[1])
            ):
                return None
            salt = secrets.token_bytes(16)
            connection.execute(
                "UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?",
                salt,
                _hash_password(new_password, salt),
                user_id,
            )
            connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", user_id)
        return self._create_session(user_id)

    def revoke(self, token: str) -> None:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with self.database.connect() as connection:
            connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", token_hash)

    def heartbeat(self, token: str) -> bool:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = int(time.time())
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE auth_sessions
                SET last_seen_at = ?
                WHERE token_hash = ? AND expires_at > ?
                """,
                now,
                token_hash,
                now,
            )
            return cursor.rowcount == 1

    def account_metrics(self) -> dict[str, int]:
        """Đếm tài khoản người dùng thường; tài khoản admin không tính vào thống kê."""
        now = int(time.time())
        with self.database.connect() as connection:
            total_accounts = connection.execute(
                "SELECT COUNT(*) FROM users WHERE is_admin = 0"
            ).fetchone()[0]
            active_accounts = connection.execute(
                """
                SELECT COUNT(DISTINCT auth_sessions.user_id)
                FROM auth_sessions
                JOIN users ON users.id = auth_sessions.user_id
                WHERE auth_sessions.expires_at > ? AND users.is_admin = 0
                """,
                now,
            ).fetchone()[0]
        return {
            "accountCount": total_accounts,
            "activeAccountCount": active_accounts,
        }

    def ensure_admin(self, email: str, password: str) -> None:
        """Tạo hoặc cấp quyền admin cho tài khoản cấu hình qua ADMIN_EMAIL/ADMIN_PASSWORD."""
        email = email.strip().lower()
        if bool(email) != bool(password):
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must both be configured.")
        if not email:
            return
        salt = secrets.token_bytes(16)
        password_hash = _hash_password(password, salt)
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT id, password_salt, password_hash FROM users WHERE email = ?",
                email,
            ).fetchone()
            if row is None:
                connection.execute(
                    """
                    INSERT INTO users (
                        id, full_name, email, phone, password_salt, password_hash, is_admin
                    ) VALUES (?, ?, ?, ?, ?, ?, 1)
                    """,
                    secrets.token_hex(16),
                    "Administrator",
                    email,
                    "",
                    salt,
                    password_hash,
                )
                return
            if not secrets.compare_digest(
                _hash_password(password, bytes(row[1])), bytes(row[2])
            ):
                connection.execute(
                    "UPDATE users SET password_salt = ?, password_hash = ?, is_admin = 1 WHERE id = ?",
                    salt,
                    password_hash,
                    row[0],
                )
                connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", row[0])
            else:
                connection.execute("UPDATE users SET is_admin = 1 WHERE id = ?", row[0])

    def _create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        expires_at = now + 30 * 24 * 60 * 60
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with self.database.connect() as connection:
            connection.execute(
                "INSERT INTO auth_sessions (token_hash, user_id, expires_at, last_seen_at) "
                "VALUES (?, ?, ?, ?)",
                token_hash,
                user_id,
                expires_at,
                now,
            )
        return token

    def _get_user(self, user_id: str) -> dict | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, full_name, email, phone, is_admin, birth_date, gender, address
                FROM users WHERE id = ?
                """,
                user_id,
            ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "fullName": row[1],
            "email": row[2],
            "phone": row[3],
            "isAdmin": bool(row[4]),
            "birthDate": row[5],
            "gender": row[6],
            "address": row[7],
        }


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
