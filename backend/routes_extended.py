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

# ------------------ SETTINGS (App + MenuConfig) ------------------
@router.get('/settings')
async def get_settings():
    try:
        doc = await db.settings.find_one({"id": "app_settings"})
        if not doc:
            # Defaults with menuConfig
            default = {
                "id": "app_settings",
                "currency": "SAR",
                "taxRate": 0.0,
                "language": "ar",
                "timezone": "Asia/Riyadh",
                "invoicePrefix": "INV",
                "menuConfig": {
                    "simple": False,
                    "items": [
                        {"path": "/", "label": "الرئيسية", "enabled": True},
                        {"path": "/operations", "label": "عمليات الشراء/البيع", "enabled": True},
                        {"group": True, "path": "/inventory", "label": "المخزون", "enabled": True, "children": [
                            {"path": "/parts", "label": "قطع الغيار", "enabled": True},
                            {"path": "/suppliers", "label": "الموردين", "enabled": True},
                        ]},
                        {"group": True, "path": "/customers-group", "label": "العملاء", "enabled": True, "children": [
                            {"path": "/customers", "label": "قائمة العملاء", "enabled": True},
                            {"path": "/customer-receipts", "label": "توريد العملاء", "enabled": True}
                        ]},
                        {"group": True, "path": "/services-group", "label": "الخدمات", "enabled": True, "children": [
                            {"path": "/services", "label": "قائمة الخدمات", "enabled": True},
                            {"path": "/import", "label": "استيراد/توريد", "enabled": True}
                        ]},
                        {"path": "/archive", "label": "أرشيف المركبات", "enabled": True},
                        {"group": True, "path": "/ceo-group", "label": "المدير التنفيذي", "enabled": True, "children": [
                            {"path": "/ceo", "label": "لوحة المدير", "enabled": True},
                            {"path": "/knowledge", "label": "إدارة المعرفة AI", "enabled": True}
                        ]},
                        {"path": "/payroll", "label": "الرواتب", "enabled": True},
                        {"group": True, "path": "/settings", "label": "الإعدادات", "enabled": True, "children": [
                            {"path": "/settings", "label": "الإعدادات العامة", "enabled": True},
                            {"path": "/templates", "label": "نماذج الفواتير/التقارير", "enabled": True},
                            {"path": "/users", "label": "المستخدمون", "enabled": True}
                        ]}
                    ]
                }
            }
            await db.settings.insert_one(default)
            doc = default
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/settings')
async def save_settings(payload: Dict[str, Any]):
    try:
        payload = {**payload, "id": "app_settings", "updatedAt": datetime.utcnow()}
        await db.settings.update_one({"id": "app_settings"}, {"$set": payload}, upsert=True)
        saved = await db.settings.find_one({"id": "app_settings"})
        if saved:
            saved.pop('_id', None)
        return saved
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        cust_has_phone = await db.customers.count_documents({"phone": {"$nin": [None, ""]}})
        cust_has_email = await db.customers.count_documents({"email": {"$nin": [None, ""]}})

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
        with_phone = await db.customers.count_documents({"phone": {"$nin": [None, ""]}})
        with_email = await db.customers.count_documents({"email": {"$nin": [None, ""]}})
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


# ------------------ BUSINESS ACCOUNTS ------------------
@router.get('/biz-accounts')
async def get_business_accounts():
    """Get all business accounts"""
    try:
        accounts = await db.business_accounts.find({'isActive': True}).to_list(length=1000)
        for a in accounts:
            a.pop('_id', None)
            if a.get('createdAt'):
                a['createdAt'] = a['createdAt'].isoformat()
            if a.get('updatedAt'):
                a['updatedAt'] = a['updatedAt'].isoformat()
        return accounts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/biz-accounts')
async def create_business_account(payload: Dict[str, Any]):
    """Create new business account"""
    try:
        from models_extended import BusinessAccount
        account = BusinessAccount(
            name=payload.get('name', ''),
            code=payload.get('code', ''),
            description=payload.get('description'),
            isActive=True
        )
        doc = account.dict()
        await db.business_accounts.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/biz-accounts/{account_id}')
