"""
نظام قاعدة المعرفة للأعطال - التطوير الذاتي
يسمح بحفظ الأعطال مع ملفات الصوت/الفيديو وكشفها في المستقبل
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any, Optional
import os
import uuid
from datetime import datetime
import base64

router = APIRouter(prefix="/api/faults")

# In-memory storage for fault knowledge
fault_knowledge_db: List[Dict] = []


@router.get("/list")
async def list_faults(
    vehicle_type: Optional[str] = None,
    symptom: Optional[str] = None,
    limit: int = 50
):
    """قائمة الأعطال المحفوظة"""
    try:
        faults = fault_knowledge_db.copy()
        
        if vehicle_type:
            faults = [f for f in faults if vehicle_type.lower() in f.get('vehicle_type', '').lower()]
        if symptom:
            faults = [f for f in faults if 
                symptom.lower() in f.get('symptom_description', '').lower() or 
                symptom.upper() in f.get('dtc_codes', [])]
        
        # Sort by created_at descending
        faults.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {"success": True, "faults": faults[:limit]}
    except Exception as e:
        print(f"List faults error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add")
async def add_fault(
    title: str = Form(...),
    vehicle_type: str = Form(...),
    vehicle_model: str = Form(None),
    symptom_description: str = Form(...),
    dtc_codes: str = Form(None),
    diagnosis_steps: str = Form(...),
    solution: str = Form(...),
    parts_needed: str = Form(None),
    estimated_cost: float = Form(None),
    difficulty_level: str = Form("medium"),
    media_file: UploadFile = File(None)
):
    """إضافة عطل جديد لقاعدة المعرفة"""
    try:
        fault_id = str(uuid.uuid4())
        media_url = None
        media_type = None
        
        # Handle file upload
        if media_file:
            file_content = await media_file.read()
            file_ext = media_file.filename.split('.')[-1].lower()
            media_type = "audio" if file_ext in ['mp3', 'wav', 'ogg', 'm4a'] else "video" if file_ext in ['mp4', 'mov', 'avi', 'webm'] else "image"
            # Store as base64
            media_url = f"data:{media_file.content_type};base64,{base64.b64encode(file_content).decode()}"
        
        # Parse DTC codes
        dtc_list = [code.strip().upper() for code in (dtc_codes or "").split(',') if code.strip()]
        parts_list = [part.strip() for part in (parts_needed or "").split(',') if part.strip()]
        
        fault_data = {
            'id': fault_id,
            'title': title,
            'vehicle_type': vehicle_type,
            'vehicle_model': vehicle_model,
            'symptom_description': symptom_description,
            'dtc_codes': dtc_list,
            'diagnosis_steps': diagnosis_steps,
            'solution': solution,
            'parts_needed': parts_list,
            'estimated_cost': estimated_cost,
            'difficulty_level': difficulty_level,
            'media_url': media_url,
            'media_type': media_type,
            'created_at': datetime.utcnow().isoformat(),
            'usage_count': 0
        }
        
        fault_knowledge_db.append(fault_data)
        return {"success": True, "fault": fault_data}
            
    except Exception as e:
        print(f"Add fault error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_similar_faults(
    symptom: str = Form(None),
    dtc_code: str = Form(None),
    vehicle_type: str = Form(None),
    media_file: UploadFile = File(None)
):
    """البحث عن أعطال مشابهة"""
    try:
        results = []
        
        for fault in fault_knowledge_db:
            score = 0
            if symptom and symptom.lower() in fault.get('symptom_description', '').lower():
                score += 2
            if symptom and symptom.lower() in fault.get('title', '').lower():
                score += 2
            if dtc_code and dtc_code.upper() in fault.get('dtc_codes', []):
                score += 3
            if vehicle_type and vehicle_type.lower() in fault.get('vehicle_type', '').lower():
                score += 1
            if score > 0:
                results.append({**fault, 'match_score': score})
        
        results.sort(key=lambda x: x.get('match_score', 0), reverse=True)
        
        # Update usage count
        for result in results[:5]:
            for fault in fault_knowledge_db:
                if fault['id'] == result['id']:
                    fault['usage_count'] = fault.get('usage_count', 0) + 1
        
        return {
            "success": True,
            "results": results[:10],
            "count": len(results),
            "search_params": {
                "symptom": symptom,
                "dtc_code": dtc_code,
                "vehicle_type": vehicle_type
            }
        }
        
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{fault_id}")
async def get_fault(fault_id: str):
    """جلب تفاصيل عطل محدد"""
    try:
        for fault in fault_knowledge_db:
            if fault['id'] == fault_id:
                return {"success": True, "fault": fault}
        raise HTTPException(status_code=404, detail="Fault not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{fault_id}")
async def delete_fault(fault_id: str):
    """حذف عطل"""
    global fault_knowledge_db
    try:
        fault_knowledge_db = [f for f in fault_knowledge_db if f['id'] != fault_id]
        return {"success": True, "message": "Fault deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def get_stats():
    """إحصائيات قاعدة المعرفة"""
    try:
        faults = fault_knowledge_db
        
        # Calculate stats
        vehicle_types = {}
        dtc_codes = {}
        
        for fault in faults:
            vt = fault.get('vehicle_type', 'Unknown')
            vehicle_types[vt] = vehicle_types.get(vt, 0) + 1
            
            for code in fault.get('dtc_codes', []):
                dtc_codes[code] = dtc_codes.get(code, 0) + 1
        
        return {
            "success": True,
            "stats": {
                "total_faults": len(faults),
                "by_vehicle_type": vehicle_types,
                "top_dtc_codes": dict(sorted(dtc_codes.items(), key=lambda x: x[1], reverse=True)[:10]),
                "with_media": len([f for f in faults if f.get('media_url')])
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Export the database for use by diesel expert
def get_fault_knowledge_db():
    return fault_knowledge_db
