"""Kết nối SQL Server dùng chung cho các service và API Gateway."""
from __future__ import annotations

import os
import re
import time
from contextlib import closing, contextmanager
from typing import Iterator

import pyodbc

# Runtime reuses ODBC connections. Tests disable pooling in their own process.

DEFAULT_CONNECTION_STRING = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    r"SERVER=localhost\SQLEXPRESS;"
    "DATABASE=QuangTriDB;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)
CONNECTION_STRING_ENV = "SQLSERVER_CONNECTION_STRING"
_DATABASE_PATTERN = re.compile(r"(?i)(^|;)\s*(DATABASE|Initial Catalog)\s*=\s*([^;]+)")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9_]+$")


class Database:
    """Giữ chuỗi kết nối SQL Server và cung cấp kết nối có commit/rollback tự động."""

    def __init__(self, connection_string: str | None = None) -> None:
        self.connection_string = (
            connection_string
            or os.getenv(CONNECTION_STRING_ENV)
            or DEFAULT_CONNECTION_STRING
        )
        self._ensured = False

    @property
    def database_name(self) -> str | None:
        match = _DATABASE_PATTERN.search(self.connection_string)
        return match.group(3).strip() if match else None

    def ensure_exists(self) -> None:
        """Tạo database nếu chưa có (kết nối qua master)."""
        if self._ensured:
            return
        name = self.database_name
        if name is not None:
            if not _SAFE_NAME.match(name):
                raise ValueError(f"Unsupported database name: {name!r}")
            master = _DATABASE_PATTERN.sub(
                lambda m: f"{m.group(1)}DATABASE=master", self.connection_string, count=1
            )
            with closing(pyodbc.connect(master, autocommit=True, timeout=5)) as connection:
                connection.timeout = 10
                for attempt in range(10):
                    try:
                        connection.execute(
                            f"IF DB_ID(N'{name}') IS NULL CREATE DATABASE [{name}]"
                        )
                        break
                    except pyodbc.Error:
                        # Service khác có thể đang tạo hoặc vừa tạo xong; đợi ngắn rồi kiểm tra lại.
                        if connection.execute(f"SELECT DB_ID(N'{name}')").fetchone()[0] is not None:
                            break
                        if attempt == 9:
                            raise
                        time.sleep(0.5)
                # SQL Express can create databases with AUTO_CLOSE enabled.
                # Keep frequently used service databases open between requests.
                connection.execute(
                    f"IF EXISTS (SELECT 1 FROM sys.databases "
                    f"WHERE name = ? AND is_auto_close_on = 1) "
                    f"ALTER DATABASE [{name}] SET AUTO_CLOSE OFF",
                    name,
                )
        self._ensured = True

    @contextmanager
    def connect(self) -> Iterator[pyodbc.Connection]:
        connection = pyodbc.connect(self.connection_string, timeout=5)
        connection.timeout = 10
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def drop(self) -> None:
        """Xóa hẳn database (dùng cho kiểm thử)."""
        name = self.database_name
        if name is None or not _SAFE_NAME.match(name):
            raise ValueError("Database name is required to drop it.")
        master = _DATABASE_PATTERN.sub(
            lambda m: f"{m.group(1)}DATABASE=master", self.connection_string, count=1
        )
        with closing(pyodbc.connect(master, autocommit=True, timeout=5)) as connection:
            connection.execute(
                f"IF DB_ID(N'{name}') IS NOT NULL BEGIN "
                f"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; "
                f"DROP DATABASE [{name}]; END"
            )
        self._ensured = False
