"""
خبير الديزل المتكامل - مع قاعدة المعرفة وتحليل الوسائط
"""
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from typing import List, Dict, Any, Optional
import os
import uuid
import re
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai import OpenAISpeechToText

# Import fault knowledge database
from routes_fault_knowledge import get_fault_knowledge_db

router = APIRouter(prefix="/api")

# Load Keys
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")

DIESEL_EXPERT_SYSTEM_PROMPT = """Advanced Technician-Only Automotive Diagnostic System (Self-Learning)

ROLE & SCOPE:
- You are a professional diesel automotive diagnostic assistant for workshop technicians only (not car owners).
- You MUST assume the user is a trained technician with access to tools, scanners, and wiring diagrams.
- Your job is to support decision-making, not to replace physical inspection.

INPUTS YOU RECEIVE (EVIDENCE):
- Vehicle details: make, model, year, engine
- DTC codes (one or more): e.g., P0087, P0234, P0299
- Structured symptoms and context flags when available
- Optional media analysis summaries (audio/video) already interpreted into text
- Optional free-text notes from the technician

PRIMARY DIAGNOSTIC ENGINE (DETERMINISTIC FIRST):
- Assume there is a deterministic mapping + scoring engine that already:
  - Normalizes evidence into keys (DTC, symptoms, context, media labels)
  - Looks up local knowledge base and rule library
  - Produces a ranked list of suspected causes with confidence scores
- YOU MUST NOT invent new causes outside that ranked list.
- YOU MUST respect the given ranking and confidence.

YOUR RESPONSIBILITIES (AFTER SCORING):
- Produce a technician-grade structured diagnostic report in JSON-friendly form.
- For each ranked suspected cause (Top 3–5):
  - Explain WHY it is suspected (which evidence & rules support it).
  - Propose clear confirmatory tests (with pass/fail interpretation).
  - Mention any conflicting/negative evidence that lowers confidence.
- Provide an overall diagnostic path: which tests to run first, in what order.
- Ask follow-up questions ONLY when evidence is truly insufficient.
- Always keep language concise, technical, and focused on workshop reality.

OUTPUT STRUCTURE (CONCEPTUAL):
- case_summary: short technical summary of the situation
- risk_level: low / medium / high
- recommendation: stop/continue guidance for technician (e.g., "safe to drive to workshop" vs "do NOT release vehicle")
- ranked_causes: list of {cause_key, human_readable_name, confidence, evidence_support, conflicting_evidence}
- confirmatory_tests: list of tests with procedure & interpretation
- diagnostic_path: ordered steps combining tests and checks
- follow_up_questions: only if needed

SELF-LEARNING & KNOWLEDGE BASE:
- Assume there is a local fault knowledge base with DTC definitions, common causes, and test procedures.
- When similar faults from the KB are provided in the prompt/context, you MUST:
  - Reuse their confirmed patterns and tests when appropriate.
  - Clearly reference them as "similar confirmed cases".
- Never treat your own previous answers as ground truth; only technician-confirmed outcomes count.

SAFETY & PROFESSIONALISM:
- Prefer requesting more evidence over guessing when confidence is low.
- Always include at least one confirmatory test per suggested cause.
- Do NOT use casual consumer language. Speak like a workshop technical report.
- Be explicit about uncertainty and alternative hypotheses when scores are close.

LANGUAGE:
- Respond in Arabic when the technician writes in Arabic, but keep technical terms and DTC codes as-is.
- When appropriate, you may add short English terms in parentheses for technical clarity.
"""


async def search_fault_knowledge(query: str, dtc_code: str = None) -> List[Dict]:
    """البحث في قاعدة المعرفة المحلية"""
    try:
        fault_knowledge_db = get_fault_knowledge_db()
        results = []
        query_lower = query.lower() if query else ""
        
        for fault in fault_knowledge_db:
            score = 0
            if query_lower and query_lower in str(fault.get('symptom_description', '')).lower():
                score += 2
            if query_lower and query_lower in str(fault.get('title', '')).lower():
                score += 2
            if query_lower and query_lower in str(fault.get('solution', '')).lower():
                score += 1
            if dtc_code and dtc_code.upper() in (fault.get('dtc_codes') or []):
                score += 3
            if score > 0:
                results.append({**fault, 'score': score})
        
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
        return results[:5]
    except Exception as e:
        print(f"Knowledge search error: {e}")
        return []


