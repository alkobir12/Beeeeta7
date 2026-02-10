from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path
import uuid
import json
import os

import httpx
import subprocess
import difflib
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
APPLIED_PATCHES_FILE = UPLOADS_DIR / "moltbot_applied_patches.json"


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
    mode: Optional[str] = "builder"
    target_files: Optional[List[str]] = None
    project_root: Optional[str] = None


class MoltbotChatResponse(BaseModel):
    project_id: str
    session_id: str
    agents: Dict[str, str]
    summary: str
    messages: List[MoltbotMessage]
    mode: Optional[str] = None
    affected_files: Optional[List[str]] = None
    blocked_files: Optional[List[str]] = None


def _get_project_root(request_root: Optional[str] = None) -> Path:
    env_root = os.environ.get("MOLTBOT_PROJECT_ROOT")
    if not env_root:
        raise HTTPException(status_code=500, detail="MOLTBOT_PROJECT_ROOT غير مضبوط")
    base_root = Path(env_root).resolve()
    if request_root:
        requested = Path(request_root).resolve()
        if base_root not in requested.parents and requested != base_root:
            raise HTTPException(status_code=400, detail="مسار مشروع غير مسموح")
        return requested
    return base_root


def _should_skip_dir(dir_name: str) -> bool:
    blocked = {
        "node_modules",
        ".git",
        "uploads",
        "static",
        "test_reports",
        "tests",
        "__pycache__",
        ".venv",
        ".ruff_cache",
        ".pytest_cache",
        ".emergent",
    }
    return dir_name in blocked


def _scan_project_files(root: Path, max_files: int = 600) -> List[str]:
    allowed_ext = {".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".md"}
    results = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if not _should_skip_dir(d)]
        for fname in files:
            ext = Path(fname).suffix.lower()
            if ext not in allowed_ext:
                continue
            full_path = Path(base) / fname
            rel = str(full_path.relative_to(root))
            results.append(rel)
            if len(results) >= max_files:
                return results
    return results


def _read_project_files(root: Path, files: List[str], max_chars: int = 5000) -> Dict[str, str]:
    content = {}
    for rel_path in files:
        full_path = root / rel_path
        if not full_path.exists() or not full_path.is_file():
            continue
        try:
            text = full_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if len(text) > max_chars:
            text = text[:max_chars] + "\n...\n"
        content[rel_path] = text
    return content


def _extract_snippets(content: str, keywords: List[str], radius: int = 6, max_snippets: int = 4) -> str:
    lines = content.splitlines()
    matches = []
    lowered = [k.lower() for k in keywords if len(k) > 2]
    for idx, line in enumerate(lines):
        if any(k in line.lower() for k in lowered):
            matches.append(idx)
    if not matches:
        return content

    snippets = []
    for idx in matches[:max_snippets]:
        start = max(0, idx - radius)
        end = min(len(lines), idx + radius + 1)
        block = "\n".join(lines[start:end])
        snippets.append(block)
    return "\n[SNIP]\n".join(snippets)


def _parse_updated_files(text: str) -> Dict[str, str]:
    files = {}
    current_path = None
    buffer = []
    for line in text.splitlines():
        if line.startswith("BEGIN_UPDATED_FILE "):
            if current_path and buffer:
                files[current_path] = "\n".join(buffer).rstrip() + "\n"
            current_path = line.replace("BEGIN_UPDATED_FILE ", "").strip()
            buffer = []
            continue
        if line.startswith("END_UPDATED_FILE"):
            if current_path:
                files[current_path] = "\n".join(buffer).rstrip() + "\n"
            current_path = None
            buffer = []
            continue
        if current_path is not None:
            buffer.append(line)
    if current_path and buffer:
        files[current_path] = "\n".join(buffer).rstrip() + "\n"
    return files


def _build_diff_from_updates(root: Path, updates: Dict[str, str]) -> str:
    diffs = []
    for rel_path, new_content in updates.items():
        full_path = root / rel_path
        if not full_path.exists():
            continue
        old_content = full_path.read_text(encoding="utf-8", errors="ignore")
        if old_content == new_content:
            continue
        diff_lines = difflib.unified_diff(
            old_content.splitlines(),
            new_content.splitlines(),
            fromfile=f"a/{rel_path}",
            tofile=f"b/{rel_path}",
            lineterm="",
        )
        diff_text = "\n".join(diff_lines)
        if diff_text:
            diff_text = f"diff --git a/{rel_path} b/{rel_path}\n" + diff_text
        diffs.append(diff_text)
    return "\n".join([d for d in diffs if d.strip()])


