"""
Enhanced AI Routes with Knowledge Base Integration
Provides intelligent automotive assistance with learning capabilities
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from datetime import datetime
from typing import Optional, List
import uuid
import os

from emergentintegrations.llm.chat import LlmChat, UserMessage
from ai_knowledge_base import AIKnowledgeBase, INITIAL_KNOWLEDGE
from pydantic import BaseModel

router = APIRouter(prefix="/api")

db = None
knowledge_base = None


def set_db(database):
    global db, knowledge_base
    db = database
    knowledge_base = AIKnowledgeBase(db)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    vehicle_info: Optional[str] = None
    provider: Optional[str] = None  # 'openai' | 'anthropic'
    model: Optional[str] = None     # e.g. 'gpt-5' | 'claude-3-7-sonnet-20250219'


class SolutionFeedback(BaseModel):
    solution_id: str
    was_helpful: bool
    additional_notes: Optional[str] = None


class NewSolution(BaseModel):
    problem_type: str
    vehicle_info: str
    problem_description: str
    solution: str
    technician_name: Optional[str] = None
    effectiveness_rating: int = 5


@router.post("/ai/enhanced-chat")
async def enhanced_ai_chat(request: ChatRequest):
    """
    Enhanced AI chat with knowledge base integration (RAG-lite)
    - Searches structured KB (solutions)
    - Searches unstructured KB docs (manual notes/imported text)
    - Uses selected provider (OpenAI ChatGPT or Anthropic Claude)
    """
    try:
        session_id = request.session_id or str(uuid.uuid4())

        # Step 1: Search knowledge base (structured)
        relevant_solutions = await knowledge_base.search_solutions(
            query=request.message,
            vehicle_info=request.vehicle_info,
            limit=5
        )

        # Step 2: Search KB docs (unstructured)
        doc_hits = []
        try:
            q = {
                "$or": [
                    {"title": {"$regex": request.message, "$options": "i"}},
                    {"content": {"$regex": request.message, "$options": "i"}}
                ]
            }
            doc_hits = await db.ai_kb_docs.find(q).sort("created_at", -1).limit(3).to_list(length=3)
            for d in doc_hits:
                d.pop("_id", None)
        except Exception:
            doc_hits = []

        # Step 3: Build context from KB
        kb_parts = []
        if relevant_solutions:
            sctx = "\n\n=== حلول من قاعدة المعرفة (من قضايا حقيقية) ===\n"
            for i, s in enumerate(relevant_solutions[:3], 1):
                sctx += f"\n{i}. [نوع المشكلة] {s.get('problem_type','-')} | [مركبة] {s.get('vehicle_info','-')}\n"
                sctx += f"الوصف: {s.get('problem_description','-')}\n"
                sctx += f"الحل: {s.get('solution','-')}\n"
                if s.get('effectiveness_rating') is not None:
                    sctx += f"التقييم: {s.get('effectiveness_rating')}/5\n"
            kb_parts.append(sctx)
        if doc_hits:
            dctx = "\n\n=== مقتطفات من وثائق فنية / ملاحظات ===\n"
            for i, d in enumerate(doc_hits, 1):
                title = d.get('title') or d.get('file_name') or d.get('url') or f"وثيقة {i}"
                snippet = (d.get('content') or '')[:500]
                dctx += f"\n- {title}:\n{snippet}\n"
            kb_parts.append(dctx)
        kb_context = "".join(kb_parts)

        # Step 4: Build system prompt
        system_prompt = f"""أنت مساعد ذكي متخصص في صيانة وإصلاح السيارات.

مهامك:
1. مساعدة الفنيين في تشخيص مشاكل السيارات
2. تقديم حلول مجربة وفعالة
3. توفير معلومات دقيقة عن قطع الغيار والخدمات
4. تقديم نصائح الصيانة الوقائية

إذا وجدت حلولاً أو مقتطفات ذات صلة في قاعدة المعرفة أدناه، فقم بالاعتماد عليها:
{kb_context}

