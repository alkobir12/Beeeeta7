import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional


CATALOG_PATH = os.path.join(os.path.dirname(__file__), "uploads", "emergent_complete_all.json")
SKILL_CONTEXT_LIMIT = 7000
MAX_SKILL_CONTEXT_ITEMS = 4


def _clean_label(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    return text.replace("_", " ").replace("-", " ").strip()


@lru_cache(maxsize=1)
def load_catalog() -> Dict[str, Any]:
    if not os.path.exists(CATALOG_PATH):
        return {"skills": [], "system_prompts": [], "summary": {}}
    with open(CATALOG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def get_catalog_summary() -> Dict[str, Any]:
    data = load_catalog()
    summary = data.get("summary") or {}
    return {
        "total_skills": int(summary.get("total_skills") or len(data.get("skills") or [])),
        "total_prompts": int(summary.get("total_prompts") or len(data.get("system_prompts") or [])),
        "categories": summary.get("categories") or {},
        "total_agents": int(summary.get("total_agents") or len(data.get("agents") or [])),
    }


def _skill_to_card(skill: Dict[str, Any]) -> Dict[str, Any]:
    content = str(skill.get("content") or "").strip()
    title = skill.get("name") or _clean_label(skill.get("id") or skill.get("path") or "مهارة")
    description = skill.get("description") or str(skill.get("path") or skill.get("category") or "").strip()
    preview = " ".join(content.split())[:180]
    return {
        "id": str(skill.get("id") or "").strip(),
        "title": title,
        "category": str(skill.get("category") or "general").strip() or "general",
        "description": description,
        "preview": preview,
        "has_content": bool(content),
    }


def search_skills(query: str = "", category: Optional[str] = None, limit: int = 24) -> List[Dict[str, Any]]:
    data = load_catalog()
    rows = []
    q = str(query or "").strip().lower()
    requested_category = str(category or "").strip().lower()

    for skill in data.get("skills") or []:
        skill_id = str(skill.get("id") or "").strip()
        if not skill_id or skill_id in {"README", "TEMPLATE"}:
            continue
        skill_category = str(skill.get("category") or "general").strip()
        if requested_category and skill_category.lower() != requested_category:
            continue
        haystack = " ".join(
            [
                skill_id,
                str(skill.get("name") or ""),
                str(skill.get("description") or ""),
                str(skill.get("path") or ""),
                str(skill.get("content") or "")[:600],
            ]
        ).lower()
        if q and q not in haystack:
            continue
        rows.append(_skill_to_card(skill))
        if len(rows) >= max(1, min(int(limit or 24), 60)):
            break

    return rows


def get_skill_by_id(skill_id: str) -> Optional[Dict[str, Any]]:
    target = str(skill_id or "").strip()
    if not target:
        return None
    data = load_catalog()
    for skill in data.get("skills") or []:
        if str(skill.get("id") or "").strip() == target:
            card = _skill_to_card(skill)
            card["content"] = str(skill.get("content") or "")
            return card
    return None


def build_skill_context(skill_ids: List[str]) -> str:
    chunks: List[str] = []
    total_chars = 0
    for raw_skill_id in skill_ids[:MAX_SKILL_CONTEXT_ITEMS]:
        skill = get_skill_by_id(raw_skill_id)
        if not skill:
            continue
        content = str(skill.get("content") or "").strip()
        if not content:
            continue
        chunk = f"### {skill.get('title') or skill.get('id')}\n{content}\n"
        if total_chars + len(chunk) > SKILL_CONTEXT_LIMIT:
            break
        chunks.append(chunk)
        total_chars += len(chunk)
    return "\n".join(chunks).strip()