def _extract_diff_blocks(text: str) -> str:
    lines = text.splitlines()
    indices = [i for i, line in enumerate(lines) if line.startswith("diff --git")]
    if not indices:
        return text
    blocks = []
    for idx, start in enumerate(indices):
        end = indices[idx + 1] if idx + 1 < len(indices) else len(lines)
        block = "\n".join(lines[start:end]).strip()
        if block:
            blocks.append(block)
    return "\n".join(blocks)


async def _select_files_with_llm(
    api_key: str, model: str, message: str, file_list: List[str]
) -> List[str]:
    if not api_key or not model:
        return []
    selector_prompt = (
        "أنت مساعد يختار الملفات المتأثرة فقط لتنفيذ تعديل مطلوب. "
        "أعد إجابتك كقائمة JSON فقط (Array of strings) بدون شرح. "
        "اختر أقل عدد ممكن من الملفات الضرورية." 
    )
    files_blob = "\n".join(f"- {f}" for f in file_list)
    chat = (
        LlmChat(
            api_key=api_key,
            session_id=f"selector-{uuid.uuid4()}",
            system_message=selector_prompt,
        ).with_model("openai", model)
    )
    response = await chat.send_message(
        UserMessage(
            text=f"طلب التعديل:\n{message}\n\nقائمة الملفات المتاحة:\n{files_blob}"
        )
    )
    try:
        selected = json.loads(response)
        if isinstance(selected, list):
            return [str(p) for p in selected if isinstance(p, str)]
    except Exception:
        return []
    return []


def _detect_blocked_files(patch_text: str, root: Path) -> List[str]:
    if not patch_text:
        return []
    blocked = []
    lines = patch_text.splitlines()
    for idx, line in enumerate(lines):
        if not line.startswith("+++ "):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        path = parts[1]
        if path.startswith("b/"):
            path = path[2:]
        prev_line = lines[idx - 1] if idx > 0 else ""
        nearby = "\n".join(lines[max(0, idx - 3):idx + 1])
        if "new file mode" in nearby or prev_line.startswith("--- /dev/null"):
            if (root / path).exists():
                blocked.append(path)
    return list(dict.fromkeys(blocked))


def _apply_patch(patch_text: str, root: Path, dry_run: bool = False) -> Dict[str, Any]:
    if not patch_text.strip():
        return {"success": False, "message": "لا يوجد patch للتطبيق"}

    if not patch_text.endswith("\n"):
        patch_text = patch_text + "\n"

    if "--- " not in patch_text or "+++ " not in patch_text:
        return {"success": False, "message": "تنسيق patch غير صالح"}

    if "@@ ..." in patch_text:
        return {"success": False, "message": "patch يحتوي على مقاطع غير صالحة (ellipsis)"}

    patch_file = UPLOADS_DIR / f"moltbot_patch_{uuid.uuid4().hex}.diff"
    patch_file.write_text(patch_text, encoding="utf-8")

    check_cmd = ["git", "apply", "--check", str(patch_file)]
    check = subprocess.run(check_cmd, cwd=str(root), capture_output=True, text=True)
    if check.returncode != 0:
        return {
            "success": False,
            "message": "فشل التحقق من patch",
            "details": (check.stderr or check.stdout)[:400],
        }

    if dry_run:
        return {"success": True, "message": "patch صالح للتطبيق"}

    apply_cmd = ["git", "apply", str(patch_file)]
    result = subprocess.run(apply_cmd, cwd=str(root), capture_output=True, text=True)
    if result.returncode != 0:
        return {
            "success": False,
            "message": "فشل تطبيق patch",
            "details": (result.stderr or result.stdout)[:400],
        }
    return {"success": True, "message": "تم تطبيق التعديل بنجاح"}


class MoltbotApplyRequest(BaseModel):
    project_id: str
    patch: str
    session_id: Optional[str] = None
    project_root: Optional[str] = None
    dry_run: Optional[bool] = False


class MoltbotRollbackRequest(BaseModel):
    project_id: str
    patch_id: str
    project_root: Optional[str] = None
    dry_run: Optional[bool] = False


