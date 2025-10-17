from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from datetime import datetime, timedelta
from typing import List, Optional
import uuid

from models_extended import (
    BusinessAccount, Operation, Budget, CustomerReceipt, TemplateDoc,
)
from models import Customer, Service

router = APIRouter(prefix="/api")

db = None

def set_db(database):
    global db
    db = database

# ------------------ IMPORT HELPERS ------------------
async def _upsert_customer_row(name, phone, email=None, address=None, mode: str = 'skip'):
    created = updated = skipped = 0
    if not phone:
        return 0, 0, 1
    existing = await db.customers.find_one({"phone": phone})
    if existing:
        if mode == 'update':
            update = {"name": name}
            if email is not None:
                update['email'] = email
            if address is not None:
                update['address'] = address
            await db.customers.update_one({"id": existing['id']}, {"$set": update})
            updated = 1
        else:
            skipped = 1
    else:
        c = Customer(name=name, phone=phone, email=email, address=address)
        await db.customers.insert_one(c.dict())
        created = 1
    return created, updated, skipped

async def _upsert_service_row(name, category='عام', price=0.0, duration=30, mode: str = 'skip'):
    created = updated = skipped = 0
    key = {"name": name, "category": category}
    existing = await db.services.find_one(key)
    if existing:
        if mode == 'update':
            await db.services.update_one({"id": existing['id']}, {"$set": {"price": float(price or 0), "duration": int(duration or 0)}})
            updated = 1
        else:
            skipped = 1
    else:
        s = Service(name=name, category=category, price=float(price or 0), duration=int(duration or 0))
        await db.services.insert_one(s.dict())
        created = 1
    return created, updated, skipped

async def _upsert_part_row(name, code=None, category='عام', price=0.0, quantity=0, unit='pcs', mode: str = 'skip'):
    created = updated = skipped = 0
    q = {"$or": []}
    if code:
        q["$or"].append({"code": code})
    q["$or"].append({"name": name, "category": category})
    existing = await db.parts.find_one(q) if q["$or"] else None
    payload = {
        "id": str(uuid.uuid4()),
        "name": name,
        "code": code,
        "category": category,
        "price": float(price or 0),
        "quantity": float(quantity or 0),
        "unit": unit,
        "createdAt": datetime.utcnow()
    }
    if existing:
        if mode == 'update':
            upd = {k: v for k, v in payload.items() if k not in ('id','createdAt')}
            await db.parts.update_one({"id": existing['id']}, {"$set": upd})
            updated = 1
        else:
            skipped = 1
    else:
        await db.parts.insert_one(payload)
        created = 1
    return created, updated, skipped

# ------------------ IMPORT ENDPOINTS (CSV) ------------------
@router.post("/import/customers/csv")
async def import_customers_csv(file: UploadFile = File(...), mode: str = 'skip'):
    try:
        content = (await file.read()).decode('utf-8', errors='ignore')
        lines = [line for line in content.splitlines() if line.strip()]
        header = [h.strip().lower() for h in lines[0].split(',')]
        idx = {k: i for i, k in enumerate(header)}
        created = updated = skipped = 0
        for line in lines[1:]:
            cols = [c.strip() for c in line.split(',')]
            if not cols or len(cols) == 0:
                continue
            name = cols[idx.get('name', 0)] if len(cols) > idx.get('name', 0) else ''
            phone = cols[idx.get('phone', 1)] if idx.get('phone') is not None and len(cols) > idx.get('phone', 1) else ''
            email = cols[idx.get('email', 2)] if idx.get('email') is not None and len(cols) > idx.get('email', 2) else None
            address = cols[idx.get('address', 3)] if idx.get('address') is not None and len(cols) > idx.get('address', 3) else None
            c,u,s = await _upsert_customer_row(name, phone, email, address, mode)
            created += c; updated += u; skipped += s
        return {"created": created, "updated": updated, "skipped": skipped}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import/services/csv")
async def import_services_csv(file: UploadFile = File(...), mode: str = 'skip'):
    try:
        content = (await file.read()).decode('utf-8', errors='ignore')
        lines = [line for line in content.splitlines() if line.strip()]
        header = [h.strip().lower() for h in lines[0].split(',')]
        idx = {k: i for i, k in enumerate(header)}
        created = updated = skipped = 0
        for line in lines[1:]:
            cols = [c.strip() for c in line.split(',')]
            name = cols[idx.get('name', 0)] if len(cols) > idx.get('name', 0) else ''
            category = cols[idx.get('category', 1)] if idx.get('category') is not None and len(cols) > idx.get('category', 1) else 'عام'
            price = cols[idx.get('price', 2)] if idx.get('price') is not None and len(cols) > idx.get('price', 2) else 0.0
            duration = cols[idx.get('duration', 3)] if idx.get('duration') is not None and len(cols) > idx.get('duration', 3) else 30
            c,u,s = await _upsert_service_row(name, category, price, duration, mode)
            created += c; updated += u; skipped += s
        return {"created": created, "updated": updated, "skipped": skipped}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import/parts/csv")
