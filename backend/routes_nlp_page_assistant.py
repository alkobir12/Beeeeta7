from fastapi import APIRouter, Body, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/nlp/page", tags=["nlp-page-assistant"])

db = None


def set_db(database):
    global db
    db = database


_SUGGESTIONS: Dict[str, Dict[str, Any]] = {}
_LEARNING = {
    "approved_entries": [],
    "corrected_entries": [],
    "rejected_entries": [],
    "correction_rules": {},
    "negative_rules": set(),
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _context_signature(page: str, fields: Dict[str, Any]) -> str:
    keys = [
        "operation-type-select",
        "operation-payment-method-select",
        "operation-account-select",
        "entry-transaction-type-select",
        "entry-party-name-input",
        "entry-vehicle-reference-input",
        "line-account-0",
        "line-debit-0",
        "line-credit-0",
    ]
    chunks = [f"page:{_norm(page)}"]
    for key in keys:
        if key in fields and str(fields.get(key, "")).strip():
            chunks.append(f"{key}:{_norm(fields.get(key))}")
    return "|".join(chunks)


def _baseline_suggestion(page: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    page_norm = _norm(page)
    op_type = _norm(fields.get("operation-type-select"))
    payment_method = _norm(fields.get("operation-payment-method-select"))
    op_account = str(fields.get("operation-account-select") or "").strip()
    party_name = str(fields.get("entry-party-name-input") or fields.get("operation-partner-search") or "").strip()
    vehicle_ref = str(fields.get("entry-vehicle-reference-input") or fields.get("operation-vehicle-search") or "").strip()

    # عمليات: البطاقة يجب أن ترتبط بـ POS (006)
    if "operations" in page_norm and payment_method in {"card", "بطاقة", "بطاقه", "pos"} and op_account == "004":
        return {
            "message": "طريقة الدفع بطاقة، يفضّل تحويل الحساب إلى 006 (POS) بدل 004.",
            "corrected_fields": {"operation-account-select": "006"},
        }

    # عمليات: البيع يتطلب عميل أو مركبة
    if "operations" in page_norm and op_type in {"sale", "sale_return"} and not party_name and not vehicle_ref:
        return {
            "message": "عملية البيع تحتاج ربط عميل أو مركبة قبل الحفظ.",
            "corrected_fields": {"operation-partner-search": "", "operation-vehicle-search": ""},
        }

    # دفتر اليومية: منع إدخال نفس السطر مدين ودائن معًا
    if "journal" in page_norm:
        debit0 = float(str(fields.get("line-debit-0") or "0") or "0")
        credit0 = float(str(fields.get("line-credit-0") or "0") or "0")
        if debit0 > 0 and credit0 > 0:
            return {
                "message": "السطر الأول يحتوي مدين ودائن معًا. يفضّل تصفير أحد الطرفين لتجنب الخطأ.",
                "corrected_fields": {"line-credit-0": "0"},
            }

    # دفتر اليومية: سند قبض يجب أن يرتبط بمرجع مركبة
    tx_type = _norm(fields.get("entry-transaction-type-select"))
    if "journal" in page_norm and tx_type == "receipt_voucher" and not vehicle_ref:
        return {
            "message": "سند القبض يتطلب مرجع مركبة (لوحة/رقم زيارة).",
            "corrected_fields": {"entry-vehicle-reference-input": ""},
        }

    return None


@router.post("/context")
async def nlp_page_context(payload: Dict[str, Any] = Body(...)):
    page = str(payload.get("page") or "").strip()
    fields = payload.get("fields") or {}
    if not isinstance(fields, dict):
        raise HTTPException(status_code=400, detail="fields must be an object")

    signature = _context_signature(page, fields)
    if signature in _LEARNING["negative_rules"]:
        return {"suggestion": None}

    learned_fix = _LEARNING["correction_rules"].get(signature)
    if learned_fix:
        sid = str(uuid.uuid4())
        suggestion = {
            "id": sid,
            "message": "اقتراح ذكي من التعلم السابق لنفس النمط.",
            "corrected_fields": learned_fix,
        }
        _SUGGESTIONS[sid] = {
            "id": sid,
            "page": page,
            "fields": fields,
            "signature": signature,
            "suggestion": suggestion,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return {"suggestion": suggestion}

    candidate = _baseline_suggestion(page, fields)
    if not candidate:
        return {"suggestion": None}

    sid = str(uuid.uuid4())
    suggestion = {
        "id": sid,
        "message": candidate.get("message", "يوجد اقتراح تحسين"),
        "corrected_fields": candidate.get("corrected_fields", {}),
    }
    _SUGGESTIONS[sid] = {
        "id": sid,
        "page": page,
        "fields": fields,
        "signature": signature,
        "suggestion": suggestion,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"suggestion": suggestion}


@router.post("/apply_correction")
async def nlp_apply_correction(payload: Dict[str, Any] = Body(...)):
    suggestion_id = str(payload.get("suggestion_id") or "").strip()
    accepted = bool(payload.get("accepted", True))
    if not suggestion_id:
        raise HTTPException(status_code=400, detail="suggestion_id is required")

    item = _SUGGESTIONS.get(suggestion_id)
    if not item:
        raise HTTPException(status_code=404, detail="suggestion not found")

    suggestion = item.get("suggestion") or {}
    corrected_fields = suggestion.get("corrected_fields") or {}
    signature = item.get("signature")

    if accepted:
        _LEARNING["approved_entries"].append(item)
        _LEARNING["corrected_entries"].append({
            "signature": signature,
            "corrected_fields": corrected_fields,
            "at": datetime.now(timezone.utc).isoformat(),
        })
        _LEARNING["correction_rules"][signature] = corrected_fields
        status = "applied"
    else:
        _LEARNING["rejected_entries"].append({
            "signature": signature,
            "at": datetime.now(timezone.utc).isoformat(),
        })
        _LEARNING["negative_rules"].add(signature)
        status = "ignored"

    return {
        "corrected_fields": corrected_fields,
        "status": status,
    }
