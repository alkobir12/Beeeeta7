"""
🛡️ Accounting Firewall Dashboard API

نقطة نهاية موحدة تعرض حالة جدار حماية المحاسبة في الوقت الفعلي:

  • Balance integrity   — التحقق من توازن جميع قيود اليومية (مدين = دائن)
  • COGS generation     — قيود تكلفة البضاعة المباعة المولدة تلقائياً
  • Idempotency hits    — حالات منع التكرار
  • Recent rejections   — رفض القيود غير المتوازنة (من السجل الزمني)
  • Precision drift     — انحراف الأرقام عن الصفر بسبب الفاصلة العشرية

Route: GET /api/firewall/status
"""

import os
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

import firewall_state

router = APIRouter(prefix="/api/firewall", tags=["firewall"])


def _to_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _supa():
    """Return Supabase client if provider is supabase, else None."""
    provider = os.environ.get("DB_PROVIDER", "mongo").lower()
    if provider != "supabase":
        return None
    try:
        from supabase_service import SupabaseService
        return SupabaseService()
    except Exception as e:
        print(f"Firewall: Supabase init failed: {e}")
        return None


def _fetch_journal_entries(workshop_id: Optional[str]) -> List[Dict[str, Any]]:
    """Read journal entries from Supabase (preferred) or empty list."""
    supa = _supa()
    if not supa:
        return []
    try:
        query = supa.client.table("journal_entries").select("*")
        if workshop_id:
            query = query.eq("workshop_id", workshop_id)
        res = query.order("created_at", desc=True).limit(2000).execute()
        return res.data or []
    except Exception as e:
        print(f"Firewall: failed to read journal_entries: {e}")
        return []


def _analyze_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Return per-entry analysis: totals, drift, balanced flag."""
    lines = entry.get("lines") or []
    if not isinstance(lines, list):
        lines = []
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    for ln in lines:
        if not isinstance(ln, dict):
            continue
        total_debit += _to_decimal(ln.get("debit"))
        total_credit += _to_decimal(ln.get("credit"))
    drift = (total_debit - total_credit).copy_abs()
    return {
        "debit": float(total_debit.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "credit": float(total_credit.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "drift": float(drift.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
        "balanced": drift <= Decimal("0.009"),
    }


@router.get("/status")
async def firewall_status(
    workshop_id: Optional[str] = Query(default=None),
    recent_limit: int = Query(default=20, ge=1, le=100),
):
    """
    حالة جدار حماية المحاسبة الشاملة.

    العائد:
      - summary: مؤشرات شاملة (balanced/unbalanced/COGS/idempotency)
      - drift: أكبر انحراف ومتوسط الانحراف
      - recent_rejections: آخر رفضيات (من السجل الزمني)
      - recent_idempotency_hits: آخر ضربات منع تكرار
      - recent_cogs_entries: آخر قيود COGS مولدة من الـ DB
      - unbalanced_entries_in_db: قيود غير متوازنة تسربت إلى DB (يجب أن تكون 0)
    """
    entries = _fetch_journal_entries(workshop_id)

    total_entries = len(entries)
    balanced_count = 0
    unbalanced_count = 0
    cogs_count = 0
    cogs_total_amount = 0.0
    idemp_tagged_count = 0
    max_drift = 0.0
    drift_sum = 0.0
    unbalanced_entries_in_db: List[Dict[str, Any]] = []
    recent_cogs: List[Dict[str, Any]] = []

    for entry in entries:
        analysis = _analyze_entry(entry)
        if analysis["balanced"]:
            balanced_count += 1
        else:
            unbalanced_count += 1
            if len(unbalanced_entries_in_db) < recent_limit:
                unbalanced_entries_in_db.append({
                    "id": entry.get("id"),
                    "date": entry.get("date"),
                    "description": entry.get("description"),
                    "debit": analysis["debit"],
                    "credit": analysis["credit"],
                    "drift": analysis["drift"],
                    "source": entry.get("source"),
                })

        drift_val = analysis["drift"]
        drift_sum += drift_val
        if drift_val > max_drift:
            max_drift = drift_val

        # COGS detection
        source = str(entry.get("source") or "").lower()
        if source == "operation_cogs":
            cogs_count += 1
            cogs_total_amount += float(entry.get("total") or 0)
            if len(recent_cogs) < recent_limit:
                recent_cogs.append({
                    "id": entry.get("id"),
                    "date": entry.get("date"),
                    "description": entry.get("description"),
                    "total": float(entry.get("total") or 0),
                    "reference_id": entry.get("reference_id"),
                    "balanced": analysis["balanced"],
                })

        # Idempotency tag detection (in description or notes-like fields)
        haystack = " ".join([
            str(entry.get("description") or ""),
            str(entry.get("source") or ""),
        ])
        if "[IDEMP:" in haystack:
            idemp_tagged_count += 1

    avg_drift = round((drift_sum / total_entries) if total_entries else 0.0, 6)

    counters = firewall_state.get_counters()

    return {
        "success": True,
        "workshop_id": workshop_id,
        "summary": {
            "total_entries": total_entries,
            "balanced_entries": balanced_count,
            "unbalanced_entries_in_db": unbalanced_count,
            "cogs_entries": cogs_count,
            "cogs_total_amount": round(cogs_total_amount, 2),
            "entries_with_idemp_tag": idemp_tagged_count,
            "lifetime_rejections": counters.get("unbalanced_rejection", 0),
            "lifetime_idempotency_hits": counters.get("idempotency_hit", 0),
            "lifetime_cogs_generated": counters.get("cogs_generated", 0),
            "balance_health_percent": round(
                (balanced_count / total_entries * 100.0) if total_entries else 100.0, 2
            ),
        },
        "drift": {
            "max": round(max_drift, 6),
            "avg": avg_drift,
            "threshold": 0.009,
        },
        "recent_rejections": firewall_state.get_events("unbalanced_rejection", limit=recent_limit),
        "recent_idempotency_hits": firewall_state.get_events("idempotency_hit", limit=recent_limit),
        "recent_cogs_events": firewall_state.get_events("cogs_generated", limit=recent_limit),
        "recent_cogs_entries": recent_cogs,
        "unbalanced_entries_in_db": unbalanced_entries_in_db,
    }


@router.post("/test/log-rejection")
async def test_log_rejection(payload: Dict[str, Any]):
    """نقطة اختبار: تسجيل رفض اصطناعي (للاختبار فقط)."""
    firewall_state.log_event(
        "unbalanced_rejection",
        {
            "reason": payload.get("reason") or "manual_test",
            "debit": payload.get("debit"),
            "credit": payload.get("credit"),
            "description": payload.get("description"),
        },
    )
    return {"success": True}
