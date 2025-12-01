
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
import uuid
from datetime import datetime
from denso_system import DensoInjectorDiagnostics

router = APIRouter(prefix="/api/injectors", tags=["Injectors"])

# Initialize the diagnostic system
denso_system = DensoInjectorDiagnostics()

# Database reference (set via set_db)
db = None

def set_db(database):
    global db
    db = database

@router.get("/engines")
async def get_supported_engines():
    """Get list of supported engines and their specs."""
    return denso_system.engine_database

@router.get("/specs/{engine_type}")
async def get_engine_specs(engine_type: str):
    """Get detailed specs for a specific engine."""
    specs = denso_system.get_injector_specifications(engine_type)
    if not specs:
        raise HTTPException(status_code=404, detail="Engine not found")
    return specs

@router.post("/validate")
async def validate_test(payload: Dict[str, Any] = Body(...)):
    """Validate VL mode readings."""
    engine = payload.get('engine_type')
    pressure = float(payload.get('pressure', 0))
    duration = float(payload.get('duration', 0))
    return_qty = float(payload.get('return_quantity', 0))
    
    result = denso_system.validate_vl_mode_reading(engine, pressure, duration, return_qty)
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
