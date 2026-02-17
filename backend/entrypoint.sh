#!/usr/bin/env sh
set -eu

# Wait for database before migrations to reduce boot race conditions.
python - <<'PY'
import os
import time
import psycopg

db_name = os.getenv("DB_NAME", "setlive")
db_user = os.getenv("DB_USER", "postgres")
db_password = os.getenv("DB_PASSWORD", "root")
db_host = os.getenv("DB_HOST", "127.0.0.1")
db_port = os.getenv("DB_PORT", "5432")

dsn = f"dbname={db_name} user={db_user} password={db_password} host={db_host} port={db_port}"
attempts = 30

for attempt in range(1, attempts + 1):
    try:
        with psycopg.connect(dsn, connect_timeout=3):
            print("Database reachable.")
            break
    except Exception as exc:
        if attempt == attempts:
            raise SystemExit(f"Database not reachable after {attempts} attempts: {exc}")
        print(f"Waiting for database ({attempt}/{attempts})...")
        time.sleep(2)
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

APP_PORT="${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "$APP_PORT" config.asgi:application
