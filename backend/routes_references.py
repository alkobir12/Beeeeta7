from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, List
import pandas as pd
from io import BytesIO
from datetime import datetime
import uuid

router = APIRouter(prefix="/api")
db = None

def set_db(database):
    global db
    db = database

@router.post("/references/import-excel")
async def import_references_excel(file: UploadFile = File(...)):
    """استيراد مراجع من Excel"""
    try:
        # Read Excel file
        contents = await file.read()
        excel_data = pd.read_excel(BytesIO(contents), sheet_name=None)
        
        imported_counts = {}
        
        # Import DTC Codes
        if 'DTC Codes' in excel_data:
            dtc_df = excel_data['DTC Codes']
            dtc_count = 0
            
            for _, row in dtc_df.iterrows():
                dtc_doc = {
                    'id': str(uuid.uuid4()),
                    'type': 'dtc',
                    'code': str(row.get('الكود', '')).strip().upper(),
                    'nameAr': str(row.get('الاسم بالعربية', '')),
                    'nameEn': str(row.get('الاسم English', '')),
                    'vehicle': str(row.get('السيارة', '')),
                    'causes': str(row.get('الأسباب', '')).split('\n') if pd.notna(row.get('الأسباب')) else [],
                    'fixes': str(row.get('طرق الإصلاح', '')).split('\n') if pd.notna(row.get('طرق الإصلاح')) else [],
                    'notes': str(row.get('الملاحظات', '')),
                    'pageNumber': str(row.get('الصفحة', '')),
                    'relatedCodes': str(row.get('أكواد مشابهة', '')).split(',') if pd.notna(row.get('أكواد مشابهة')) else [],
                    'source': file.filename,
                    'createdAt': datetime.utcnow()
                }
                
                # Check if already exists
                existing = await db.dtc_references.find_one({'code': dtc_doc['code'], 'vehicle': dtc_doc['vehicle']})
                if existing:
                    await db.dtc_references.update_one({'_id': existing['_id']}, {'$set': dtc_doc})
                else:
                    await db.dtc_references.insert_one(dtc_doc)
                dtc_count += 1
            
            imported_counts['dtc'] = dtc_count
        
        # Import Electrical Components
        if 'Electrical Components' in excel_data:
            elec_df = excel_data['Electrical Components']
            elec_count = 0
            
            for _, row in elec_df.iterrows():
                elec_doc = {
                    'id': str(uuid.uuid4()),
                    'type': 'electrical',
                    'componentAr': str(row.get('المكون', '')),
                    'componentEn': str(row.get('Component', '')),
                    'voltageNormal': float(row.get('الجهد الطبيعي', 0)),
                    'voltageMin': float(row.get('الجهد الأدنى', 0)),
                    'voltageMax': float(row.get('الجهد الأعلى', 0)),
                    'unit': str(row.get('الوحدة', 'V')),
                    'measurementMethod': str(row.get('طريقة القياس', '')),
                    'notes': str(row.get('الملاحظات', '')),
                    'source': file.filename,
                    'createdAt': datetime.utcnow()
                }
                
                await db.electrical_references.insert_one(elec_doc)
                elec_count += 1
            
            imported_counts['electrical'] = elec_count
        
        # Import Vehicle Specs
        if 'Vehicle Specs' in excel_data:
            veh_df = excel_data['Vehicle Specs']
            veh_count = 0
            
            for _, row in veh_df.iterrows():
                veh_doc = {
                    'id': str(uuid.uuid4()),
                    'type': 'vehicle_spec',
                    'vehicle': str(row.get('السيارة', '')),
                    'engine': str(row.get('المحرك', '')),
                    'year': str(row.get('السنة', '')),
                    'displacement': str(row.get('السعة', '')),
                    'power': str(row.get('القوة', '')),
                    'torque': str(row.get('العزم', '')),
                    'fuelSystem': str(row.get('نظام الوقود', '')),
                    'ignitionSystem': str(row.get('نظام الإشعال', '')),
                    'notes': str(row.get('الملاحظات', '')),
                    'source': file.filename,
                    'createdAt': datetime.utcnow()
                }
                
                await db.vehicle_references.insert_one(veh_doc)
                veh_count += 1
            
            imported_counts['vehicles'] = veh_count
        
        return {
            'status': 'ok',
            'message': 'تم استيراد المراجع بنجاح',
            'imported': imported_counts,
            'filename': file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/references/dtc")
async def get_dtc_references(code: str = None, vehicle: str = None):
    """الحصول على مراجع DTC"""
    try:
        query = {}
        if code:
            query['code'] = code.upper()
        if vehicle:
            query['vehicle'] = {'$regex': vehicle, '$options': 'i'}
        
        refs = await db.dtc_references.find(query).to_list(length=100)
        for ref in refs:
            ref.pop('_id', None)
        
        return {'references': refs, 'count': len(refs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/references/electrical")
async def get_electrical_references(component: str = None):
    """الحصول على مراجع كهربائية"""
    try:
        query = {}
        if component:
            query['$or'] = [
                {'componentAr': {'$regex': component, '$options': 'i'}},
                {'componentEn': {'$regex': component, '$options': 'i'}}
            ]
        
        refs = await db.electrical_references.find(query).to_list(length=100)
        for ref in refs:
            ref.pop('_id', None)
        
        return {'references': refs, 'count': len(refs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
