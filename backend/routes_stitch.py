from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import os
import httpx

from supabase import create_client

router = APIRouter(prefix="/api/stitch", tags=["stitch"])

STITCH_API_URL = os.environ.get("STITCH_API_URL")
STITCH_API_KEY = os.environ.get("GOOGLE_STITCH_API_KEY")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Supabase client init failed for Stitch: {e}")


class StitchGenerateRequest(BaseModel):
    prompt: str
    design_style: str = "modern"
    color_scheme: Optional[str] = None


def _ensure_stitch_config():
    if not STITCH_API_URL or not STITCH_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Stitch API configuration missing. Set STITCH_API_URL and GOOGLE_STITCH_API_KEY.",
        )


async def _create_generation_record(generation_id: str, request: StitchGenerateRequest):
    if not supabase_client:
        return None
    try:
        response = (
            supabase_client.table("ui_generations")
            .insert(
                {
                    "id": generation_id,
                    "prompt": request.prompt,
                    "design_style": request.design_style,
                    "color_scheme": request.color_scheme,
                    "status": "pending",
                    "created_at": datetime.utcnow().isoformat(),
                }
            )
            .execute()
        )
        return (response.data or [None])[0]
    except Exception as e:
        print(f"Stitch generation record insert failed: {e}")
        return None


async def _update_generation_record(generation_id: str, update_data: dict):
    if not supabase_client:
        return None
    try:
        response = (
            supabase_client.table("ui_generations")
            .update(update_data)
            .eq("id", generation_id)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"Stitch generation record update failed: {e}")
        return None


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_ui(request: StitchGenerateRequest):
    _ensure_stitch_config()

    if len(request.prompt.strip()) < 10:
        raise HTTPException(status_code=400, detail="Prompt must be at least 10 characters long")

    generation_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    await _create_generation_record(generation_id, request)

    headers = {
        "Authorization": f"Bearer {STITCH_API_KEY}",
        "Content-Type": "application/json",
        "X-Request-ID": generation_id,
    }

    payload = {
        "prompt": request.prompt,
        "style": request.design_style,
        "color_scheme": request.color_scheme or "default",
        "format": "react-typescript",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{STITCH_API_URL}/generate",
                json=payload,
                headers=headers,
                timeout=30.0,
            )
        except httpx.TimeoutException:
            await _update_generation_record(
                generation_id, {"status": "failed", "error_message": "timeout"}
            )
            raise HTTPException(status_code=504, detail="Stitch API request timed out")

    if response.status_code == 429:
        await _update_generation_record(
            generation_id, {"status": "failed", "error_message": "rate_limit"}
        )
        raise HTTPException(status_code=429, detail="Stitch API rate limit exceeded")

    if response.status_code >= 400:
        await _update_generation_record(
            generation_id,
            {"status": "failed", "error_message": response.text[:500]},
        )
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Stitch API error: {response.text}",
        )

    stitch_response = response.json() if response.content else {}
    await _update_generation_record(
        generation_id,
        {
            "status": "completed",
            "generated_code": stitch_response.get("code"),
            "figma_url": stitch_response.get("figma_url"),
            "completed_at": datetime.utcnow().isoformat(),
        },
    )

    return {
        "id": generation_id,
        "status": "completed",
        "prompt": request.prompt,
        "design_style": request.design_style,
        "generated_code": stitch_response.get("code"),
        "figma_url": stitch_response.get("figma_url"),
        "created_at": created_at,
        "completed_at": datetime.utcnow().isoformat(),
    }


@router.get("/history")
async def get_generation_history(limit: int = 20):
    if not supabase_client:
        return []
    try:
        response = (
            supabase_client.table("ui_generations")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Stitch history fetch failed: {e}")
        return []


@router.get("/status/{generation_id}")
async def get_generation_status(generation_id: str):
    if not supabase_client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        response = (
            supabase_client.table("ui_generations")
            .select("id, status, created_at, completed_at, error_message, generated_code, figma_url, prompt, design_style")
            .eq("id", generation_id)
            .single()
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Generation request not found")
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Stitch status fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve generation status")
