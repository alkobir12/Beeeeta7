"""
Supabase API Routes
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from supabase_service import SupabaseService

router = APIRouter(prefix='/supabase', tags=['supabase'])

supabase_service = SupabaseService()

@router.get('/vehicles')
async def get_vehicles():
    """Get all vehicles from Supabase"""
    try:
        vehicles = supabase_service.get_vehicles()
        return {
            "vehicles": vehicles,
            "count": len(vehicles),
            "mode": "mock" if supabase_service.mock_mode else "live"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/analytics')
async def get_analytics():
    """Get workshop analytics from Supabase"""
    try:
        analytics = supabase_service.get_analytics()
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/status')
async def get_status():
    """Get Supabase connection status"""
    return {
        "connected": not supabase_service.mock_mode,
        "mode": "mock" if supabase_service.mock_mode else "live",
        "url_configured": bool(supabase_service.supabase_url),
        "key_configured": bool(supabase_service.supabase_key)
    }
