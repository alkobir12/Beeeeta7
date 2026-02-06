
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

router = APIRouter(prefix="/api/alkabeer-bot", tags=["alkabeer-bot"])

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")
BASE_PROMPT_FILE = os.path.join(PROMPTS_DIR, "alkabeer_base.md")
EXT_PROMPT_FILE = os.path.join(PROMPTS_DIR, "alkabeer_extensions.md")

# In-memory session tracking for Developer Mode
# Format: { session_id: { "mode": "user" | "dev", "pending_data": [] } }
session_states = {}

def get_combined_system_prompt():
    base = ""
    ext = ""
    try:
        if os.path.exists(BASE_PROMPT_FILE):
            with open(BASE_PROMPT_FILE, "r", encoding="utf-8") as f:
                base = f.read()
        if os.path.exists(EXT_PROMPT_FILE):
            with open(EXT_PROMPT_FILE, "r", encoding="utf-8") as f:
                ext = f.read()
    except Exception as e:
        print(f"Error reading prompt files: {e}")
    
    combined = base + "\n\n" + "# 9. تحديثات ومعلومات إضافية (تمت إضافتها بواسطة المطور)\n" + ext
    return combined

def append_to_knowledge(text):
    try:
        with open(EXT_PROMPT_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n- {text}")
        return True
    except Exception as e:
        print(f"Error writing to extensions: {e}")
        return False

class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None

class ChatResponse(BaseModel):
    response: str
    sessionId: str
    model: str
    mode: str = "user"

@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

        session_id = payload.sessionId or str(uuid.uuid4())
        
        # Init session state if not exists
        if session_id not in session_states:
            session_states[session_id] = {"mode": "user"}
        
        state = session_states[session_id]
        user_msg = payload.message.strip()

        # --- Developer Mode Logic ---
        # 1. Trigger Entry
        if user_msg == "rrr":
            state["mode"] = "dev"
            return ChatResponse(
                response="🔓 **تم تفعيل وضع المطور (Developer Mode)**\n\nأهلاً بك يا ريّس. أنا الآن مستعد لتلقي معلومات جديدة لتحديث ذاكرتي.\n\n📝 **التعليمات:**\n- أرسل أي معلومة تريد إضافتها مباشرة.\n- اكتب `EXIT` للخروج من وضع المطور.\n- اكتب `CLEAR` لمسح التحديثات الأخيرة (اختياري).",
                sessionId=session_id,
                model="system",
                mode="dev"
            )
        
        # 2. Handle Dev Mode Interactions
        if state["mode"] == "dev":
            if user_msg.upper() == "EXIT":
                state["mode"] = "user"
                return ChatResponse(
                    response="🔒 **تم الخروج من وضع المطور.**\nعودة إلى وضع خدمة العملاء (أبو فهد).",
                    sessionId=session_id,
                    model="system",
                    mode="user"
                )
            
            # Append received info to knowledge base
            if append_to_knowledge(user_msg):
                return ChatResponse(
                    response=f"✅ **تم الحفظ!**\nتمت إضافة المعلومة إلى قاعدة المعرفة.\n\nهل لديك المزيد؟ (اكتب `EXIT` للخروج)",
                    sessionId=session_id,
                    model="system",
                    mode="dev"
                )
            else:
                return ChatResponse(
                    response="❌ حدث خطأ أثناء حفظ المعلومات. يرجى المحاولة مرة أخرى.",
                    sessionId=session_id,
                    model="system",
                    mode="dev"
                )

        # --- Standard Chat Logic (Abu Fahad) ---
        
        # Load the latest combined prompt
        system_prompt = get_combined_system_prompt()

        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o")

        file_contents = []
        if payload.attachments:
            for att in payload.attachments:
                if att.get("base64"):
                    b64 = att["base64"]
                    if "," in b64:
                        b64 = b64.split(",")[1]
                    file_contents.append(ImageContent(image_base64=b64))

        llm_msg = UserMessage(
            text=user_msg,
            file_contents=file_contents if file_contents else None
        )

        response = await chat.send_message(llm_msg)

        return ChatResponse(
            response=response,
            sessionId=session_id,
            model="gpt-4o",
            mode="user"
        )

    except Exception as e:
        print(f"AlKabeer Bot Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
def health():
    return {"status": "ok", "bot": "AlKabeer Abu Fahad (Dev Mode Enabled)"}
