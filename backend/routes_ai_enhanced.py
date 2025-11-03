"""
Enhanced AI Routes with Knowledge Base Integration
Provides intelligent automotive assistance with learning capabilities
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid
import os
import shutil
import subprocess
import asyncio
from pathlib import Path

from emergentintegrations.llm.chat import LlmChat, UserMessage
from ai_knowledge_base import AIKnowledgeBase, INITIAL_KNOWLEDGE
from pydantic import BaseModel

router = APIRouter(prefix="/api")

db = None
knowledge_base = None

# Use relative path from current file location (deployment-safe)
ROOT_DIR = Path(__file__).parent
BASE_UPLOAD_DIR = ROOT_DIR / "uploads"
TMP_DIR = BASE_UPLOAD_DIR / "tmp"
VIDEO_DIR = BASE_UPLOAD_DIR / "videos"
AUDIO_DIR = BASE_UPLOAD_DIR / "audio"
for d in (BASE_UPLOAD_DIR, TMP_DIR, VIDEO_DIR, AUDIO_DIR):
    try:
        d.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass


def set_db(database):
    global db, knowledge_base
    db = database
    knowledge_base = AIKnowledgeBase(db)


# -------------------- Core Chat --------------------
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    vehicle_info: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/ai/enhanced-chat")
async def enhanced_ai_chat(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        # KB search
        relevant_solutions = await knowledge_base.search_solutions(
            query=request.message,
            vehicle_info=request.vehicle_info,
            limit=5
        )
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
        kb_parts = []
        if relevant_solutions:
            sctx = "\n\n=== حلول من قاعدة المعرفة (من قضايا حقيقية) ===\n"
            for i, s in enumerate(relevant_solutions[:3], 1):
                sctx += f"\n{i}. [نوع] {s.get('problem_type','-')} | [مركبة] {s.get('vehicle_info','-')}\nالوصف: {s.get('problem_description','-')}\nالحل: {s.get('solution','-')}\n"
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
اعتمد على المراجع إن وُجدت:
{kb_context}

متطلبات الإجابة:
- بالعربية الواضحة
- خطوات مرقمة عند الحاجة
- السلامة أولاً
"""
        provider = (request.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = request.model or ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY missing")
        chat = LlmChat(api_key=llm_key, session_id=session_id, system_message=system_prompt).with_model(provider, model)
        response = await chat.send_message(UserMessage(text=request.message))
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


# -------------------- Diagram Reading Assistant --------------------
class DiagramQARequest(BaseModel):
    diagram_text: Optional[str] = None
    question: Optional[str] = None
    vehicle_info: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/ai/electrical/diagram-qa")
async def electrical_diagram_qa(req: DiagramQARequest):
    """Assistant to help read wiring diagrams and propose solutions."""
    try:
        # collect context from electrical KB and docs with diagram keywords
        terms = [t for t in ["مخطط", "schematic", "wiring", "DIN", "JIS", "connector", "pinout", "ground", "GND", "E", "IG", "B+", "ACC", "CAN", "LIN"]]
        q_or = [{"title": {"$regex": t, "$options": "i"}} for t in terms] + [{"content_excerpt": {"$regex": t, "$options": "i"}} for t in terms]
        ekb = await db.ai_kb_electrical.find({"$or": q_or}).sort("created_at", -1).limit(3).to_list(length=3)
        for e in ekb:
            e.pop('_id', None)
        d_or = [{"title": {"$regex": t, "$options": "i"}} for t in terms] + [{"content": {"$regex": t, "$options": "i"}} for t in terms]
        docs = await db.ai_kb_docs.find({"$or": d_or}).sort("created_at", -1).limit(3).to_list(length=3)
        for d in docs:
            d.pop('_id', None)
        ctx = []
        if ekb:
            ctx.append("\n\n=== مرجع كهربائي منظم ===\n" + "\n".join([str(e.get('structured'))[:600] for e in ekb]))
        if docs:
            ctx.append("\n\n=== مقتطف وثائق ===\n" + "\n".join([(d.get('title') or d.get('file_name') or 'وثيقة') + "\n" + (d.get('content') or '')[:500] for d in docs]))
        system = f"""أنت خبير قراءة مخططات كهرباء سيارات.
اهدافك:
- شرح رموز المخططات (أسلاك، ألوان، فيوزات، ريلايات، موصلات، أطراف)
- تحديد اتجاه سريان التيار والمسار من المصدر إلى الحمل والأرضي
- تحديد نقاط القياس بالمِلتميتر والاسكانر
- اقتراح الحلول بناءً على القراءة

مراجع مختصرة:
{''.join(ctx)}

صيغة الإجابة:
1) فهم المخطط (الرموز/الألوان/الاتجاه)
2) تتبع المسار (B+ → فيوز → ريلاي → الموصل → الحمل → الأرضي)
3) نقاط اختبار رئيسية وقيم متوقعة
4) أعطال محتملة وحلول
5) تحذيرات سلامة
"""
        user = (req.question or "") + ("\n\n" + (req.diagram_text or ""))
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            # fallback textual guide
            guide = """دليل مبسط لقراءة المخطط:
- حدد مصدر التغذية: B+ أو IG أو ACC
- تتبع الفيوز ثم الريلاي ثم سلك الخرج إلى الحمل ثم الأرضي E
- اقرأ ألوان الأسلاك (مثال تويوتا: B=أسود أرضي، R=أحمر بطارية، G=أخضر، Y=أصفر، W=أبيض)
- افحص الفولت قبل وبعد الفيوز والريلاي، وافحص الاستمرارية للأرضي
- نقاط قياس: طرف الإدخال/الإخراج في الريلاي، طرف الحمل، نقطة الأرضي
- في غياب مفتاح الذكاء، اتبع الجدول المرجعي للمخططات DIN/JIS
"""
            return {"response": guide, "sources": [d.get('title') for d in docs][:3]}
        provider = (req.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = req.model or ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=system).with_model(provider, model)
        resp = await chat.send_message(UserMessage(text=user))
        return {"response": resp, "sources": [d.get('title') or d.get('file_name') for d in docs][:3]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/kb/electrical/seed-diagram-guide")
async def seed_diagram_guide():
    """Seed a tutorial doc for reading automotive wiring diagrams."""


@router.post("/ai/kb/upload-and-analyze")
async def upload_and_analyze_document(file: UploadFile = File(...)):
    """Upload PDF/video and analyze with AI"""
    try:
        # Save file temporarily
        file_content = await file.read()
        file_path = TMP_DIR / file.filename
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Extract text from PDF if applicable
        extracted_text = ""
        if file.filename.lower().endswith('.pdf'):
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(str(file_path))
                # Extract first 10 pages
                for page_num in range(min(10, len(reader.pages))):
                    extracted_text += reader.pages[page_num].extract_text() + "\n"
                extracted_text = extracted_text[:15000]  # Limit to 15k chars
            except Exception as e:
                print(f"⚠️ PDF extraction failed: {e}")
                extracted_text = f"[ملف PDF: {file.filename}]"
        
        # Analyze with AI
        llm = LlmChat(
            api_key=os.getenv('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are an AI document analyzer for automotive workshop. Analyze technical documents and electrical diagrams in Arabic."
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        analysis_prompt = f"""حلل هذا المستند وقدم:
1. ملخص بالعربية
2. النقاط الرئيسية (3-5 نقاط)
3. المواضيع الرئيسية
4. أي مواصفات أو بيانات تقنية

المستند: {file.filename}

المحتوى:
{extracted_text[:10000] if extracted_text else "لا يوجد نص مستخرج"}"""
        
        response = await llm.send_message(UserMessage(text=analysis_prompt))
        
        # Store in knowledge base
        doc_record = {
            'id': str(uuid.uuid4()),
            'filename': file.filename,
            'type': 'pdf' if file.filename.endswith('.pdf') else 'video',
            'title': file.filename,
            'content': (response if isinstance(response, str) else response.text)[:5000],  # First 5000 chars
            'summary': response if isinstance(response, str) else response.text,
            'uploadedAt': datetime.utcnow()
        }
        
        await db.knowledge_documents.insert_one(doc_record)
        
        # Parse key points from AI response
        response_text = response if isinstance(response, str) else response.text
        key_points = []
        for line in response_text.split('\n'):
            if line.strip().startswith('•') or line.strip().startswith('-'):
                key_points.append(line.strip()[1:].strip())
        
        return {
            'success': True,
            'filename': file.filename,
            'type': doc_record['type'],
            'summary': response_text,
            'keyPoints': key_points[:5]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ai/kb/docs")
async def get_knowledge_documents():
    """Get all uploaded knowledge documents"""
    try:
        docs = await db.knowledge_documents.find({}).sort('uploadedAt', -1).to_list(length=100)
        for doc in docs:
            doc.pop('_id', None)
            if doc.get('uploadedAt') and hasattr(doc['uploadedAt'], 'isoformat'):
                doc['uploadedAt'] = doc['uploadedAt'].isoformat()
        return {'docs': docs, 'count': len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/kb/smart-search")
async def smart_search_knowledge(payload: Dict[str, Any]):
    """AI-powered smart search in knowledge base"""
    try:
        query = payload.get('query', '')
        limit = payload.get('limit', 10)
        
        if not query:
            raise HTTPException(status_code=422, detail='query required')
        
        # Simple text-based search first (fast, no AI needed for basic search)
        docs = await db.knowledge_documents.find({}).to_list(length=100)  # Limit to 100 for speed
        
        # Fast text matching
        results = []
        query_lower = query.lower()
        
        for doc in docs:
            title = doc.get('title', '').lower()
            content = doc.get('content', '').lower()
            summary = doc.get('summary', '').lower()
            
            # Calculate simple relevance score
            relevance = 0
            if query_lower in title:
                relevance += 0.5
            if query_lower in content:
                relevance += 0.3
            if query_lower in summary:
                relevance += 0.2
            
            if relevance > 0:
                results.append({
                    'title': doc.get('title'),
                    'excerpt': doc.get('summary', doc.get('content', ''))[:300] + '...',
                    'source': doc.get('filename', 'Unknown'),
                    'relevance': relevance
                })
        
        # Sort by relevance and return top results
        results.sort(key=lambda x: x['relevance'], reverse=True)
        return {'results': results[:limit], 'count': len(results[:limit])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/kb/compare-files")
async def compare_files(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """Compare two files using AI"""
    try:
        llm = LlmChat(
            api_key=os.getenv('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a file comparison assistant for automotive workshop management. Compare documents and provide detailed analysis in Arabic."
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        # Read files
        content1 = (await file1.read()).decode('utf-8', errors='ignore')[:3000]
        content2 = (await file2.read()).decode('utf-8', errors='ignore')[:3000]
        
        comparison_prompt = f"""قارن بين هذين الملفين بالتفصيل:

الملف الأول ({file1.filename}):
{content1}

الملف الثاني ({file2.filename}):
{content2}

أعطني:
1. التشابهات
2. الاختلافات  
3. التوصيات"""
        
        response = await llm.send_message(UserMessage(text=comparison_prompt))
        
        # Parse response
        response_text = response if isinstance(response, str) else response.text
        sections = response_text.split('\n\n')
        
        return {
            'file1': file1.filename,
            'file2': file2.filename,
            'similarities': sections[0] if len(sections) > 0 else '',
            'differences': sections[1] if len(sections) > 1 else '',
            'recommendations': sections[2] if len(sections) > 2 else response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/kb/compare-vehicles")
async def compare_vehicles(payload: Dict[str, Any]):
    """Compare two vehicles using AI"""
    try:
        vehicle1_id = payload.get('vehicle1_id')
        vehicle2_id = payload.get('vehicle2_id')
        
        v1 = await db.vehicles.find_one({'id': vehicle1_id})
        v2 = await db.vehicles.find_one({'id': vehicle2_id})
        
        if not v1 or not v2:
            raise HTTPException(status_code=404, detail='Vehicle not found')
        
        # Clean data
        v1.pop('_id', None)
        v2.pop('_id', None)
        
        # Use AI to analyze
        llm = LlmChat(
            api_key=os.getenv('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a vehicle comparison assistant for automotive workshop management. Compare vehicles and provide detailed analysis in Arabic."
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        prompt = f"""قارن بين هاتين المركبتين بالتفصيل:

المركبة 1: {v1.get('brand')} {v1.get('model')} {v1.get('year')} - {v1.get('plateNumber')}
المركبة 2: {v2.get('brand')} {v2.get('model')} {v2.get('year')} - {v2.get('plateNumber')}

حلل الفروقات في: الموديل، السنة، الخدمات المطلوبة، الحالة، أي معلومات مهمة."""
        
        response = await llm.send_message(UserMessage(text=prompt))
        
        return {
            'vehicle1': v1,
            'vehicle2': v2,
            'analysis': response if isinstance(response, str) else response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/kb/engine-info")
async def get_engine_info(payload: Dict[str, Any]):
    """Get engine/vehicle information using AI - Optimized with timeout and caching"""
    try:
        query = payload.get('query', '')
        
        if not query:
            raise HTTPException(status_code=422, detail='query required')
        
        # Simple prompt without heavy context to speed up response
        llm = LlmChat(
            api_key=os.getenv('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are an expert automotive mechanic assistant. Provide concise technical information about engines and vehicles in Arabic. Keep answers under 300 words."
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        # Simplified prompt for faster response
        prompt = f"""أنت خبير ميكانيكا سيارات. أجب على هذا السؤال بإيجاز (أقل من 300 كلمة):

السؤال: {query}

أعطني إجابة مختصرة ومفيدة."""
        
        # Use asyncio.wait_for to add timeout
        import asyncio
        response = await asyncio.wait_for(
            llm.send_message(UserMessage(text=prompt)),
            timeout=15.0  # 15 second timeout
        )
        
        return {
            'query': query,
            'answer': response if isinstance(response, str) else response.text,
            'sources': []
        }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail='AI response timeout - please try a simpler query')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        doc = {
            "id": str(uuid.uuid4()),
            "title": "دليل قراءة مخططات كهرباء السيارات",
            "tags": ["electrical","diagram","schematic","tutorial"],
            "content_excerpt": "خطوات قراءة المخطط: تحديد المصدر B+/IG/ACC، تتبع الفيوز والريلاي، ألوان الأسلاك، أطراف الموصلات، اتجاه السريان، نقاط القياس.",
            "structured": {
                "symbols": {
                    "battery": "B+",
                    "ignition": "IG",
                    "accessory": "ACC",
                    "ground": "E/GND",
                    "fuse": "F",
                    "relay": "RL",
                    "connector": "C/IG/K/EM/ECU pins",
                    "junction": "J/SPLICE",
                    "sensor": "SNS/V",
                    "actuator": "M/COIL"
                },
                "wire_colors_toyota": {"B":"أسود (أرضي)","W":"أبيض","R":"أحمر","G":"أخضر","Y":"أصفر","L":"أزرق","Br":"بني","P":"وردي"},
                "pinout_reading": ["اقرأ اسم الموصل (مثال C25)","تعرّف على رقم الطرف (مثال 3)","طول السلك ولونه","الوجهة التالية"],
                "flow": "B+ → FUSE → RELAY → CONNECTOR → LOAD → GROUND",
                "test_points": ["قبل/بعد الفيوز","مدخل/مخرج الريلاي","طرف الحمل","نقطة الأرضي"],
                "expected_values": ["12V عند B+","0V قبل الريلاي إذا غير مُفعّل","12V بعد الريلاي عند التفعيل","0Ω تقريبًا بين الأرضي ونقطة E"],
                "safety": ["افصل البطارية","استخدم ملتيميتر مع نطاق مناسب","تجنّب القِصر"],
                "procedure": [
                    "حدد مصدر التغذية المناسب للدائرة",
                    "اتبع المخطط من المصدر إلى الحمل مع تدوين الرموز",
                    "حدّد نقاط القياس وقارن بالقيم",
                    "عزل العطل: تغذية/تأريض/توصيل/مكوّن",
                    "أكّد الإصلاح بإعادة القياس"
                ]
            },
            "created_at": datetime.utcnow()
        }
        await db.ai_kb_electrical.insert_one(doc)
        return {"ok": True, "id": doc["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------- Diagnostics Compare & Fleet --------------------
class VehicleSnapshot(BaseModel):
    vin: Optional[str] = None
    plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    engine_code: Optional[str] = None
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
    baseline_hint: Optional[str] = None
    session_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/ai/diagnostics/compare")
async def ai_diagnostics_compare(payload: CompareRequest):
    try:
        session_id = payload.session_id or str(uuid.uuid4())
        hint = payload.baseline_hint or payload.vehicle_a.engine_code or payload.vehicle_b.engine_code or ""
        doc_query_terms = [t for t in [hint, payload.vehicle_a.engine_code, payload.vehicle_b.engine_code, "SCV", "Rail", "Injector", "DTC"] if t]
        doc_hits: List[Dict[str, Any]] = []
        if doc_query_terms:
            q = {"$or": [{"title": {"$regex": term, "$options": "i"}} for term in doc_query_terms] + [{"content": {"$regex": term, "$options": "i"}} for term in doc_query_terms]}
            doc_hits = await db.ai_kb_docs.find(q).limit(5).to_list(length=5)
            for d in doc_hits:
                d.pop('_id', None)
        def to_lines(v: VehicleSnapshot) -> str:
            data = v.dict()
            lines = []
            for k, val in data.items():
                if val is not None:
                    lines.append(f"- {k}: {val}")
            return "\n".join(lines)
        ctx_docs = "\n\n".join([f"[مرجع] {d.get('title') or d.get('file_name')}:\n{(d.get('content') or '')[:500]}" for d in (doc_hits or [])])
        system_prompt = f"""أنت خبير كهرباء ومحركات ديزل وأنظمة DENSO CRS.
قارن بين مركبتين وحدد الطبيعي/غير الطبيعي بناءً على المراجع الكهربائية المختصرة أدناه.
اكتب: ملخص، مقارنة نصية، القيم الحرجة، الأسباب المحتملة، خطوات فحص بالمِلتميتر/الاسكانر، توصيات، مخاطر السلامة.

مراجع مختصرة:
{ctx_docs}
"""
        user_prompt = f"""المركبة أ:\n{to_lines(payload.vehicle_a)}\n\nالمركبة ب:\n{to_lines(payload.vehicle_b)}\n\nالمطلوب: تقرير مقارنة عربي احترافي مع حكم (طبيعي/غير طبيعي) لكل مؤشر كهربائي وحقن، وتوصيات عملية."""
        provider = (payload.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = payload.model or ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            a = payload.vehicle_a.dict()
            b = payload.vehicle_b.dict()
            diffs = {k: {"a": a.get(k), "b": b.get(k)} for k in set(a)|set(b) if a.get(k) != b.get(k)}
            rep = {"summary": "تقرير بدائي بلا نموذج ذكاء (مطلوب EMERGENT_LLM_KEY)", "diffs": diffs}
            await db.ai_vehicle_cases.insert_one({
                "id": str(uuid.uuid4()), "session_id": session_id, "type": "compare", "payload": payload.dict(), "report": rep, "timestamp": datetime.utcnow()
            })
            return rep
        chat = LlmChat(api_key=llm_key, session_id=session_id, system_message=system_prompt).with_model(provider, model)
        response = await chat.send_message(UserMessage(text=user_prompt))
        report = {"report": response, "session_id": session_id, "provider": provider, "model": model, "doc_refs": [d.get('title') or d.get('file_name') for d in (doc_hits or [])]}
        await db.ai_vehicle_cases.insert_one({
            "id": str(uuid.uuid4()), "session_id": session_id, "type": "compare", "payload": payload.dict(), "report": report, "timestamp": datetime.utcnow()
        })
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/diagnostics/analyze-fleet")
async def ai_analyze_fleet(payload: dict = Body(default={})):
    try:
        account_id = payload.get('account_id')
        q: Dict[str, Any] = {}
        if account_id:
            q['accountId'] = account_id
        vehicles = await db.vehicles.find(q).to_list(length=5000)
        for v in vehicles:
            v.pop('_id', None)
        total = len(vehicles)
        by_status = {}
        brands = {}
        for v in vehicles:
            s = (v.get('status') or 'unknown')
            by_status[s] = by_status.get(s, 0) + 1
            b = (v.get('brand') or 'Unknown')
            brands[b] = brands.get(b, 0) + 1
        kpi = {"totalVehicles": total, "byStatus": by_status, "topBrands": sorted(brands.items(), key=lambda x: x[1], reverse=True)[:10]}
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            return {"kpi": kpi, "ai": None, "note": "LLM key missing; returned KPIs only"}
        provider = (os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        system_prompt = "محلل عمليات للورشة يقدّم مؤشرات وتنبيهات ذكية حول حالة المركبات وتدفق العمل."
        context = f"إجمالي المركبات: {total}\nحسب الحالة: {by_status}\nأكثر 10 علامات: {kpi['topBrands']}"
        ask = "حلّل المؤشرات وقدّم 3 تنبيهات مبكرة، و3 توصيات قابلة للتنفيذ."
        chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=system_prompt).with_model(provider, model)
        ai_resp = await chat.send_message(UserMessage(text=context + "\n\n" + ask))
        return {"kpi": kpi, "ai": ai_resp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------- Media Upload (Video up to 1GB, audio extraction) --------------------
class InitUploadRequest(BaseModel):
    filename: str
    size: int
    mimeType: Optional[str] = None


@router.post("/media/upload/init")
async def media_upload_init(req: InitUploadRequest):
    try:
        if req.size > 1024 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Max 1GB allowed")
        upload_id = str(uuid.uuid4())
        await db.ai_media_uploads.insert_one({
            "id": upload_id, "filename": req.filename, "size": req.size, "mimeType": req.mimeType, "createdAt": datetime.utcnow()
        })
        return {"uploadId": upload_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/media/upload/chunk")
async def media_upload_chunk(uploadId: str = Body(...), index: int = Body(...), chunk: UploadFile = File(...)):
    try:
        if not uploadId:
            raise HTTPException(status_code=400, detail="uploadId required")
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        chunk_path = TMP_DIR / f"{uploadId}_{index:06d}.part"
        with open(chunk_path, "wb") as f:
            f.write(await chunk.read())
        return {"ok": True, "index": index}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CompleteUploadRequest(BaseModel):
    uploadId: str
    totalChunks: int


@router.post("/media/upload/complete")
async def media_upload_complete(req: CompleteUploadRequest):
    try:
        meta = await db.ai_media_uploads.find_one({"id": req.uploadId})
        if not meta:
            raise HTTPException(status_code=404, detail="upload not found")
        safe_name = meta['filename'].replace('/', '_')
        VIDEO_DIR.mkdir(parents=True, exist_ok=True)
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        final_name = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{safe_name}"
        final_path = VIDEO_DIR / final_name
        with open(final_path, "wb") as out:
            for i in range(req.totalChunks):
                part_path = TMP_DIR / f"{req.uploadId}_{i:06d}.part"
                if not part_path.exists():
                    raise HTTPException(status_code=400, detail=f"missing chunk {i}")
                with open(part_path, "rb") as p:
                    shutil.copyfileobj(p, out)
        # cleanup
        for i in range(req.totalChunks):
            try:
                part_path = TMP_DIR / f"{req.uploadId}_{i:06d}.part"
                part_path.unlink(missing_ok=True)
            except Exception:
                pass
        # extract audio if ffmpeg available
        audio_path = None
        try:
            if shutil.which('ffmpeg'):
                audio_name = os.path.splitext(final_name)[0] + ".mp3"
                audio_path = AUDIO_DIR / audio_name
                cmd = ['ffmpeg', '-y', '-i', str(final_path), '-vn', '-acodec', 'libmp3lame', '-q:a', '2', str(audio_path)]
                subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception:
            audio_path = None
        rec = {
            "id": str(uuid.uuid4()), "uploadId": req.uploadId, "videoPath": str(final_path), "audioPath": str(audio_path) if audio_path else None,
            "filename": meta['filename'], "size": meta['size'], "createdAt": datetime.utcnow()
        }
        await db.ai_media.insert_one(rec)
        # Add placeholder KB doc
        kb_doc = {
            "id": str(uuid.uuid4()), "source_type": "video", "title": f"فيديو تقني: {meta['filename']}",
            "content": f"تمت إضافة فيديو للتوثيق الفني. المسار: {final_path}. الصوت: {audio_path or 'قيد المعالجة/غير متوفر' }.",
            "tags": ["video","repair","electrical","inspection"], "url": None, "file_name": meta['filename'], "created_at": datetime.utcnow()
        }
        await db.ai_kb_docs.insert_one(kb_doc)
        return {"ok": True, "video": final_path, "audio": audio_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/media/list")
async def media_list(limit: int = 50):
    try:
        rows = await db.ai_media.find({}).sort("createdAt", -1).limit(limit).to_list(length=limit)
        for r in rows:
            r.pop('_id', None)
        return {"items": rows, "count": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------- Electrical Knowledge Extraction & QA --------------------
class ElectricalIngestRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    docId: Optional[str] = None
    tags: Optional[List[str]] = None


@router.post("/ai/kb/electrical/ingest")
async def electrical_ingest(req: ElectricalIngestRequest):
    try:
        text = req.content
        if not text and req.docId:
            doc = await db.ai_kb_docs.find_one({"id": req.docId})
            if not doc:
                raise HTTPException(status_code=404, detail="doc not found")
            text = doc.get('content')
        if not text:
            raise HTTPException(status_code=400, detail="content or docId required")
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        structured = None
        if llm_key:
            provider = (os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
            model = ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
            system = "استخرج معرفة كهربائية منظمة من النص (أسماء الدوائر/الفيوزات/الريلايات/الأرضي/الحساسات/أرقام الأطراف/الجهود الطبيعية/خطوات الفحص) وأعد JSON."
            prompt = f"نص مرجعي:\n{text[:6000]}\n\nالمطلوب: JSON بالمفاتيح: components(fuses, relays, sensors, connectors, grounds), wires, pinouts, expected_values, test_steps(ar), safety_notes."
            chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=system).with_model(provider, model)
            try:
                structured = await chat.send_message(UserMessage(text=prompt))
            except Exception:
                structured = None
        if not structured:
            structured = {
                "components": {"fuses": [], "relays": [], "sensors": [], "connectors": [], "grounds": []},
                "wires": [], "pinouts": [], "expected_values": [], "test_steps": ["فحص فولت/أوم حسب المخطط"], "safety_notes": ["افصل البطارية قبل العمل"]
            }
        row = {
            "id": str(uuid.uuid4()), "title": req.title or "معرفة كهربائية", "tags": (req.tags or []) + ["electrical"],
            "content_excerpt": text[:1000], "structured": structured, "created_at": datetime.utcnow()
        }
        await db.ai_kb_electrical.insert_one(row)
        return {"ok": True, "id": row["id"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/kb/electrical/search")
async def electrical_search(query: str, limit: int = 10):
    try:
        q = {"$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"content_excerpt": {"$regex": query, "$options": "i"}},
            {"tags": {"$in": [query]}},
        ]}
        docs = await db.ai_kb_electrical.find(q).sort("created_at", -1).limit(limit).to_list(length=limit)
        for d in docs:
            d.pop('_id', None)
        return {"results": docs, "count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ElectricalQARequest(BaseModel):
    message: str
    vehicle_info: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


@router.post("/ai/electrical/qa")
async def electrical_qa(request: ElectricalQARequest):
    try:
        q = {"$or": [
            {"title": {"$regex": request.message, "$options": "i"}},
            {"content_excerpt": {"$regex": request.message, "$options": "i"}},
            {"tags": {"$in": ["electrical"]}}
        ]}
        hits = await db.ai_kb_electrical.find(q).sort("created_at", -1).limit(3).to_list(length=3)
        for h in hits:
            h.pop('_id', None)
        ctx = "\n\n".join([f"[مرجع كهربائي] {h.get('title')}:\n{h.get('content_excerpt')}\nمُنظم: {str(h.get('structured'))[:400]}" for h in hits])
        system_prompt = f"""أنت خبير كهرباء مركبات.
استخدم المراجع الكهربائية أدناه لتقديم تشخيص وخطوات فحص دقيقة بالمِلتميتر والاسكانر، مع قيم جهد/مقاومة متوقعة إن أمكن.
{ctx}
"""
        provider = (request.provider or os.getenv("DEFAULT_AI_PROVIDER") or "anthropic").strip().lower()
        model = request.model or ("gpt-5" if provider == "openai" else "claude-3-7-sonnet-20250219")
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if not llm_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY missing")
        chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=system_prompt).with_model(provider, model)
        resp = await chat.send_message(UserMessage(text=request.message))
        return {"response": resp, "sources": [h.get('title') for h in hits]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------- Generic KB (existing minimal) --------------------
class NewSolution(BaseModel):
    problem_type: str
    vehicle_info: str
    problem_description: str
    solution: str
    technician_name: Optional[str] = None
    effectiveness_rating: int = 5


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
        return {"success": True, "message": "تم إضافة الحل إلى قاعدة المعرفة بنجاح", "entry_id": entry.get("_id") and str(entry.get("_id"))}
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
            "id": str(uuid.uuid4()), "source_type": payload.get('source_type','manual'), "title": payload.get('title'),
            "content": payload['content'], "tags": payload.get('tags', []), "url": payload.get('url'), "file_name": payload.get('file_name'), "created_at": datetime.utcnow()
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
async def submit_solution_feedback(feedback: dict = Body(...)):
    try:
        await knowledge_base.mark_solution_used(
            solution_id=feedback.get('solution_id'),
            was_successful=feedback.get('was_helpful', True)
        )
        return {"success": True, "message": "شكراً لتقييمك"}
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
