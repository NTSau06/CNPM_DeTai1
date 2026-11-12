"""Check the SQL configuration used by the backend without printing credentials."""
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from services.common.database import Database

started = time.monotonic()
database = Database()
database.ensure_exists()
for attempt in range(3):
    with database.connect() as connection:
        row = connection.execute('SELECT is_auto_close_on FROM sys.databases WHERE name = DB_NAME()').fetchone()
        assert row[0] == 0, 'AUTO_CLOSE must be OFF'
        count = connection.execute('SELECT COUNT(*) FROM places').fetchone()[0]
        print(f'PASS SQL connection {attempt + 1}: {count} places, AUTO_CLOSE=OFF', flush=True)
print(f'Total {time.monotonic() - started:.2f}s', flush=True)