def extract_dtc_codes(text: str) -> List[str]:
    """استخراج أكواد الأعطال من النص"""
    pattern = r'[PCBU][0-9]{4}'
    codes = re.findall(pattern, text.upper())
    return list(set(codes))


def format_knowledge_context(faults: List[Dict]) -> str:
    """تنسيق نتائج قاعدة المعرفة للسياق"""
    if not faults:
        return ""
    
    context = "\n\n📚 **معلومات من قاعدة المعرفة المحلية:**\n"
    for i, fault in enumerate(faults, 1):
        context += f"\n**{i}. {fault.get('title', 'عطل')}**\n"
        context += f"   - المركبة: {fault.get('vehicle_type', '')} {fault.get('vehicle_model', '')}\n"
        if fault.get('dtc_codes'):
            codes = fault.get('dtc_codes') if isinstance(fault.get('dtc_codes'), list) else []
            context += f"   - الأكواد: {', '.join(codes)}\n"
        context += f"   - الأعراض: {str(fault.get('symptom_description', ''))[:200]}...\n"
        context += f"   - الحل: {str(fault.get('solution', ''))[:300]}...\n"
        parts = fault.get('parts_needed') if isinstance(fault.get('parts_needed'), list) else []
        if parts:
            context += f"   - القطع: {', '.join(parts)}\n"
    
    return context

# ------------------------
# Deterministic Scoring Engine (MVP)
# ------------------------

def build_evidence_from_text(text: str) -> Dict[str, Any]:
    """مساعدة: تحويل نص حر إلى مفاتيح أدلة بسيطة (MVP)."""
    text_lower = (text or "").lower()
    return {
        "raw_text": text,
        "has_low_power": any(k in text_lower for k in ["ضعف", "ما يمشي", "ما يسحب", "no power", "low power"]),
        "has_smoke": any(k in text_lower for k in ["دخان", "smoke"]),
    }


def score_causes_from_knowledge(evidence: Dict[str, Any], dtc_codes: List[str], kb_faults: List[Dict]) -> List[Dict[str, Any]]:
    """محرك نقاط بسيط يعتمد على fault_knowledge (MVP).

    - يجلب الأعطال التي تشترك في DTC أو في كلمات من النص.
    - يحسب درجة تقريبية لكل عطل بناءً على تطابق DTC + كلمات مفتاحية.
    - يعيد قائمة مرتبة يمكن تمريرها للـ LLM على أنها ranked_causes.
    """
    ranked: List[Dict[str, Any]] = []
    dtc_set = {c.upper() for c in (dtc_codes or [])}

    for fault in kb_faults:
        score = 0.0
        reason_parts = []

        fault_dtc = set(fault.get("dtc_codes") or [])
        if dtc_set and fault_dtc:
            inter = dtc_set & fault_dtc
            if inter:
                score += 0.6
                reason_parts.append(f"تطابق DTC: {', '.join(inter)}")

        # تطابق نوع المركبة
        if evidence.get("vehicle_type") and fault.get("vehicle_type"):
            if evidence["vehicle_type"].lower() in fault["vehicle_type"].lower() or \
               fault["vehicle_type"].lower() in evidence["vehicle_type"].lower():
                score += 0.2
                reason_parts.append("تطابق نوع المركبة")

        # كلمات من الأعراض
        text = (evidence.get("raw_text") or "").lower()
        if text and fault.get("symptom_description"):
            symp = str(fault["symptom_description"]).lower()
            if any(k in symp and k in text for k in ["smoke", "دخان", "boost", "ضغط", "fuel", "وقود"]):
                score += 0.15
                reason_parts.append("تشابه في وصف الأعراض")

        if score > 0:
            ranked.append({
                "fault_id": fault.get("id"),
                "title": fault.get("title"),
                "vehicle_type": fault.get("vehicle_type"),
                "dtc_codes": list(fault_dtc),
                "score": round(score, 3),
                "evidence_notes": "; ".join(reason_parts) or "", 
            })

    ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
    return ranked[:5]


