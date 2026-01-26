from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
import os
import uuid
from datetime import datetime

from emergentintegrations.llm.chat import LlmChat, UserMessage

from routes_finance import supabase  # reuse existing Supabase client

router = APIRouter(prefix="/api/finance-bot", tags=["finance-bot"])


FINANCE_SYSTEM_PROMPT = """
أنت "أبوفهد"، المحاسب والمدير المالي الذكي لورش السيارات.
- تتعامل مع بيانات ورشة حقيقية (حسابات، قيود يومية، قوائم مالية، عمليات، فواتير).
- مهامك الأساسية:
  1. تحليل حركة الحسابات (إيرادات، مصروفات، أصول، التزامات، حقوق ملكية) مع مراعاة معايير المحاسبة.
  2. اكتشاف الأخطاء أو الأنماط غير الطبيعية أو الاحتيال المحتمل في القيود والحركات المتكررة.
  3. تنبيه المستخدم عند وجود مؤشر على قرب تحقيق خسارة أو وجود التزامات كبيرة قادمة بناءً على النمط.
  4. تقديم شرح مبسط لحالة الحساب أو القوائم المالية، مع توضيح مستوى الخطورة.
  5. اقتراح توصيات عملية وخطوات تنفيذية واضحة لتحسين الربحية وتقليل المخاطر.

إرشادات الإجابة:
- أجب دائمًا باللغة العربية الفصحى، وبنبرة مهنية وواضحة، وبأسلوب ودود باسم "أبوفهد".
- قسّم الإجابة إلى عناوين فرعية إن أمكن: (ملخص، ملاحظات، أخطاء أو مخاطر محتملة، توصيات عملية، تنبيهات مستقبلية مقترحة).
- عندما تكون الأرقام غير كافية، اطلب توضيحًا محددًا من المستخدم، ولا تفترض أرقامًا من عندك.
- لا تخترع أرقامًا غير موجودة؛ ركّز على التحليل النوعي عندما تكون البيانات محدودة.
- إذا طلب المستخدم تحليلاً عامًا للوضع المالي، حاول تقييم:
  - الربحية الحالية،
  - مستوى الديون والالتزامات،
  - مخاطر السيولة،
  - أي نمط مقلق يظهر من البيانات المتاحة.
""".strip()


class FinanceBotChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="نص سؤال أو طلب المستخدم")
    account_code: Optional[str] = Field(
        None, description="كود الحساب المحاسبي المراد تدقيقه (مثل 411 أو 514)"
    )
    workshop_id: Optional[str] = Field(
        None, description="معرّف الورشة، مثل finmodule-sync"
    )
    conversation_id: Optional[str] = Field(
        None, description="معرّف المحادثة للحفاظ على السياق"
    )
    # بيانات مالية اختيارية لتمكين التحليل القواعدي (لا تغيّر شكل الرد)
    financial_data: Optional[Dict[str, Any]] = Field(
        None,
        description="ملخص بيانات مالية اختيارية (مثل revenue/expenses/assets/liabilities) لإضافة ملاحظات قواعدية",
    )


class FinanceBotChatResponse(BaseModel):


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

    response: str
    conversation_id: str
    provider: str = "openai-gpt-5.1"
    timestamp: str


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
        coa_res = (
            supabase.table("chart_of_accounts")
            .select("id, code, name_ar, name, type, balance")
            .eq("workshop_id", workshop_id)
            .eq("code", account_code)
            .execute()
        )
        account = (coa_res.data or [None])[0]

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
                code = line.get("account_code") or line.get("account")
                if str(code) == str(account_code):
                    total_debit += float(line.get("debit", 0) or 0)
                    total_credit += float(line.get("credit", 0) or 0)
                    entries_count += 1

        if not account and entries_count == 0:
            return f"لا توجد بيانات محاسبية متاحة للحساب {account_code}."

        parts = [
            f"ملخص الحساب المحاسبي {account_code}:",
        ]

        if account:
            parts.append(
                f"- الاسم: {account.get('name_ar') or account.get('name') or 'غير معروف'}"
            )
            parts.append(f"- النوع: {account.get('type') or 'غير محدد'}")
            if account.get("balance") is not None:
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


@router.post("/chat", response_model=FinanceBotChatResponse)
async def finance_bot_chat(payload: FinanceBotChatRequest):
    """نقطة دردشة مع المدير المالي الذكي لورش السيارات."""

    workshop_id = payload.workshop_id or os.environ.get("DEFAULT_WORKSHOP_ID", "finmodule-sync")

    chat = _get_llm_chat(payload.conversation_id)
    session_id = chat.session_id

    # تحضير سياق إضافي إن وُجد حساب محدّد
    context_parts = []
    if payload.account_code:
        account_context = await _build_account_context(workshop_id, payload.account_code)
        if account_context:
            context_parts.append(account_context)

    # يمكن لاحقاً تمرير نتائج تدقيق النظام أو القوائم المالية هنا

    context_text = "\n\n".join(context_parts) if context_parts else ""

    user_text = payload.message.strip()
    if context_text:
        full_text = f"سياق البيانات المحاسبية المتاحة:\n{context_text}\n\nسؤال المستخدم:\n{user_text}"
    else:
        full_text = user_text

    user_message = UserMessage(text=full_text)

    try:
        ai_response = await chat.send_message(user_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"تعذّر الاتصال بالمساعد المالي: {e}")

    # تحليل قواعدي آمن (يُدمج في نفس response كنص إضافي)
    safe_analysis = abu_fahad_safe_analysis(payload.financial_data or {})
    if safe_analysis.get("notes"):
        ai_response = (
            f"{ai_response}\n\n"
            "ملاحظات سريعة (تحليل قواعدي):\n"
            + "\n".join([f"- {n}" for n in safe_analysis["notes"]])
        )

    return FinanceBotChatResponse(
        response=ai_response,
        conversation_id=session_id,
        timestamp=datetime.now().isoformat(),
    )