async def import_parts_csv(file: UploadFile = File(...), mode: str = 'skip'):
    try:
        content = (await file.read()).decode('utf-8', errors='ignore')
        lines = [line for line in content.splitlines() if line.strip()]
        header = [h.strip().lower() for h in lines[0].split(',')]
        idx = {k: i for i, k in enumerate(header)}
        created = updated = skipped = 0
        for line in lines[1:]:
            cols = [c.strip() for c in line.split(',')]
            name = cols[idx.get('name', 0)] if len(cols) > idx.get('name', 0) else ''
            code = cols[idx.get('code', 1)] if idx.get('code') is not None and len(cols) > idx.get('code', 1) else None
            category = cols[idx.get('category', 2)] if idx.get('category') is not None and len(cols) > idx.get('category', 2) else 'عام'
            price = cols[idx.get('price', 3)] if idx.get('price') is not None and len(cols) > idx.get('price', 3) else 0
            quantity = cols[idx.get('quantity', 4)] if idx.get('quantity') is not None and len(cols) > idx.get('quantity', 4) else 0
            unit = cols[idx.get('unit', 5)] if idx.get('unit') is not None and len(cols) > idx.get('unit', 5) else 'pcs'
            c,u,s = await _upsert_part_row(name, code, category, price, quantity, unit, mode)
            created += c; updated += u; skipped += s
        return {"created": created, "updated": updated, "skipped": skipped}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ------------------ IMPORT ENDPOINTS (XLSX optional) ------------------
async def _xlsx_rows(file_bytes):
    try:
        import openpyxl
    except Exception:
        raise HTTPException(status_code=400, detail="XLSX غير مدعوم حالياً (يلزم تثبيت openpyxl). استخدم CSV.")
    try:
        from io import BytesIO
        wb = openpyxl.load_workbook(BytesIO(file_bytes))
        ws = wb.active
        rows = []
        for row in ws.iter_rows(values_only=True):
            rows.append([str(c).strip() if c is not None else '' for c in row])
        return rows
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل قراءة XLSX: {str(e)}")

@router.post("/import/customers/xlsx")
async def import_customers_xlsx(file: UploadFile = File(...), mode: str = 'skip'):
    rows = await _xlsx_rows(await file.read())
    if not rows:
        return {"created":0,"updated":0,"skipped":0}
    header = [h.strip().lower() for h in rows[0]]
    idx = {k:i for i,k in enumerate(header)}
    created = updated = skipped = 0
    for cols in rows[1:]:
        name = cols[idx.get('name', 0)] if len(cols) > idx.get('name', 0) else ''
        phone = cols[idx.get('phone', 1)] if idx.get('phone') is not None and len(cols) > idx.get('phone', 1) else ''
        email = cols[idx.get('email', 2)] if idx.get('email') is not None and len(cols) > idx.get('email', 2) else None
        address = cols[idx.get('address', 3)] if idx.get('address') is not None and len(cols) > idx.get('address', 3) else None
        c,u,s = await _upsert_customer_row(name, phone, email, address, mode)
        created += c; updated += u; skipped += s
    return {"created": created, "updated": updated, "skipped": skipped}

@router.post("/import/services/xlsx")
async def import_services_xlsx(file: UploadFile = File(...), mode: str = 'skip'):
    rows = await _xlsx_rows(await file.read())
    if not rows:
        return {"created":0,"updated":0,"skipped":0}
    header = [h.strip().lower() for h in rows[0]]
    idx = {k:i for i,k in enumerate(header)}
    created = updated = skipped = 0
    for cols in rows[1:]:
        name = cols[idx.get('name', 0)] if len(cols) > idx.get('name', 0) else ''
        category = cols[idx.get('category', 1)] if idx.get('category') is not None and len(cols) > idx.get('category', 1) else 'عام'
        price = cols[idx.get('price', 2)] if idx.get('price') is not None and len(cols) > idx.get('price', 2) else 0
        duration = cols[idx.get('duration', 3)] if idx.get('duration') is not None and len(cols) > idx.get('duration', 3) else 30
        c,u,s = await _upsert_service_row(name, category, price, duration, mode)
        created += c; updated += u; skipped += s
    return {"created": created, "updated": updated, "skipped": skipped}

@router.post("/import/parts/xlsx")
async def import_parts_xlsx(file: UploadFile = File(...), mode: str = 'skip'):
    rows = await _xlsx_rows(await file.read())
    if not rows:
        return {"created":0,"updated":0,"skipped":0}
    header = [h.strip().lower() for h in rows[0]]
    idx = {k:i for i,k in enumerate(header)}
    created = updated = skipped = 0
    for cols in rows[1:]:
        name = cols[idx.get('name', 0)] if len(cols) > idx.get('name', 0) else ''
        code = cols[idx.get('code', 1)] if idx.get('code') is not None and len(cols) > idx.get('code', 1) else None
        category = cols[idx.get('category', 2)] if idx.get('category') is not None and len(cols) > idx.get('category', 2) else 'عام'
        price = cols[idx.get('price', 3)] if idx.get('price') is not None and len(cols) > idx.get('price', 3) else 0
        quantity = cols[idx.get('quantity', 4)] if idx.get('quantity') is not None and len(cols) > idx.get('quantity', 4) else 0
        unit = cols[idx.get('unit', 5)] if idx.get('unit') is not None and len(cols) > idx.get('unit', 5) else 'pcs'
        c,u,s = await _upsert_part_row(name, code, category, price, quantity, unit, mode)
        created += c; updated += u; skipped += s
    return {"created": created, "updated": updated, "skipped": skipped}

# ------------------ END IMPORT ------------------
