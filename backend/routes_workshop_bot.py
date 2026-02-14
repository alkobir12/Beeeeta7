"""
Workshop AI Bot - Saudi Dialect Expert
Engines: 1KD / 2KD / 1GD / 1VD-FTV / FJA300 (LC300)
Modes: client / tech / admin
"""

import os
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx

router = APIRouter(prefix="/api/workshop-bot")

# Dialect Normalization
DIALECT_MAP = {
    "ينتّع": "تردد",
    "ينتع": "تردد",
    "نتعه": "تردد",
    "ما تشد": "ضعف عزم",
    "ماتشد": "ضعف عزم",
    "تقطيع": "تقطيع",
    "تصك": "صوت ضرب",
    "تصق": "صوت ضرب",
    "طقه": "طقطقة",
    "طقطقه": "طقطقة",
    "أشيك": "افحص",
    "اشيك": "افحص",
    "أعاين": "افحص",
    "اعاين": "افحص",
    "يصفّر": "صفير",
    "صفاره": "صفير",
    "يدخّن": "دخان",
    "يدخن": "دخان",
    "تحمى": "حرارة",
    "يحمو": "حرارة",
}


def normalize(text: str) -> str:
    t = (text or "").strip()
    for k, v in DIALECT_MAP.items():
        t = t.replace(k, v)
    return t


# Engine Aliases
ENGINE_ALIASES = {
    "1vd-ftv": ["1vd", "1vd-ftv", "v8 ديزل", "v8 diesel", "v8"],
    "fja300": ["fja300", "lc300", "land cruiser 300", "كروزر 300", "300"],
    "1kd": ["1kd", "1kd-ftv"],
    "2kd": ["2kd", "2kd-ftv"],
    "1gd": ["1gd", "1gd-ftv"],
}


def normalize_engine(engine: Optional[str]) -> Optional[str]:
    if not engine:
        return None
    e = engine.lower().strip()
    for canon, aliases in ENGINE_ALIASES.items():
        for a in aliases:
            if a in e:
                return canon
    return engine.lower()


# Knowledge Base
KB_RULES: List[Dict[str, Any]] = [
    {
        "id": "diesel_black_smoke",
        "engines": None,
        "triggers": ["تردد", "ضعف عزم", "دخان"],
        "smoke": "أسود",
        "causes": [("بخاخ", 60), ("EGR", 25), ("فلتر", 15)],
        "steps": ["افحص فلتر الهواء والوقود", "نظف/افحص EGR", "اختبر البخاخات"],
    },
    {
        "id": "turbo_whistle",
        "engines": None,
        "triggers": ["صفير", "ضعف عزم"],
        "sound": "صفير",
        "causes": [("تهريب تيربو", 70), ("تيربو", 20), ("حساس هواء", 10)],
        "steps": [
            "افحص ليّات التيربو والانتركولر",
            "شد أو بدّل التالف",
            "افحص ضغط التيربو",
        ],
    },
    {
        "id": "1vd_power_loss",
        "engines": ["1vd-ftv"],
        "triggers": ["ضعف عزم", "تردد", "تقطيع"],
        "causes": [
            ("خلل بخاخات (1VD حساس)", 45),
            ("EGR/سناج", 25),
            ("تهريب بُوست", 20),
            ("حساس MAP", 10),
        ],
        "steps": [
            "ابدأ بالفلاتر والبوست",
            "عاين ليّات التيربو والانتركولر",
            "افحص EGR",
            "اختبر توازن البخاخات",
        ],
    },
    {
        "id": "fja300_cutting",
        "engines": ["fja300"],
        "triggers": ["تقطيع", "حرارة", "ضعف عزم"],
        "causes": [
            ("عدم توافق MAF/MAP", 35),
            ("تذبذب بُوست", 30),
            ("ضغط وقود", 20),
            ("تكيّف ECU", 15),
        ],
        "steps": [
            "سجّل بيانات MAF/MAP/Boost",
            "افحص تهريب الهواء",
            "راجع ضغط الوقود",
            "إعادة تعلم ECU حسب الإجراء",
        ],
    },
    {
        "id": "cooling_overheat",
        "engines": None,
        "triggers": ["حرارة", "يحمو", "يغلي"],
        "causes": [
            ("ثرموستات", 35),
            ("مروحة", 25),
            ("طرمبة ماء", 20),
            ("رديتر مسدود", 20),
        ],
        "steps": [
            "افحص مستوى الماء",
            "اختبر الثرموستات",
            "افحص عمل المروحة",
            "نظف الرديتر",
        ],
    },
    {
        "id": "hard_start",
        "engines": None,
        "triggers": ["ما تدور", "ما تشتغل", "صعوبة تشغيل"],
        "causes": [
            ("بطارية ضعيفة", 40),
            ("سلف", 25),
            ("بخاخات", 20),
            ("فلتر ديزل", 15),
        ],
        "steps": [
            "افحص البطارية (فولت وأمبير)",
            "اختبر السلف",
            "افحص ضغط البخاخات",
            "بدل فلتر الديزل",
        ],
    },
]


