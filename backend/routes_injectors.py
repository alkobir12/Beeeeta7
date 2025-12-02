
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
import uuid
from datetime import datetime
from denso_system_v7 import DensoSystemV7

router = APIRouter(prefix="/api/injectors", tags=["Injectors"])

# Initialize the diagnostic system - Version 7.0 Final
denso_system = DensoSystemV7()

# Database reference (set via set_db)
db = None

def set_db(database):
    global db
    db = database

@router.get("/engines")
async def get_supported_engines():
    """Get list of supported engines and their specs."""
    engines = denso_system.get_engines_list()
    return {
        "engines": engines,
        "system_version": denso_system.system_info['version'],
        "last_updated": denso_system.system_info['last_updated']
    }

@router.get("/specs/{engine_id}")
async def get_engine_specs(engine_id: str):
    """Get detailed specs for a specific engine."""
    specs = denso_system.get_engine_details(engine_id)
    if not specs:
        raise HTTPException(status_code=404, detail="المحرك غير موجود / Engine not found")
    return specs

@router.get("/generation/{generation}")
async def get_generation_info(generation: str):
    """Get information about a specific Denso generation (G2, G3, G4, etc.)."""
    info = denso_system.get_generation_info(generation)
    if not info:
        raise HTTPException(status_code=404, detail="الجيل غير موجود / Generation not found")
    return info

@router.post("/validate/resistance")
async def validate_resistance(payload: Dict[str, Any] = Body(...)):
    """Validate electrical resistance reading."""
    engine_id = payload.get('engine_id')
    resistance = float(payload.get('resistance_ohm', 0))
    
    if not engine_id:
        raise HTTPException(status_code=400, detail="engine_id is required")
    
    result = denso_system.validate_resistance(engine_id, resistance)
    return result

@router.post("/validate/vl-mode")
async def validate_vl_mode(payload: Dict[str, Any] = Body(...)):
    """Validate VL mode (Full Load) readings per BOSCH EPS815 standard."""
    engine_id = payload.get('engine_id')
    pressure = float(payload.get('pressure_bar', 0))
    duration = float(payload.get('duration_us', 0))
    return_qty = float(payload.get('return_qty_ml_min', 0))
    
    if not engine_id:
        raise HTTPException(status_code=400, detail="engine_id is required")
    
    result = denso_system.validate_vl_mode(engine_id, pressure, duration, return_qty)
    return result

@router.post("/report")
async def save_report(payload: Dict[str, Any] = Body(...)):
    """Generate and save a diagnostic report."""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
        
    # Generate text report
    report_text = denso_system.generate_diagnostic_report(payload)
    
    doc = {
        "id": str(uuid.uuid4()),
        "type": "injector_report",
        "engineType": payload.get('engine_type'),
        "testData": payload,
        "reportText": report_text,
        "createdAt": datetime.utcnow(),
        "technician": payload.get('technician', 'Unknown')
    }
    
    await db.injector_reports.insert_one(doc)
    doc.pop('_id', None)
    doc['createdAt'] = doc['createdAt'].isoformat()
    
    return doc

@router.get("/reports")
async def list_reports():
    """List recent diagnostic reports."""
    if not db:
        return []
    
    docs = await db.injector_reports.find({"type": "injector_report"}).sort("createdAt", -1).to_list(length=100)
    for d in docs:
        d.pop('_id', None)
        if d.get('createdAt'):
            d['createdAt'] = d['createdAt'].isoformat()
    return docs
