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

# ------------------ CUSTOMER RECEIPTS ------------------
@router.post('/customer-receipts')
async def create_customer_receipt(payload: Dict[str, Any]):
    try:
        # Minimal validation
        if not payload.get('customerId') or payload.get('amount') is None:
            raise HTTPException(status_code=422, detail='customerId and amount are required')
        model = CustomerReceipt(
            customerId=payload['customerId'],
            accountId=payload.get('accountId'),
            amount=float(payload.get('amount', 0)),
            paymentMethod=payload.get('paymentMethod', 'cash'),
            reference=payload.get('reference'),
            notes=payload.get('notes'),
        )
        await db.customer_receipts.insert_one(model.dict())
        # Auto create income transaction record
        try:
            await db.transactions.insert_one({
                'id': str(uuid.uuid4()),
                'type': 'income',
                'category': 'customer_receipt',
                'amount': model.amount,
                'description': f"Customer receipt {model.id}",
                'paymentMethod': model.paymentMethod,
                'reference': model.id,
                'accountId': model.accountId,
                'date': datetime.utcnow(),
                'createdBy': None
            })
        except Exception:
            pass
        return model.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/customer-receipts')
async def list_customer_receipts(customer_id: Optional[str] = None, account_id: Optional[str] = None):
    try:
        query: Dict[str, Any] = {}
        if customer_id:
            query['customerId'] = customer_id
        if account_id:
            query['accountId'] = account_id
        rows = await db.customer_receipts.find(query).sort('date', -1).to_list(length=100000)
        for r in rows:
            r.pop('_id', None)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ DIAGNOSIS CASES (READ-ONLY FOR NOW) ------------------
@router.get('/diagnosis-cases')
async def list_diagnosis_cases(vehicle_id: Optional[str] = None, customer_id: Optional[str] = None):
    try:
        query: Dict[str, Any] = {}
        if vehicle_id:
            query['vehicleId'] = vehicle_id
        if customer_id:
            query['customerId'] = customer_id
        rows = await db.diagnosis_cases.find(query).sort('createdAt', -1).to_list(length=100000)
        for r in rows:
            r.pop('_id', None)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ QUOTES (READ-ONLY FOR NOW) ------------------
@router.get('/quotes')
async def list_quotes(vehicle_id: Optional[str] = None, customer_id: Optional[str] = None, status: Optional[str] = None):
    try:
        query: Dict[str, Any] = {}
        if vehicle_id:
            query['vehicleId'] = vehicle_id
        if customer_id:
            query['customerId'] = customer_id
        if status:
            query['status'] = status
        rows = await db.quotes.find(query).sort('createdAt', -1).to_list(length=100000)
        for r in rows:
            r.pop('_id', None)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PRINT TEMPLATES ------------------
DEFAULT_TEMPLATES: Dict[str, str] = {
    'invoice': '<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;direction:rtl} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}</style></head><body><h2>فاتورة</h2><div>العميل: {{CUSTOMER_NAME}} — الجوال: {{CUSTOMER_PHONE}}</div><div>المركبة: {{VEHICLE_PLATE}} {{VEHICLE_MODEL}} {{VEHICLE_YEAR}}</div><div>رقم الفاتورة: {{INVOICE_NO}}</div><hr/><table><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{{ITEMS_ROWS}}</tbody></table><hr/><div>المجموع: {{SUBTOTAL}}</div><div>الضريبة: {{TAX}}</div><div><strong>الإجمالي: {{TOTAL}}</strong></div></body></html>',
    'diagnosis': '<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;direction:rtl} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}</style></head><body><h2>تقرير التشخيص</h2><div>العميل: {{CUSTOMER_NAME}}</div><div>المركبة: {{VEHICLE_PLATE}} {{VEHICLE_MODEL}} {{VEHICLE_YEAR}}</div><div>التاريخ: {{DIAGNOSIS_DATE}}</div><hr/><table><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{{ITEMS_ROWS}}</tbody></table></body></html>',
    'quote': '<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;direction:rtl} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}</style></head><body><h2>عرض سعر</h2><div>العميل: {{CUSTOMER_NAME}}</div><div>المركبة: {{VEHICLE_PLATE}} {{VEHICLE_MODEL}} {{VEHICLE_YEAR}}</div><hr/><table><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{{ITEMS_ROWS}}</tbody></table><hr/><div>المجموع: {{SUBTOTAL}}</div><div>الخصم: {{DISCOUNT}}</div><div>الضريبة: {{TAX}}</div><div><strong>الإجمالي: {{TOTAL}}</strong></div></body></html>',
    'receipt': '<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;direction:rtl}</style></head><body><h2>سند قبض</h2><div>العميل: {{CUSTOMER_NAME}}</div><div>المبلغ: {{TOTAL}} ر.س</div><div>التاريخ: {{RECEIPT_DATE}}</div></body></html>'
}

async def _ensure_templates():
    try:
        count = await db.templates.count_documents({})
    except Exception:
        count = 0
    added = []
    for t, html in DEFAULT_TEMPLATES.items():
        existing = await db.templates.find_one({'type': t, 'isActive': True})
        if not existing:
            doc = TemplateDoc(name=f"{t} (افتراضي)", type=t, html=html, isActive=True)
            await db.templates.insert_one(doc.dict())
            added.append(t)
    return added

@router.post('/seed/print-templates')
async def seed_print_templates():
    try:
        added = await _ensure_templates()
        return {"added": added}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/print/resolve-template')
async def resolve_template(payload: Dict[str, Any] = Body(...)):
    try:
        override_type = (payload or {}).get('override_type') or (payload or {}).get('type')
        if not override_type:
            raise HTTPException(status_code=422, detail='override_type is required')
        await _ensure_templates()
        tpl = await db.templates.find_one({'type': override_type, 'isActive': True})
        if not tpl:
            raise HTTPException(status_code=404, detail='Template not found')
        tpl.pop('_id', None) if isinstance(tpl, dict) else None
        return {"type": override_type, "template": tpl}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _render_items_rows(items: List[Dict[str, Any]]):
    rows = []
    for it in (items or []):
        name = it.get('name', '')
        qty = it.get('qty') or it.get('quantity') or 1
        price = it.get('price') or 0
        total = it.get('total') or (qty * price)
        rows.append(f"<tr><td>{name}</td><td>{qty}</td><td>{price}</td><td>{total}</td></tr>")
    return "".join(rows)

@router.post('/print/render')
async def print_render(payload: Dict[str, Any] = Body(...)):
    try:
        override_type = payload.get('override_type') or payload.get('type') or 'invoice'
        data = payload.get('data') or {}
        await _ensure_templates()
        tpl = await db.templates.find_one({'type': override_type, 'isActive': True})
        html = (tpl.get('html') if tpl else DEFAULT_TEMPLATES.get(override_type)) or '<html><body>{{CONTENT}}</body></html>'

        # Prepare items
        items = data.get('items') or []
        rows_html = _render_items_rows(items)
        html = html.replace('{{ITEMS_ROWS}}', rows_html)

        # Replace simple placeholders
        for k, v in data.items():
            try:
                html = html.replace(f'{{{{{k}}}}}', str(v))
            except Exception:
                continue
        # Ensure full HTML
        if '<html' not in html.lower():
            html = f"<html><head><meta charset='utf-8'></head><body>{html}</body></html>"
        return {"html": html}
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