# Blackbox AI Config
BLACKBOX_API_URL = os.environ.get("BLACKBOX_API_URL")
BLACKBOX_API_KEY = os.environ.get("BLACKBOX_API_KEY")
BLACKBOX_REPO_URL = os.environ.get("BLACKBOX_REPO_URL")
BLACKBOX_BRANCH = os.environ.get("BLACKBOX_BRANCH")

BLACKBOX_MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "blackbox-pro": {
        "label": "Blackbox Pro",
        "agent": "blackbox",
        "model": "blackboxai/blackbox-pro",
    },
    "claude-sonnet-4.5": {
        "label": "Claude Sonnet 4.5",
        "agent": "claude",
        "model": "blackboxai/anthropic/claude-sonnet-4.5",
    },
    "gpt-5-codex": {
        "label": "GPT-5 Codex",
        "agent": "codex",
        "model": "gpt-5-codex",
    },
}


def get_blackbox_agents(model_id: str) -> List[Dict[str, str]]:
    if model_id == "multi":
        return [
            {
                "agent": BLACKBOX_MODEL_REGISTRY["claude-sonnet-4.5"]["agent"],
                "model": BLACKBOX_MODEL_REGISTRY["claude-sonnet-4.5"]["model"],
            },
            {
                "agent": BLACKBOX_MODEL_REGISTRY["blackbox-pro"]["agent"],
                "model": BLACKBOX_MODEL_REGISTRY["blackbox-pro"]["model"],
            },
            {
                "agent": BLACKBOX_MODEL_REGISTRY["gpt-5-codex"]["agent"],
                "model": BLACKBOX_MODEL_REGISTRY["gpt-5-codex"]["model"],
            },
        ]
    if model_id in BLACKBOX_MODEL_REGISTRY:
        config = BLACKBOX_MODEL_REGISTRY[model_id]
        return [{"agent": config["agent"], "model": config["model"]}]
    return []


# Models
class BotRequest(BaseModel):
    mode: Optional[str] = "client"
    message: str
    sound: Optional[str] = None
    smoke: Optional[str] = None
    engine: Optional[str] = None
    model: Optional[str] = "kb"


class BotResponse(BaseModel):
    status: str
    reply: str
    probable: Optional[List[Dict[str, Any]]] = None
    next_question: Optional[str] = None
    confidence: Optional[int] = None
    model_used: Optional[str] = None
    agent_results: Optional[List[Dict[str, Any]]] = None


# Logic
def score_rule(rule, text, engine):
    score = 0
    for t in rule["triggers"]:
        if t in text:
            score += 2
    if rule.get("engines"):
        if engine in rule["engines"]:
            score += 4
        else:
            score -= 2
    return score


def choose_rule(text, engine):
    scored = [(score_rule(r, text, engine), r) for r in KB_RULES]
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored and scored[0][0] >= 2 else None


