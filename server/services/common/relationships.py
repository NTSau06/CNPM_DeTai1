"""Upgrade relationships in the shared SQL database without discarding old data."""
from __future__ import annotations

from dataclasses import dataclass

from services.common.database import Database


@dataclass(frozen=True)
class Relationship:
    table: str
    column: str
    parent: str
    on_delete: str = "NO ACTION"

    @property
    def name(self) -> str:
        return f"FK_{self.table}_{self.column}"


# Identifiers and actions are constants, never supplied by an API caller.
RELATIONSHIPS = (
    Relationship("tours", "owner_id", "users", "CASCADE"),
    Relationship("ticket_orders", "place_id", "places"),
    Relationship("ticket_prices", "place_id", "places", "CASCADE"),
    Relationship("visits", "place_id", "places"),
    Relationship("ratings", "place_id", "places"),
    Relationship("device_pairings", "place_id", "places", "SET NULL"),
    Relationship("user_favorites", "place_id", "places", "CASCADE"),
)


def _inspect(connection) -> tuple[list[Relationship], list[str]]:
    tables = {
        row[0] for row in connection.execute(
            "SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')"
        ).fetchall()
    }
    available = []
    issues = []
    for relation in RELATIONSHIPS:
        missing = {relation.table, relation.parent} - tables
        if missing:
            issues.append(f"{relation.name}: missing tables {', '.join(sorted(missing))}")
            continue
        available.append(relation)
        count = connection.execute(
            f"SELECT COUNT_BIG(*) FROM dbo.[{relation.table}] AS child "
            f"LEFT JOIN dbo.[{relation.parent}] AS parent "
            f"ON parent.id = child.[{relation.column}] "
            f"WHERE child.[{relation.column}] IS NOT NULL AND parent.id IS NULL"
        ).fetchone()[0]
        if count:
            issues.append(f"{relation.name}: {count} orphan row(s)")
    return available, issues


def inspect_relationships(database: Database) -> list[str]:
    """Read-only preflight; report missing tables and references needing repair."""
    with database.connect() as connection:
        return _inspect(connection)[1]


def apply_relationships(database: Database, *, require_all: bool = False) -> None:
    """Add validated FKs atomically; safe to repeat and run from multiple services.

    A standalone service may start before the parent table exists. Each table
    initializer calls this after committing its schema, so whichever service
    creates the second table installs the relationship. The migration CLI
    requires every table to exist. Orphans always abort; no NOCHECK or data loss.
    """
    with database.connect() as connection:
        result = connection.execute(
            "SET NOCOUNT ON; DECLARE @result INT; "
            "EXEC @result = sys.sp_getapplock "
            "@Resource = N'quangtri-relationship-migration-v1', "
            "@LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000; "
            "SELECT @result"
        ).fetchone()[0]
        if result < 0:
            raise RuntimeError("Could not acquire the database relationship migration lock.")
        available, issues = _inspect(connection)
        errors = issues if require_all else [issue for issue in issues if "orphan row(s)" in issue]
        if errors:
            raise RuntimeError(
                "Cannot add foreign keys; repair the existing references first. "
                "No data was changed.\n" + "\n".join(errors)
            )
        for relation in available:
            existing = connection.execute(
                "SELECT is_disabled, is_not_trusted FROM sys.foreign_keys "
                "WHERE parent_object_id = OBJECT_ID(?) AND name = ?",
                f"dbo.{relation.table}", relation.name,
            ).fetchone()
            if existing is None:
                connection.execute(
                    f"ALTER TABLE dbo.[{relation.table}] WITH CHECK "
                    f"ADD CONSTRAINT [{relation.name}] FOREIGN KEY ([{relation.column}]) "
                    f"REFERENCES dbo.[{relation.parent}] ([id]) ON DELETE {relation.on_delete}"
                )
            elif existing[0] or existing[1]:
                connection.execute(
                    f"ALTER TABLE dbo.[{relation.table}] WITH CHECK "
                    f"CHECK CONSTRAINT [{relation.name}]"
                )
