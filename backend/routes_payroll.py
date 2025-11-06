from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api")
db = None

def set_db(database):
    global db
    db = database

# ============ Employee Performance ============
@router.post("/employee-performance")
async def log_employee_performance(payload: Dict[str, Any]):
    """تسجيل أداء موظف"""
    try:
        record = {
            'id': str(uuid.uuid4()),
            'employeeId': payload.get('employeeId'),
            'workDate': datetime.utcnow(),
            'hoursWorked': float(payload.get('hoursWorked', 0)),
            'vehicleId': payload.get('vehicleId'),
            'notes': payload.get('notes', ''),
            'createdAt': datetime.utcnow()
        }
        
        await db.employee_performance.insert_one(record)
        record.pop('_id', None)
        return record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/employee-performance")
async def get_employee_performance(employee_id: str = None, vehicle_id: str = None):
    """الحصول على سجلات الأداء"""
    try:
        query = {}
        if employee_id:
            query['employeeId'] = employee_id
        if vehicle_id:
            query['vehicleId'] = vehicle_id
        
        records = await db.employee_performance.find(query).sort('workDate', -1).to_list(length=100)
        for r in records:
            r.pop('_id', None)
            if r.get('workDate'):
                r['workDate'] = r['workDate'].isoformat()
            if r.get('createdAt'):
                r['createdAt'] = r['createdAt'].isoformat()
        
        return {'records': records, 'count': len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ Salary Records ============
@router.post("/salary-records")
async def create_salary_record(payload: Dict[str, Any]):
    """إضافة سجل راتب"""
    try:
        basic_salary = float(payload.get('basicSalary', 0))
        allowances = float(payload.get('allowances', 0))
        deductions = float(payload.get('deductions', 0))
        total = basic_salary + allowances - deductions
        
        record = {
            'id': str(uuid.uuid4()),
            'employeeId': payload.get('employeeId'),
            'month': int(payload.get('month')),
            'year': int(payload.get('year')),
            'basicSalary': basic_salary,
            'allowances': allowances,
            'deductions': deductions,
            'totalSalary': total,
            'paymentDate': payload.get('paymentDate'),
            'paymentStatus': payload.get('paymentStatus', 'pending'),
            'notes': payload.get('notes', ''),
            'createdAt': datetime.utcnow()
        }
        
        await db.salary_records.insert_one(record)
        
        # Auto-create expense transaction
        if record['paymentStatus'] == 'paid':
            transaction = {
                'id': str(uuid.uuid4()),
                'accountId': payload.get('accountId', ''),
                'type': 'expense',
                'category': 'salary',
                'amount': total,
                'description': f"راتب - {payload.get('employeeName', 'موظف')} - {record['month']}/{record['year']}",
                'date': datetime.utcnow(),
                'reference': record['id'],
                'createdAt': datetime.utcnow()
            }
            await db.transactions.insert_one(transaction)
        
        record.pop('_id', None)
        return record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/salary-records")
async def get_salary_records(employee_id: str = None, year: int = None, month: int = None):
    """الحصول على سجلات الرواتب"""
    try:
        query = {}
        if employee_id:
            query['employeeId'] = employee_id
        if year:
            query['year'] = year
        if month:
            query['month'] = month
        
        records = await db.salary_records.find(query).sort('year', -1).sort('month', -1).to_list(length=100)
        for r in records:
            r.pop('_id', None)
            if r.get('createdAt'):
                r['createdAt'] = r['createdAt'].isoformat()
        
        return {'records': records, 'count': len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/salary-records/{record_id}")
async def update_salary_record(record_id: str, payload: Dict[str, Any]):
    """تحديث سجل راتب"""
    try:
        update_data = {}
        
        if 'paymentStatus' in payload:
            update_data['paymentStatus'] = payload['paymentStatus']
            
            # If marking as paid, create transaction
            if payload['paymentStatus'] == 'paid':
                record = await db.salary_records.find_one({'id': record_id})
                if record:
                    transaction = {
                        'id': str(uuid.uuid4()),
                        'accountId': payload.get('accountId', ''),
                        'type': 'expense',
                        'category': 'salary',
                        'amount': record.get('totalSalary', 0),
                        'description': f"راتب - {record['month']}/{record['year']}",
                        'date': datetime.utcnow(),
                        'reference': record_id,
                        'createdAt': datetime.utcnow()
                    }
                    await db.transactions.insert_one(transaction)
        
        if update_data:
            await db.salary_records.update_one({'id': record_id}, {'$set': update_data})
        
        updated = await db.salary_records.find_one({'id': record_id})
        updated.pop('_id', None)
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
