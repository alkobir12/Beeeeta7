from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
import os
import uuid
import re
from pathlib import Path
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from emergentintegrations.llm.chat import LlmChat, UserMessage

from routes_finance import supabase  # reuse existing client

router = APIRouter(prefix="/api/finance-bot", tags=["finance-bot"])


FINANCE_SYSTEM_PROMPT = """
أنت محاسب قانوني خارجي ينفذ جلسة تدقيق حيّة.
- اسأل سؤالًا واحدًا فقط في كل رد.
- لا تنتقل لملاحظة جديدة قبل حسم الحالية (resolved أو escalated).
- ابدأ دائمًا بأعلى ملاحظة خطورة.
- واجه التناقضات بالأرقام مباشرة.
- عند المخاطر العالية لا تقبل تفسيرًا بلا مستند داعم.
""".strip()


QUESTION_BANK = {
    "elevated": [
        "ما سبب هذا الارتفاع تحديدًا في هذا الحساب؟",
        "ما العامل الذي أدى لهذا التغير مقارنة بالفترة السابقة؟",
        "هل هذا الارتفاع ناتج عن عملية تشغيلية أم تعديل محاسبي؟",
    ],
    "no_financial_match": [
        "لماذا لا توجد حركة نقدية رغم وجود نشاط مرتبط؟",
        "كيف تم تسجيل هذا النشاط محاسبيًا دون أثر مالي واضح؟",
        "هل هناك تأخير في الاعتراف أو تسجيل ناقص؟",
    ],
    "unsupported": [
        "هل يوجد قيد أو فاتورة مرتبطة؟",
        "ما مصدر هذه القيمة في القيود؟",
    ],
    "linked_mismatch": [
        "لماذا لا يتوافق هذا الحساب مع الحساب المرتبط به؟",
        "كيف تفسر الانفصال بين الإيراد والذمم المدينة هنا؟",
        "هل هناك تسوية لم تُسجل بعد؟",
    ],
    "sudden_change": [
        "ما سبب هذا التغير الحاد خلال هذه الفترة تحديدًا؟",
        "هل هناك حدث استثنائي يفسر هذا الانحراف؟",
        "هل التغيير متكرر أم حالة منفردة؟",
    ],
    "evidence_required": [
        "هل يمكنك رفع مستند داعم الآن (فاتورة/قيد) لهذه الملاحظة؟",
    ],
}


SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
AUDIT_SESSION_MEM: Dict[str, Dict[str, Any]] = {}
_AUDIT_DB = None


def _get_audit_db():
    global _AUDIT_DB
    if _AUDIT_DB is not None:
        return _AUDIT_DB

    try:
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            return None
        _AUDIT_DB = AsyncIOMotorClient(mongo_url)[db_name]
        return _AUDIT_DB
    except Exception:
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_severity(value: Any) -> str:
    s = str(value or "").strip().lower()
    if s in {"critical", "high", "medium", "low"}:
        return s
    if s in {"مرتفع", "عالي"}:
        return "high"
    if s in {"متوسط"}:
        return "medium"
    if s in {"منخفض"}:
        return "low"
    return "medium"


def _detect_category(finding: Dict[str, Any]) -> str:
    hay = " ".join(
        [
            str(finding.get("title") or ""),
            str(finding.get("message") or ""),
            str(finding.get("actual_value") or ""),
        ]
    ).lower()
    if any(k in hay for k in ["لا يتوافق", "عدم توازن", "ذمم", "≠", "فرق"]):
        return "linked_mismatch"
    if any(k in hay for k in ["بدون حركة", "دون أثر", "لا توجد حركة نقدية"]):
        return "no_financial_match"
    if any(k in hay for k in ["غير مدعوم", "فاتورة", "مستند", "قيد"]):
        return "unsupported"
    if any(k in hay for k in ["حاد", "مفاجئ", "قفزة", "انحراف"]):
        return "sudden_change"
    return "elevated"


