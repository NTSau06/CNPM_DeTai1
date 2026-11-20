"""Exercise shared-database FK upgrades and delete policies on real SQL Server."""
from pathlib import Path

import pyodbc
import pytest
from fastapi.testclient import TestClient

from api_gateway.auth import AuthRepository
from api_gateway.favorites import FavoriteRepository
from api_gateway.main import create_app as create_gateway_app
from api_gateway.pairing import PairingRepository
from api_gateway.tickets import TicketRepository
from services.analytics_service.repository import AnalyticsRepository
from services.common.relationships import RELATIONSHIPS, apply_relationships, inspect_relationships
from services.poi_service.main import create_app as create_poi_app
from services.poi_service.repository import PlaceRepository
from services.tour_service.repository import TourRepository

SEED = Path(__file__).parents[1] / "services/poi_service/data/places.json"
PLACE = "phong-nha-cave"


def initialize(database, *, parents_last=False):
    repositories = [
        AuthRepository(database), PlaceRepository(database, SEED),
        TourRepository(database), TicketRepository(database),
        AnalyticsRepository(database), PairingRepository(database),
        FavoriteRepository(database),
    ]
    if parents_last:
        # Gateway tables still require users, but places and tours' owner table
        # can appear after their independently started child services.
        repositories = [repositories[i] for i in (2, 4, 0, 3, 5, 6, 1)]
    for repository in repositories:
        repository.initialize()


def add_user(database):
    return AuthRepository(database).register(
        "Test User", "relationships@example.com", "", "valid-password"
    )[1]["id"]


@pytest.fixture
def shared_database(database):
    initialize(database)
    return database


@pytest.mark.parametrize("parents_last", [False, True])
def test_startup_installs_all_trusted_foreign_keys_and_can_repeat(database, parents_last):
    initialize(database, parents_last=parents_last)
    initialize(database, parents_last=not parents_last)
    apply_relationships(database, require_all=True)
    assert inspect_relationships(database) == []
    with database.connect() as connection:
        rows = connection.execute(
            "SELECT is_disabled, is_not_trusted FROM sys.foreign_keys"
        ).fetchall()
        # 7 quan hệ trong RELATIONSHIPS + 4 khóa ngoại tới users khai báo khi tạo bảng.
        assert len(rows) == 11
        assert all(tuple(row) == (False, False) for row in rows)


@pytest.mark.parametrize("sql", [
    "INSERT INTO tours VALUES ('bad-tour', 0, 'missing-user', '{}')",
    "INSERT INTO ticket_prices VALUES ('missing-place', 100)",
    "INSERT INTO ticket_orders (id, user_id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at) "
    "VALUES ('bad-order', ?, 'missing-place', 1, 100, 100, '2026-01-01')",
    "INSERT INTO user_favorites (user_id, place_id, created_at) VALUES (?, 'missing-place', '2026-01-01')",
    "INSERT INTO visits VALUES ('visitor', 'missing-place', '2026-01-01')",
    "INSERT INTO ratings VALUES ('visitor', 'missing-place', 5, '', '2026-01-01')",
    "INSERT INTO device_pairings (code_hash, language, place_id, path, created_at, expires_at) "
    "VALUES ('bad-code', 'vi', 'missing-place', '/', 0, 100)",
])
def test_database_rejects_missing_parent(shared_database, sql):
    user_id = add_user(shared_database)
    with pytest.raises(pyodbc.IntegrityError, match="547"):
        with shared_database.connect() as connection:
            connection.execute(sql, *([user_id] if "?" in sql else []))


def test_upgrade_refuses_orphans_without_partial_changes(shared_database):
    with shared_database.connect() as connection:
        for relation in RELATIONSHIPS:
            connection.execute(f"ALTER TABLE dbo.[{relation.table}] DROP CONSTRAINT [{relation.name}]")
        connection.execute("INSERT INTO tours VALUES ('old-tour', 0, 'missing-user', '{}')")
    assert inspect_relationships(shared_database) == ["FK_tours_owner_id: 1 orphan row(s)"]
    with pytest.raises(RuntimeError, match="orphan"):
        apply_relationships(shared_database, require_all=True)
    with shared_database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM sys.foreign_keys").fetchone()[0] == 4
        assert connection.execute("SELECT owner_id FROM tours").fetchone()[0] == "missing-user"
        connection.execute("UPDATE tours SET owner_id = NULL")
    apply_relationships(shared_database, require_all=True)
    with shared_database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM tours").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM sys.foreign_keys").fetchone()[0] == 11


@pytest.mark.parametrize("history", ["orders", "visits", "ratings"])
def test_delete_place_with_history_returns_conflict_and_keeps_data(shared_database, history):
    user_id = add_user(shared_database)
    with shared_database.connect() as connection:
        if history == "orders":
            connection.execute(
                "INSERT INTO ticket_orders "
                "(id, user_id, place_id, quantity, unit_price_vnd, total_price_vnd, created_at) "
                "VALUES ('order', ?, ?, 1, 100, 100, '2026-01-01')",
                user_id, PLACE,
            )
        elif history == "visits":
            connection.execute("INSERT INTO visits VALUES ('visitor', ?, '2026-01-01')", PLACE)
        else:
            connection.execute("INSERT INTO ratings VALUES ('visitor', ?, 5, '', '2026-01-01')", PLACE)
    with TestClient(create_poi_app(shared_database, SEED)) as client:
        response = client.delete(f"/internal/v1/admin/places/{PLACE}")
        assert response.status_code == 409
        assert client.get(f"/internal/v1/places/{PLACE}").status_code == 200
    with shared_database.connect() as connection:
        table = "ticket_orders" if history == "orders" else history
        assert connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM ticket_prices WHERE place_id = ?", PLACE).fetchone()[0] == 1


def test_delete_unused_place_cleans_price_and_detaches_pairing(shared_database):
    pairing = PairingRepository(shared_database)
    code, _ = pairing.create(None, "vi", PLACE, "/explore")
    with TestClient(create_poi_app(shared_database, SEED)) as client:
        assert client.delete(f"/internal/v1/admin/places/{PLACE}").status_code == 204
    assert pairing.claim(code)["placeId"] is None
    TicketRepository(shared_database).initialize()
    assert PLACE not in {item["placeId"] for item in TicketRepository(shared_database).prices()}


def test_delete_user_cascades_owned_tours_and_accepts_guest_tours(shared_database):
    user_id = add_user(shared_database)
    with shared_database.connect() as connection:
        connection.execute("INSERT INTO tours VALUES ('owned', 0, ?, '{}')", user_id)
        connection.execute("INSERT INTO tours VALUES ('guest', 0, NULL, '{}')")
    assert AuthRepository(shared_database).delete_user(user_id)
    with shared_database.connect() as connection:
        assert [row[0] for row in connection.execute("SELECT id FROM tours")] == ["guest"]


def test_pairing_unknown_place_returns_conflict(shared_database):
    with TestClient(create_gateway_app(database=shared_database, admin_email="", admin_password="")) as client:
        response = client.post("/api/v1/pairing", json={"language": "vi", "placeId": "missing-place"})
    assert response.status_code == 409