def ask_question():
    return "الصوت وش هو؟ أو علمني نوع المكينة لو تقدر."


def ensure_blackbox_config():
    missing = [
        key
        for key, value in {
            "BLACKBOX_API_URL": BLACKBOX_API_URL,
            "BLACKBOX_API_KEY": BLACKBOX_API_KEY,
            "BLACKBOX_REPO_URL": BLACKBOX_REPO_URL,
            "BLACKBOX_BRANCH": BLACKBOX_BRANCH,
        }.items()
        if not value
    ]
    if missing:
        raise HTTPException(status_code=500, detail=f"Blackbox config missing: {', '.join(missing)}")


def build_blackbox_prompt(req: BotRequest, engine: Optional[str]) -> str:
    return (
        "أنت مساعد ورشة سيارات ثنائي اللغة (عربي ثم إنجليزي).\n"
        "قدّم إجابة عملية مختصرة مع خطوات فحص مقترحة ونصيحة أمان إن لزم.\n"
        f"وضع المستخدم: {req.mode}.\n"
        f"نوع المكينة: {engine or 'غير محدد'}.\n"
        f"رسالة المستخدم: {req.message}\n"
        "أجب بالعربية أولًا ثم بالإنجليزية في فقرة منفصلة."
    )


def extract_agent_text(execution: Dict[str, Any]) -> str:
    for key in ["output", "response", "message", "content", "text"]:
        if isinstance(execution.get(key), str) and execution.get(key).strip():
            return execution.get(key).strip()
    result = execution.get("result")
    if isinstance(result, dict):
        for key in ["output", "response", "message", "content", "text", "final"]:
            if isinstance(result.get(key), str) and result.get(key).strip():
                return result.get(key).strip()
    if isinstance(result, str) and result.strip():
        return result.strip()
    return ""