@router.post("/apply")
async def apply_patch(request: MoltbotApplyRequest):
    project = _get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")

    root = _get_project_root(request.project_root)
    blocked = _detect_blocked_files(request.patch, root)
    if blocked:
        return {
            "success": False,
            "message": "تم منع تطبيق patch بسبب محاولة إنشاء ملفات موجودة",
            "blocked_files": blocked,
        }

    result = _apply_patch(request.patch, root, dry_run=bool(request.dry_run))
    if result.get("success") and not request.dry_run:
        patch_id = str(uuid.uuid4())
        patches = _read_list(APPLIED_PATCHES_FILE)
        patches.append(
            {
                "id": patch_id,
                "project_id": request.project_id,
                "session_id": request.session_id,
                "patch": request.patch,
                "created_at": _now_iso(),
                "rolled_back": False,
                "rolled_back_at": None,
            }
        )
        _write_list(APPLIED_PATCHES_FILE, patches)
        _update_project(request.project_id, {"updated_at": _now_iso()})
        result["patch_id"] = patch_id
    return result


@router.post("/rollback")
async def rollback_patch(request: MoltbotRollbackRequest):
    project = _get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")

    root = _get_project_root(request.project_root)
    patches = _read_list(APPLIED_PATCHES_FILE)
    patch_doc = next((p for p in patches if p.get("id") == request.patch_id), None)
    if not patch_doc:
        raise HTTPException(status_code=404, detail="الـ patch غير موجود")
    if patch_doc.get("rolled_back"):
        return {"success": False, "message": "تم تنفيذ rollback مسبقاً"}

    patch_text = patch_doc.get("patch", "")
    if not patch_text.strip():
        return {"success": False, "message": "الـ patch فارغ"}
    if not patch_text.endswith("\n"):
        patch_text += "\n"

    patch_file = UPLOADS_DIR / f"moltbot_rollback_{uuid.uuid4().hex}.diff"
    patch_file.write_text(patch_text, encoding="utf-8")

    check_cmd = ["git", "apply", "--reverse", "--check", str(patch_file)]
    check = subprocess.run(check_cmd, cwd=str(root), capture_output=True, text=True)
    if check.returncode != 0:
        return {
            "success": False,
            "message": "تعذر التراجع عن التعديل",
            "details": (check.stderr or check.stdout)[:400],
        }

    if request.dry_run:
        return {"success": True, "message": "rollback صالح للتطبيق"}

    apply_cmd = ["git", "apply", "--reverse", str(patch_file)]
    result = subprocess.run(apply_cmd, cwd=str(root), capture_output=True, text=True)
    if result.returncode != 0:
        return {
            "success": False,
            "message": "فشل تنفيذ rollback",
            "details": (result.stderr or result.stdout)[:400],
        }

    patch_doc["rolled_back"] = True
    patch_doc["rolled_back_at"] = _now_iso()
    _write_list(APPLIED_PATCHES_FILE, patches)
    _update_project(request.project_id, {"updated_at": _now_iso()})
    return {"success": True, "message": "تم التراجع عن التعديل بنجاح"}


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

    mode = (payload.mode or "builder").strip().lower()
    affected_files: List[str] = []
    blocked_files: List[str] = []
    project_context = ""
    full_context = ""
    project_root = None

    openai_key = os.environ.get("EMERGENT_LLM_KEY")
    openai_model = os.environ.get("MOLTBOT_OPENAI_MODEL")
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

    editor_policy = (
        "أنت تعمل على تحرير مشروع FastAPI قائم دون إعادة كتابة كاملة. "
        "التزم بالقواعد التالية: لا تغيّر البنية الأساسية، لا تكرر الأكواد الموجودة، عدّل فقط الأجزاء المرتبطة بطلب التحرير. "
        "أنتج تعديلات minimal patch فقط بصيغة git unified diff. "
        "أظهر فقط الملفات التي تحتاج تعديل ولا تضف شرحًا. "
        "لا تنشئ ملفًا جديدًا إذا كان موجودًا مسبقًا. "
        "لا تستخدم Markdown أو علامات ``` في الإخراج. "
        "ممنوع استخدام ... أو @@ ...؛ استخدم أرقام أسطر فعلية وسياق حقيقي من الملف. "
        "استخدم فقط محتوى الملفات المقدم بين BEGIN_FILE و END_FILE ولا تفترض أي كود غير موجود. "
        "صيغة الإخراج المطلوبة حصراً:\n"
        "diff --git a/path b/path\n"
        "--- a/path\n"
        "+++ b/path\n"
        "@@ ...\n"
        "-old\n"
        "+new\n"
        "(يمكن تكرار الكتل لعدة ملفات)."
    )

    if mode == "editor":
        project_root = _get_project_root(payload.project_root)
        available_files = _scan_project_files(project_root)
        target_files = payload.target_files or []
        if target_files:
            affected_files = [f for f in target_files if f in available_files]
        else:
            affected_files = await _select_files_with_llm(
                openai_key or "",
                openai_model or "",
                payload.message.strip(),
                available_files,
            )
            affected_files = [f for f in affected_files if f in available_files]

        affected_files = affected_files[:8]
        files_content = _read_project_files(project_root, affected_files)
        if files_content:
            context_blocks = []
            full_blocks = []
            for path, content in files_content.items():
                snippet = _extract_snippets(content, payload.message.split())
                context_blocks.append(f"BEGIN_FILE {path}\n{snippet}\nEND_FILE")
                full_blocks.append(f"BEGIN_FILE {path}\n{content}\nEND_FILE")
            project_context = "\n\n".join(context_blocks)
            full_context = "\n\n".join(full_blocks)

    if "planner" in agents:
        try:
            if not openai_key or not openai_model:
                raise HTTPException(status_code=500, detail="إعدادات GPT غير مكتملة")
            system_message = planner_prompt
            user_message = payload.message.strip()
            if mode == "editor":
                system_message = f"{planner_prompt}\n\n{editor_policy}"
                user_message = (
                    f"طلب التحرير:\n{payload.message.strip()}\n\n"
                    f"الملفات المتاحة للتعديل:\n" + "\n".join(f"- {f}" for f in affected_files)
                )
                if project_context:
                    user_message += f"\n\nمحتوى الملفات:\n{project_context}"

            chat = (
                LlmChat(
                    api_key=openai_key,
                    session_id=f"{session_id}-planner",
                    system_message=system_message,
                )
                .with_model("openai", openai_model)
            )
            planner_response = await chat.send_message(UserMessage(text=user_message))
            agents_response["planner"] = planner_response
        except Exception as exc:
            agents_response["planner"] = f"تعذر تشغيل وكيل التخطيط: {exc}"

    if "builder" in agents:
        try:
            if not openai_key or not openai_model:
                raise HTTPException(status_code=500, detail="إعدادات GPT غير مكتملة")
            system_message = builder_prompt
            user_message = payload.message.strip()
            if mode == "editor":
                system_message = f"{builder_prompt}\n\n{editor_policy}"
                user_message = (
                    f"طلب التحرير:\n{payload.message.strip()}\n\n"
                    f"الملفات المتاحة للتعديل:\n" + "\n".join(f"- {f}" for f in affected_files)
                )
                if project_context:
                    user_message += f"\n\nمحتوى الملفات:\n{project_context}"

            chat = (
                LlmChat(
                    api_key=openai_key,
                    session_id=f"{session_id}-builder",
                    system_message=system_message,
                )
                .with_model("openai", openai_model)
            )
            builder_response = await chat.send_message(UserMessage(text=user_message))
            agents_response["builder"] = builder_response
        except Exception as exc:
            agents_response["builder"] = f"تعذر تشغيل وكيل البناء: {exc}"

    if "reviewer" in agents:
        try:
            system_message = reviewer_prompt
            user_message = payload.message.strip()
            if mode == "editor":
                system_message = f"{reviewer_prompt}\n\n{editor_policy}"
                user_message = (
                    f"طلب التحرير:\n{payload.message.strip()}\n\n"
                    f"الملفات المتاحة للتعديل:\n" + "\n".join(f"- {f}" for f in affected_files)
                )
                if project_context:
                    user_message += f"\n\nمحتوى الملفات:\n{project_context}"

            reviewer_response = await _call_openai_compatible(
                groq_key,
                groq_url,
                groq_model,
                [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message},
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
            if mode == "editor":
                summary_prompt = (
                    "اعتمد على المحتوى المقدم بين BEGIN_FILE و END_FILE لإخراج النسخة النهائية لكل ملف متأثر. "
                    "لا تضف شرحًا. الصيغة المطلوبة حصراً:\n"
                    "BEGIN_UPDATED_FILE path\n"
                    "<المحتوى الكامل بعد التعديل>\n"
                    "END_UPDATED_FILE\n"
                    "(كرّر لكل ملف).\n\n"
                    "ممنوع استخدام ... أو @@ ... أو Markdown.\n\n"
                    "لا تحذف أو تعيد ترتيب أقسام غير مرتبطة بطلب التحرير. حافظ على بقية الملف كما هو.\n\n"
                    f"ملفات المشروع:\n{full_context}\n\n"
                    f"نتائج الوكلاء:\n"
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

    if mode == "editor" and project_root:
        updated_files = _parse_updated_files(summary_text)
        if updated_files:
            summary_text = _build_diff_from_updates(project_root, updated_files)
        else:
            summary_text = _extract_diff_blocks(summary_text)
        blocked_files = _detect_blocked_files(summary_text, project_root)

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
        mode=mode,
        affected_files=affected_files or None,
        blocked_files=blocked_files or None,
    )
