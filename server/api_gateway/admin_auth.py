"""Store administrator credentials and sessions separately from user accounts."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from pathlib import Path


class AdminAuthRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def initialize(
        self,
        email: str,
        password: str,
        legacy_user_database_path: Path,
    ) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        normalized_email = email.strip().lower()
        if bool(normalized_email) != bool(password):
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must both be configured.")
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS admins (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_salt BLOB NOT NULL,
                    password_hash BLOB NOT NULL
                );
                CREATE TABLE IF NOT EXISTS admin_sessions (
                    token_hash TEXT PRIMARY KEY,
                    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
                    expires_at INTEGER NOT NULL,
                    last_seen_at INTEGER
                );
                """
            )
        if not normalized_email:
            return
        if "@" not in normalized_email or len(password) < 12:
            raise RuntimeError(
                "ADMIN_EMAIL must be valid and ADMIN_PASSWORD must contain at least 12 characters."
            )

        self._migrate_legacy_admins(legacy_user_database_path, normalized_email)
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                DELETE FROM admin_sessions
                WHERE admin_id IN (SELECT id FROM admins WHERE email != ?)
                """,
                (normalized_email,),
            )
            connection.execute("DELETE FROM admins WHERE email != ?", (normalized_email,))
            salt = secrets.token_bytes(16)
            password_hash = _hash_password(password, salt)
            row = connection.execute(
                "SELECT id, password_salt, password_hash FROM admins WHERE email = ?",
                (normalized_email,),
            ).fetchone()
            if row and secrets.compare_digest(
                _hash_password(password, bytes(row[1])), bytes(row[2])
            ):
                return

            admin_id = row[0] if row else secrets.token_hex(16)
            connection.execute(
                """
                INSERT INTO admins (id, full_name, email, password_salt, password_hash)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    full_name = excluded.full_name,
                    password_salt = excluded.password_salt,
                    password_hash = excluded.password_hash
                """,
                (
                    admin_id,
                    normalized_email.split("@", 1)[0],
                    normalized_email,
                    salt,
                    password_hash,
                ),
            )
            connection.execute(
                "DELETE FROM admin_sessions WHERE admin_id = ?",
                (admin_id,),
            )

    def login(self, email: str, password: str) -> tuple[str, dict] | None:
        with sqlite3.connect(self.database_path) as connection:
            row = connection.execute(
                "SELECT id, full_name, password_salt, password_hash FROM admins WHERE email = ?",
                (email.strip().lower(),),
            ).fetchone()
        if row is None or not secrets.compare_digest(
            _hash_password(password, bytes(row[2])), bytes(row[3])
        ):
            return None
        admin = {
            "id": row[0],
            "fullName": row[1],
            "email": email.strip().lower(),
            "phone": "",
            "birthDate": "",
            "gender": "",
            "address": "",
            "role": "admin",
        }
        return self._create_session(row[0]), admin

    def authenticate(self, token: str) -> dict | None:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = int(time.time())
        with sqlite3.connect(self.database_path) as connection:
            row = connection.execute(
                """
                SELECT admins.id, admins.full_name, admins.email
                FROM admin_sessions
                JOIN admins ON admins.id = admin_sessions.admin_id
                WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > ?
                """,
                (token_hash, now),
            ).fetchone()
            if row is None:
                connection.execute(
                    "DELETE FROM admin_sessions WHERE token_hash = ? OR expires_at <= ?",
                    (token_hash, now),
                )
                return None
        return {
            "id": row[0],
            "fullName": row[1],
            "email": row[2],
            "phone": "",
            "birthDate": "",
            "gender": "",
            "address": "",
            "role": "admin",
        }

    def heartbeat(self, token: str) -> bool:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = int(time.time())
        with sqlite3.connect(self.database_path) as connection:
            cursor = connection.execute(
                """
                UPDATE admin_sessions
                SET last_seen_at = ?
                WHERE token_hash = ? AND expires_at > ?
                """,
                (now, token_hash, now),
            )
        return cursor.rowcount == 1

    def revoke(self, token: str) -> None:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                "DELETE FROM admin_sessions WHERE token_hash = ?",
                (token_hash,),
            )

    def _create_session(self, admin_id: str) -> str:
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with sqlite3.connect(self.database_path) as connection:
            connection.execute(
                """
                INSERT INTO admin_sessions (token_hash, admin_id, expires_at, last_seen_at)
                VALUES (?, ?, ?, ?)
                """,
                (token_hash, admin_id, now + 30 * 24 * 60 * 60, now),
            )
        return token

    def _migrate_legacy_admins(
        self,
        legacy_user_database_path: Path,
        configured_email: str,
    ) -> None:
        if not legacy_user_database_path.exists():
            return
        with sqlite3.connect(legacy_user_database_path) as users_connection:
            columns = {
                row[1] for row in users_connection.execute("PRAGMA table_info(users)")
            }
            if not columns or "role" not in columns:
                return
            legacy_rows = users_connection.execute(
                """
                SELECT id, full_name, email, password_salt, password_hash
                FROM users
                WHERE role = 'admin' AND email = ?
                """,
                (configured_email,),
            ).fetchall()
            with sqlite3.connect(self.database_path) as admins_connection:
                admins_connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS admins (
                        id TEXT PRIMARY KEY,
                        full_name TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        password_salt BLOB NOT NULL,
                        password_hash BLOB NOT NULL
                    )
                    """
                )
                admins_connection.executemany(
                    """
                    INSERT OR IGNORE INTO admins (
                        id, full_name, email, password_salt, password_hash
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    legacy_rows,
                )
            if legacy_rows:
                user_ids = [row[0] for row in legacy_rows]
                placeholders = ",".join("?" for _ in user_ids)
                users_connection.execute(
                    f"DELETE FROM auth_sessions WHERE user_id IN ({placeholders})",
                    user_ids,
                )
                users_connection.execute(
                    f"DELETE FROM users WHERE id IN ({placeholders})",
                    user_ids,
                )
            users_connection.execute(
                "UPDATE users SET role = 'user' WHERE role = 'admin'"
            )


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
