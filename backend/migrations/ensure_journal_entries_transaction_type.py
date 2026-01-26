"""Ensure transaction_type column exists on Supabase Postgres.

This is used as a lightweight migration step during development.
It uses DATABASE_URL (pgbouncer) if available.

Run:
  python -m migrations.ensure_journal_entries_transaction_type

Note: Uses IF NOT EXISTS, so it is safe to run multiple times.
"""

import os

import psycopg2


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    conn = psycopg2.connect(database_url)
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
