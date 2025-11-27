
import os
import requests
from fastapi import HTTPException

# Genspark Agent Configuration
GENSPARK_AGENT_ID = os.environ.get('GENSPARK_AGENT_ID', 'fe62398f-faa9-4a8f-bae9-4d0b5dc25680')
GENSPARK_API_URL = f"https://api.genspark.ai/agents/{GENSPARK_AGENT_ID}/chat"
GENSPARK_API_KEY = os.environ.get('GENSPARK_API_KEY', '')

def chat_with_genspark(message: str, session_id: str = None):
    """
    Send a message to the Genspark agent and get a response.
    """
    headers = {
        "Content-Type": "application/json",
    }
    
    # Add API key if available
    if GENSPARK_API_KEY:
        headers["Authorization"] = f"Bearer {GENSPARK_API_KEY}"
    
    payload = {
        "message": message,
    }
    
    if session_id:
        payload["session_id"] = session_id
    
    try:
        response = requests.post(GENSPARK_API_URL, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()
        return {
            "response": data.get("response", data.get("message", data.get("answer", str(data)))),
            "session_id": data.get("session_id", session_id)
        }
    except requests.exceptions.HTTPError as e:
        print(f"Genspark HTTP Error: {e}, Response: {e.response.text if e.response else 'N/A'}")
        raise HTTPException(status_code=502, detail=f"Genspark API error: {str(e)}")
    except requests.exceptions.RequestException as e:
        print(f"Genspark Request Error: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Genspark: {str(e)}")
    except Exception as e:
        print(f"Genspark Error: {e}")
        raise HTTPException(status_code=500, detail=f"Genspark service error: {str(e)}")