def _enforce_single_question(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return "ما التفسير المحدد لهذا الانحراف؟"

    m = re.search(r"(.+?[؟?])", cleaned)
    if m:
        q = m.group(1).strip()
    else:
        q = cleaned.rstrip(".!") + "؟"

    q = q.replace("??", "?").replace("؟؟", "؟")
    q = q.replace("?", "؟")
    if not q.endswith("؟"):
        q = q.rstrip(".") + "؟"
    return q


def _is_vague(text: str) -> bool:
    t = str(text or "").strip().lower()
    if len(t) < 8:
        return True
    vague_tokens = ["لا أعرف", "غير متأكد", "ما أدري", "مدري", "يمكن", "احتمال"]
    return any(tok.lower() in t for tok in vague_tokens)


def _build_next_question(finding: Dict[str, Any], ask_evidence: bool = False) -> str:
    category = str(finding.get("category") or "elevated")
    asked = int(finding.get("question_count") or 0)

    if ask_evidence:
        q = QUESTION_BANK["evidence_required"][0]
    else:
        pool = QUESTION_BANK.get(category) or QUESTION_BANK["elevated"]
        q = pool[min(asked, len(pool) - 1)]

    account = str(finding.get("account") or finding.get("account_code") or "").strip()
    if account:
        q = f"في الحساب {account}: {q}"

    return _enforce_single_question(q)


def _normalize_finding(raw: Dict[str, Any], idx: int) -> Dict[str, Any]:
    finding_id = str(raw.get("finding_id") or raw.get("id") or f"finding_{idx+1}")
    severity = _normalize_severity(raw.get("severity"))
    finding = {
        "finding_id": finding_id,
        "title": str(raw.get("title") or raw.get("finding") or "ملاحظة تدقيق"),
        "account": str(raw.get("account") or raw.get("account_code") or ""),
        "period": str(raw.get("period") or ""),
        "actual_value": raw.get("actual_value") if raw.get("actual_value") is not None else raw.get("actual"),
        "expected_range": raw.get("expected_range") if raw.get("expected_range") is not None else raw.get("expected"),
        "severity": severity,
        "confidence": float(raw.get("confidence") or 0),
        "related_accounts": raw.get("related_accounts") or raw.get("linked_accounts") or [],
        "operation_refs": raw.get("operation_refs") or raw.get("references") or [],
        "message": str(raw.get("message") or ""),
        "status": str(raw.get("status") or "open"),
        "category": _detect_category(raw),
        "question_count": int(raw.get("question_count") or 0),
        "evidence": raw.get("evidence") or [],
        "history": raw.get("history") or [],
    }
    return finding


def _sort_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        findings,
        key=lambda f: (
            SEVERITY_ORDER.get(_normalize_severity(f.get("severity")), 99),
            -float(f.get("confidence") or 0),
        ),
    )


async def _load_session(session_id: str) -> Optional[Dict[str, Any]]:
    audit_db = _get_audit_db()
    if audit_db is not None:
        row = await audit_db.finance_audit_sessions.find_one({"session_id": session_id}, {"_id": 0})
        return row
    return AUDIT_SESSION_MEM.get(session_id)


async def _save_session(session: Dict[str, Any]):
    session["updated_at"] = _now_iso()
    audit_db = _get_audit_db()
    if audit_db is not None:
        await audit_db.finance_audit_sessions.update_one(
            {"session_id": session.get("session_id")},
            {"$set": session},
            upsert=True,
        )
        return
    AUDIT_SESSION_MEM[str(session.get("session_id"))] = session


def _first_open_finding(findings: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for finding in findings:
        if finding.get("status") not in {"resolved", "escalated"}:
            return finding
    return None


def _normalize_findings_from_request(payload: "FinanceBotChatRequest") -> List[Dict[str, Any]]:
    incoming = payload.findings or []
    normalized = [_normalize_finding(f, idx) for idx, f in enumerate(incoming)]
    return _sort_findings(normalized)


class FinanceBotChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="نص سؤال أو طلب المستخدم")
    session_id: Optional[str] = Field(None, description="معرف جلسة التدقيق")
    account_code: Optional[str] = Field(
        None, description="كود الحساب المحاسبي المراد تدقيقه (مثل 411 أو 514)"
    )
    workshop_id: Optional[str] = Field(
        None, description="معرّف الورشة، مثل finmodule-sync"
    )
    conversation_id: Optional[str] = Field(
        None, description="معرّف المحادثة للحفاظ على السياق"
    )
    findings: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Findings القادمة من محرك التحليل الخلفي",
    )
    evidence_id: Optional[str] = Field(None, description="معرف المرفق الداعم")
    evidence_name: Optional[str] = Field(None, description="اسم الملف الداعم")
    # بيانات مالية اختيارية لتمكين التحليل القواعدي (لا تغيّر شكل الرد)
    financial_data: Optional[Dict[str, Any]] = Field(
        None,
        description="ملخص بيانات مالية اختيارية (مثل revenue/expenses/assets/liabilities) لإضافة ملاحظات قواعدية",
    )


