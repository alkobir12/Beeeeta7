from fastapi import APIRouter, HTTPException, UploadFile, File, Body, Request
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncio
from starlette.responses import StreamingResponse

from models_extended import (
    BusinessAccount, Operation, Budget, CustomerReceipt, TemplateDoc,
)
from models import Customer, Service

router = APIRouter(prefix="/api")

db = None

# In-memory subscribers for approvals SSE
approvals_subscribers: set = set()


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
                            {"path": "/knowledge", "label": "إدارة المعرفة AI", "enabled": True},
                            {"path": "/references", "label": "المراجع الفنية", "enabled": True}
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
            "customers": customers_count,
            "services": services_count,
            "suppliers": suppliers_count,
            "parts": parts_count,
            "lowStock": low_stock,
            "outOfStock": out_stock,
            "stockValue": stock_value,
            "categories": categories,
            "sales30": sales_total,
            "purchases30": purchases_total,
            "income30": income,
            "expense30": expense,
            "profit30": profit,
            "newCustomersThisMonth": cust_new,
            "customersWithPhone": cust_has_phone,
            "customersWithEmail": cust_has_email
        }
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
            for it in items:
                if it.itemType == 'part' and it.itemId:
                    await db.parts.update_one({'id': it.itemId}, {'$inc': {'quantity': int(it.quantity)}})
        elif operation.type == 'sale':
            for it in items:
                if it.itemType == 'part' and it.itemId:
                    await db.parts.update_one({'id': it.itemId}, {'$inc': {'quantity': -int(it.quantity)}})
        # Auto-create transaction
        try:
            transaction = {
                'id': str(uuid.uuid4()),
                'accountId': operation.accountId,
                'type': 'income' if operation.type == 'sale' else 'expense',
                'category': f"operation_{operation.type}",
                'amount': subtotal,
                'description': f"{operation.type} - {operation.partnerName or 'عملية'}",
                'date': datetime.utcnow(),
                'reference': operation.id,
                'createdAt': datetime.utcnow()
            }
            await db.transactions.insert_one(transaction)
        except Exception as e:
            print(f"⚠️ Failed to create transaction: {e}")
        doc.pop('_id', None)
        if doc.get('date'):
            doc['date'] = doc['date'].isoformat()
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ DELETE ALL OPERATIONS ------------------
@router.delete('/operations/clear-all')
async def clear_all_operations():
    """Delete all operations - use with caution"""
    try:
        result = await db.operations.delete_many({})
        return {'status': 'ok', 'deleted': result.deleted_count}
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
        # Get all operations (sales and purchases)
        query_filter = {}
        if account_id:
            query_filter['accountId'] = account_id
        all_operations = await db.operations.find(query_filter).to_list(length=10000)
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
        # Calculate sales analytics
        today_sales = 0
        week_sales = 0
        month_sales = 0
        today_sales_count = 0
        week_sales_count = 0
        month_sales_count = 0
        # Calculate expenses (purchases) analytics
        today_expenses = 0
        week_expenses = 0
        month_expenses = 0
        today_expenses_count = 0
        week_expenses_count = 0
        month_expenses_count = 0
        for op in all_operations:
            op_date = parse_date(op)
            if not op_date:
                continue
            total = float(op.get('total', 0))
            op_type = op.get('type')
            if op_type == 'sale':
                if op_date >= today:
                    today_sales += total
                    today_sales_count += 1
                if op_date >= week_ago:
                    week_sales += total
                    week_sales_count += 1
                if op_date >= month_start:
                    month_sales += total
                    month_sales_count += 1
            elif op_type == 'purchase':
                if op_date >= today:
                    today_expenses += total
                    today_expenses_count += 1
                if op_date >= week_ago:
                    week_expenses += total
                    week_expenses_count += 1
                if op_date >= month_start:
                    month_expenses += total
                    month_expenses_count += 1
        # Calculate profit
        today_profit = today_sales - today_expenses
        week_profit = week_sales - week_expenses
        month_profit = month_sales - month_expenses
        # Get all accounts summary
        accounts_summary = []
        try:
            all_accounts_list = await db.business_accounts.find({'isActive': True}).to_list(length=100)
            for acc in all_accounts_list:
                acc_id = acc.get('id')
                if not acc_id:
                    continue
                # Filter operations for this account
                acc_ops = [op for op in all_operations if op.get('accountId') == acc_id]
                acc_today_sales = 0
                acc_week_sales = 0
                acc_month_sales = 0
                acc_today_expenses = 0
                acc_week_expenses = 0
                acc_month_expenses = 0
                acc_today_count = 0
                acc_week_count = 0
                acc_month_count = 0
                for op in acc_ops:
                    op_date = parse_date(op)
                    if not op_date:
                        continue
                    total = float(op.get('total', 0))
                    op_type = op.get('type')
                    if op_date >= today:
                        if op_type == 'sale':
                            acc_today_sales += total
                        elif op_type == 'purchase':
                            acc_today_expenses += total
                        acc_today_count += 1
                    if op_date >= week_ago:
                        if op_type == 'sale':
                            acc_week_sales += total
                        elif op_type == 'purchase':
                            acc_week_expenses += total
                        acc_week_count += 1
                    if op_date >= month_start:
                        if op_type == 'sale':
                            acc_month_sales += total
                        elif op_type == 'purchase':
                            acc_month_expenses += total
                        acc_month_count += 1
                accounts_summary.append({
                    'id': acc_id,
                    'name': acc.get('name', 'Unknown'),
                    'todaySales': acc_today_sales,
                    'weekSales': acc_week_sales,
                    'monthSales': acc_month_sales,
                    'todayExpenses': acc_today_expenses,
                    'weekExpenses': acc_week_expenses,
                    'monthExpenses': acc_month_expenses,
                    'todayProfit': acc_today_sales - acc_today_expenses,
                    'weekProfit': acc_week_sales - acc_week_expenses,
                    'monthProfit': acc_month_sales - acc_month_expenses,
                    'todayCount': acc_today_count,
                    'weekCount': acc_week_count,
                    'monthCount': acc_month_count
                })
        except Exception as ex:
            print(f"⚠️ Accounts summary error: {ex}")
            import traceback
            traceback.print_exc()
        return {
            'today': {
                'sales': today_sales, 
                'expenses': today_expenses,
                'profit': today_profit,
                'salesCount': today_sales_count,
                'expensesCount': today_expenses_count
            },
            'week': {
                'sales': week_sales,
                'expenses': week_expenses,
                'profit': week_profit,
                'salesCount': week_sales_count,
                'expensesCount': week_expenses_count
            },
            'month': {
                'sales': month_sales,
                'expenses': month_expenses,
                'profit': month_profit,
                'salesCount': month_sales_count,
                'expensesCount': month_expenses_count
            },
            'accountsSummary': accounts_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ CEO MULTI-ACCOUNT AI ANALYSIS ------------------
@router.post('/ceo/ai-analysis-multi')
async def ceo_ai_analysis_multi(payload: Dict[str, Any] = Body(...)):
    """Aggregate metrics across multiple business accounts and optionally return AI insights.
    Expected payload: { accountIds: [str], question: str, days: int? }
    Response: { accounts: [...], totals: {...}, ai: {answer, model}? }
    """
    try:
        account_ids = (payload or {}).get('accountIds') or []
        question = (payload or {}).get('question') or ''
        days = int((payload or {}).get('days') or 30)
        # Resolve accounts list
        if not account_ids:
            all_acc = await db.business_accounts.find({'isActive': True}).to_list(length=1000)
            account_ids = [a.get('id') for a in all_acc if a.get('id')]
        account_ids = [a for a in account_ids if a]
        if not account_ids:
            return {"accounts": [], "totals": {"income": 0.0, "expenses": 0.0, "profit": 0.0, "profitMargin": 0.0}, "ai": None}
        # Date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        # Fetch transactions in range for selected accounts
        tx = await db.transactions.find({
            'date': { '$gte': start_date, '$lte': end_date },
            'accountId': { '$in': account_ids }
        }).to_list(length=100000)
        # Compute per-account metrics
        per_account = []
        # Load account names
        acc_map = {}
        try:
            acc_docs = await db.business_accounts.find({'id': { '$in': account_ids }}).to_list(length=1000)
            acc_map = {a.get('id'): a.get('name', 'Account') for a in acc_docs}
        except Exception:
            acc_map = {a: 'Account' for a in account_ids}
        for acc_id in account_ids:
            acc_tx = [t for t in tx if t.get('accountId') == acc_id]
            income = sum(float(t.get('amount', 0)) for t in acc_tx if t.get('type') == 'income')
            expenses = sum(float(t.get('amount', 0)) for t in acc_tx if t.get('type') == 'expense')
            profit = income - expenses
            profit_margin = (profit / income * 100.0) if income > 0 else 0.0
            per_account.append({
                'id': acc_id,
                'name': acc_map.get(acc_id, 'Account'),
                'income': income,
                'expenses': expenses,
                'profit': profit,
                'profitMargin': profit_margin
            })
        totals_income = sum(a['income'] for a in per_account)
        totals_expenses = sum(a['expenses'] for a in per_account)
        totals_profit = totals_income - totals_expenses
        totals = {
            'income': totals_income,
            'expenses': totals_expenses,
            'profit': totals_profit,
            'profitMargin': (totals_profit / totals_income * 100.0) if totals_income > 0 else 0.0
        }
        ai_result = None
        if question:
            try:
                import os
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                llm_key = os.getenv('EMERGENT_LLM_KEY')
                if llm_key:
                    system_msg = (
                        "أنت مساعد المدير التنفيذي. حلّل بيانات الورشة عبر الفروع وقدّم قرارات عملية مختصرة بالعربية. "
                        "ركّز على الربحية والسيولة وتحسين التسعير وتقليص المصروفات عند الحاجة."
                    )
                    context_lines = [
                        f"فرع {a['name']}: إيرادات {a['income']:.0f}، مصروفات {a['expenses']:.0f}، ربح {a['profit']:.0f} (هامش {a['profitMargin']:.1f}%)"
                        for a in per_account
                    ]
                    context = "\n".join(context_lines)
                    user_text = f"السؤال: {question}\n\nالبيانات:\n{context}\n\nالرجاء إعطاء توصيات تنفيذية مختصرة (٥ نقاط كحد أقصى)."
                    chat = LlmChat(api_key=llm_key, session_id=str(uuid.uuid4()), system_message=system_msg).with_model(
                        'anthropic', 'claude-sonnet-4-20250514'
                    )
                    response_text = await chat.send_message(UserMessage(text=user_text))
                    ai_result = { 'answer': response_text, 'model': 'anthropic/claude-sonnet-4-20250514' }
            except Exception as e:
                print(f"AI analysis error: {e}")
                ai_result = None
        return {
            'accounts': per_account,
            'totals': totals,
            'periodDays': days,
            'ai': ai_result
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
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(contents))
        else:
            df = pd.read_excel(BytesIO(contents))
        created = updated = skipped = 0
        for _, row in df.iterrows():
            try:
                name = str(row.get('name', row.get('الاسم', ''))).strip()
                phone = str(row.get('phone', row.get('الجوال', row.get('رقم الجوال', '')))).strip()
                if not name or not phone:
                    skipped += 1
                    continue
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
        raise HTTPException(status_code=500, detail:str(e))

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

@router.get('/customers/{customer_id}/approvals')
async def list_customer_approvals(customer_id: str):
    """List approval requests for a given customer"""
    try:
        docs = await db.approval_requests.find({'customerId': customer_id}).sort('createdAt', -1).to_list(length=1000)
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
        raise HTTPException(status_code=500, detail:str(e))

async def _approvals_broadcast(event: Dict[str, Any]):
    dead = []
    for q in list(approvals_subscribers):
        try:
            q.put_nowait(event)
        except Exception:
            dead.append(q)
    for q in dead:
        approvals_subscribers.discard(q)

@router.post('/approvals/public/{token}/respond')
async def respond_to_approval(
    token: str, 
    status: str = 'approved',
    name: str = '',
    phone: str = '',
    notes: str = ''
):
    """Customer responds to approval request - supports query params or body"""
    try:
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
        # Broadcast SSE event
        await _approvals_broadcast({
            'type': 'approval_updated',
            'token': token,
            'status': updated_doc.get('status'),
            'vehicleId': updated_doc.get('vehicleId'),
            'customerId': updated_doc.get('customerId'),
            'respondedAt': updated_doc.get('respondedAt')
        })
        return updated_doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail:str(e))

