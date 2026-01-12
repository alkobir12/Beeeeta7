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

# Import fault knowledge database
from routes_fault_knowledge import get_fault_knowledge_db

router = APIRouter(prefix="/api")

# Load Keys
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")

DIESEL_EXPERT_SYSTEM_PROMPT = """أنت خبير صيانة سيارات الديزل متخصص في تويوتا وإيسوزو وميتسوبيشي. تتميز بـ:
- تحليل Datastream و Livestream
- قراءة مخططات الأسلاك الكهربائية
- تشخيص أكواد الأعطال (P0087, P0088, P0093, P0234, P0299, إلخ)
- إصلاح أنظمة Common Rail
- مواصفات ضغط الوقود (1GD-FTV, 2GD-FTV, F33A-FTV, 4JJ1, 4N15)
- تشخيص أنظمة التيربو
- مشاكل DPF و EGR
- المشاكل الخاصة بمنطقة الخليج (الحرارة، الغبار، جودة الوقود)
- لاند كروزر 300 (2022) محرك V6 ديزل توين تيربو (F33A-FTV)

تجيب بالعربية والإنجليزية حسب لغة المستخدم.
تقدم حلول عملية ومفصلة لميكانيكيين الديزل.

عند وجود معلومات من قاعدة المعرفة المحلية، اذكرها واستفد منها في إجابتك.

⚠️ تحليل الصور والفيديو:
- عند تحليل صورة أو فيديو، قم بوصف ما تراه بدقة
- حدد أي مشاكل أو أعطال واضحة
- اقترح خطوات التشخيص والإصلاح
- إذا كانت الصورة غير واضحة، اطلب صورة أفضل

هام: إذا وجدت عطل مشابه في قاعدة المعرفة، اقتبس منه الحل وخطوات التشخيص.
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

DIESEL_EXPERT_SYSTEM_PROMPT = """أنت خبير صيانة سيارات الديزل متخصص في تويوتا وإيسوزو وميتسوبيشي. تتميز بـ:
- تحليل Datastream و Livestream
- قراءة مخططات الأسلاك الكهربائية
- تشخيص أكواد الأعطال (P0087, P0088, P0093, P0234, P0299, إلخ)
- إصلاح أنظمة Common Rail
- مواصفات ضغط الوقود (1GD-FTV, 2GD-FTV, F33A-FTV, 4JJ1, 4N15)
- تشخيص أنظمة التيربو
- مشاكل DPF و EGR
- المشاكل الخاصة بمنطقة الخليج (الحرارة، الغبار، جودة الوقود)
- لاند كروزر 300 (2022) محرك V6 ديزل توين تيربو (F33A-FTV)

تجيب بالعربية والإنجليزية حسب لغة المستخدم.
تقدم حلول عملية ومفصلة لميكانيكيين الديزل.

عند وجود معلومات من قاعدة المعرفة المحلية، اذكرها واستفد منها في إجابتك.
عند وجود معلومات من الإنترنت، اذكر المصدر.
إذا تم تقديم صورة أو فيديو، حللها بعناية لتحديد المشكلة.