متطلبات الإجابة:
- بالعربية الفصحى الواضحة
- مختصرة ومباشرة مع خطوات مرقمة عند الحاجة
- إذا كانت المعرفة غير كافية، وضّح ذلك واقترح ما يجب فحصه خطوة بخطوة
"""

        # Step 5: Select provider/model
        provider = (request.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = request.model
        if not model:
            model = "gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219"

        # Step 6: Call LLM via Emergent Integrations
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY missing")

        chat = LlmChat(api_key=llm_key, session_id=session_id, system_message=system_prompt).with_model(provider, model)
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)

        # Step 7: Save conversation
        conversation_entry = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "user_message": request.message,
            "ai_response": response,
            "vehicle_info": request.vehicle_info,
            "provider": provider,
            "model": model,
            "kb_struct_hits": len(relevant_solutions or []),
            "kb_doc_hits": len(doc_hits or []),
            "timestamp": datetime.utcnow()
        }
        await db.ai_conversations.insert_one(conversation_entry)

        return {
            "response": response,
            "session_id": session_id,
            "provider": provider,
            "model": model,
            "knowledge_base_used": (len(relevant_solutions or []) + len(doc_hits or [])) > 0,
            "relevant_solutions": len(relevant_solutions or []),
            "relevant_docs": len(doc_hits or [])
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/add-solution")
async def add_solution_to_knowledge_base(solution: NewSolution):
    """Add a new structured solution to KB"""
    try:
        entry = await knowledge_base.add_solution(
            problem_type=solution.problem_type,
            vehicle_info=solution.vehicle_info,
            problem_description=solution.problem_description,
            solution=solution.solution,
            technician_name=solution.technician_name,
            effectiveness_rating=solution.effectiveness_rating
        )
        return {
            "success": True,
            "message": "تم إضافة الحل إلى قاعدة المعرفة بنجاح",
            "entry_id": entry.get("_id") and str(entry.get("_id"))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/kb/import/json")
async def import_kb_json(payload: dict):
    """Bulk import structured solutions as JSON: { items: [{problem_type, vehicle_info, problem_description, solution, technician_name?, effectiveness_rating?}, ...] }"""
    items = payload.get("items") or []
    created = 0
    for it in items:
        try:
            await knowledge_base.add_solution(
                problem_type=it.get('problem_type','عام'),
                vehicle_info=it.get('vehicle_info','غير محدد'),
                problem_description=it['problem_description'],
                solution=it['solution'],
                technician_name=it.get('technician_name'),
                effectiveness_rating=int(it.get('effectiveness_rating', 5))
            )
            created += 1
        except Exception:
            continue
    return {"created": created}


@router.post("/ai/kb/import/csv")
async def import_kb_csv(file: UploadFile = File(...)):
    """Import CSV with headers: problem_type,vehicle_info,problem_description,solution,technician_name,effectiveness_rating"""
    try:
        content = (await file.read()).decode('utf-8', errors='ignore')
        lines = [ln for ln in content.splitlines() if ln.strip()]
        header = [h.strip().lower() for h in lines[0].split(',')]
        idx = {k: i for i, k in enumerate(header)}
        created = 0
        for line in lines[1:]:
            cols = [c.strip() for c in line.split(',')]
            try:
                problem_type = cols[idx.get('problem_type', 0)] if 'problem_type' in idx else 'عام'
                vehicle_info = cols[idx.get('vehicle_info', 1)] if 'vehicle_info' in idx else 'غير محدد'
                problem_description = cols[idx.get('problem_description', 2)]
                solution = cols[idx.get('solution', 3)]
                technician_name = cols[idx.get('technician_name', 4)] if 'technician_name' in idx else None
                eff = int(cols[idx.get('effectiveness_rating', 5)]) if 'effectiveness_rating' in idx and cols[idx.get('effectiveness_rating', 5)] else 5
                await knowledge_base.add_solution(
                    problem_type=problem_type,
                    vehicle_info=vehicle_info,
                    problem_description=problem_description,
                    solution=solution,
                    technician_name=technician_name,
                    effectiveness_rating=eff
                )
                created += 1
            except Exception:
                continue
        return {"created": created}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai/kb/docs")
async def add_kb_doc(payload: dict):
    """Add unstructured KB document: {title?, content, tags?, url?} """
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "source_type": payload.get('source_type','manual'),
            "title": payload.get('title'),
            "content": payload['content'],
            "tags": payload.get('tags', []),
            "url": payload.get('url'),
            "file_name": payload.get('file_name'),
            "created_at": datetime.utcnow()
        }
        await db.ai_kb_docs.insert_one(doc)
        return {"ok": True, "id": doc["id"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ai/kb/search-docs")
async def search_kb_docs(query: str, limit: int = 10):
    try:
        q = {"$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"content": {"$regex": query, "$options": "i"}},
            {"tags": {"$in": [query]}}
        ]}
        docs = await db.ai_kb_docs.find(q).sort("created_at", -1).limit(limit).to_list(length=limit)
        for d in docs:
            d.pop("_id", None)
        return {"results": docs, "count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/add-solution-feedback")
async def submit_solution_feedback(feedback: SolutionFeedback):
    try:
        await knowledge_base.mark_solution_used(
            solution_id=feedback.solution_id,
            was_successful=feedback.was_helpful
        )
        return {"success": True, "message": "شكراً لتقييمك"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/search-solutions")
async def search_knowledge_base(
    query: str,
    vehicle_info: Optional[str] = None,
    problem_type: Optional[str] = None,
    limit: int = 10
):
    try:
        solutions = await knowledge_base.search_solutions(
            query=query,
            vehicle_info=vehicle_info,
            problem_type=problem_type,
            limit=limit
        )
        return {"results": solutions, "count": len(solutions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/common-problems")
async def get_common_problems(limit: int = 10):
    try:
        problems = await knowledge_base.get_common_problems(limit=limit)
        return {"problems": problems, "count": len(problems)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/vehicle-issues/{vehicle_info}")
async def get_vehicle_specific_issues(vehicle_info: str):
    try:
        issues = await knowledge_base.get_vehicle_specific_issues(vehicle_info)
        return {"vehicle": vehicle_info, "common_issues": issues, "count": len(issues)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/initialize-knowledge-base")
async def initialize_knowledge_base():
    try:
        count = 0
        for solution_data in INITIAL_KNOWLEDGE:
            await knowledge_base.add_solution(**solution_data)
            count += 1
        return {"success": True, "message": f"تم تهيئة قاعدة المعرفة بـ {count} حل مسبق", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
