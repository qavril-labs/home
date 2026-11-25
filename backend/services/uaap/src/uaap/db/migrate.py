"""Applies `migrations/*.sql` in order, once each, recorded in `uaap.schema_migrations`.

Run as the schema owner (not the service role):
    UAAP_DATABASE_OWNER_URL=postgresql://... python -m uaap.db.migrate

Each file runs in its own transaction. A checksum guards against editing an applied migration.
(ADR-013 named Alembic; plain SQL with a version table keeps the dependency count down and matches
the core `packages/db` runner. Decision recorded in UAAP_A5_PERSISTENCE.md.)
"""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

import psycopg

MIGRATIONS = Path(__file__).with_name("migrations")
LATEST = max(p.stem for p in MIGRATIONS.glob("*.sql"))

_BOOTSTRAP = """
CREATE SCHEMA IF NOT EXISTS uaap;
CREATE TABLE IF NOT EXISTS uaap.schema_migrations (
  version    text PRIMARY KEY,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
"""


def migrate(owner_url: str) -> list[str]:
    applied_now: list[str] = []
    with psycopg.connect(owner_url, autocommit=False) as conn:
        conn.execute(_BOOTSTRAP)
        conn.commit()
        done: dict[str, str] = dict(
            conn.execute("SELECT version, checksum FROM uaap.schema_migrations").fetchall()
        )
        for path in sorted(MIGRATIONS.glob("*.sql")):
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            if path.stem in done:
                if done[path.stem] != checksum:
                    raise RuntimeError(f"Migration {path.name} changed after it was applied")
                continue
            with conn.transaction():
                conn.execute(sql.encode("utf-8"))  # Trusted file shipped with the code.
                conn.execute(
                    "INSERT INTO uaap.schema_migrations (version, checksum) VALUES (%s, %s)",
                    (path.stem, checksum),
                )
            applied_now.append(path.stem)
    return applied_now


def main() -> None:
    url = os.environ.get("UAAP_DATABASE_OWNER_URL")
    if not url:
        sys.exit("Set UAAP_DATABASE_OWNER_URL to the schema owner's connection string.")
    applied = migrate(url)
    print("Applied: " + (", ".join(applied) if applied else "nothing (up to date)"))


if __name__ == "__main__":
    main()
