from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
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

# ------------------ ANALYTICS CARDS (GLOBAL) ------------------
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
        low_stock = len([p for p in parts if (p.get('quantity') or 0) <= (p.get('minQuantity') or 0)])
        out_stock = len([p for p in parts if (p.get('quantity') or 0) <= 0])
        stock_value = sum(((p.get('purchasePrice') or p.get('price') or 0) * (p.get('quantity') or 0)) for p in parts)
        categories = len(set([p.get('category') for p in parts if p.get('category')]))

        since = datetime.utcnow() - timedelta(days=30)
        sales_ops = await db.operations.find({"type": "sale", "date": {"$gte": since}}).to_list(length=100000)
        purc_ops = await db.operations.find({"type": "purchase", "date": {"$gte": since}}).to_list(length=100000)
        sales_total = sum(o.get('total', 0) for o in sales_ops)
        purchases_total = sum(o.get('total', 0) for o in purc_ops)

        tx = await db.transactions.find({"date": {"$gte": since}}).to_list(length=100000)
        income = sum(t.get('amount', 0) for t in tx if t.get('type') == 'income')
        expense = sum(t.get('amount', 0) for t in tx if t.get('type') == 'expense')
        profit = income - expense

        since_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        try:
            cust_new = await db.customers.count_documents({"createdAt": {"$gte": since_month}})
        except Exception:
            cust_new = 0
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

# ------------------ ANALYTICS PER DOMAIN ------------------
@router.get('/analytics/parts')
async def analytics_parts():
    try:
        parts = await db.parts.find({}).to_list(length=100000)
        for p in parts:
            p.pop('_id', None)
        low_stock_list = [
            {
                "name": p.get('name'),
                "code": p.get('code'),
                "quantity": p.get('quantity', 0),
                "minQuantity": p.get('minQuantity', 0),
                "category": p.get('category')
            }
            for p in parts if (p.get('quantity') or 0) <= (p.get('minQuantity') or 0)
        ][:20]
        stock_value = sum(((p.get('purchasePrice') or p.get('price') or 0) * (p.get('quantity') or 0)) for p in parts)
        categories = {}
        for p in parts:
            cat = p.get('category') or 'other'
            categories[cat] = categories.get(cat, 0) + 1
        return {
            "total": len(parts),
            "lowStock": len(low_stock_list),
            "outOfStock": len([p for p in parts if (p.get('quantity') or 0) <= 0]),
            "stockValue": stock_value,
            "categories": categories,
            "lowStockList": low_stock_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/analytics/customers')
async def analytics_customers():
    try:
        total = await db.customers.count_documents({})
        with_phone = await db.customers.count_documents({"phone": {"$ne": None, "$ne": ""}})
        with_email = await db.customers.count_documents({"email": {"$ne": None, "$ne": ""}})
        since = datetime.utcnow() - timedelta(days=30)
        receipts = await db.customer_receipts.find({"date": {"$gte": since}}).to_list(length=100000)
        total_receipts = sum(r.get('amount', 0) for r in receipts)
        return {"total": total, "withPhone": with_phone, "withEmail": with_email, "last30dReceipts": total_receipts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/analytics/services')
async def analytics_services():
    try:
        rows = await db.services.find({}).to_list(length=100000)
        for r in rows:
            r.pop('_id', None)
        total = len(rows)
        cats = {}
        total_price = 0
        for r in rows:
            cats[r.get('category') or 'other'] = cats.get(r.get('category') or 'other', 0) + 1
            total_price += float(r.get('price') or 0)
        avg_price = (total_price / total) if total > 0 else 0
        return {"total": total, "categories": cats, "avgPrice": avg_price}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/analytics/suppliers')
async def analytics_suppliers():
    try:
        sups = await db.suppliers.find({}).to_list(length=100000)
        for s in sups:
            s.pop('_id', None)
        # Vendor bills aggregation
        bills = await db.vendor_bills.find({}).to_list(length=100000)
        for b in bills: b.pop('_id', None)
        per_supplier: Dict[str, Dict[str, Any]] = {}
        for s in sups:
            per_supplier[s['id']] = {"name": s.get('name'), "paid": 0.0, "unpaid": 0.0, "count": 0}
        for b in bills:
            sid = b.get('supplierId')
            if sid not in per_supplier:
                per_supplier[sid] = {"name": sid or 'unknown', "paid": 0.0, "unpaid": 0.0, "count": 0}
            amt = float(b.get('total') or 0)
            if (b.get('status') or '').lower() in ('paid','done','settled'):
                per_supplier[sid]['paid'] += amt
            else:
                per_supplier[sid]['unpaid'] += amt
            per_supplier[sid]['count'] += 1
        summary = {
            "totalSuppliers": len(sups),
            "totalBills": len(bills),
            "totalPaid": sum(v['paid'] for v in per_supplier.values()),
            "totalUnpaid": sum(v['unpaid'] for v in per_supplier.values())
        }
        return {"suppliers": per_supplier, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/analytics/sales')
async def analytics_sales():
    try:
        since = datetime.utcnow() - timedelta(days=30)
        sales_ops = await db.operations.find({"type": "sale", "date": {"$gte": since}}).to_list(length=100000)
        purc_ops = await db.operations.find({"type": "purchase", "date": {"$gte": since}}).to_list(length=100000)
        sales_total = sum(o.get('total', 0) for o in sales_ops)
        purchases_total = sum(o.get('total', 0) for o in purc_ops)
        tx = await db.transactions.find({"date": {"$gte": since}}).to_list(length=100000)
        income = sum(t.get('amount', 0) for t in tx if t.get('type') == 'income')
        expense = sum(t.get('amount', 0) for t in tx if t.get('type') == 'expense')
        profit = income - expense
        return {"sales": sales_total, "purchases": purchases_total, "income": income, "expense": expense, "profit": profit}
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

# ... (rest of existing import endpoints remain unchanged) ...
