from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path
import uuid
import json
import os

import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage

try:
    from supabase import create_client
except Exception:
    create_client = None


router = APIRouter(prefix="/api/moltbot", tags=["moltbot"])

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

PROJECTS_FILE = UPLOADS_DIR / "moltbot_projects.json"
SESSIONS_FILE = UPLOADS_DIR / "moltbot_sessions.json"
MESSAGES_FILE = UPLOADS_DIR / "moltbot_messages.json"


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _read_list(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _write_list(path: Path, data: List[Dict[str, Any]]):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _ensure_supabase_client():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (supabase_url and supabase_key and create_client):
        return None
    try:
        return create_client(supabase_url, supabase_key)
    except Exception:
        return None


supabase_client = _ensure_supabase_client()


class MoltbotProjectCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = ""
    industry: Optional[str] = ""
    domain: Optional[str] = ""
    status: Optional[str] = "draft"
    resale_ready: Optional[bool] = False


class MoltbotProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    domain: Optional[str] = None
    status: Optional[str] = None
    resale_ready: Optional[bool] = None
    last_build_at: Optional[str] = None


class MoltbotProject(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    industry: Optional[str] = ""
    domain: Optional[str] = ""
    status: str
    resale_ready: bool
    created_at: str
    updated_at: str
    last_build_at: Optional[str] = None


class MoltbotSession(BaseModel):
    id: str
    project_id: str
    title: str
    created_at: str


class MoltbotMessage(BaseModel):
    id: str
    session_id: str
    project_id: str
    role: str
    agent: Optional[str] = None
    content: str
    created_at: str


class MoltbotChatRequest(BaseModel):
    project_id: str
    session_id: Optional[str] = None
    message: str
    goal: Optional[str] = None
    use_agents: Optional[List[str]] = None


class MoltbotChatResponse(BaseModel):
    project_id: str
    session_id: str
    agents: Dict[str, str]
    summary: str
    messages: List[MoltbotMessage]


def _save_project(project: Dict[str, Any]) -> Dict[str, Any]:
    if supabase_client:
        try:
            response = supabase_client.table("moltbot_projects").insert(project).execute()
            return (response.data or [project])[0]
        except Exception:
            pass
    projects = _read_list(PROJECTS_FILE)
    projects.append(project)
    _write_list(PROJECTS_FILE, projects)
    return project


def _update_project(project_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    if supabase_client:
        try:
            response = (
                supabase_client.table("moltbot_projects")
                .update(updates)
                .eq("id", project_id)
                .execute()
            )
            if response.data:
                return response.data[0]
        except Exception:
            pass
    projects = _read_list(PROJECTS_FILE)
    for idx, proj in enumerate(projects):
        if proj.get("id") == project_id:
            projects[idx] = {**proj, **updates}
            _write_list(PROJECTS_FILE, projects)
            return projects[idx]
    raise HTTPException(status_code=404, detail="المشروع غير موجود")


def _get_project(project_id: str) -> Optional[Dict[str, Any]]:
    if supabase_client:
        try:
            response = (
                supabase_client.table("moltbot_projects")
                .select("*")
                .eq("id", project_id)
                .maybe_single()
                .execute()
            )
            return response.data or None
        except Exception:
            pass
    projects = _read_list(PROJECTS_FILE)
    return next((p for p in projects if p.get("id") == project_id), None)


def _list_projects() -> List[Dict[str, Any]]:
    if supabase_client:
        try:
            response = (
                supabase_client.table("moltbot_projects")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception:
            pass
    return list(reversed(_read_list(PROJECTS_FILE)))


def _save_session(session: Dict[str, Any]) -> Dict[str, Any]:
    if supabase_client:
        try:
            response = supabase_client.table("moltbot_sessions").insert(session).execute()
            return (response.data or [session])[0]
        except Exception:
            pass
    sessions = _read_list(SESSIONS_FILE)
    sessions.append(session)
    _write_list(SESSIONS_FILE, sessions)
    return session


def _list_messages(session_id: str) -> List[Dict[str, Any]]:
    if supabase_client:
        try:
            response = (
                supabase_client.table("moltbot_messages")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at")
                .execute()
            )
            return response.data or []
        except Exception:
            pass
    messages = _read_list(MESSAGES_FILE)
    return [m for m in messages if m.get("session_id") == session_id]


def _store_message(message: Dict[str, Any]) -> Dict[str, Any]:
    if supabase_client:
        try:
            response = supabase_client.table("moltbot_messages").insert(message).execute()
            return (response.data or [message])[0]
        except Exception:
            pass
    messages = _read_list(MESSAGES_FILE)
    messages.append(message)
    _write_list(MESSAGES_FILE, messages)
    return message


async def _call_openai_compatible(
    api_key: str,
    base_url: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 1200,
) -> str:
    if not api_key:
        raise HTTPException(status_code=500, detail="مفتاح API غير متوفر")
    if not base_url:
        raise HTTPException(status_code=500, detail="رابط مزود النموذج غير متوفر")
    if not model:
        raise HTTPException(status_code=500, detail="اسم النموذج غير متوفر")

    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(endpoint, json=payload, headers=headers)

    if response.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail=f"فشل الاتصال بالمزود: {response.text[:400]}",
        )

    data = response.json() if response.content else {}
    content = (
        (data.get("choices") or [{}])[0]
        .get("message", {})
        .get("content")
    )
    if not content:
        raise HTTPException(status_code=500, detail="لا يوجد رد من المزود")
    return content.strip()


@router.get("/projects", response_model=List[MoltbotProject])
async def list_projects():
    return _list_projects()


@router.post("/projects", response_model=MoltbotProject)
async def create_project(payload: MoltbotProjectCreate):
    project_id = str(uuid.uuid4())
    now = _now_iso()
    project = {
        "id": project_id,
        "name": payload.name.strip(),
        "description": payload.description or "",
        "industry": payload.industry or "",
        "domain": payload.domain or "",
        "status": payload.status or "draft",
        "resale_ready": bool(payload.resale_ready),
        "created_at": now,
        "updated_at": now,
        "last_build_at": None,
    }
    return _save_project(project)


@router.put("/projects/{project_id}", response_model=MoltbotProject)
async def update_project(project_id: str, payload: MoltbotProjectUpdate):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="لا توجد حقول للتحديث")
    updates["updated_at"] = _now_iso()
    return _update_project(project_id, updates)


@router.post("/projects/{project_id}/sessions", response_model=MoltbotSession)
async def create_session(project_id: str):
    project = _get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
    session = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "title": f"جلسة {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        "created_at": _now_iso(),
    }
    return _save_session(session)


@router.get("/sessions/{session_id}/messages", response_model=List[MoltbotMessage])
async def get_messages(session_id: str):
    return _list_messages(session_id)


@router.post("/chat", response_model=MoltbotChatResponse)
async def run_moltbot_chat(payload: MoltbotChatRequest):
    project = _get_project(payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="الرسالة مطلوبة")

    session_id = payload.session_id or str(uuid.uuid4())
    if not payload.session_id:
        _save_session(
            {
                "id": session_id,
                "project_id": payload.project_id,
                "title": payload.message.strip()[:40],
                "created_at": _now_iso(),
            }
        )

    user_message = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "project_id": payload.project_id,
        "role": "user",
        "agent": None,
        "content": payload.message.strip(),
        "created_at": _now_iso(),
    }
    _store_message(user_message)

    agents = payload.use_agents or ["planner", "builder", "reviewer"]
    agents_response: Dict[str, str] = {}
    recorded_messages: List[MoltbotMessage] = []

    openai_key = os.environ.get("EMERGENT_LLM_KEY")
    openai_model = os.environ.get("MOLTBOT_OPENAI_MODEL")
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    deepseek_url = os.environ.get("DEEPSEEK_API_BASE_URL")
    deepseek_model = os.environ.get("DEEPSEEK_MODEL")
    groq_key = os.environ.get("GROQ_API_KEY")
    groq_url = os.environ.get("GROQ_API_BASE_URL")
    groq_model = os.environ.get("GROQ_MODEL")

    planner_prompt = (
        "أنت وكيل تخطيط فائق لمولت بوت. مهمتك وضع خطة تنفيذية لبناء موقع مستقل قابل للبيع. "
        "اجعل الرد مختصرًا منظمًا بعناوين واضحة وخطوات قابلة للتنفيذ."
    )
    builder_prompt = (
        "أنت وكيل بناء تقني متعدد الوكلاء. صِف الهيكلة التقنية والواجهات والخدمات المطلوبة. "
        "قدّم نقاطًا تقنية عملية قابلة للتطبيق مباشرة."
    )
    reviewer_prompt = (
        "أنت وكيل مراجعة وجودة. قيّم المخاطر والثغرات واقترح تحسينات للأمان والأداء والتسويق."
    )

    if "planner" in agents:
        try:
            if not openai_key or not openai_model:
                raise HTTPException(status_code=500, detail="إعدادات GPT غير مكتملة")
            chat = (
                LlmChat(
                    api_key=openai_key,
                    session_id=f"{session_id}-planner",
                    system_message=planner_prompt,
                )
                .with_model("openai", openai_model)
            )
            planner_response = await chat.send_message(
                UserMessage(text=payload.message.strip())
            )
            agents_response["planner"] = planner_response
        except Exception as exc:
            agents_response["planner"] = f"تعذر تشغيل وكيل التخطيط: {exc}"

    if "builder" in agents:
        try:
            builder_response = await _call_openai_compatible(
                deepseek_key,
                deepseek_url,
                deepseek_model,
                [
                    {"role": "system", "content": builder_prompt},
                    {"role": "user", "content": payload.message.strip()},
                ],
            )
            agents_response["builder"] = builder_response
        except Exception as exc:
            agents_response["builder"] = f"تعذر تشغيل وكيل البناء: {exc}"

    if "reviewer" in agents:
        try:
            reviewer_response = await _call_openai_compatible(
                groq_key,
                groq_url,
                groq_model,
                [
                    {"role": "system", "content": reviewer_prompt},
                    {"role": "user", "content": payload.message.strip()},
                ],
            )
            agents_response["reviewer"] = reviewer_response
        except Exception as exc:
            agents_response["reviewer"] = f"تعذر تشغيل وكيل المراجعة: {exc}"

    summary_text = ""
    try:
        if openai_key and openai_model:
            summary_prompt = (
                "لخص ناتج الوكلاء التاليين في خطة موحدة مختصرة قابلة للتنفيذ مع الخطوات الرئيسية فقط.\n\n"
                f"وكيل التخطيط:\n{agents_response.get('planner','')}\n\n"
                f"وكيل البناء:\n{agents_response.get('builder','')}\n\n"
                f"وكيل المراجعة:\n{agents_response.get('reviewer','')}"
            )
            summary_chat = (
                LlmChat(
                    api_key=openai_key,
                    session_id=f"{session_id}-summary",
                    system_message="أنت وكيل تلخيص لمولت بوت."
                )
                .with_model("openai", openai_model)
            )
            summary_text = await summary_chat.send_message(UserMessage(text=summary_prompt))
        else:
            summary_text = "لم يتم إعداد GPT لتوليد الخلاصة."
    except Exception as exc:
        summary_text = f"تعذر توليد الخلاصة: {exc}"

    for agent_name, content in agents_response.items():
        stored = _store_message(
            {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "project_id": payload.project_id,
                "role": "assistant",
                "agent": agent_name,
                "content": content,
                "created_at": _now_iso(),
            }
        )
        recorded_messages.append(MoltbotMessage(**stored))

    summary_message = _store_message(
        {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "project_id": payload.project_id,
            "role": "assistant",
            "agent": "summary",
            "content": summary_text,
            "created_at": _now_iso(),
        }
    )
    recorded_messages.append(MoltbotMessage(**summary_message))

    _update_project(
        payload.project_id,
        {"last_build_at": _now_iso(), "status": "building"},
    )

    return MoltbotChatResponse(
        project_id=payload.project_id,
        session_id=session_id,
        agents=agents_response,
        summary=summary_text,
        messages=recorded_messages,
    )