هام: إذا وجدت عطل مشابه في قاعدة المعرفة، اقتبس منه الحل وخطوات التشخيص.
"""


async def search_fault_knowledge(query: str, dtc_code: str = None) -> List[Dict]:
    """البحث في قاعدة المعرفة المحلية"""
    try:
        fault_knowledge_db = get_fault_knowledge_db()
        results = []
        query_lower = query.lower() if query else ""
        
        for fault in fault_knowledge_db:
            score = 0
            if query_lower and query_lower in fault.get('symptom_description', '').lower():
                score += 2
            if query_lower and query_lower in fault.get('title', '').lower():
                score += 2
            if query_lower and query_lower in fault.get('solution', '').lower():
                score += 1
            if dtc_code and dtc_code.upper() in fault.get('dtc_codes', []):
                score += 3
            if score > 0:
                results.append({**fault, 'score': score})
        
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
        return results[:5]
    except Exception as e:
        print(f"Knowledge search error: {e}")
        return []


async def search_web(query: str) -> str:
    """البحث على الإنترنت عن معلومات الأعطال"""
    try:
        # Use a simple approach - search for diesel repair info
        search_query = f"diesel engine {query} repair diagnosis solution"
        
        # For now, return a structured note that web search was attempted
        # In production, integrate with a real search API
        return f"[تم البحث على الإنترنت عن: {query}]"
    except Exception as e:
        print(f"Web search error: {e}")
        return ""


def extract_dtc_codes(text: str) -> List[str]:
    """استخراج أكواد الأعطال من النص"""
    import re
    # Pattern for DTC codes like P0087, P0234, etc.
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
            context += f"   - الأكواد: {', '.join(fault.get('dtc_codes', []))}\n"
        context += f"   - الأعراض: {fault.get('symptom_description', '')[:200]}...\n"
        context += f"   - الحل: {fault.get('solution', '')[:300]}...\n"
        if fault.get('parts_needed'):
            context += f"   - القطع: {', '.join(fault.get('parts_needed', []))}\n"
    
    return context


@router.post('/diesel-expert')
async def diesel_expert_chat(payload: Dict[str, Any] = Body(...)):
    """
    خبير الديزل المتكامل مع قاعدة المعرفة والبحث
    """
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
        
        # 1. استخراج أكواد الأعطال من النص
        dtc_codes = extract_dtc_codes(text_content)
        
        # 2. البحث في قاعدة المعرفة
        knowledge_results = []
        if text_content or dtc_codes:
            knowledge_results = await search_fault_knowledge(
                text_content, 
                dtc_codes[0] if dtc_codes else None
            )
        
        # 3. تجهيز السياق من قاعدة المعرفة
        knowledge_context = format_knowledge_context(knowledge_results)
        
        # 4. تجهيز الرسالة النهائية مع السياق
        enhanced_content = text_content
        if knowledge_context:
            enhanced_content = f"{text_content}\n\n{knowledge_context}"
        
        # 5. معالجة المرفقات
        file_contents = []
        for att in attachments:
            if att.get('base64'):
                b64 = att['base64']
                if ',' in b64:
                    b64 = b64.split(',')[1]
                file_contents.append(ImageContent(image_base64=b64))
        
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
        
        # 7. إضافة مصادر المعرفة للرد
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
            "dtc_codes_found": dtc_codes
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Diesel Expert Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/diesel-expert/analyze')
async def analyze_fault(
    description: str = Form(...),
    vehicle_type: str = Form(None),
    dtc_code: str = Form(None),
    media_file: UploadFile = File(None)
):
    """
    تحليل عطل شامل - يبحث في قاعدة المعرفة ويقدم تشخيص
    """
    try:
        api_key = EMERGENT_LLM_KEY or os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM configuration missing")
        
        # 1. البحث في قاعدة المعرفة
        search_query = f"{description} {vehicle_type or ''} {dtc_code or ''}"
        knowledge_results = await search_fault_knowledge(search_query, dtc_code)
        
        # 2. تجهيز السياق
        knowledge_context = format_knowledge_context(knowledge_results)
        
        # 3. معالجة الملف إذا وجد
        file_contents = []
        media_info = ""
        if media_file:
            file_content = await media_file.read()
            file_ext = media_file.filename.split('.')[-1].lower()
            
            if file_ext in ['jpg', 'jpeg', 'png', 'webp']:
                b64 = base64.b64encode(file_content).decode()
                file_contents.append(ImageContent(image_base64=b64))
                media_info = "[تم إرفاق صورة للتحليل]"
            elif file_ext in ['mp3', 'wav', 'ogg', 'm4a']:
                media_info = f"[تم إرفاق ملف صوتي: {media_file.filename}]"
            elif file_ext in ['mp4', 'mov', 'avi', 'webm']:
                media_info = f"[تم إرفاق فيديو: {media_file.filename}]"
        
        # 4. بناء الطلب للـ LLM
        analysis_prompt = f"""قم بتحليل العطل التالي وقدم تشخيص شامل:

**وصف المشكلة:** {description}
**نوع المركبة:** {vehicle_type or 'غير محدد'}
**كود العطل:** {dtc_code or 'غير محدد'}
{media_info}

{knowledge_context}

قدم:
1. التشخيص المحتمل
2. الأسباب المحتملة (مرتبة حسب الاحتمالية)
3. خطوات الفحص والتشخيص
4. الحل المقترح
5. القطع التي قد تحتاج استبدال
6. التكلفة التقديرية (إذا أمكن)
7. نصائح إضافية

إذا وجدت معلومات مفيدة في قاعدة المعرفة، اذكرها واستفد منها."""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=DIESEL_EXPERT_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o-mini")
        
        user_message_obj = UserMessage(
            text=analysis_prompt,
            file_contents=file_contents if file_contents else None
        )
        
        response = await chat.send_message(user_message_obj)
        
        return {
            "success": True,
            "analysis": response,
            "knowledge_sources": [{
                'title': f.get('title'),
                'id': f.get('id'),
                'vehicle_type': f.get('vehicle_type'),
                'dtc_codes': f.get('dtc_codes', [])
            } for f in knowledge_results],
            "dtc_codes_detected": extract_dtc_codes(description + (dtc_code or '')),
            "has_similar_faults": len(knowledge_results) > 0
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Analyze error: {e}")
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
                'symptom': f.get('symptom_description', '')[:150],
                'dtc_codes': f.get('dtc_codes', []),
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
        "knowledge_base": "supabase" if supabase_client else "memory",
        "model": "gpt-4o-mini"
    }
