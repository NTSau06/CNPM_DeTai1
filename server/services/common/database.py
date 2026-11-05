"""Kết nối SQL Server dùng chung cho các service và API Gateway."""
from __future__ import annotations

import os
import re
from contextlib import contextmanager
from typing import Iterator

import pyodbc

# Mỗi lần mở kết nối mới, đóng hẳn khi xong để có thể xóa database kiểm thử.
pyodbc.pooling = False

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
        self.connection_string = connection_string or os.getenv(
            CONNECTION_STRING_ENV, DEFAULT_CONNECTION_STRING
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
            with pyodbc.connect(master, autocommit=True) as connection:
                try:
                    connection.execute(
                        f"IF DB_ID(N'{name}') IS NULL CREATE DATABASE [{name}]"
                    )
                except pyodbc.Error:
                    # Service khác có thể vừa tạo xong; chỉ báo lỗi nếu vẫn chưa có.
                    if connection.execute(f"SELECT DB_ID(N'{name}')").fetchone()[0] is None:
                        raise
        self._ensured = True

    @contextmanager
    def connect(self) -> Iterator[pyodbc.Connection]:
        connection = pyodbc.connect(self.connection_string)
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
        with pyodbc.connect(master, autocommit=True) as connection:
            connection.execute(
                f"IF DB_ID(N'{name}') IS NOT NULL BEGIN "
                f"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; "
                f"DROP DATABASE [{name}]; END"
            )
        self._ensured = False
