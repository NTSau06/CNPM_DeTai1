"""Lưu tài khoản, mật khẩu băm và phiên đăng nhập cho API Gateway."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from pathlib import Path


class AuthRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    phone TEXT NOT NULL,
                    password_salt BLOB NOT NULL,
                    password_hash BLOB NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user'
                );
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires_at INTEGER NOT NULL,
                    last_seen_at INTEGER
                );
                """
            )
            user_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(users)")
            }
            if "role" not in user_columns:
                connection.execute(
                    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"
                )
            session_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(auth_sessions)")
            }
            if "last_seen_at" not in session_columns:
                connection.execute(
                    "ALTER TABLE auth_sessions ADD COLUMN last_seen_at INTEGER"
                )

    def register(self, full_name: str, email: str, phone: str, password: str) -> tuple[str, dict]:
        salt = secrets.token_bytes(16)
        password_hash = _hash_password(password, salt)
        user_id = secrets.token_hex(16)
        with sqlite3.connect(self.database_path) as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO users (id, full_name, email, phone, password_salt, password_hash)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, full_name, email, phone, salt, password_hash),
                )
            except sqlite3.IntegrityError as error:
                raise ValueError("An account with this email already exists.") from error
        user = self._get_user(user_id)
        if user is None:
            raise RuntimeError("Registered account could not be loaded.")
        return self._create_session(user_id), user

    def login(self, email: str, password: str) -> tuple[str, dict] | None:
        with sqlite3.connect(self.database_path) as connection:
            row = connection.execute(
                "SELECT id, password_salt, password_hash FROM users WHERE email = ?",
                (email,),
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
        with sqlite3.connect(self.database_path) as connection:
            row = connection.execute(
                """
                SELECT users.id
                FROM auth_sessions
                JOIN users ON users.id = auth_sessions.user_id
                WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
                """,
                (token_hash, now),
            ).fetchone()
            if row is None:
                connection.execute(
                    "DELETE FROM auth_sessions WHERE token_hash = ? OR expires_at <= ?",
                    (token_hash, now),
                )
                return None
        return self._get_user(row[0])

    def revoke(self, token: str) -> None:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with sqlite3.connect(self.database_path) as connection:
            connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (token_hash,))

    def heartbeat(self, token: str) -> bool:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = int(time.time())
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute(
                """
                UPDATE auth_sessions
                SET last_seen_at = ?
                WHERE token_hash = ? AND expires_at > ?
                """,
                (now, token_hash, now),
            )
        return cursor.rowcount == 1

    def account_metrics(self) -> dict[str, int]:
        now = int(time.time())
        with sqlite3.connect(self.database_path) as connection:
            total_accounts = connection.execute(
                "SELECT COUNT(*) FROM users"
            ).fetchone()[0]
            active_accounts = connection.execute(
                """
                SELECT COUNT(DISTINCT user_id)
                FROM auth_sessions
                WHERE expires_at > ?
                """,
                (now,),
            ).fetchone()[0]
        return {
            "accountCount": total_accounts,
            "activeAccountCount": active_accounts,
        }

    def _create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        expires_at = now + 30 * 24 * 60 * 60
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                INSERT INTO auth_sessions (token_hash, user_id, expires_at, last_seen_at)
                VALUES (?, ?, ?, ?)
                """,
                (token_hash, user_id, expires_at, now),
            )
        return token

    def _get_user(self, user_id: str) -> dict | None:
        with sqlite3.connect(self.database_path) as connection:
            row = connection.execute(
                "SELECT id, full_name, email, phone, role FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "fullName": row[1],
            "email": row[2],
            "phone": row[3],
            "birthDate": "",
            "gender": "",
            "address": "",
            "role": row[4],
        }


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
