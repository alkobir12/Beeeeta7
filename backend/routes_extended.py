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

# ------------------ ANALYTICS CARDS ------------------
@router.get('/analytics/cards')
async def analytics_cards():
    try:
        customers_count = await db.customers.count_documents({})
        services_count = await db.services.count_documents({})
        suppliers_count = await db.suppliers.count_documents({}) if hasattr(db, 'suppliers') else 0
        parts_count = await db.parts.count_documents({}) if hasattr(db, 'parts') else 0

        parts = await db.parts.find({}).to_list(length=100000)
        for p in parts:
            p.pop('_id', None)
        low_stock = len([p for p in parts if p.get('quantity', 0) <= p.get('minQuantity', 0)])
        out_stock = len([p for p in parts if p.get('quantity', 0) <= 0])
        stock_value = sum((p.get('purchasePrice', 0) or p.get('price', 0)) * (p.get('quantity', 0) or 0) for p in parts)
        categories = len(set([p.get('category') for p in parts if p.get('category')]))

        # Operations last 30 days
        since = datetime.utcnow() - timedelta(days=30)
        sales_ops = await db.operations.find({"type": "sale", "date": {"$gte": since}}).to_list(length=100000)
        purc_ops = await db.operations.find({"type": "purchase", "date": {"$gte": since}}).to_list(length=100000)
        sales_total = sum(o.get('total', 0) for o in sales_ops)
        purchases_total = sum(o.get('total', 0) for o in purc_ops)

        # Transactions profit estimation
        tx = await db.transactions.find({"date": {"$gte": since}}).to_list(length=100000)
        income = sum(t.get('amount', 0) for t in tx if t.get('type') == 'income')
        expense = sum(t.get('amount', 0) for t in tx if t.get('type') == 'expense')
        profit = income - expense

        # Customers details
        since_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        cust_new = await db.customers.count_documents({"createdAt": {"$gte": since_month}}) if hasattr(db.customers, 'count_documents') else 0
        cust_has_phone = await db.customers.count_documents({"phone": {"$ne": None, "$ne": ""}})
        cust_has_email = await db.customers.count_documents({"email": {"$ne": None, "$ne": ""}})

        return {
            "customers": {"total": customers_count, "newThisMonth": cust_new, "withPhone": cust_has_phone, "withEmail": cust_has_email},
            "services": {"total": services_count},
            "suppliers": {"total": suppliers_count},
            "parts": {"total": parts_count, "lowStock": low_stock, "outOfStock": out_stock, "stockValue": stock_value, "categories": categories},
            "sales": {"count": len(sales_ops), "total": sales_total},
            "purchases": {"count": len(purc_ops), "total": purchases_total},
            "finance": {"income": income, "expense": expense, "profit": profit}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

# ------------------ IMPORT ENDPOINTS (CSV/XLSX) ------------------
# ... existing import endpoints remain unchanged below ...
