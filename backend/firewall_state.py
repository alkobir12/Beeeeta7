"""
🛡️ Accounting Firewall — In-Memory Event Log

سجل أحداث جدار حماية المحاسبة في الذاكرة.
يلتقط الأحداث في الوقت الفعلي:
  - رفض القيود غير المتوازنة (unbalanced_rejection)
  - ضربات منع التكرار (idempotency_hit)
  - توليد قيود تكلفة البضاعة المباعة (cogs_generated)

السجل دائري (rolling buffer) بسعة محددة لتفادي تضخم الذاكرة.
"""

from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional

# Rolling buffer per event kind
_MAX_EVENTS_PER_KIND = 200

_events: Dict[str, "deque[Dict[str, Any]]"] = {
    "unbalanced_rejection": deque(maxlen=_MAX_EVENTS_PER_KIND),
    "idempotency_hit": deque(maxlen=_MAX_EVENTS_PER_KIND),
    "cogs_generated": deque(maxlen=_MAX_EVENTS_PER_KIND),
}

# Running counters (lifetime since process started)
_counters: Dict[str, int] = {
    "unbalanced_rejection": 0,
    "idempotency_hit": 0,
    "cogs_generated": 0,
}

_lock = Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(kind: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Append an event to the rolling buffer."""
    with _lock:
        if kind not in _events:
            _events[kind] = deque(maxlen=_MAX_EVENTS_PER_KIND)
            _counters[kind] = 0
        record = {
            "ts": _now_iso(),
            "kind": kind,
            **(details or {}),
        }
        _events[kind].append(record)
        _counters[kind] = _counters.get(kind, 0) + 1


def get_events(kind: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Return most recent events of a given kind (newest first)."""
    with _lock:
        buf = _events.get(kind)
        if not buf:
            return []
        items = list(buf)
    items.reverse()
    if limit and limit > 0:
        items = items[:limit]
    return items


def get_counters() -> Dict[str, int]:
    """Return total counters since process start."""
    with _lock:
        return dict(_counters)


def reset_all() -> None:
    """For tests only."""
    with _lock:
        for k in list(_events.keys()):
            _events[k].clear()
            _counters[k] = 0
