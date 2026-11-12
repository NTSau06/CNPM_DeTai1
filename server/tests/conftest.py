"""Fixture dùng chung: mỗi test có một database SQL Server tạm riêng."""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from typing import Iterator

import pytest
import pyodbc

from services.common.database import Database, _DATABASE_PATTERN

# Test databases are dropped after each test; do not retain their connections.
pyodbc.pooling = False


@pytest.fixture
def database() -> Iterator[Database]:
    name = f"QuangTriTest_{uuid.uuid4().hex[:12]}"
    connection_string = _DATABASE_PATTERN.sub(
        lambda m: f"{m.group(1)}DATABASE={name}", Database().connection_string, count=1
    )
    db = Database(connection_string)
    db.ensure_exists()
    try:
        yield db
    finally:
        db.drop()
