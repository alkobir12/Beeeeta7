# -*- coding: utf-8 -*-
"""
Gemini AI Chat Bot - FastAPI Routes
بوت ذكي متطور يعمل بتقنية Google Gemini 2.0 Flash
"""

from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
import os
from datetime import datetime
import uuid
import google.generativeai as genai

router = APIRouter(prefix="/api/gemini-chat", tags=["Gemini Chat"])

# إعداد Gemini
GEMINI_API_KEY = os.getenv('GOOGLE_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("⚠️ GOOGLE_API_KEY غير موجود في ملف .env")

# تخزين المحادثات (في الذاكرة)
conversations = {}

# إعدادات البوت
BOT_CONFIG = {
    'name': 'مساعد ذكي',
    'model': 'gemini-2.0-flash-exp',
    'welcome_message': 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟ 🤖',
    'system_prompt': '''أنت مساعد ذكي محترف ومفيد في نظام إدارة الورش.
    - أجب بالعربية إذا سأل المستخدم بالعربية
    - أجب بالإنجليزية إذا سأل بالإنجليزية
    - كن مهذباً ومحترماً ومساعداً
    - قدم إجابات دقيقة ومفيدة
    - إذا سألوك عن الورشة، قل أنك مساعد في نظام إدارة الورش
    - يمكنك مساعدتهم في:
      * الاستفسارات العامة عن صيانة السيارات
      * شرح مصطلحات الصيانة
      * نصائح عامة للعناية بالسيارة
      * أي استفسارات أخرى
    - إذا لم تعرف الإجابة، قل ذلك بصراحة'''
}

# Database reference (optional)
db = None

def set_db(database):
    global db
    db = database


@router.get("/health")
async def health_check():
    """فحص حالة الخادم"""
    return {
        'status': 'healthy',
        'bot_name': BOT_CONFIG['name'],
        'model': BOT_CONFIG['model'],
        'conversations': len(conversations),
        'timestamp': datetime.utcnow().isoformat(),
        'api_key_configured': bool(GEMINI_API_KEY)
    }


@router.post("/start")
async def start_conversation():
    """بدء محادثة جديدة"""
    conversation_id = str(uuid.uuid4())
    conversations[conversation_id] = {
        'history': [],
        'created_at': datetime.utcnow().isoformat(),
        'last_activity': datetime.utcnow().isoformat()
    }
    
    return {
        'conversation_id': conversation_id,
        'welcome_message': BOT_CONFIG['welcome_message'],
        'bot_name': BOT_CONFIG['name'],
        'model': BOT_CONFIG['model']
    }


@router.post("/chat")
async def chat(payload: Dict[str, Any] = Body(...)):
    """
    المحادثة مع البوت
    
    Request Body:
    {
        "message": "رسالة المستخدم",
        "conversation_id": "معرّف المحادثة (اختياري)"
    }
    """
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=500, 
                detail="Gemini API Key غير مهيأ. يرجى إضافة GOOGLE_API_KEY في ملف .env"
            )
        
        # الحصول على البيانات
        user_message = payload.get('message', '').strip()
        conversation_id = payload.get('conversation_id')
        
        # التحقق من الرسالة
        if not user_message:
            raise HTTPException(status_code=400, detail="الرسالة فارغة")
        
        # إنشاء أو استرجاع المحادثة
        if conversation_id and conversation_id in conversations:
            chat_data = conversations[conversation_id]
            chat_history = chat_data['history']
        else:
            # محادثة جديدة
            conversation_id = str(uuid.uuid4())
            chat_history = []
            conversations[conversation_id] = {
                'history': chat_history,
                'created_at': datetime.utcnow().isoformat(),
                'last_activity': datetime.utcnow().isoformat()
            }
        
        # إضافة رسالة المستخدم للتاريخ
        chat_history.append({
            'role': 'user',
            'parts': [user_message],
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # بناء المحادثة مع System Prompt
        full_history = [
            {'role': 'user', 'parts': [BOT_CONFIG['system_prompt']]},
            {'role': 'model', 'parts': ['فهمت، سأكون مساعداً مفيداً ومحترماً.']}
        ]
        
        # إضافة التاريخ (بدون timestamps للـ API)
        for msg in chat_history[:-1]:  # exclude last message (user's current message)
            full_history.append({
                'role': msg['role'],
                'parts': msg['parts']
            })
        
        # إنشاء النموذج والمحادثة
        model = genai.GenerativeModel(BOT_CONFIG['model'])
        chat = model.start_chat(history=full_history)
        
        # إرسال الرسالة والحصول على الرد
        response = chat.send_message(user_message)
        bot_response = response.text
        
        # إضافة رد البوت للتاريخ
        chat_history.append({
            'role': 'model',
            'parts': [bot_response],
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # تحديث آخر نشاط
        conversations[conversation_id]['last_activity'] = datetime.utcnow().isoformat()
        
        # الاحتفاظ بآخر 50 رسالة فقط (لتوفير الذاكرة)
        if len(chat_history) > 100:
            chat_history = chat_history[-100:]
            conversations[conversation_id]['history'] = chat_history
        
        # إرجاع الرد
        return {
            'response': bot_response,
            'conversation_id': conversation_id,
            'timestamp': datetime.utcnow().isoformat(),
            'model': BOT_CONFIG['model']
        }
        
    except Exception as e:
        print(f"❌ خطأ في Gemini Chat: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"حدث خطأ في المحادثة: {str(e)}"
        )


@router.get("/history/{conversation_id}")
async def get_history(conversation_id: str):
    """الحصول على تاريخ محادثة"""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="المحادثة غير موجودة")
    
    return {
        'conversation_id': conversation_id,
        'history': conversations[conversation_id]['history'],
        'created_at': conversations[conversation_id]['created_at'],
        'last_activity': conversations[conversation_id]['last_activity']
    }


@router.delete("/clear/{conversation_id}")
async def clear_conversation(conversation_id: str):
    """مسح محادثة معينة"""
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {'message': 'تم مسح المحادثة', 'conversation_id': conversation_id}
    raise HTTPException(status_code=404, detail="المحادثة غير موجودة")


@router.delete("/clear-all")
async def clear_all_conversations():
    """مسح جميع المحادثات"""
    count = len(conversations)
    conversations.clear()
    return {'message': f'تم مسح {count} محادثة', 'cleared': count}


@router.get("/stats")
async def get_stats():
    """إحصائيات المحادثات"""
    total_conversations = len(conversations)
    total_messages = sum(len(conv['history']) for conv in conversations.values())
    
    return {
        'total_conversations': total_conversations,
        'total_messages': total_messages,
        'active_conversations': total_conversations,
        'bot_config': {
            'name': BOT_CONFIG['name'],
            'model': BOT_CONFIG['model']
        }
    }