class FinanceBotChatResponse(BaseModel):
    response: str
    conversation_id: str
    session_id: str
    finding_id: Optional[str] = None
    finding_status: Optional[str] = None
    provider: str = "openai-gpt-5.1"
    timestamp: str


def abu_fahad_safe_analysis(financial_data: Dict[str, Any]) -> Dict[str, List[str]]:
    """تحليل قواعدي بسيط وآمن (بدون LLM) لإضافة تنبيهات سريعة.

    الهدف: إضافة طبقة تدقيق مبدئية حتى لو كانت البيانات محدودة.
    """
    notes: List[str] = []

    try:
        revenue = float(financial_data.get("revenue") or 0)
        expenses = float(financial_data.get("expenses") or 0)
        net_profit = float(
            financial_data.get("net_profit")
            if financial_data.get("net_profit") is not None
            else financial_data.get("netProfit")
            if financial_data.get("netProfit") is not None
            else (revenue - expenses)
        )
        assets = float(financial_data.get("assets") or 0)
        liabilities = float(financial_data.get("liabilities") or 0)

        if revenue > 0:
            margin = (net_profit / revenue) * 100
            if margin < 10:
                notes.append(f"تنبيه: هامش الربح منخفض جداً ({margin:.1f}%). راجع تسعير الخدمات وهوامش قطع الغيار.")
            elif margin < 20:
                notes.append(f"ملاحظة: هامش الربح متوسط ({margin:.1f}%). توجد فرصة لرفع الربحية عبر ضبط المصروفات أو تحسين التسعير.")
        else:
            notes.append("ملاحظة: لا توجد إيرادات مسجلة في البيانات المرسلة. إذا كان هذا غير صحيح، تحقق من تسجيل العمليات والقيود.")

        if revenue > 0 and expenses > revenue:
            notes.append("تنبيه: المصروفات أعلى من الإيرادات في الفترة، وهذا مؤشر خطر على الربحية.")

        if assets > 0 and liabilities > assets * 0.5:
            notes.append("تحذير: نسبة الالتزامات إلى الأصول مرتفعة. راجع السيولة وجدول السداد.")

    except Exception:
        # في حال أي مشكلة تحويل/تنسيق لا نمنع عمل البوت
        pass

    return {"notes": notes}


def build_financial_context(financial_data: Optional[Dict[str, Any]]) -> str:
    if not financial_data:
        return ""
    return (
        "ملخص مالي مختصر:\n"
        f"- الإيرادات: {financial_data.get('revenue', 0)}\n"
        f"- المصروفات: {financial_data.get('expenses', 0)}\n"
        f"- صافي الربح: {financial_data.get('netProfit', financial_data.get('net_profit', 0))}\n"
        f"- هامش الربح: {financial_data.get('profitMargin', financial_data.get('net_margin', 0))}%\n"
        f"- السيولة الحالية: {financial_data.get('current_ratio', '—')}\n"
    )


def _get_llm_chat(conversation_id: Optional[str]) -> LlmChat:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="لم يتم ضبط مفتاح EMERGENT_LLM_KEY في الخادم. يرجى التواصل مع المسؤول.",
        )

    session_id = conversation_id or str(uuid.uuid4())

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=FINANCE_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.1")

    return chat


