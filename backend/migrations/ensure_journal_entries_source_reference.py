"""Ensure source and reference_id columns exist on journal_entries."""

import os
from pathlib import Path

from dotenv import load_dotenv
import psycopg2

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _connect():
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
        ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'manual';
        """
    )

    cur.execute(
        """
        ALTER TABLE journal_entries
        ADD COLUMN IF NOT EXISTS reference_id VARCHAR(64);
        """
    )

    conn.commit()
    cur.close()
    conn.close()

    print("✅ Migration OK: source/reference_id ensured on journal_entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
