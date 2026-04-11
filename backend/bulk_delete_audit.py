import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


_AUDIT_LOG_PATH = os.path.join(
    os.path.dirname(__file__),
    "uploads",
    "bulk_delete_audit_log.json",
)
_MAX_EVENTS = 300


def _read_events() -> List[Dict[str, Any]]:
    try:
        if not os.path.exists(_AUDIT_LOG_PATH):
            return []
        with open(_AUDIT_LOG_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _write_events(events: List[Dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(_AUDIT_LOG_PATH), exist_ok=True)
    with open(_AUDIT_LOG_PATH, "w", encoding="utf-8") as handle:
        json.dump(events[-_MAX_EVENTS:], handle, ensure_ascii=False, indent=2)


def record_bulk_delete_event(
    *,
    action: str,
    source_endpoint: str,
    workshop_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
    items: Optional[Dict[str, Any]] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    events = _read_events()
    event = {
        "id": str(uuid.uuid4()),
        "action": str(action or "bulk_delete").strip() or "bulk_delete",
        "source_endpoint": str(source_endpoint or "").strip(),
        "workshop_id": str(workshop_id or "").strip(),
        "user": {
            "id": str(user_id or "system").strip() or "system",
            "role": str(user_role or "unknown").strip() or "unknown",
        },
        "items": items or {},
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    events.append(event)
    _write_events(events)
    return event


def list_bulk_delete_events(
    *,
    workshop_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    rows = _read_events()
    if workshop_id:
        rows = [
            row for row in rows
            if str(row.get("workshop_id") or "").strip() == str(workshop_id).strip()
        ]
    if action:
        rows = [
            row for row in rows
            if str(row.get("action") or "").strip() == str(action).strip()
        ]
    rows.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
    safe_limit = max(1, min(int(limit or 50), 200))
    return rows[:safe_limit]