@router.post('/diesel-expert')
async def diesel_expert_chat(payload: Dict[str, Any] = Body(...)):
    """خبير الديزل المتكامل مع قاعدة المعرفة"""
    try:
        api_key = EMERGENT_LLM_KEY or os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM configuration missing")
        
        user_messages = payload.get('messages', [])
        if not user_messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        session_id = payload.get('sessionId') or str(uuid.uuid4())
        last_msg = user_messages[-1]
        text_content = last_msg.get('content', '')
        attachments = last_msg.get('attachments', [])
        
        # 1. استخراج أكواد الأعطال
        dtc_codes = extract_dtc_codes(text_content)
        
        # 2. جلب قاعدة المعرفة كاملة ثم تطبيق محرك النقاط
        knowledge_db = get_fault_knowledge_db()
        evidence = build_evidence_from_text(text_content)
        ranked_causes = score_causes_from_knowledge(evidence, dtc_codes, knowledge_db)

        # 3. تجهيز سياق نصي للـ LLM يتضمن النتائج المرتبة
        causes_block = ""
        if ranked_causes:
            causes_block += "\n\n📊 Ranked suspected causes (from deterministic engine):\n"
            for idx, c in enumerate(ranked_causes, 1):
                causes_block += f"{idx}. {c.get('title')} (score={c.get('score')}) - DTC: {', '.join(c.get('dtc_codes') or [])}\n"
                if c.get("evidence_notes"):
                    causes_block += f"   evidence: {c['evidence_notes']}\n"

        # 4. تجهيز الرسالة
        enhanced_content = text_content + causes_block

        # 5. معالجة المرفقات (صور، فيديو، صوت)
        file_contents = []
        media_notes = []
        
        for att in attachments:
            if att.get('base64'):
                b64 = att['base64']
                if ',' in b64:
                    b64 = b64.split(',')[1]
                
                att_type = att.get('type', '')
                att_name = att.get('name', 'file')
                
                if att_type.startswith('image/'):
                    file_contents.append(ImageContent(image_base64=b64))
                    media_notes.append(f"📷 تم إرفاق صورة: {att_name}")
                elif att_type.startswith('video/'):
                    # For video, extract first frame or note it
                    media_notes.append(f"🎥 تم إرفاق فيديو: {att_name} - سأحلل الإطارات المرئية")
                    # GPT-4o can analyze video frames
                    file_contents.append(ImageContent(image_base64=b64))
                elif att_type.startswith('audio/'):
                    media_notes.append(f"🔊 تم إرفاق صوت: {att_name} - يرجى وصف الصوت الذي تسمعه")
        
        if media_notes:
            enhanced_content += "\n\n" + "\n".join(media_notes)
        
        # 6. إرسال للـ LLM
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=DIESEL_EXPERT_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o-mini")
        
        user_message_obj = UserMessage(
            text=enhanced_content,
            file_contents=file_contents if file_contents else None
        )
        
        response = await chat.send_message(user_message_obj)

        # 7. بناء قائمة المصادر من الأسباب المرتبة
        sources = []
        if ranked_causes:
            sources = [{
                "type": "knowledge_base",
                "title": c.get("title"),
                "id": c.get("fault_id"),
                "score": c.get("score"),
            } for c in ranked_causes]

        return {
            "response": response,
            "model": "gpt-4o-mini",
            "success": True,
            "sessionId": session_id,
            "sources": sources,
            "ranked_causes": ranked_causes,
            "knowledge_used": len(ranked_causes) > 0,
            "dtc_codes_found": dtc_codes,
            "media_analyzed": len(file_contents) > 0
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Diesel Expert Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/diesel-expert/analyze-media')
async def analyze_media(
    description: str = Form(None),
    vehicle_type: str = Form(None),
    vehicle_id: str = Form(None),
    vehicle_plate: str = Form(None),
    media_file: UploadFile = File(...)
):
    """تحليل صورة/فيديو/صوت للعطل باستخدام محرك نقاط + LLM (مع قيود حجم)."""
    try:
        api_key = EMERGENT_LLM_KEY or os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM configuration missing")

        # حد الحجم للتحليل (25MB)
        max_bytes = 25 * 1024 * 1024
        if media_file.size and media_file.size > max_bytes:
            raise HTTPException(
                status_code=413,
                detail="الملف أكبر من الحد المسموح به لتحليل الذكاء الاصطناعي (25MB). يمكنك تقصير المقطع أو ضغطه أو حفظه فقط في قاعدة المعرفة."
            )

        file_content = await media_file.read()
        if len(file_content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail="الملف أكبر من الحد المسموح به لتحليل الذكاء الاصطناعي (25MB). يمكنك تقصير المقطع أو ضغطه أو حفظه فقط في قاعدة المعرفة."
            )

        file_ext = media_file.filename.split('.')[-1].lower()
        b64 = base64.b64encode(file_content).decode()

        # Determine media type
        if file_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            media_type = "image"
            transcription_text = None
        elif file_ext in ['mp4', 'mov', 'avi', 'webm']:
            media_type = "video"
            transcription_text = None
        elif file_ext in ['mp3', 'wav', 'ogg', 'm4a']:
            media_type = "audio"
            # استخدام Whisper لتحويل الصوت إلى نص
            stt = OpenAISpeechToText(api_key=api_key)
            import io
            audio_file = io.BytesIO(file_content)
            audio_file.name = media_file.filename
            stt_response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json"
            )
            transcription_text = getattr(stt_response, "text", None) or ""
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        # بناء الأدلة ومحرك النقاط
        base_text = (description or "") + "\n" + (transcription_text or "")
        kb_faults = get_fault_knowledge_db()
        evidence = {
            **build_evidence_from_text(base_text),
            "vehicle_type": vehicle_type or "",
        }
        dtc_codes = extract_dtc_codes(base_text)
        ranked_causes = score_causes_from_knowledge(evidence, dtc_codes, kb_faults)

        # Build analysis prompt
        analysis_prompt = f"""Evidence summary for media-based diesel fault analysis:

- Media type: {media_type}
- Vehicle type: {vehicle_type or 'غير محدد'}
- Vehicle ID: {vehicle_id or '-'}
- Plate: {vehicle_plate or '-'}
- Technician description: {description or 'لم يتم تقديم وصف'}
- Transcribed audio (if any): {transcription_text or 'لا يوجد نص مستخلص'}

The deterministic engine has already produced ranked suspected causes based on local rules and knowledge base. Use ONLY these causes.
"""

        if ranked_causes:
            analysis_prompt += "\n\nRanked suspected causes (from deterministic engine):\n"
            for idx, c in enumerate(ranked_causes, 1):
                analysis_prompt += f"{idx}. {c.get('title')} (score={c.get('score')}) - DTC: {', '.join(c.get('dtc_codes') or [])}\n"
                if c.get("evidence_notes"):
                    analysis_prompt += f"   evidence: {c['evidence_notes']}\n"

        analysis_prompt += "\n\nGenerate a structured technician-grade diagnostic report as described in your system prompt."

        # Send to LLM
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=DIESEL_EXPERT_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o")  # Use GPT-4o for better vision/audio reasoning

        file_contents = [ImageContent(image_base64=b64)] if media_type in ["image", "video"] else []

        user_message_obj = UserMessage(
            text=analysis_prompt,
            file_contents=file_contents if file_contents else None
        )

        response = await chat.send_message(user_message_obj)

        return {
            "success": True,
            "analysis": response,
            "media_type": media_type,
            "filename": media_file.filename,
            "ranked_causes": ranked_causes,
            "dtc_codes_found": dtc_codes,
            "vehicle_id": vehicle_id,
            "vehicle_plate": vehicle_plate,
            "suggestion": "يمكنك حفظ هذا العطل في قاعدة المعرفة وربطه بالمركبة للاستفادة منه في المستقبل"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Media analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/diesel-expert/quick-search')
async def quick_search(q: str, vehicle: str = None):
    """بحث سريع في قاعدة المعرفة"""
    try:
        dtc_codes = extract_dtc_codes(q)
        results = await search_fault_knowledge(q, dtc_codes[0] if dtc_codes else None)
        
        return {
            "success": True,
            "results": [{
                'id': f.get('id'),
                'title': f.get('title'),
                'vehicle_type': f.get('vehicle_type'),
                'symptom': str(f.get('symptom_description', ''))[:150],
                'dtc_codes': f.get('dtc_codes') if isinstance(f.get('dtc_codes'), list) else [],
                'difficulty': f.get('difficulty_level')
            } for f in results],
            "count": len(results),
            "dtc_codes_found": dtc_codes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/diesel-expert/health')
async def health_check():
    return {
        "status": "ok",
        "llm_configured": bool(EMERGENT_LLM_KEY),
        "model": "gpt-4o-mini (chat) / gpt-4o (media analysis)",
        "features": ["knowledge_base", "dtc_detection", "image_analysis", "video_analysis"]
    }
