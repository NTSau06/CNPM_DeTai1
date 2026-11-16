"""Check or install all six additional foreign keys in the configured database."""
from pathlib import Path
import argparse
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from services.common.database import Database
from services.common.relationships import apply_relationships, inspect_relationships


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Read-only preflight")
    args = parser.parse_args()
    database = Database()
    print(f"Database: {database.database_name}", flush=True)
    issues = inspect_relationships(database)
    if issues:
        print("\n".join(issues))
        print("No changes applied. Repair these references before retrying.")
        return 1
    if args.check:
        print("All six relationships are ready for migration; no orphan rows.")
        return 0
    apply_relationships(database, require_all=True)
    print("All six foreign keys are enabled and validated. No existing rows were deleted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
