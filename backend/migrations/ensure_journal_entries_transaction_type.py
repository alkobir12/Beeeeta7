"""Ensure transaction_type column exists on Supabase Postgres.

This is used as a lightweight migration step during development.
It uses DATABASE_URL (pgbouncer) if available.

Run:
  python -m migrations.ensure_journal_entries_transaction_type

Note: Uses IF NOT EXISTS, so it is safe to run multiple times.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
import psycopg2

# Load backend/.env when running this migration as a module/script
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _connect():
    """Connect using DATABASE_URL or DIRECT_URL.

    Supabase DATABASE_URL may include '?pgbouncer=true' which psycopg2 doesn't accept.
    """
    database_url = os.environ.get("DATABASE_URL")
    direct_url = os.environ.get("DIRECT_URL")

    if database_url:
        clean = database_url.split("?")[0]
        try:
            return psycopg2.connect(clean)
        except Exception as e:
            print(f"⚠️ DATABASE_URL connect failed: {e}")

    if direct_url:
        return psycopg2.connect(direct_url)

    raise RuntimeError("No valid database URL available (DATABASE_URL/DIRECT_URL)")


def main() -> int:
    conn = _connect()
    cur = conn.cursor()

    cur.execute(
        """
        ALTER TABLE journal_entries
        ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) DEFAULT 'revenue';
        """
    )

    conn.commit()
    cur.close()
    conn.close()

    print("✅ Migration OK: transaction_type ensured on journal_entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
