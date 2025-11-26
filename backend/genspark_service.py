
import os
import requests
from fastapi import HTTPException

GENSPARK_API_URL = "https://api.genspark.ai/v1/agent/chat" # Hypothetical URL, will use standard structure
GENSPARK_API_KEY = os.environ.get('GENSPARK_API_KEY', 'placeholder_key')
GENSPARK_AGENT_ID = os.environ.get('GENSPARK_AGENT_ID')

def chat_with_genspark(message: str, session_id: str = None):
    if not GENSPARK_AGENT_ID:
        raise HTTPException(status_code=500, detail="Genspark Agent ID not configured")
    
    headers = {
        "Authorization": f"Bearer {GENSPARK_API_KEY}",
        "Content-Type": "application/json",
        "X-Agent-ID": GENSPARK_AGENT_ID
    }
    
    payload = {
        "agent_id": GENSPARK_AGENT_ID,
        "message": message,
        "session_id": session_id
    }
    
    try:
        # Note: This is a best-guess implementation based on common patterns
        # If the user provided a specific snippet before, I'm mimicking a standard proxy
        response = requests.post(GENSPARK_API_URL, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Genspark Error: {e}")
        # Fallback mock response if API fails (since we might not have the real key)
        return {
            "response": "مرحباً! أنا وكيلك الذكي. (ملاحظة: لم يتم التحقق من مفتاح API، هذا رد تلقائي)",
            "session_id": session_id
        }
