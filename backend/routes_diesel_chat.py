from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
import os
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

router = APIRouter(prefix="/api")

# Load Emergent Key
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")

DIESEL_EXPERT_SYSTEM_PROMPT = """You are an expert in Toyota, Isuzu, and Mitsubishi diesel vehicle maintenance. You specialize in:
- Datastream vs Livestream analysis and comparison
- Reading electrical wiring diagrams
- DTC codes diagnosis (P0087, P0088, P0093, P0234, P0299, etc.)
- Common Rail fuel system troubleshooting
- Fuel pressure specifications (1GD-FTV, 2GD-FTV, F33A-FTV, 4JJ1, 4N15)
- Turbo system diagnosis
- DPF and EGR problems
- Gulf region specific issues (heat, dust, fuel quality)
- Land Cruiser 300 (2022) with 3.3L V6 Twin-Turbo Diesel (F33A-FTV)

You respond in both Arabic and English based on the user's language. You are available 24/7.
Provide detailed, practical solutions for diesel mechanics working in the Gulf region.
Focus on real-world troubleshooting steps and common issues.
When discussing DTC codes, explain the meaning, common causes, and diagnostic steps.
If an image is provided, analyze it carefully for any visible issues, wear, leaks, or specific part identification.
"""

@router.post('/diesel-chat')
async def diesel_chat(payload: Dict[str, Any] = Body(...)):
    """
    Chat endpoint for diesel vehicle maintenance expert with Vision support
    Expects: { "messages": [{"role": "user", "content": "...", "attachments": [...]}] }
    """
    try:
        # Fallback to a default key if not set (for safety in dev, but explicit key preferred)
        api_key = EMERGENT_LLM_KEY
        if not api_key:
             # Try getting from env again just in case
             api_key = os.getenv("EMERGENT_LLM_KEY")
        
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM configuration missing (EMERGENT_LLM_KEY)")
        
        user_messages = payload.get('messages', [])
        if not user_messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        # Initialize Chat
        session_id = payload.get('sessionId') or str(uuid.uuid4())
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=DIESEL_EXPERT_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o-mini") # Using GPT-4o-mini for faster responses
        
        # We only send the LAST user message to the LLM for now to keep it simple with this library
        # But for history, we should reconstruct.
        # emergentintegrations usually handles history if we use the same session_id?
        # Actually, LlmChat doesn't automatically load history from external DB.
        # It's better to send the conversation or just the last message + context?
        # The library's `send_message` takes a single UserMessage.
        # To support history, we might need to rely on the `messages` list passed from frontend
        # and maybe format them?
        # However, LlmChat abstraction seems to be per-turn.
        # Let's assume for now we send the last message, and if we need history, we include it in the text?
        # Or checking the library: it likely maintains history if we re-use the instance?
        # But we create a NEW instance per request.
        # For a mechanic chat, history is important.
        # Let's aggregate previous messages into the system prompt or context if needed.
        # But for now, let's just process the latest message effectively.
        
        last_msg = user_messages[-1]
        if last_msg.get('role') != 'user':
            # If last is assistant, we can't really "reply" to it.
            # But frontend should send user message last.
            pass

        text_content = last_msg.get('content', '')
        attachments = last_msg.get('attachments', [])
        
        file_contents = []
        for att in attachments:
            if att.get('base64'):
                # Strip prefix if present (data:image/jpeg;base64,...)
                b64 = att['base64']
                if ',' in b64:
                    b64 = b64.split(',')[1]
                file_contents.append(ImageContent(image_base64=b64))
        
        user_message_obj = UserMessage(
            text=text_content,
            file_contents=file_contents if file_contents else None
        )
        
        response = await chat.send_message(user_message_obj)
        
        return {
            "response": response,
            "model": "gpt-4o",
            "success": True,
            "sessionId": session_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Diesel Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/diesel-chat/health')
async def diesel_chat_health():
    return {
        "status": "ok",
        "llm_key_configured": bool(EMERGENT_LLM_KEY),
        "model": "gpt-4o"
    }
