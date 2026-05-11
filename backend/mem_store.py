"""
🧰 Shared In-Memory Store Helpers (JSON-on-disk fallback)

Used as a lightweight in-memory persistence layer when DB_PROVIDER is "memory"
or when Mongo isn't available. Files are stored under /app/backend/uploads/<name>.json.

Originally defined in routes_extended.py (lines 43-62); extracted here so that
the new domain-specific routers (settings, approvals, accounts, etc.) can import
the same helpers without duplication.
"""

import json
import os
from typing import Any, List

_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")


def mem_read(name: str) -> List[Any]:
    """Read a JSON list from uploads/<name>.json. Returns [] if missing/invalid."""
    try:
        p = os.path.join(_UPLOADS_DIR, f"{name}.json")
        if not os.path.exists(p):
            return []
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def mem_write(name: str, items: List[Any]) -> None:
    """Write a JSON list to uploads/<name>.json. Best-effort, swallows errors."""
    try:
        os.makedirs(_UPLOADS_DIR, exist_ok=True)
        p = os.path.join(_UPLOADS_DIR, f"{name}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# Aliases that match the legacy underscore-prefixed names used inside routes_extended.py
_mem_read = mem_read
_mem_write = mem_write