@router.get('/approvals/stream')
async def approvals_stream(request: Request):
    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        approvals_subscribers.add(queue)
        try:
            while True:
                if await request.is_disconnected():
                    break
                data = await queue.get()
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
        finally:
            approvals_subscribers.discard(queue)
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ------------------ NOTIFICATIONS (WhatsApp Helpers) ------------------
@router.post('/notifications/prepare')
async def prepare_notification(payload: Dict[str, Any]):
    try:
        notif_type = (payload or {}).get('type')
        phone = (payload or {}).get('phone', '')
        link = (payload or {}).get('link', '')
        # Normalize phone
        norm = ''.join([c for c in phone if c.isdigit()])
        if norm.startswith('05') or norm.startswith('5'):
            if norm.startswith('0'):
                norm = '966' + norm[1:]
            else:
                norm = '966' + norm
        elif not norm.startswith('966'):
            norm = '966' + norm
        message = ""
        if notif_type == 'approval':
            message = f"مرحباً، نأمل اعتماد الطلب عبر الرابط: {link}"
        else:
            message = f"مرحباً، رابطك: {link}"
        import urllib.parse
        encoded = urllib.parse.quote(message)
        deeplink = f"https://wa.me/{norm}?text={encoded}"
        return {'whatsappDeeplink': deeplink}
    except Exception as e:
        raise HTTPException(status_code=500, detail:str(e))