async def _build_account_context(workshop_id: str, account_code: str) -> str:
    """جلب ملخّص عن حساب معيّن من Supabase لتضمينه في سياق الدردشة."""
    if not supabase:
        return ""

    try:
        # جلب بيانات الحساب من دليل الحسابات
        def lookup_account(table_name: str, field: str):
            return (
                supabase.table(table_name)
                .select("id, code, name_ar, name, type, balance")
                .eq("workshop_id", workshop_id)
                .eq(field, account_code)
                .execute()
            )

        account = None
        for table_name in ["chart_of_accounts", "business_accounts"]:
            try:
                coa_res = lookup_account(table_name, "code")
                account = (coa_res.data or [None])[0]
                if not account:
                    coa_res = lookup_account(table_name, "id")
                    account = (coa_res.data or [None])[0]
                if account:
                    break
            except Exception as e:
                print(f"Account lookup error ({table_name}): {e}")
                continue

        # جلب إجمالي المدين والدائن من قيود اليومية لهذا الحساب
        je_res = (
            supabase.table("journal_entries")
            .select("lines")
            .eq("workshop_id", workshop_id)
            .execute()
        )

        total_debit = 0.0
        total_credit = 0.0
        entries_count = 0

        for row in (je_res.data or []):
            for line in row.get("lines", []) or []:
                code = (
                    line.get("account_code")
                    or line.get("account")
                    or line.get("account_id")
                    or line.get("accountId")
                )
                if str(code) == str(account_code) or (account and str(code) == str(account.get("id"))):
                    total_debit += float(line.get("debit", 0) or 0)
                    total_credit += float(line.get("credit", 0) or 0)
                    entries_count += 1

        if not account and entries_count == 0:
            return f"لا توجد بيانات محاسبية متاحة للحساب {account_code}."

        account_name = (
            account.get("name_ar") or account.get("name") if account else f"الحساب {account_code}"
        )
        account_type = account.get("type") if account else "غير محدد"

        parts = [
            f"ملخص الحساب المحاسبي {account_code}:",
        ]

        parts.append(f"- الاسم: {account_name or 'غير معروف'}")
        parts.append(f"- النوع: {account_type or 'غير محدد'}")
        if account and account.get("balance") is not None:
            parts.append(f"- الرصيد المسجّل: {account.get('balance')}")

        parts.append(
            f"- إجمالي المدين من القيود: {total_debit:.2f} | إجمالي الدائن: {total_credit:.2f} | عدد الحركات: {entries_count}"
        )

        return "\n".join(parts)

    except Exception as e:
        # في حال فشل جلب البيانات، لا نمنع الدردشة، فقط نعيد رسالة مختصرة
        return f"تعذّر جلب بيانات مفصّلة للحساب {account_code} بسبب خطأ تقني: {e}"


