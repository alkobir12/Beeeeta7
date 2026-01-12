"""
نظام قاعدة المعرفة للأعطال - التطوير الذاتي
يسمح بحفظ الأعطال مع ملفات الصوت/الفيديو وكشفها في المستقبل
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Any, Optional
import os
import uuid
from datetime import datetime
import json
import base64

router = APIRouter(prefix="/api/faults")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase_client = None
use_supabase_faults = False

try:
    from supabase import create_client
    if SUPABASE_URL and SUPABASE_KEY:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Test if table exists
        try:
            supabase_client.table('fault_knowledge').select('id').limit(1).execute()
            use_supabase_faults = True
            print("✅ fault_knowledge table found in Supabase")
        except Exception as e:
            print(f"⚠️ fault_knowledge table not found, using in-memory: {e}")
            use_supabase_faults = False
except Exception as e:
    print(f"Supabase not configured for fault knowledge: {e}")


# In-memory fallback if Supabase not available
fault_knowledge_db = []


@router.get("/list")
async def list_faults(
    vehicle_type: Optional[str] = None,
    symptom: Optional[str] = None,
    limit: int = 50
):
    """قائمة الأعطال المحفوظة"""
    try:
        if use_supabase_faults:
            query = supabase_client.table('fault_knowledge').select('*').order('created_at', desc=True).limit(limit)
            if vehicle_type:
                query = query.ilike('vehicle_type', f'%{vehicle_type}%')
            if symptom:
                query = query.or_(f"symptom_description.ilike.%{symptom}%,dtc_codes.cs.{{{symptom}}}")
            result = query.execute()
            return {"success": True, "faults": result.data or []}
        else:
            # Fallback to in-memory
            faults = fault_knowledge_db
            if vehicle_type:
                faults = [f for f in faults if vehicle_type.lower() in f.get('vehicle_type', '').lower()]
            if symptom:
                faults = [f for f in faults if symptom.lower() in f.get('symptom_description', '').lower() or symptom in f.get('dtc_codes', [])]
            return {"success": True, "faults": faults[:limit]}
    except Exception as e:
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
            
            if use_supabase_faults:
                # Upload to Supabase Storage
                file_path = f"faults/{fault_id}/{media_file.filename}"
                try:
                    supabase_client.storage.from_('fault-media').upload(file_path, file_content)
                    media_url = supabase_client.storage.from_('fault-media').get_public_url(file_path)
                except Exception as e:
                    print(f"Storage upload error: {e}")
                    # Fallback: store as base64
                    media_url = f"data:{media_file.content_type};base64,{base64.b64encode(file_content).decode()}"
            else:
                # Store as base64 for in-memory storage
                media_url = f"data:{media_file.content_type};base64,{base64.b64encode(file_content).decode()}"
        
        # Parse DTC codes
        dtc_list = [code.strip() for code in (dtc_codes or "").split(',') if code.strip()]
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
        
        if use_supabase_faults:
            result = supabase_client.table('fault_knowledge').insert(fault_data).execute()
            return {"success": True, "fault": result.data[0] if result.data else fault_data}
        else:
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
    """
    البحث عن أعطال مشابهة
    يمكن البحث بالأعراض، كود العطل، نوع المركبة، أو ملف صوت/فيديو
    """
    try:
        results = []
        
        if use_supabase_faults:
            query = supabase_client.table('fault_knowledge').select('*')
            
            # Build search query
            conditions = []
            if symptom:
                conditions.append(f"symptom_description.ilike.%{symptom}%")
            if dtc_code:
                conditions.append(f"dtc_codes.cs.{{{dtc_code}}}")
            if vehicle_type:
                conditions.append(f"vehicle_type.ilike.%{vehicle_type}%")
            
            if conditions:
                query = query.or_(','.join(conditions))
            
            result = query.order('usage_count', desc=True).limit(10).execute()
            results = result.data or []
            
            # Update usage count for found faults
            for fault in results:
                supabase_client.table('fault_knowledge').update({
                    'usage_count': fault.get('usage_count', 0) + 1
                }).eq('id', fault['id']).execute()
        else:
            # In-memory search
            for fault in fault_knowledge_db:
                score = 0
                if symptom and symptom.lower() in fault.get('symptom_description', '').lower():
                    score += 2
                if dtc_code and dtc_code in fault.get('dtc_codes', []):
                    score += 3
                if vehicle_type and vehicle_type.lower() in fault.get('vehicle_type', '').lower():
                    score += 1
                if score > 0:
                    results.append({**fault, 'match_score': score})
            
            results.sort(key=lambda x: x.get('match_score', 0), reverse=True)
            results = results[:10]
        
        return {
            "success": True,
            "results": results,
            "count": len(results),
            "search_params": {
                "symptom": symptom,
                "dtc_code": dtc_code,
                "vehicle_type": vehicle_type,
                "has_media": media_file is not None
            }
        }
        
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{fault_id}")
async def get_fault(fault_id: str):
    """جلب تفاصيل عطل محدد"""
    try:
        if use_supabase_faults:
            result = supabase_client.table('fault_knowledge').select('*').eq('id', fault_id).execute()
            if result.data:
                return {"success": True, "fault": result.data[0]}
            raise HTTPException(status_code=404, detail="Fault not found")
        else:
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
    try:
        if use_supabase_faults:
            supabase_client.table('fault_knowledge').delete().eq('id', fault_id).execute()
        else:
            global fault_knowledge_db
            fault_knowledge_db = [f for f in fault_knowledge_db if f['id'] != fault_id]
        return {"success": True, "message": "Fault deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def get_stats():
    """إحصائيات قاعدة المعرفة"""
    try:
        if use_supabase_faults:
            result = supabase_client.table('fault_knowledge').select('*').execute()
            faults = result.data or []
        else:
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
