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
        
        # 2. البحث في قاعدة المعرفة
        knowledge_results = []
        if text_content or dtc_codes:
            knowledge_results = await search_fault_knowledge(
                text_content, 
                dtc_codes[0] if dtc_codes else None
            )
        
        # 3. تجهيز السياق
        knowledge_context = format_knowledge_context(knowledge_results)
        
        # 4. تجهيز الرسالة
        enhanced_content = text_content
        if knowledge_context:
            enhanced_content = f"{text_content}\n\n{knowledge_context}"
        
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
        
        # 7. إضافة مصادر المعرفة
        sources = []
        if knowledge_results:
            sources = [{
                'type': 'knowledge_base',
                'title': f.get('title'),
                'id': f.get('id')
            } for f in knowledge_results]
        
        return {
            "response": response,
            "model": "gpt-4o-mini",
            "success": True,
            "sessionId": session_id,
            "sources": sources,
            "knowledge_used": len(knowledge_results) > 0,
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
    media_file: UploadFile = File(...)
):
    """تحليل صورة/فيديو/صوت للعطل"""
    try:
        api_key = EMERGENT_LLM_KEY or os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM configuration missing")
        
        file_content = await media_file.read()
        file_ext = media_file.filename.split('.')[-1].lower()
        b64 = base64.b64encode(file_content).decode()
        
        # Determine media type
        if file_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            media_type = "image"
            media_prompt = "حلل هذه الصورة وحدد أي مشاكل أو أعطال واضحة في المحرك أو النظام."
        elif file_ext in ['mp4', 'mov', 'avi', 'webm']:
            media_type = "video"
            media_prompt = "حلل هذا الفيديو وحدد أي مشاكل أو أعطال واضحة. لاحظ أي أصوات غير طبيعية أو اهتزازات."
        elif file_ext in ['mp3', 'wav', 'ogg', 'm4a']:
            media_type = "audio"
            media_prompt = "تم إرفاق ملف صوتي. يرجى وصف الصوت الذي تسمعه من المحرك حتى أتمكن من تحليله."
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Build analysis prompt
        analysis_prompt = f"""قم بتحليل هذا {media_type} وقدم تشخيص شامل:

{media_prompt}

**معلومات إضافية:**
- نوع المركبة: {vehicle_type or 'غير محدد'}
- وصف المشكلة: {description or 'لم يتم تقديم وصف'}

قدم:
1. وصف ما تراه/تسمعه
2. التشخيص المحتمل
3. الأسباب المحتملة
4. خطوات الفحص المقترحة
5. الحل المقترح
6. هل يجب حفظ هذا العطل في قاعدة المعرفة؟"""
        
        # Search knowledge base for similar issues
        knowledge_results = await search_fault_knowledge(description or vehicle_type or "")
        knowledge_context = format_knowledge_context(knowledge_results)
        if knowledge_context:
            analysis_prompt += f"\n\n{knowledge_context}"
        
        # Send to LLM
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=DIESEL_EXPERT_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o")  # Use GPT-4o for better vision
        
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
            "similar_faults": [{
                'title': f.get('title'),
                'id': f.get('id')
            } for f in knowledge_results],
            "suggestion": "يمكنك حفظ هذا العطل في قاعدة المعرفة للاستفادة منه في المستقبل"
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
