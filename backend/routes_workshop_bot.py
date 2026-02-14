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


# Endpoints
@router.post("/respond", response_model=BotResponse)
def respond(req: BotRequest):
    text = normalize(req.message)
    engine = normalize_engine(req.engine)
    rule = choose_rule(text, engine)

    if not rule:
        return BotResponse(
            status="need_info",
            reply="خلنا نكمّل الصورة شوي. 🤔",
            next_question=ask_question(),
            confidence=0,
        )

    # Calculate confidence
    confidence = min(95, 50 + len([t for t in rule["triggers"] if t in text]) * 15)

    if req.mode == "tech":
        causes_text = "\n".join([f"• {c[0]}: {c[1]}%" for c in rule["causes"]])
        steps_text = "\n".join([f"{i+1}. {s}" for i, s in enumerate(rule["steps"])])

        return BotResponse(
            status="ok",
            reply=f"🔧 تشخيص فني:\n\n**الأسباب المحتملة:**\n{causes_text}\n\n**خطوات الفحص:**\n{steps_text}",
            probable=[{"cause": c[0], "probability": c[1]} for c in rule["causes"]],
            confidence=confidence,
        )

    if req.mode == "admin":
        causes_text = "\n".join([f"• {c[0]}: {c[1]}%" for c in rule["causes"]])

        return BotResponse(
            status="ok",
            reply=f"📊 ملخص إداري:\n\n**الأسباب المحتملة:**\n{causes_text}\n\n💡 نقترح فحص مبدئي قبل أي اعتماد للعميل.",
            probable=[{"cause": c[0], "probability": c[1]} for c in rule["causes"]],
            confidence=confidence,
        )

    # Client mode (default)
    top_cause = rule["causes"][0][0] if rule["causes"] else "غير محدد"

    return BotResponse(
        status="ok",
        reply=f"من اللي يبان، المشكلة غالباً من **{top_cause}**. نحتاج فحص بسيط للتأكيد. 👍",
        probable=[{"cause": c[0], "probability": c[1]} for c in rule["causes"][:3]],
        confidence=confidence,
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


@router.get("/health")
def health_check():
    return {
        "status": "running",
        "version": "1.2.0",
        "rules_count": len(KB_RULES),
        "engines_supported": len(ENGINE_ALIASES),
    }
