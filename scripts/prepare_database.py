"""Initialize the shared database before starting the five local services."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from services.common.database import Database

database = Database()
database.ensure_exists()
with database.connect() as connection:
    connection.execute('SELECT 1').fetchone()
print('SQL Server is ready; AUTO_CLOSE is OFF.', flush=True)
