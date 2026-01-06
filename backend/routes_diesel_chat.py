from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
import httpx
import os
import asyncio

router = APIRouter(prefix="/api")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_BASE_URL = os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

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
"""


@router.post('/diesel-chat')
async def diesel_chat(payload: Dict[str, Any] = Body(...)):
    """
    Chat endpoint for diesel vehicle maintenance expert
    Expects: { "messages": [{"role": "user", "content": "..."}] }
    Returns: { "response": "...", "model": "..." }
    """
    try:
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
        user_messages = payload.get('messages', [])
        if not user_messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        # Build messages with system prompt
        messages = [
            {"role": "system", "content": DIESEL_EXPERT_SYSTEM_PROMPT}
        ]
        
        # Add user messages (keep conversation history)
        for msg in user_messages:
            if msg.get('role') and msg.get('content'):
                messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
        
        # Call Groq API
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{GROQ_API_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 2000,
                    "top_p": 1,
                    "stream": False
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=f"Groq API error: {error_detail}")
            
            data = response.json()
            assistant_message = data['choices'][0]['message']['content']
            
            return {
                "response": assistant_message,
                "model": GROQ_MODEL,
                "success": True
            }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/diesel-chat/health')
async def diesel_chat_health():
    """Health check for diesel chat service"""
    return {
        "status": "ok",
        "groq_api_configured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL
    }
