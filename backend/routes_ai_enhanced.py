"""
Enhanced AI Routes with Knowledge Base Integration
Provides intelligent automotive assistance with learning capabilities
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from datetime import datetime
from typing import Optional, List, Dict, Any
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


class VehicleSnapshot(BaseModel):
    # Minimal schema for diagnostics; all fields optional and free-form friendly
    vin: Optional[str] = None
    plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    engine_code: Optional[str] = None  # e.g., 1KD-FTV, 2KD-FTV, 1VD-FTV
    mileage_km: Optional[float] = None
    dtc_codes: Optional[List[str]] = None
    symptoms: Optional[str] = None
    rail_pressure_idle_mpa: Optional[float] = None
    rail_pressure_load_mpa: Optional[float] = None
    fuel_temp_c: Optional[float] = None
    coolant_temp_c: Optional[float] = None
    maf_gps: Optional[float] = None
    map_kpa: Optional[float] = None
    boost_kpa: Optional[float] = None
    idle_rpm: Optional[int] = None
    notes: Optional[str] = None


class CompareRequest(BaseModel):
    vehicle_a: VehicleSnapshot
    vehicle_b: VehicleSnapshot
    baseline_hint: Optional[str] = None  # e.g., "1KD-FTV", "1VD-FTV"
    session_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/ai/enhanced-chat")
async def enhanced_ai_chat(request: ChatRequest):
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

        # Step 3: Build context
        kb_parts = []
        if relevant_solutions:
            sctx = "\n\n=== حلول من قاعدة المعرفة (من قضايا حقيقية) ===\n"
            for i, s in enumerate(relevant_solutions[:3], 1):
                sctx += f"\n{i}. [نوع المشكلة] {s.get('problem_type','-')} | [مركبة] {s.get('vehicle_info','-')}\n"
                sctx += f"الوصف: {s.get('problem_description','-')}\n"
                sctx += f"الحل: {s.get('solution','-')}\n"
            kb_parts.append(sctx)
        if doc_hits:
            dctx = "\n\n=== مقتطفات من وثائق فنية / مراجع ===\n"
            for i, d in enumerate(doc_hits, 1):
                title = d.get('title') or d.get('file_name') or d.get('url') or f"وثيقة {i}"
                snippet = (d.get('content') or '')[:600]
                dctx += f"\n- {title}:\n{snippet}\n"
            kb_parts.append(dctx)
        kb_context = "".join(kb_parts)

        system_prompt = f"""أنت مساعد ذكي متخصص في صيانة وإصلاح السيارات.

مهامك:
1) مساعدة الفنيين في التشخيص 
2) تقديم حلول دقيقة وفعّالة
3) إعطاء تعليمات فحص خطوة بخطوة

إن وُجدت معلومات مرجعية مفيدة أدناه فاعتمد عليها: {kb_context}

متطلبات الإجابة:
- بالعربية الواضحة
- خطوات مرقمة
- نبّه لسلامة العمل عند الحاجة
"""

        provider = (request.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = request.model or ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY missing")

        chat = LlmChat(api_key=llm_key, session_id=session_id, system_message=system_prompt).with_model(provider, model)
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)

        await db.ai_conversations.insert_one({
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
        })

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


@router.post("/ai/diagnostics/compare")
async def ai_diagnostics_compare(payload: CompareRequest):
    """Compare two vehicle snapshots and produce an expert report using KB context."""
    try:
        session_id = payload.session_id or str(uuid.uuid4())
        # Gather doc context based on baseline hint or engine codes
        hint = payload.baseline_hint or payload.vehicle_a.engine_code or payload.vehicle_b.engine_code or ""
        doc_query_terms = [t for t in [hint, payload.vehicle_a.engine_code, payload.vehicle_b.engine_code, "SCV", "Rail", "Injector", "DTC"] if t]
        doc_hits: List[Dict[str, Any]] = []
        if doc_query_terms:
            q = {"$or": [{"title": {"$regex": term, "$options": "i"}} for term in doc_query_terms] + [{"content": {"$regex": term, "$options": "i"}} for term in doc_query_terms]}
            doc_hits = await db.ai_kb_docs.find(q).limit(5).to_list(length=5)
            for d in doc_hits:
                d.pop('_id', None)

        # Build comparison prompt
        def to_lines(v: VehicleSnapshot) -> str:
            data = v.dict()
            lines = []
            for k, val in data.items():
                if val is not None:
                    lines.append(f"- {k}: {val}")
            return "\n".join(lines)

        ctx_docs = "\n\n".join([f"[مرجع] {d.get('title') or d.get('file_name')}:\n{(d.get('content') or '')[:500]}" for d in (doc_hits or [])])

        system_prompt = f"""أنت خبير ديزل وأنظمة DENSO CRS.