async def run_blackbox_task(prompt: str, agents: List[Dict[str, str]]) -> Dict[str, Any]:
    ensure_blackbox_config()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {BLACKBOX_API_KEY}",
    }
    payload = {
        "prompt": prompt,
        "repoUrl": BLACKBOX_REPO_URL,
        "selectedBranch": BLACKBOX_BRANCH,
        "selectedAgents": agents,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        create_resp = await client.post(f"{BLACKBOX_API_URL}/tasks", json=payload, headers=headers)
        if create_resp.status_code >= 400:
            try:
                err_data = create_resp.json()
            except Exception:
                err_data = {}
            error_code = err_data.get("code")
            error_message = err_data.get("error") or err_data.get("message") or create_resp.text
            if error_code == "EXT_AUTO_TOPUP_FAILED":
                error_message = "رصيد Blackbox غير كافٍ. يرجى شحن الحساب أو إضافة وسيلة دفع."
            raise HTTPException(status_code=502, detail=error_message)
        create_data = create_resp.json()
        task = create_data.get("task") or create_data
        task_id = task.get("id") if isinstance(task, dict) else None
        if not task_id:
            raise HTTPException(status_code=500, detail="Blackbox task id not found")

        status_data = {}
        for _ in range(15):
            await asyncio.sleep(2)
            status_resp = await client.get(f"{BLACKBOX_API_URL}/tasks/{task_id}", headers=headers)
            if status_resp.status_code >= 400:
                status_data = {"error": status_resp.text}
                continue
            status_data = status_resp.json()
            agent_execs = (status_data.get("task") or status_data).get("agentExecutions") or []
            if agent_execs and all(exec.get("status") in ["completed", "failed"] for exec in agent_execs):
                break

    return status_data


# Endpoints
@router.post("/respond", response_model=BotResponse)
async def respond(req: BotRequest):
    model_id = (req.model or "kb").strip().lower()
    engine = normalize_engine(req.engine)

    if model_id != "kb":
        agents = get_blackbox_agents(model_id)
        if not agents:
            raise HTTPException(status_code=400, detail="Unknown model")
        prompt = build_blackbox_prompt(req, engine)
        try:
            status_data = await run_blackbox_task(prompt, agents)
        except HTTPException as exc:
            return BotResponse(
                status="error",
                reply=f"تعذر تشغيل Blackbox AI الآن. {exc.detail}",
                model_used=model_id,
            )
        agent_execs = (status_data.get("task") or status_data).get("agentExecutions") or []

        responses = []
        for exec in agent_execs:
            text = extract_agent_text(exec)
            if text:
                label = exec.get("model") or exec.get("agent") or "model"
                responses.append({"label": label, "text": text})

        if model_id == "multi" and responses:
            reply = "\n\n".join([f"— {r['label']}:\n{r['text']}" for r in responses])
        else:
            reply = responses[0]["text"] if responses else "لم نحصل على رد واضح. حاول مرة أخرى."

        return BotResponse(
            status="ok",
            reply=reply,
            model_used=model_id,
            agent_results=agent_execs,
        )

    text = normalize(req.message)
    rule = choose_rule(text, engine)

    if not rule:
        return BotResponse(
            status="need_info",
            reply="خلنا نكمّل الصورة شوي. 🤔",
            next_question=ask_question(),
            confidence=0,
            model_used="kb",
        )

    confidence = min(95, 50 + len([t for t in rule["triggers"] if t in text]) * 15)

    if req.mode == "tech":
        causes_text = "\n".join([f"• {c[0]}: {c[1]}%" for c in rule["causes"]])
        steps_text = "\n".join([f"{i+1}. {s}" for i, s in enumerate(rule["steps"])])

        return BotResponse(
            status="ok",
            reply=f"🔧 تشخيص فني:\n\n**الأسباب المحتملة:**\n{causes_text}\n\n**خطوات الفحص:**\n{steps_text}",
            probable=[{"cause": c[0], "probability": c[1]} for c in rule["causes"]],
            confidence=confidence,
            model_used="kb",
        )

    if req.mode == "admin":
        causes_text = "\n".join([f"• {c[0]}: {c[1]}%" for c in rule["causes"]])

        return BotResponse(
            status="ok",
            reply=f"📊 ملخص إداري:\n\n**الأسباب المحتملة:**\n{causes_text}\n\n💡 نقترح فحص مبدئي قبل أي اعتماد للعميل.",
            probable=[{"cause": c[0], "probability": c[1]} for c in rule["causes"]],
            confidence=confidence,
            model_used="kb",
        )

    top_cause = rule["causes"][0][0] if rule["causes"] else "غير محدد"

    return BotResponse(
        status="ok",
        reply=f"من اللي يبان، المشكلة غالباً من **{top_cause}**. نحتاج فحص بسيط للتأكيد. 👍",
        probable=[{"cause": c[0], "probability": c[1]} for c in rule["causes"][:3]],
        confidence=confidence,
        model_used="kb",
    )


@router.get("/engines")
def get_engines():
    """Get supported engines"""
    return {
        "engines": [
            {"id": "1vd-ftv", "name": "1VD-FTV", "name_ar": "V8 ديزل"},
            {"id": "fja300", "name": "FJA300", "name_ar": "لاندكروزر 300"},
            {"id": "1kd", "name": "1KD-FTV", "name_ar": "4 سلندر ديزل"},
            {"id": "2kd", "name": "2KD-FTV", "name_ar": "4 سلندر ديزل"},
            {"id": "1gd", "name": "1GD-FTV", "name_ar": "4 سلندر ديزل حديث"},
        ]
    }


@router.get("/models")
def get_models():
    models = [
        {"id": "kb", "label": "قاعدة الورشة", "type": "rule"},
        {"id": "multi", "label": "متعدد النماذج", "type": "multi"},
    ]
    for key, config in BLACKBOX_MODEL_REGISTRY.items():
        models.append({"id": key, "label": config["label"], "type": "single"})
    return {"models": models}


@router.get("/health")
def health_check():
    return {
        "status": "running",
        "version": "1.2.0",
        "rules_count": len(KB_RULES),
        "engines_supported": len(ENGINE_ALIASES),
    }