async def update_business_account(account_id: str, payload: Dict[str, Any]):
    """Update business account"""
    try:
        update_data = {}
        if 'name' in payload:
            update_data['name'] = payload['name']
        if 'code' in payload:
            update_data['code'] = payload['code']
        if 'description' in payload:
            update_data['description'] = payload['description']
        if 'isActive' in payload:
            update_data['isActive'] = payload['isActive']
        
        update_data['updatedAt'] = datetime.utcnow()
        
        result = await db.business_accounts.update_one(
            {'id': account_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Account not found')
        
        updated = await db.business_accounts.find_one({'id': account_id})
        updated.pop('_id', None)
        if updated.get('createdAt'):
            updated['createdAt'] = updated['createdAt'].isoformat()
        if updated.get('updatedAt'):
            updated['updatedAt'] = updated['updatedAt'].isoformat()
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ BUDGETS ------------------
@router.get('/budgets')
async def list_budgets(account_id: Optional[str] = None, period: Optional[str] = None):
    """List budgets. Optionally filter by account_id and/or period (YYYY-MM)."""
    try:
        q: Dict[str, Any] = {}
        if account_id:
            q['accountId'] = account_id
        if period:
            q['period'] = period
        rows = await db.budgets.find(q).sort('createdAt', -1).to_list(length=1000)
        for r in rows:
            r.pop('_id', None)
        # Enrich with actuals if possible
        for r in rows:
            per = r.get('period')
            acc = r.get('accountId')
            try:
                if per:
                    start = datetime.fromisoformat(per + '-01')
                    # naive monthly end: add 32 days then set day=1 and minus 1 second
                    from datetime import timedelta
                    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
                    end = next_month
                    tq: Dict[str, Any] = {"date": {"$gte": start, "$lt": end}}
                    if acc:
                        tq['accountId'] = acc
                    tx = await db.transactions.find(tq).to_list(length=10000)
                    income = sum(float(t.get('amount', 0)) for t in tx if t.get('type') == 'income')
                    expense = sum(float(t.get('amount', 0)) for t in tx if t.get('type') == 'expense')
                    r['actualIncome'] = income
                    r['actualExpenses'] = expense
            except Exception:
                pass
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/budgets')
async def create_budget(payload: Dict[str, Any]):
    """Create a budget for a branch (account)."""
    try:
        account_id = payload.get('accountId')
        period = payload.get('period')  # YYYY-MM
        if not account_id or not period:
            raise HTTPException(status_code=422, detail='accountId and period required')
        # prevent duplicates
        existing = await db.budgets.find_one({'accountId': account_id, 'period': period})
        if existing:
            existing.pop('_id', None)
            return existing
        from models_extended import Budget
        b = Budget(
            accountId=account_id,
            period=period,
            allocations=payload.get('allocations', []),
            incomeTarget=float(payload.get('incomeTarget', 0) or 0),
            expenseTarget=float(payload.get('expenseTarget', 0) or 0),
            notes=payload.get('notes')
        )
        await db.budgets.insert_one(b.dict())
        doc = b.dict()
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/budgets/{budget_id}')
async def update_budget(budget_id: str, payload: Dict[str, Any]):
    try:
        update = {}
        for k in ['allocations', 'incomeTarget', 'expenseTarget', 'notes', 'period']:
            if k in payload:
                update[k] = payload[k]
        if not update:
            return {'status': 'noop'}
        res = await db.budgets.update_one({'id': budget_id}, {'$set': update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail='Budget not found')
        row = await db.budgets.find_one({'id': budget_id})
        row.pop('_id', None)
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/operations/{op_id}')
async def get_operation(op_id: str):
    try:
        op = await db.operations.find_one({'id': op_id})
        if not op:
            raise HTTPException(status_code=404, detail='Operation not found')
        op.pop('_id', None)
        if op.get('date') and hasattr(op['date'], 'isoformat'):
            op['date'] = op['date'].isoformat()
        return op
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/operations/{op_id}')
async def update_operation(op_id: str, payload: Dict[str, Any]):
    """Update simple fields of an operation (partnerName, paymentMethod, notes)."""
    try:
        allowed = {k: v for k, v in payload.items() if k in ['partnerName', 'paymentMethod', 'notes']}
        if not allowed:
            return {'status': 'noop'}
        res = await db.operations.update_one({'id': op_id}, {'$set': allowed})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail='Operation not found')
        op = await db.operations.find_one({'id': op_id})
        op.pop('_id', None)
        if op.get('date') and hasattr(op['date'], 'isoformat'):
            op['date'] = op['date'].isoformat()
        return op
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ IMPORT PARTS ------------------
@router.post('/import/parts')
async def import_parts(file: UploadFile = File(...), mode: str = 'skip'):
    """Import parts from Excel/CSV. Supports Arabic headers."""
    try:
        import pandas as pd
        from io import BytesIO
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(BytesIO(contents))
        else:
            df = pd.read_excel(BytesIO(contents))
        created = updated = skipped = 0
        for _, row in df.iterrows():
            try:
                part_number = str(row.get('partNumber', row.get('رقم القطعة', row.get('PartNumber', '')))).strip()
                name = str(row.get('name', row.get('الاسم', row.get('اسم القطعة', '')))).strip()
                if not part_number or not name:
                    skipped += 1
                    continue
                category = (row.get('category', row.get('التصنيف', 'عام')))
                purchase_price = float(row.get('purchasePrice', row.get('سعر الشراء', row.get('cost', 0)) or 0))
                selling_price = float(row.get('sellingPrice', row.get('سعر البيع', row.get('price', 0)) or 0))
                quantity = int(row.get('quantity', row.get('الكمية', 0) or 0))
                min_qty = int(row.get('minQuantity', row.get('الحد الأدنى', 5) or 5))
                supplier = row.get('supplier', row.get('المورد')) if pd.notna(row.get('supplier', row.get('المورد', None))) else None
                existing = await db.parts.find_one({'partNumber': part_number})
                part_payload = {
                    'partNumber': part_number,
                    'name': name,
                    'category': str(category),
                    'purchasePrice': purchase_price,
                    'sellingPrice': selling_price,
                    'quantity': quantity,
                    'minQuantity': min_qty,
                    'supplier': supplier
                }
                if existing:
                    if mode == 'update':
                        await db.parts.update_one({'id': existing['id']}, {'$set': part_payload})
                        updated += 1
                    else:
                        skipped += 1
                else:
                    from models import Part
                    p = Part(**part_payload)
                    await db.parts.insert_one(p.dict())
                    created += 1
            except Exception:
                skipped += 1
                continue
        return {'status': 'ok', 'created': created, 'updated': updated, 'skipped': skipped, 'total': len(df)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ------------------ OPERATIONS (Purchase/Sale) ------------------
@router.get('/operations')
async def get_operations(account_id: Optional[str] = None, type: Optional[str] = None):
    """Get all operations with optional filters"""
    try:
        query = {}
        if account_id:
            query['accountId'] = account_id
        if type:
            query['type'] = type
        
        operations = await db.operations.find(query).sort('date', -1).to_list(length=1000)
        for op in operations:
            op.pop('_id', None)
            if op.get('date') and hasattr(op['date'], 'isoformat'):
                op['date'] = op['date'].isoformat()
        return operations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/operations')
async def create_operation(payload: Dict[str, Any]):
    """Create new purchase/sale operation"""
    try:
        from models_extended import Operation, OperationItem
        
        # Parse items
        items_data = payload.get('items', [])
        items = []
        for it in items_data:
            items.append(OperationItem(
                itemId=it.get('itemId'),
                itemType=it.get('itemType', 'part'),
                name=it.get('name', ''),
                quantity=float(it.get('quantity', 1)),
                price=float(it.get('price', 0))
            ))
        
        # Calculate totals
        subtotal = sum(it.quantity * it.price for it in items)
        
        operation = Operation(
            accountId=payload.get('accountId', ''),
            type=payload.get('type', 'purchase'),
            partnerType=payload.get('partnerType', 'supplier'),
            partnerName=payload.get('partnerName'),
            partnerId=payload.get('partnerId'),
            items=items,
            subtotal=subtotal,
            total=subtotal,
            paymentMethod=payload.get('paymentMethod', 'cash'),
            notes=payload.get('notes')
        )
        
        doc = operation.dict()
        await db.operations.insert_one(doc)
        
        # Update parts inventory if applicable
        if operation.type == 'purchase':
            # Increase quantity for purchase
            for it in items:
                if it.itemType == 'part' and it.itemId:
                    await db.parts.update_one(
                        {'id': it.itemId},
                        {'$inc': {'quantity': int(it.quantity)}}
                    )
        elif operation.type == 'sale':
            # Decrease quantity for sale
            for it in items:
                if it.itemType == 'part' and it.itemId:
                    await db.parts.update_one(
                        {'id': it.itemId},
                        {'$inc': {'quantity': -int(it.quantity)}}
                    )
        
        doc.pop('_id', None)
        if doc.get('date'):
            doc['date'] = doc['date'].isoformat()
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ OPERATIONS ANALYTICS ------------------
@router.get('/operations/analytics/summary')
async def get_operations_analytics(account_id: Optional[str] = None):
    """Get operations analytics: today, week, month sales"""
    try:
        from datetime import date, timedelta
        
        # Get today's date
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_start = today.replace(day=1)
        
        # Query for sales only
        base_query = {'type': 'sale'}
        if account_id:
            base_query['accountId'] = account_id
        
        # Get all sales
        all_sales = await db.operations.find(base_query).to_list(length=10000)
        
        # Helper function to parse date
        def parse_date(op):
            d = op.get('date')
            if not d:
                return None
            if isinstance(d, str):
                try:
                    return datetime.fromisoformat(d.replace('Z', '+00:00'))
                except Exception:
                    return None
            return d
        
        # Calculate analytics
        today_sales = 0
        week_sales = 0
        month_sales = 0
        today_count = 0
        week_count = 0
        month_count = 0
        
        for op in all_sales:
            op_date = parse_date(op)
            if not op_date:
                continue
            
            total = float(op.get('total', 0))
            
            if op_date >= today:
                today_sales += total
                today_count += 1
            if op_date >= week_ago:
                week_sales += total
                week_count += 1
            if op_date >= month_start:
                month_sales += total
                month_count += 1
        
        # Get all accounts summary
        accounts_summary = []
        
        try:
            all_accounts_list = await db.biz_accounts.find({}).to_list(length=100)
            
            for acc in all_accounts_list:
                acc_id = acc.get('id')
                if not acc_id:
                    continue
                    
                acc_sales = [op for op in all_sales if op.get('accountId') == acc_id]
                
                acc_today = 0
                acc_week = 0
                acc_month = 0
                acc_today_count = 0
                acc_week_count = 0
                acc_month_count = 0
                
                for op in acc_sales:
                    op_date = parse_date(op)
                    if not op_date:
                        continue
                    total = float(op.get('total', 0))
                    
                    if op_date >= today:
                        acc_today += total
                        acc_today_count += 1
                    if op_date >= week_ago:
                        acc_week += total
                        acc_week_count += 1
                    if op_date >= month_start:
                        acc_month += total
                        acc_month_count += 1
                
                accounts_summary.append({
                    'id': acc_id,
                    'name': acc.get('name', 'Unknown'),
                    'todaySales': acc_today,
                    'weekSales': acc_week,
                    'monthSales': acc_month,
                    'todayCount': acc_today_count,
                    'weekCount': acc_week_count,
                    'monthCount': acc_month_count
                })
        except Exception as e:
            # If accounts summary fails, continue with main analytics
            pass
        
        return {
            'today': {'total': today_sales, 'count': today_count},
            'week': {'total': week_sales, 'count': week_count},
            'month': {'total': month_sales, 'count': month_count},
            'accountsSummary': accounts_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ IMPORT CUSTOMERS ------------------
@router.post('/import/customers')
async def import_customers(file: UploadFile = File(...), mode: str = 'skip'):
    """Import customers from Excel/CSV file"""
    try:
        import pandas as pd
        from io import BytesIO
        
        # Read file
        contents = await file.read()
        
        # Determine file type and read
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(contents))
        else:
            df = pd.read_excel(BytesIO(contents))
        
        # Expected columns: name, phone, email (optional), address (optional), vehicleBrand (optional), vehiclePlate (optional), vehicleKm (optional)
        created = updated = skipped = 0
        
        for _, row in df.iterrows():
            try:
                name = str(row.get('name', row.get('الاسم', ''))).strip()
                phone = str(row.get('phone', row.get('الجوال', row.get('رقم الجوال', '')))).strip()
                
                if not name or not phone:
                    skipped += 1
                    continue
                
                # Check if customer exists
                existing = await db.customers.find_one({'phone': phone})
                
                customer_data = {
                    'name': name,
                    'phone': phone,
                    'email': str(row.get('email', row.get('البريد', ''))) if pd.notna(row.get('email', row.get('البريد'))) else None,
                    'address': str(row.get('address', row.get('العنوان', ''))) if pd.notna(row.get('address', row.get('العنوان'))) else None,
                    'vehicleBrand': str(row.get('vehicleBrand', row.get('نوع المركبة', ''))) if pd.notna(row.get('vehicleBrand', row.get('نوع المركبة'))) else None,
                    'vehiclePlate': str(row.get('vehiclePlate', row.get('رقم اللوحة', ''))) if pd.notna(row.get('vehiclePlate', row.get('رقم اللوحة'))) else None,
                    'vehicleKm': int(row.get('vehicleKm', row.get('الكيلومتر', 0))) if pd.notna(row.get('vehicleKm', row.get('الكيلومتر'))) else 0
                }
                
                if existing:
                    if mode == 'update':
                        await db.customers.update_one(
                            {'id': existing['id']},
                            {'$set': customer_data}
                        )
                        updated += 1
                    else:
                        skipped += 1
                else:
                    from models import Customer
                    customer = Customer(
                        **customer_data,
                        vehicles=[],
                        totalVisits=0,
                        createdAt=datetime.utcnow()
                    )
                    await db.customers.insert_one(customer.dict())
                    created += 1
                    
            except Exception as e:
                print(f"Error processing row: {e}")
                skipped += 1
                continue
        
        return {
            'status': 'ok',
            'created': created,
            'updated': updated,
            'skipped': skipped,
            'total': len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ AUTH (OTP) ------------------
@router.post('/auth/request-otp')
async def request_otp(payload: Dict[str, Any]):
    try:
        phone = (payload or {}).get('phone') or ''
        if not phone:
            raise HTTPException(status_code=422, detail='phone required')
        
        # Normalize phone number - ensure it starts with country code
        norm = ''.join([c for c in phone if c.isdigit()])
        
        # Add Saudi country code if missing
        if norm.startswith('05') or norm.startswith('5'):
            # Remove leading 0 and add 966
            if norm.startswith('0'):
                norm = '966' + norm[1:]
            else:
                norm = '966' + norm
        elif not norm.startswith('966'):
            # If doesn't start with 966 and not 05x, add it anyway
            norm = '966' + norm
        
        # Generate random 6-digit OTP code
        import random
        code = str(random.randint(100000, 999999))
        
        token = str(uuid.uuid4())
        doc = {
            'id': str(uuid.uuid4()),
            'phone': norm,
            'code': code,
            'token': token,
            'purpose': 'login',
            'createdAt': datetime.utcnow(),
            'expiresAt': datetime.utcnow() + timedelta(minutes=5),
            'attempts': 0,
            'consumed': False
        }
        await db.otp_requests.insert_one(doc)
        
        # Send via WhatsApp service if available
        whatsapp_result = None
        if whatsapp_service:
            try:
                whatsapp_result = await whatsapp_service.send_otp(norm, code)
            except Exception as e:
                print(f"WhatsApp send error: {e}")
        
        # Always return deeplink as fallback
        whatsapp_text = f"رمز التحقق للدخول: {code}"
        import urllib.parse
        encoded_text = urllib.parse.quote(whatsapp_text)
        deeplink = f"https://wa.me/{norm}?text={encoded_text}"
        
        response = { 
            'token': token, 
            'whatsappDeeplink': deeplink
        }
        
        # Add WhatsApp send status if available
        if whatsapp_result:
            response['whatsappSent'] = whatsapp_result.get('success', False)
            response['deliveryMethod'] = whatsapp_result.get('delivery_method', 'deeplink')
            if whatsapp_result.get('message_id'):
                response['messageId'] = whatsapp_result['message_id']
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/auth/verify-otp')
async def verify_otp(payload: Dict[str, Any]):
    try:
        phone = (payload or {}).get('phone') or ''
        code = (payload or {}).get('code') or ''
        token = (payload or {}).get('token') or ''
        norm = ''.join([c for c in phone if c.isdigit()])
        req = await db.otp_requests.find_one({'phone': norm, 'token': token})
        if not req:
            raise HTTPException(status_code=400, detail='invalid token')
        if req.get('consumed'):
            raise HTTPException(status_code=400, detail='already used')
        if req.get('expiresAt') and req['expiresAt'] < datetime.utcnow():
            raise HTTPException(status_code=400, detail='expired')
        if str(code) != str(req.get('code')):
            await db.otp_requests.update_one({'id': req['id']}, {'$inc': {'attempts': 1}})
            raise HTTPException(status_code=400, detail='invalid code')
        await db.otp_requests.update_one({'id': req['id']}, {'$set': {'consumed': True}})
        session = { 'id': str(uuid.uuid4()), 'phone': norm, 'role': 'admin' }
        user = { 'id': str(uuid.uuid4()), 'name': 'Admin', 'phone': norm, 'role': 'admin' }
        return { 'session': session, 'user': user }
    except HTTPException:
        raise
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
        for b in bills:
            b.pop('_id', None)
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
        await db.templates.count_documents({})
    except Exception:
        pass
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


# ------------------ TEMPLATES CRUD ------------------
@router.get('/templates')
async def get_templates():
    """Get all templates"""
    try:
        templates = await db.templates.find({}).to_list(length=1000)
        for t in templates:
            t.pop('_id', None)
            if t.get('updatedAt') and hasattr(t['updatedAt'], 'isoformat'):
                t['updatedAt'] = t['updatedAt'].isoformat()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/templates')
async def create_template(payload: Dict[str, Any]):
    """Create new template"""
    try:
        doc = TemplateDoc(
            name=payload.get('name', 'نموذج جديد'),
            type=payload.get('type', 'invoice'),
            language=payload.get('language', 'ar'),
            html=payload.get('html', ''),
            isActive=payload.get('isActive', True)
        )
        await db.templates.insert_one(doc.dict())
        doc_dict = doc.dict()
        doc_dict.pop('_id', None) if '_id' in doc_dict else None
        return doc_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/templates/{template_id}')
async def update_template(template_id: str, payload: Dict[str, Any]):
    """Update template"""
    try:
        update_data = {}
        if 'name' in payload:
            update_data['name'] = payload['name']
        if 'html' in payload:
            update_data['html'] = payload['html']
        if 'type' in payload:
            update_data['type'] = payload['type']
        if 'isActive' in payload:
            update_data['isActive'] = payload['isActive']
        

        update_data['updatedAt'] = datetime.utcnow()
        result = await db.templates.update_one({'id': template_id}, {'$set': update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Template not found')
        updated = await db.templates.find_one({'id': template_id})
        updated.pop('_id', None)
        if updated.get('updatedAt') and hasattr(updated['updatedAt'], 'isoformat'):
            updated['updatedAt'] = updated['updatedAt'].isoformat()
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/templates/{template_id}/make-default')
async def make_default_template(template_id: str):
    """Set a template as default (isActive=True) and deactivate other templates of the same type."""
    try:
        tpl = await db.templates.find_one({'id': template_id})
        if not tpl:
            raise HTTPException(status_code=404, detail='Template not found')
        ttype = tpl.get('type')
        # Deactivate others of same type
        await db.templates.update_many({'type': ttype, 'id': {'$ne': template_id}}, {'$set': {'isActive': False, 'updatedAt': datetime.utcnow()}})
        # Activate this one
        await db.templates.update_one({'id': template_id}, {'$set': {'isActive': True, 'updatedAt': datetime.utcnow()}})
        updated = await db.templates.find_one({'id': template_id})
        updated.pop('_id', None)
        if updated.get('updatedAt') and hasattr(updated['updatedAt'], 'isoformat'):
            updated['updatedAt'] = updated['updatedAt'].isoformat()
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# CLEAN START

        updated = await db.templates.find_one({'id': template_id})
        updated.pop('_id', None)
        if updated.get('updatedAt'):
            updated['updatedAt'] = updated['updatedAt'].isoformat()
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/templates/mechanic-default')
async def get_mechanic_default_template(t: Optional[str] = None):
    """Return mechanic default HTML to help users start a new template quickly.
    Query param t can be: invoice, diagnosis, quote, receipt (optional)"""
    try:
        from pathlib import Path
        p = Path(__file__).parent / 'invoice_template_mechanic.html'
        if not p.exists():
            raise HTTPException(status_code=404, detail='invoice_template_mechanic.html not found')
        html = p.read_text(encoding='utf-8')
        return {'type': (t or 'invoice'), 'html': html}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete('/templates/{template_id}')
async def delete_template(template_id: str):
    """Delete template"""
    try:
        result = await db.templates.delete_one({'id': template_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Template not found')
        return {'status': 'ok', 'deleted': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/templates/{template_id}/apply-to-all')
async def apply_template_to_all_types(template_id: str, types: Optional[List[str]] = Body(default=None)):
    """Copy template HTML to multiple types (invoice/diagnosis/quote) and set as active default for each."""
    try:
        tpl = await db.templates.find_one({'id': template_id})
        if not tpl:
            raise HTTPException(status_code=404, detail='Template not found')
        html = tpl.get('html') or tpl.get('content') or ''
        target_types = types or ['invoice', 'diagnosis', 'quote']
        activated = []
        for t in target_types:
            existing = await db.templates.find_one({'type': t, 'isActive': True})
            active_id = None
            if existing:
                await db.templates.update_one({'id': existing['id']}, {'$set': {'html': html, 'isActive': True, 'updatedAt': datetime.utcnow(), 'name': tpl.get('name', 'نموذج')}})
                active_id = existing['id']
            else:
                new_doc = TemplateDoc(name=tpl.get('name', 'نموذج'), type=t, language=tpl.get('language', 'ar'), html=html, isActive=True)
                await db.templates.insert_one(new_doc.dict())
                active_id = new_doc.id
            await db.templates.update_many({'type': t, 'id': {'$ne': active_id}}, {'$set': {'isActive': False}})
            activated.append(t)
        return {'status': 'ok', 'applied_types': activated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/templates/seed-mechanic-apply-all')
async def seed_mechanic_apply_all():
    """Read mechanic invoice file and apply as default HTML for invoice/diagnosis/quote/receipt."""
    try:
        from pathlib import Path
        template_path = Path(__file__).parent / 'invoice_template_mechanic.html'
        if not template_path.exists():
            raise HTTPException(status_code=404, detail='Mechanic template file not found')
        html_content = template_path.read_text(encoding='utf-8')
        types = ['invoice', 'diagnosis', 'quote', 'receipt']
        applied = []
        for t in types:
            existing = await db.templates.find_one({'type': t, 'isActive': True})
            if existing:
                await db.templates.update_one({'id': existing['id']}, {'$set': {'html': html_content, 'isActive': True, 'updatedAt': datetime.utcnow(), 'name': 'قالب الميكانيكا الافتراضي'}})
                active_id = existing['id']
            else:
                doc = TemplateDoc(name='قالب الميكانيكا الافتراضي', type=t, language='ar', html=html_content, isActive=True)
                await db.templates.insert_one(doc.dict())
                active_id = doc.id
            await db.templates.update_many({'type': t, 'id': {'$ne': active_id}}, {'$set': {'isActive': False}})
            applied.append(t)
        # Mark settings flag so we don't reapply automatically later
        await db.settings.update_one({'id': 'app_settings'}, {'$set': {'id': 'app_settings', 'mechanicTemplateApplied': True, 'updatedAt': datetime.utcnow()}}, upsert=True)
        return {'status': 'ok', 'applied_types': applied}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/print/resolve-template')
async def resolve_print_template(payload: Dict[str, Any]):
    try:
        override_type = payload.get('override_type')
        template_id = payload.get('template_id')
        
        # If template_id provided, use it
        if template_id:
            template = await db.templates.find_one({'id': template_id})
            if template:
                template.pop('_id', None)
                return {'type': override_type, 'template': template}
        
        # Otherwise find by type
        if override_type:
            template = await db.templates.find_one({'type': override_type, 'isActive': True})
            if template:
                template.pop('_id', None)
                return {'type': override_type, 'template': template}
        
        # Fallback to defaults
        await _ensure_templates()
        template = await db.templates.find_one({'type': override_type, 'isActive': True})
        if template:
            template.pop('_id', None)
            return {'type': override_type, 'template': template}
        
        raise HTTPException(status_code=404, detail='No template found')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/seed/add-mechanic-template')
async def add_mechanic_invoice_template():
    """Add professional mechanic invoice template from image"""
    try:
        from pathlib import Path
        template_path = Path(__file__).parent / "invoice_template_mechanic.html"
        
        if template_path.exists():
            with open(template_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Check if already exists
            existing = await db.templates.find_one({
                'name': 'فاتورة الميكانيكا الاحترافية',
                'type': 'invoice'
            })
            
            if not existing:
                doc = TemplateDoc(
                    name='فاتورة الميكانيكا الاحترافية',
                    type='invoice',
                    language='ar',
                    html=html_content,
                    isActive=True
                )
                await db.templates.insert_one(doc.dict())
                return {'status': 'ok', 'message': 'Template added successfully'}
            else:
                # Update existing
                await db.templates.update_one(
                    {'id': existing['id']},
                    {'$set': {'html': html_content, 'updatedAt': datetime.utcnow()}}
                )
                return {'status': 'ok', 'message': 'Template updated successfully'}
        else:
            raise HTTPException(status_code=404, detail='Template file not found')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        # Support new fields: category, unit
        name = it.get('name', '')
        category = it.get('category', '')
        unit = it.get('unit', '')
        qty = it.get('qty') or it.get('quantity') or 1
        price = it.get('price') or 0
        total = it.get('total') or (qty * price)
        rows.append(f"<tr><td>{name}</td><td>{category}</td><td>{unit}</td><td>{qty}</td><td>{price}</td><td>{total}</td></tr>")
    return "".join(rows)

@router.post('/print/render')
async def print_render(payload: Dict[str, Any] = Body(...)):
    try:
        override_type = payload.get('override_type') or payload.get('type') or 'invoice'
        template_id = payload.get('template_id')
        data = payload.get('data') or {}
        
        # Get template - prioritize template_id if provided

        # Prepare items
        items = data.get('items') or []
        rows_html = _render_items_rows(items)
        html = html.replace('{{ITEMS_ROWS}}', rows_html).replace('{{ITEMS_LIST}}', rows_html).replace('{{QUOTE_ITEMS}}', rows_html)

        # Replace simple placeholders
        for k, v in data.items():
            try:
                html = html.replace('{{'+str(k)+'}}', str(v))
            except Exception:
                pass
        return {'html': html}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ WORKSHOP PROFILE ------------------
@router.get('/profile')
async def get_profile():
    try:
        doc = await db.settings.find_one({'id': 'workshop_profile'})
        if not doc:
            return {
                'name': '', 'nameEnglish': '', 'logo': '', 'phone': '', 'whatsapp': '', 'email': '',
                'address': '', 'city': '', 'postalCode': '', 'taxNumber': '', 'commercialRegister': '',
                'bankAccount': '', 'iban': '', 'workingHours': '', 'invoiceFooter': '', 'termsAndConditions': ''
            }
        doc.pop('_id', None)
        return doc.get('data') if 'data' in doc else doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/profile')
async def update_profile(payload: Dict[str, Any]):
    try:
        await db.settings.update_one(
            {'id': 'workshop_profile'},
            {'$set': {'id': 'workshop_profile', 'data': payload, 'updatedAt': datetime.utcnow()}},
            upsert=True
        )
        return {'status': 'ok'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ SERVICES ------------------
@router.get('/services')
async def list_services():
    try:
        rows = await db.services.find({}).sort('createdAt', -1).to_list(length=1000)
        for r in rows:
            r.pop('_id', None)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/services')
async def create_service(payload: Dict[str, Any]):
    try:
        import uuid
        doc = {
            'id': str(uuid.uuid4()),
            'name': payload.get('name', '').strip(),
            'category': payload.get('category', '').strip(),
            'price': float(payload.get('price') or 0),
            'duration': int(payload.get('duration') or 0),
            'createdAt': datetime.utcnow()
        }
        if not doc['name']:
            raise HTTPException(status_code=422, detail='name required')
        await db.services.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete('/services/{sid}')
async def delete_service(sid: str):
    try:
        res = await db.services.delete_one({'id': sid})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Service not found')
        return {'status': 'ok'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PARTS (minimal) ------------------
@router.get('/parts')
async def list_parts():
    try:
        rows = await db.parts.find({}).sort('createdAt', -1).to_list(length=5000)
        for r in rows:
            r.pop('_id', None)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ OPERATIONS list/create ------------------
@router.get('/operations')
async def list_operations():
    try:
        rows = await db.operations.find({}).sort('date', -1).to_list(length=1000)
        for r in rows:
            r.pop('_id', None)
            if r.get('date') and hasattr(r['date'], 'isoformat'):
                r['date'] = r['date'].isoformat()
            # compute total if missing
            if 'total' not in r:
                r['total'] = sum(float(i.get('total') or (float(i.get('price') or 0) * float(i.get('quantity') or i.get('qty') or 1))) for i in (r.get('items') or []))
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/operations')
async def create_operation(payload: Dict[str, Any]):
    try:
        import uuid
        items = payload.get('items') or []
        # Normalize items and preserve service rows
        norm_items = []
        for it in items:
            name = (it.get('name') or '').strip()
            qty = float(it.get('quantity') or it.get('qty') or 1)
            price = float(it.get('price') or 0)
            total = float(it.get('total') or (qty * price))
            norm_items.append({
                'itemType': it.get('itemType') or ('service' if not it.get('itemId') else 'part'),
                'itemId': it.get('itemId') or None,
                'name': name,
                'quantity': qty,
                'price': price,
                'total': total
            })
        total = sum(i['total'] for i in norm_items)
        doc = {
            'id': str(uuid.uuid4()),
            'accountId': payload.get('accountId'),
            'type': payload.get('type', 'purchase'),
            'partnerType': payload.get('partnerType'),
            'partnerName': payload.get('partnerName'),
            'items': norm_items,
            'paymentMethod': payload.get('paymentMethod', 'cash'),
            'notes': payload.get('notes', ''),
            'total': total,
            'date': datetime.utcnow()
        }
        await db.operations.insert_one(doc)
        doc.pop('_id', None)
        doc['date'] = doc['date'].isoformat()
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

        html = None
        if template_id:
            tpl = await db.templates.find_one({'id': template_id})
            if tpl:
                html = tpl.get('html')
        
        # Fallback to type-based lookup
        if not html:
            await _ensure_templates()
            tpl = await db.templates.find_one({'type': override_type, 'isActive': True})
            html = (tpl.get('html') if tpl else DEFAULT_TEMPLATES.get(override_type)) or '<html><body>{{CONTENT}}</body></html>'

        # Prepare items
        items = data.get('items') or []
        rows_html = _render_items_rows(items)
        # Replace multiple placeholders that templates may use
        html = html.replace('{{ITEMS_ROWS}}', rows_html)
        html = html.replace('{{ITEMS_LIST}}', rows_html)
        html = html.replace('{{QUOTE_ITEMS}}', rows_html)

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

# ------------------ APPROVALS (Customer Approval Requests) ------------------
@router.post('/approvals')
async def create_approval(payload: Dict[str, Any]):
    """Create customer approval request with token"""
    try:
        from models_extended import ApprovalRequest
        vehicle_id = payload.get('vehicleId')
        customer_id = payload.get('customerId')
        title = payload.get('title', 'طلب اعتماد')
        amount = float(payload.get('amount', 0))
        
        token = f"APR-{str(uuid.uuid4())[:8].upper()}"
        expires_at = datetime.utcnow() + timedelta(days=7)
        
        approval = ApprovalRequest(
            token=token,
            vehicleId=vehicle_id,
            customerId=customer_id,
            title=title,
            amount=amount,
            status='pending',
            expiresAt=expires_at
        )
        doc = approval.dict()
        await db.approval_requests.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/approvals')
async def list_approvals(vehicle_id: Optional[str] = None):
    """List approval requests, optionally filtered by vehicle_id"""
    try:
        query = {}
        if vehicle_id:
            query['vehicleId'] = vehicle_id
        docs = await db.approval_requests.find(query).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
            if d.get('createdAt'):
                d['createdAt'] = d['createdAt'].isoformat()
            if d.get('expiresAt'):
                d['expiresAt'] = d['expiresAt'].isoformat()
            if d.get('respondedAt'):
                d['respondedAt'] = d['respondedAt'].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/approvals/public/{token}')
async def get_public_approval(token: str):
    """Get approval request by token for public view"""
    try:
        doc = await db.approval_requests.find_one({'token': token})
        if not doc:
            raise HTTPException(status_code=404, detail='رابط غير صحيح')
        if doc.get('revoked'):
            raise HTTPException(status_code=410, detail='تم إلغاء الطلب')
        if doc.get('expiresAt') and doc['expiresAt'] < datetime.utcnow():
            raise HTTPException(status_code=410, detail='انتهت صلاحية الرابط')
        doc.pop('_id', None)
        if doc.get('createdAt'):
            doc['createdAt'] = doc['createdAt'].isoformat()
        if doc.get('expiresAt'):
            doc['expiresAt'] = doc['expiresAt'].isoformat()
        if doc.get('respondedAt'):
            doc['respondedAt'] = doc['respondedAt'].isoformat()
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/approvals/public/{token}/respond')
async def respond_to_approval(token: str, payload: Dict[str, Any]):
    """Customer responds to approval request"""
    try:
        status = payload.get('status', 'approved')  # approved, rejected, deferred, requote
        name = payload.get('name', '')
        phone = payload.get('phone', '')
        notes = payload.get('notes', '')
        
        doc = await db.approval_requests.find_one({'token': token})
        if not doc:
            raise HTTPException(status_code=404, detail='رابط غير صحيح')
        if doc.get('revoked'):
            raise HTTPException(status_code=410, detail='تم إلغاء الطلب')
        if doc.get('expiresAt') and doc['expiresAt'] < datetime.utcnow():
            raise HTTPException(status_code=410, detail='انتهت صلاحية الرابط')
        
        update = {
            'status': status,
            'respondedAt': datetime.utcnow(),
            'responderName': name,
            'responderPhone': phone,
            'notes': notes
        }
        await db.approval_requests.update_one({'token': token}, {'$set': update})
        
        updated_doc = await db.approval_requests.find_one({'token': token})
        updated_doc.pop('_id', None)
        if updated_doc.get('createdAt'):
            updated_doc['createdAt'] = updated_doc['createdAt'].isoformat()
        if updated_doc.get('expiresAt'):
            updated_doc['expiresAt'] = updated_doc['expiresAt'].isoformat()
        if updated_doc.get('respondedAt'):
            updated_doc['respondedAt'] = updated_doc['respondedAt'].isoformat()
        return updated_doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/approvals/{approval_id}/revoke')
async def revoke_approval(approval_id: str):
    """Revoke an approval request"""
    try:
        result = await db.approval_requests.update_one(
            {'id': approval_id},
            {'$set': {'revoked': True}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='not found')
        return {'status': 'ok', 'revoked': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ NOTIFICATIONS (WhatsApp Helpers) ------------------
@router.post('/notifications/prepare')
async def prepare_notification(payload: Dict[str, Any]):
    """Prepare WhatsApp notification with phone normalization"""
    try:
        notif_type = payload.get('type', 'generic')
        phone = payload.get('phone', '')
        link = payload.get('link', '')
        
        # Normalize phone: remove all non-digits, then ensure it starts with country code
        norm = ''.join([c for c in phone if c.isdigit()])
        # If starts with +966, already has country code
        if phone.startswith('+966'):
            norm = norm  # already correct
        elif norm.startswith('966'):
            pass  # already correct
        elif norm.startswith('05') or norm.startswith('5'):
            # Add Saudi country code
            if norm.startswith('0'):
                norm = '966' + norm[1:]
            else:
                norm = '966' + norm
        
        # Build message based on type
        if notif_type == 'approval':
            message = f"السلام عليكم،\nلديك طلب اعتماد جديد:\n{link}"
        elif notif_type == 'tracking':
            message = f"السلام عليكم،\nلتتبع حالة مركبتك:\n{link}"
        else:
            message = f"رسالة من الورشة:\n{link}"
        
        # Encode message for URL
        import urllib.parse
        encoded_message = urllib.parse.quote(message)
        whatsapp_deeplink = f"https://wa.me/{norm}?text={encoded_message}"
        return {"whatsappDeeplink": whatsapp_deeplink, "normalizedPhone": norm, "message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ CEO: Chart of Accounts ------------------

DEFAULT_ACCOUNTS = [
    {"name": "الإيرادات", "code": "revenue", "type": "group", "children": [
        {"name": "الخدمات", "code": "service_revenue", "type": "revenue"},
        {"name": "بيع قطع الغيار", "code": "parts_sale", "type": "revenue"}
    ]},
    {"name": "المصروفات", "code": "expenses", "type": "group", "children": [
        {"name": "مشتريات قطع الغيار", "code": "parts_purchase", "type": "expense"},
        {"name": "مصروفات تشغيلية", "code": "operational", "type": "group", "children": [
            {"name": "رواتب", "code": "salaries", "type": "expense"},
            {"name": "إيجار", "code": "rent", "type": "expense"},
            {"name": "كهرباء/ماء", "code": "utilities", "type": "expense"},
            {"name": "وقود", "code": "fuel", "type": "expense"},
            {"name": "أدوات", "code": "tools", "type": "expense"},
            {"name": "متفرقات", "code": "misc", "type": "expense"}
        ]}
    ]}
]

async def _seed_accounts_for_branch(branch_id: str):
    # Check if already seeded
    existing = await db.chart_accounts.find_one({"branchId": branch_id})
    if existing:
        return 0
    created = 0
    async def insert_node(node, parent_id=None, path=None):
        nonlocal created
        import uuid
        nid = str(uuid.uuid4())
        doc = {
            "id": nid,
            "name": node["name"],
            "code": node.get("code"),
            "type": node.get("type", "group"),
            "parentId": parent_id,
            "branchId": branch_id,
            "path": (path or []) + [nid],
            "createdAt": datetime.utcnow()
        }
        await db.chart_accounts.insert_one(doc)
        created += 1
        for ch in node.get("children", []) or []:
            await insert_node(ch, nid, doc["path"])
    for root in DEFAULT_ACCOUNTS:
        await insert_node(root)
    return created

@router.post('/ceo/seed-accounts')
async def seed_chart_accounts(account_id: Optional[str] = None):
    try:
        created = 0
        if account_id:
            created += await _seed_accounts_for_branch(account_id)
        else:
            accounts = await db.business_accounts.find({"isActive": True}).to_list(length=1000)
            for a in accounts:
                created += await _seed_accounts_for_branch(a['id'])
        return {"status": "ok", "created": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/ceo/accounts')
async def list_chart_accounts(branch: Optional[str] = None):
    try:
        q = {"branchId": branch} if branch else {}
        rows = await db.chart_accounts.find(q).to_list(length=5000)
        for r in rows:
            r.pop('_id', None)
        return {"items": rows, "count": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _map_tx_to_code(tx: Dict[str, Any]) -> Optional[str]:
    cat = (tx.get('category') or '').lower()
    typ = (tx.get('type') or '').lower()
    if typ == 'income':
        if cat in ('service','services','service_income'):
            return 'service_revenue'
        if cat in ('parts_sale','sale','sales','parts'):
            return 'parts_sale'
    if typ == 'expense':
        if cat in ('parts_purchase','purchase','parts'):
            return 'parts_purchase'
        if cat in ('salaries','salary','payroll'):
            return 'salaries'
        if cat in ('rent',):
            return 'rent'
        if cat in ('utilities','electricity','water'):
            return 'utilities'
        if cat in ('fuel','gas'):
            return 'fuel'
        if cat in ('tools','equipment'):
            return 'tools'
        if cat in ('misc','other'):
            return 'misc'
    return None

@router.get('/ceo/accounts/{node_id}/summary')
async def chart_account_summary(node_id: str, branch: Optional[str] = None, period: Optional[str] = None):
    try:
        node = await db.chart_accounts.find_one({'id': node_id})
        if not node:
            raise HTTPException(status_code=404, detail='account node not found')
        # Collect codes under this node
        descendants = await db.chart_accounts.find({'branchId': node['branchId']}).to_list(length=5000)
        for d in descendants:
            d.pop('_id', None)
        allowed_codes = set()
        def collect(nid):
            for d in descendants:
                if d['id'] == nid:
                    if d.get('code'):
                        allowed_codes.add(d['code'])
                    # children
                    for c in descendants:
                        if c.get('parentId') == nid:
                            collect(c['id'])
        collect(node_id)
        # Query transactions
        tq: Dict[str, Any] = {}
        if branch:
            tq['accountId'] = branch
        else:
            tq['accountId'] = node['branchId']
        if period:
            # period format YYYY-MM
            start = datetime.fromisoformat(period + '-01')
            from datetime import timedelta
            next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            tq['date'] = {"$gte": start, "$lt": next_month}
        txs = await db.transactions.find(tq).to_list(length=50000)
        total_income = total_expense = 0.0
        by_code = {}
        for t in txs:
            code = _map_tx_to_code(t)
            if code and code in allowed_codes:
                amt = float(t.get('amount') or 0)
                if (t.get('type') or '').lower() == 'income':
                    total_income += amt
                else:
                    total_expense += amt
                by_code[code] = by_code.get(code, 0.0) + amt
        return {
            'node': {k:v for k,v in node.items() if k != '_id'},
            'period': period,
            'income': total_income,
            'expense': total_expense,
            'net': total_income - total_expense,
            'byCode': by_code
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/ceo/accounts/{node_id}/ai-analysis')
async def chart_account_ai(node_id: str, question: Optional[str] = None):
    try:
        node = await db.chart_accounts.find_one({'id': node_id})
        if not node:
            raise HTTPException(status_code=404, detail='account node not found')
        # Build summary context quickly
        summary = await chart_account_summary(node_id)
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        import uuid
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        provider = (os.getenv('DEFAULT_AI_PROVIDER') or 'anthropic').lower()
        model = 'gpt-5' if provider == 'openai' else 'claude-3-7-sonnet-20250219'
        sysmsg = f"""
أنت محلل مالي للورش.
العقد: {node.get('name')} ({node.get('code')})
الملخص: الدخل {summary['income']:.2f}، المصروف {summary['expense']:.2f}، صافي {summary['net']:.2f}
حسب الرموز: {summary['byCode']}
قدم توصيات مختصرة قابلة للتنفيذ.
"""
        chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=sysmsg).with_model(provider, model)
        resp = await chat.send_message(UserMessage(text=question or 'حلّل هذا الحساب وقدّم توصيات.'))
        return {'analysis': resp, 'summary': summary}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ WHATSAPP MESSAGING APIs ------------------
whatsapp_service = None

def init_whatsapp_service(database):
    """Initialize WhatsApp service with database"""
    global whatsapp_service
    from whatsapp_service import WhatsAppService
    whatsapp_service = WhatsAppService(database)
    return whatsapp_service

@router.post('/whatsapp/send-otp')
async def send_otp_whatsapp(payload: Dict[str, Any]):
    """Send OTP via WhatsApp"""
    try:
        phone = payload.get('phone')
        code = payload.get('code')
        
        if not phone or not code:
            raise HTTPException(status_code=422, detail='phone and code required')
        
        if not whatsapp_service:
            raise HTTPException(status_code=500, detail='WhatsApp service not initialized')
        
        result = await whatsapp_service.send_otp(phone, code)
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error', 'Failed to send'))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/whatsapp/send-approval')
async def send_approval_whatsapp(payload: Dict[str, Any]):
    """Send approval request via WhatsApp"""
    try:
        phone = payload.get('phone')
        customer_name = payload.get('customerName', 'العميل')
        title = payload.get('title', 'طلب اعتماد')
        amount = float(payload.get('amount', 0))
        approval_link = payload.get('approvalLink')
        
        if not phone or not approval_link:
            raise HTTPException(status_code=422, detail='phone and approvalLink required')
        
        if not whatsapp_service:
            raise HTTPException(status_code=500, detail='WhatsApp service not initialized')
        
        result = await whatsapp_service.send_approval_request(
            phone=phone,
            customer_name=customer_name,
            title=title,
            amount=amount,
            approval_link=approval_link
        )
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error', 'Failed to send'))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/whatsapp/send-document')
async def send_document_whatsapp(payload: Dict[str, Any]):
    """Send document (invoice, diagnosis, quote, receipt) via WhatsApp"""
    try:
        phone = payload.get('phone')
        customer_name = payload.get('customerName', 'العميل')
        document_type = payload.get('documentType', 'invoice')
        vehicle_plate = payload.get('vehiclePlate', '')
        tracking_link = payload.get('trackingLink')
        
        if not phone or not tracking_link:
            raise HTTPException(status_code=422, detail='phone and trackingLink required')
        
        if not whatsapp_service:
            raise HTTPException(status_code=500, detail='WhatsApp service not initialized')
        
        result = await whatsapp_service.send_document(
            phone=phone,
            customer_name=customer_name,
            document_type=document_type,
            vehicle_plate=vehicle_plate,
            tracking_link=tracking_link
        )
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result.get('error', 'Failed to send'))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/whatsapp/messages')
async def get_whatsapp_messages(
    phone: Optional[str] = None,
    message_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get list of sent WhatsApp messages"""
    try:
        if not whatsapp_service:
            raise HTTPException(status_code=500, detail='WhatsApp service not initialized')
        
        messages = await whatsapp_service.get_messages(
            phone=phone,
            message_type=message_type,
            status=status,
            limit=limit
        )
        
        return {'messages': messages, 'count': len(messages)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/whatsapp/messages/{message_id}')
async def get_whatsapp_message_status(message_id: str):
    """Get status of specific WhatsApp message"""
    try:
        if not whatsapp_service:
            raise HTTPException(status_code=500, detail='WhatsApp service not initialized')
        
        message = await whatsapp_service.get_message_status(message_id)
        
        if not message:
            raise HTTPException(status_code=404, detail='Message not found')
        
        return message
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/whatsapp/status')
async def get_whatsapp_service_status():
    """Get WhatsApp service configuration status"""
    try:
        if not whatsapp_service:
            return {
                'initialized': False,
                'twilio_enabled': False,
                'delivery_method': 'none'
            }
        
        return {
            'initialized': True,
            'twilio_enabled': whatsapp_service.twilio_enabled,
            'delivery_method': 'twilio' if whatsapp_service.twilio_enabled else 'deeplink'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