قارن بين مركبتين وحدد ما إذا كانت القيم ضمن الحدود الطبيعية أم لا بناءً على خبرتك والمراجع المقتطفة أدناه.
أذكر: الملخص، القيم الحرجة، احتمال السبب، خطوات فحص، وتوصيات.

مراجع تقنية مختصرة:
{ctx_docs}

صيغة الإخراج:
- الملخص العام
- جدول مقارنة (نصي) لأهم المؤشرات
- القيم خارج النطاق المحتمل + سبب مرجح
- خطوات فحص مقترحة (مرقمة)
- قطع/تنظيف/برمجة مقترحة
- مخاطر السلامة إن وجدت
"""
        user_prompt = f"""المركبة أ:\n{to_lines(payload.vehicle_a)}\n\nالمركبة ب:\n{to_lines(payload.vehicle_b)}\n\nالمطلوب: تقرير مقارنة عربي احترافي مع حكم (طبيعي/غير طبيعي) لكل مؤشر، وتوصيات عملية.
إن وُجدت أكواد أعطال فقم بربطها بالأسباب المحتملة من مراجع DENSO."""

        provider = (payload.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = payload.model or ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            # Fallback heuristic (no LLM) — simple diff
            def heuristic_report() -> Dict[str, Any]:
                diffs = {}
                a = payload.vehicle_a.dict()
                b = payload.vehicle_b.dict()
                keys = set(k for k in a.keys() | b.keys())
                for k in keys:
                    if a.get(k) != b.get(k):
                        diffs[k] = {"a": a.get(k), "b": b.get(k)}
                return {
                    "summary": "وضع تقرير بدائي بدون نموذج ذكاء بسبب غياب مفتاح LLM.",
                    "diffs": diffs,
                    "recommendations": ["يرجى تفعيل EMERGENT_LLM_KEY للحصول على تحليل خبير"],
                }
            rep = heuristic_report()
            # Persist case
            await db.ai_vehicle_cases.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "type": "compare",
                "payload": payload.dict(),
                "report": rep,
                "provider": None,
                "model": None,
                "timestamp": datetime.utcnow()
            })
            return rep

        chat = LlmChat(api_key=llm_key, session_id=session_id, system_message=system_prompt).with_model(provider, model)
        response = await chat.send_message(UserMessage(text=user_prompt))

        report = {
            "report": response,
            "session_id": session_id,
            "provider": provider,
            "model": model,
            "doc_refs": [d.get('title') or d.get('file_name') for d in (doc_hits or [])]
        }
        await db.ai_vehicle_cases.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "type": "compare",
            "payload": payload.dict(),
            "report": report,
            "timestamp": datetime.utcnow()
        })
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/diagnostics/analyze-fleet")
async def ai_analyze_fleet(payload: dict = Body(default={})):  # accepts {account_id?}
    """Analyze all vehicles and produce AI insights for CEO/Analytics."""
    try:
        account_id = payload.get('account_id')
        q: Dict[str, Any] = {}
        if account_id:
            q['accountId'] = account_id
        vehicles = await db.vehicles.find(q).to_list(length=5000)
        for v in vehicles:
            v.pop('_id', None)

        # Basic KPIs via Mongo-only data
        total = len(vehicles)
        by_status = {}
        brands = {}
        for v in vehicles:
            s = (v.get('status') or 'unknown')
            by_status[s] = by_status.get(s, 0) + 1
            b = (v.get('brand') or 'Unknown')
            brands[b] = brands.get(b, 0) + 1

        kpi = {
            "totalVehicles": total,
            "byStatus": by_status,
            "topBrands": sorted(brands.items(), key=lambda x: x[1], reverse=True)[:10]
        }

        # Compose AI summary
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            return {"kpi": kpi, "ai": None, "note": "LLM key missing; returned KPIs only"}

        provider = (os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        system_prompt = "محلل عمليات للورشة يقدّم مؤشرات وتنبيهات ذكية حول حالة المركبات وتدفق العمل."
        context = f"إجمالي المركبات: {total}\nحسب الحالة: {by_status}\nأكثر 10 علامات: {kpi['topBrands']}"
        ask = "حلّل المؤشرات وقدّم 3 تنبيهات مبكرة، و3 توصيات قابلة للتنفيذ لتحسين سرعة الإنجاز ومعدّل الاعتماد."
        chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=system_prompt).with_model(provider, model)
        ai_resp = await chat.send_message(UserMessage(text=context + "\n\n" + ask))

        return {"kpi": kpi, "ai": ai_resp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/add-solution")
async def add_solution_to_knowledge_base(solution: NewSolution):
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