@router.get("/health")
async def finance_bot_health():
    """فحص صحة إعداد البوت المالي (وجود المفتاح ونموذج LLM)."""
    has_key = bool(os.environ.get("EMERGENT_LLM_KEY"))
    return {
        "status": "ok" if has_key else "missing-key",
        "provider": "openai",
        "model": "gpt-5.1",
        "has_key": has_key,
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/evidence/upload")
async def upload_finance_evidence(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    finding_id: Optional[str] = Form(None),
):
    """رفع مرفق داعم للتدقيق وربطه بجلسة/ملاحظة."""
    try:
        safe_session = re.sub(r"[^a-zA-Z0-9_-]", "", session_id) or "audit"
        ext = Path(file.filename or "evidence").suffix or ".bin"
        evidence_id = str(uuid.uuid4())

        folder = Path("/app/backend/uploads/finance_audit_evidence") / safe_session
        folder.mkdir(parents=True, exist_ok=True)

        filename = f"{evidence_id}{ext}"
        path = folder / filename

        data = await file.read()
        path.write_bytes(data)

        record = {
            "evidence_id": evidence_id,
            "session_id": session_id,
            "finding_id": finding_id,
            "file_name": file.filename,
            "file_path": str(path),
            "mime_type": file.content_type,
            "size": len(data),
            "uploaded_at": _now_iso(),
        }

        audit_db = _get_audit_db()
        if audit_db is not None:
            await audit_db.finance_audit_evidence.insert_one({**record})

        return {"success": True, "data": record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"تعذر رفع المرفق: {e}")


def _response_state_transition(
    finding: Dict[str, Any],
    user_message: str,
    evidence_id: Optional[str],
) -> Dict[str, Any]:
    message = str(user_message or "").strip()
    severity = _normalize_severity(finding.get("severity"))

    if evidence_id:
        finding.setdefault("evidence", []).append(
            {
                "evidence_id": evidence_id,
                "name": finding.get("latest_evidence_name") or "evidence",
                "attached_at": _now_iso(),
            }
        )
        finding["status"] = "resolved"
        return finding

    if _is_vague(message):
        finding["status"] = "probing"
        return finding

    # المخاطر العالية: لا إغلاق بدون دليل
    if severity in {"high", "critical"}:
        finding["status"] = "pending_evidence"
        return finding

    finding["status"] = "resolved"
    return finding


@router.post("/chat", response_model=FinanceBotChatResponse)
async def finance_bot_chat(payload: FinanceBotChatRequest):
    """جلسة تدقيق تفاعلية: سؤال واحد فقط + حالة Finding محفوظة في DB."""

    workshop_id = payload.workshop_id or os.environ.get("DEFAULT_WORKSHOP_ID", "finmodule-sync")
    session_id = payload.session_id or payload.conversation_id or str(uuid.uuid4())
    user_text = (payload.message or "").strip()

    session = await _load_session(session_id)
    incoming_findings = _normalize_findings_from_request(payload)

    if not session:
        # fallback Findings من تنبيهات النظام إن لم تصل صراحة
        if not incoming_findings and payload.financial_data and isinstance(payload.financial_data.get("findings"), list):
            incoming_findings = _sort_findings([
                _normalize_finding(f, idx)
                for idx, f in enumerate(payload.financial_data.get("findings") or [])
            ])

        if not incoming_findings:
            # mode fallback: استخدم LLM لكن مع حارس سؤال واحد إجباري
            chat = _get_llm_chat(session_id)
            context_parts = []
            if payload.account_code:
                account_context = await _build_account_context(workshop_id, payload.account_code)
                if account_context:
                    context_parts.append(account_context)
            if payload.financial_data:
                context_parts.append(build_financial_context(payload.financial_data))

            full_text = user_text
            if context_parts:
                context_joined = "\n\n".join(context_parts)
                full_text = f"سياق:\n{context_joined}\n\nرسالة المستخدم:\n{user_text}\n\nأعطني سؤال تدقيق واحد فقط."

            try:
                ai_response = await chat.send_message(UserMessage(text=full_text))
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"تعذّر الاتصال بالمساعد المالي: {e}")

            one_q = _enforce_single_question(ai_response)
            return FinanceBotChatResponse(
                response=one_q,
                conversation_id=session_id,
                session_id=session_id,
                finding_id=None,
                finding_status="probing",
                timestamp=datetime.now().isoformat(),
            )

        session = {
            "session_id": session_id,
            "workshop_id": workshop_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "closed_count": 0,
            "findings": incoming_findings,
        }

    findings = session.get("findings") or []
    if not findings:
        raise HTTPException(status_code=400, detail="لا توجد Findings متاحة لبدء جلسة التدقيق.")

    active = _first_open_finding(findings)
    if not active:
        done_q = _enforce_single_question("تم إغلاق كل الملاحظات الحالية. هل ترغب ببدء دورة تدقيق جديدة؟")
        return FinanceBotChatResponse(
            response=done_q,
            conversation_id=session_id,
            session_id=session_id,
            finding_id=None,
            finding_status="resolved",
            timestamp=datetime.now().isoformat(),
        )

    # سجل الرسالة الحالية ضمن تاريخ الملاحظة
    active.setdefault("history", []).append(
        {"role": "user", "text": user_text, "at": _now_iso(), "evidence_id": payload.evidence_id}
    )
    if payload.evidence_name:
        active["latest_evidence_name"] = payload.evidence_name

    if active.get("status") == "open":
        active["status"] = "probing"
        question = _build_next_question(active, ask_evidence=False)
    else:
        _response_state_transition(active, user_text, payload.evidence_id)

        if active.get("status") == "resolved":
            session["closed_count"] = int(session.get("closed_count") or 0) + 1
            active["resolved_at"] = _now_iso()
            next_finding = _first_open_finding(findings)
            if next_finding:
                next_finding["status"] = "probing"
                next_finding["question_count"] = int(next_finding.get("question_count") or 0)
                question = _build_next_question(next_finding, ask_evidence=False)
                active = next_finding
            else:
                question = "تم إغلاق كل الملاحظات الحالية. هل ترغب ببدء دورة تدقيق جديدة؟"
        elif active.get("status") == "pending_evidence":
            question = _build_next_question(active, ask_evidence=True)
        else:
            question = _build_next_question(active, ask_evidence=False)

    active["question_count"] = int(active.get("question_count") or 0) + 1
    active.setdefault("history", []).append({"role": "assistant", "text": question, "at": _now_iso()})

    await _save_session(session)

    return FinanceBotChatResponse(
        response=_enforce_single_question(question),
        conversation_id=session_id,
        session_id=session_id,
        finding_id=active.get("finding_id") if isinstance(active, dict) else None,
        finding_status=active.get("status") if isinstance(active, dict) else "probing",
        timestamp=datetime.now().isoformat(),
    )
