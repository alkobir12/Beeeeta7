from fastapi import APIRouter, HTTPException, Body, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import asyncio
import json
import uuid
import os

router = APIRouter(prefix="/api")

db = None

# SSE subscribers for approvals
approvals_subscribers: set = set()


def set_db(database):
    global db
    db = database

# -------------- SETTINGS --------------
@router.get('/settings')
async def get_settings():
    try:
        doc = await db.settings.find_one({"id": "app_settings"})
        if not doc:
            default = {
                "id": "app_settings",
                "currency": "SAR",
                "taxRate": 0.0,
                "language": "ar",
                "timezone": "Asia/Riyadh",
                "invoicePrefix": "INV",
                # Base templates flags (new)
                "baseRepairTemplateActive": True,
                "baseTemplates": {
                    "repair": "invoice_template_repair_ar.html",
                    "invoice": "invoice_template_repair_ar.html",
                    "vehicle_status": "invoice_template_repair_ar.html"
                },
                # Menu configuration
                "menuConfig": {
                    "simple": False,
                    "items": [
                        {"path": "/", "label": "الرئيسية", "enabled": True},
                        {"path": "/operations", "label": "عمليات الشراء/البيع", "enabled": True},
                        {"group": True, "path": "/inventory", "label": "المخزون", "enabled": True, "children": [
                            {"path": "/parts", "label": "قطع الغيار", "enabled": True},
                            {"path": "/suppliers", "label": "الموردين", "enabled": True}
                        ]},
                        {"group": True, "path": "/customers-group", "label": "العملاء", "enabled": True, "children": [
                            {"path": "/customers", "label": "قائمة العملاء", "enabled": True},
                            {"path": "/customer-receipts", "label": "توريد العملاء", "enabled": True}
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
async def save_settings(payload: Dict[str, Any] = Body(...)):
    try:
        payload = {**payload, "id": "app_settings", "updatedAt": datetime.utcnow()}
        await db.settings.update_one({"id": "app_settings"}, {"$set": payload}, upsert=True)
        saved = await db.settings.find_one({"id": "app_settings"})
        saved.pop('_id', None)
        return saved
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- PARTS --------------
@router.get('/parts')
async def get_parts():
    try:
        docs = await db.parts.find({}).to_list(length=10000)
        for d in docs:
            d.pop('_id', None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- BUSINESS ACCOUNTS --------------
@router.get('/biz-accounts')
async def list_accounts():
    try:
        docs = await db.business_accounts.find({'isActive': True}).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- OPERATIONS --------------
@router.get('/operations')
async def get_operations(account_id: Optional[str] = None, type: Optional[str] = None):
    try:
        query: Dict[str, Any] = {}
        if account_id:
            query['accountId'] = account_id
        if type:
            query['type'] = type
        ops = await db.operations.find(query).sort('date', -1).to_list(length=1000)
        for o in ops:
            o.pop('_id', None)
            if o.get('date') and hasattr(o['date'], 'isoformat'):
                o['date'] = o['date'].isoformat()
        return ops
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/operations')
async def create_operation(payload: Dict[str, Any] = Body(...)):
    try:
        items = payload.get('items', [])
        subtotal = 0.0
        for it in items:
            qty = float(it.get('quantity', 1))
            price = float(it.get('price', 0))
            it['total'] = qty * price
            subtotal += it['total']
        op = {
            'id': str(uuid.uuid4()),
            'accountId': payload.get('accountId', ''),
            'type': payload.get('type', 'purchase'),
            'partnerType': payload.get('partnerType', 'supplier'),
            'partnerName': payload.get('partnerName'),
            'items': items,
            'subtotal': subtotal,
            'total': subtotal,
            'paymentMethod': payload.get('paymentMethod', 'cash'),
            'notes': payload.get('notes'),
            'date': datetime.utcnow(),
            'createdAt': datetime.utcnow()
        }
        await db.operations.insert_one(op)
        # Auto transaction
        try:
            tx = {
                'id': str(uuid.uuid4()),
                'accountId': op['accountId'],
                'type': 'income' if op['type'] == 'sale' else 'expense',
                'category': f"operation_{op['type']}",
                'amount': subtotal,
                'description': f"{op['type']} - {op.get('partnerName') or 'عملية'}",
                'date': datetime.utcnow(),
                'reference': op['id'],
                'createdAt': datetime.utcnow()
            }
            await db.transactions.insert_one(tx)
        except Exception as ex:
            print(f"tx err: {ex}")
        op.pop('_id', None)
        op['date'] = op['date'].isoformat()
        return op
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/operations/analytics/summary')
async def operations_analytics(account_id: Optional[str] = None):
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_start = today.replace(day=1)
        query = {}
        if account_id:
            query['accountId'] = account_id
        ops = await db.operations.find(query).to_list(length=100000)

        def parse_date(d):
            if isinstance(d, str):
                try:
                    return datetime.fromisoformat(d.replace('Z', '+00:00'))
                except Exception:
                    return today
            return d or today

        def calc(range_start):
            sales = expenses = sales_c = exp_c = 0
            for o in ops:
                d = parse_date(o.get('date'))
                if d >= range_start:
                    t = float(o.get('total', 0))
                    if o.get('type') == 'sale':
                        sales += t; sales_c += 1
                    elif o.get('type') == 'purchase':
                        expenses += t; exp_c += 1
            return sales, expenses, sales - expenses, sales_c, exp_c

        tS, tE, tP, tSc, tEc = calc(today)
        wS, wE, wP, wSc, wEc = calc(week_ago)
        mS, mE, mP, mSc, mEc = calc(month_start)

        # accounts summary
        acc_docs = await db.business_accounts.find({'isActive': True}).to_list(length=100)
        acc_summary = []
        for acc in acc_docs:
            acc_id = acc.get('id')
            a_ops = [o for o in ops if o.get('accountId') == acc_id]
            def calc_acc(range_start):
                s=e=c=0
                for o in a_ops:
                    d = parse_date(o.get('date'))
                    if d >= range_start:
                        val = float(o.get('total', 0))
                        if o.get('type') == 'sale': s += val
                        elif o.get('type') == 'purchase': e += val
                        c += 1
                return s,e,s-e,c
            a_tS,a_tE,a_tP,a_tC = calc_acc(today)
            a_wS,a_wE,a_wP,a_wC = calc_acc(week_ago)
            a_mS,a_mE,a_mP,a_mC = calc_acc(month_start)
            acc_summary.append({
                'id': acc_id,
                'name': acc.get('name','Account'),
                'todaySales': a_tS, 'weekSales': a_wS, 'monthSales': a_mS,
                'todayExpenses': a_tE, 'weekExpenses': a_wE, 'monthExpenses': a_mE,
                'todayProfit': a_tP, 'weekProfit': a_wP, 'monthProfit': a_mP,
                'todayCount': a_tC, 'weekCount': a_wC, 'monthCount': a_mC
            })

        return {
            'today': {'sales': tS, 'expenses': tE, 'profit': tP, 'salesCount': tSc, 'expensesCount': tEc},
            'week': {'sales': wS, 'expenses': wE, 'profit': wP, 'salesCount': wSc, 'expensesCount': wEc},
            'month': {'sales': mS, 'expenses': mE, 'profit': mP, 'salesCount': mSc, 'expensesCount': mEc},
            'accountsSummary': acc_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- CEO MULTI ACCOUNT --------------
@router.post('/ceo/ai-analysis-multi')
async def ceo_ai_analysis_multi(payload: Dict[str, Any] = Body(...)):
    try:
        account_ids = (payload or {}).get('accountIds') or []
        days = int((payload or {}).get('days') or 30)
        question = (payload or {}).get('question') or ''
        if not account_ids:
            accs = await db.business_accounts.find({'isActive': True}).to_list(length=1000)
            account_ids = [a.get('id') for a in accs if a.get('id')]
        end = datetime.utcnow(); start = end - timedelta(days=days)
        tx = await db.transactions.find({'date': {'$gte': start, '$lte': end}, 'accountId': {'$in': account_ids}}).to_list(length=100000)
        per = []
        acc_docs = await db.business_accounts.find({'id': {'$in': account_ids}}).to_list(length=1000)
        name_map = {a.get('id'): a.get('name','Account') for a in acc_docs}
        for aid in account_ids:
            ftx = [t for t in tx if t.get('accountId') == aid]
            income = sum(float(t.get('amount',0)) for t in ftx if t.get('type')=='income')
            expense = sum(float(t.get('amount',0)) for t in ftx if t.get('type')=='expense')
            profit = income - expense
            per.append({'id': aid, 'name': name_map.get(aid,'Account'), 'income': income, 'expenses': expense, 'profit': profit, 'profitMargin': (profit/income*100.0) if income>0 else 0.0})
        totals_income = sum(a['income'] for a in per)
        totals_expenses = sum(a['expenses'] for a in per)
        totals_profit = totals_income - totals_expenses
        result = {'accounts': per, 'totals': {'income': totals_income, 'expenses': totals_expenses, 'profit': totals_profit, 'profitMargin': (totals_profit/totals_income*100.0) if totals_income>0 else 0.0}, 'ai': None, 'periodDays': days}
        # Optional AI
        if question:
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                key = os.getenv('EMERGENT_LLM_KEY')
                if key:
                    sys = "أنت مساعد المدير التنفيذي. حلّل بيانات الورشة عبر الفروع وقدّم قرارات عملية مختصرة."
                    ctx = "\n".join([f"{a['name']}: دخل {a['income']:.0f}، مصروف {a['expenses']:.0f}، ربح {a['profit']:.0f}" for a in per])
                    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=sys).with_model('anthropic','claude-sonnet-4-20250514')
                    ans = await chat.send_message(UserMessage(text=f"السؤال: {question}\nالبيانات:\n{ctx}"))
                    result['ai'] = {'answer': ans, 'model': 'anthropic/claude-sonnet-4-20250514'}
            except Exception as ex:
                print(f"AI error: {ex}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- APPROVALS + SSE --------------
@router.post('/approvals')
async def create_approval(payload: Dict[str, Any] = Body(...)):
    try:
        token = f"APR-{str(uuid.uuid4())[:8].upper()}"
        doc = {
            'id': str(uuid.uuid4()),
            'token': token,
            'vehicleId': payload.get('vehicleId'),
            'customerId': payload.get('customerId'),
            'title': payload.get('title') or 'طلب اعتماد',
            'amount': float(payload.get('amount') or 0),
            'notes': payload.get('notes'),
            'status': 'pending',
            'createdAt': datetime.utcnow(),
            'expiresAt': datetime.utcnow() + timedelta(days=7)
        }
        await db.approval_requests.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/approvals')
async def list_approvals(vehicle_id: Optional[str] = None):
    try:
        q = {}
        if vehicle_id:
            q['vehicleId'] = vehicle_id
        docs = await db.approval_requests.find(q).sort('createdAt', -1).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
            for k in ('createdAt','expiresAt','respondedAt'):
                if d.get(k) and hasattr(d[k],'isoformat'):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/customers/{customer_id}/approvals')
async def list_customer_approvals(customer_id: str):
    try:
        docs = await db.approval_requests.find({'customerId': customer_id}).sort('createdAt', -1).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
            for k in ('createdAt','expiresAt','respondedAt'):
                if d.get(k) and hasattr(d[k],'isoformat'):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/approvals/public/{token}')
async def public_approval(token: str):
    try:
        d = await db.approval_requests.find_one({'token': token})
        if not d:
            raise HTTPException(status_code=404, detail='رابط غير صحيح')
        if d.get('revoked'):
            raise HTTPException(status_code=410, detail='تم إلغاء الطلب')
        if d.get('expiresAt') and d['expiresAt'] < datetime.utcnow():
            raise HTTPException(status_code=410, detail='انتهت صلاحية الرابط')
        d.pop('_id', None)
        for k in ('createdAt','expiresAt','respondedAt'):
            if d.get(k) and hasattr(d[k],'isoformat'):
                d[k] = d[k].isoformat()
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
async def respond_public_approval(token: str, status: str = 'approved', name: str = '', phone: str = '', notes: str = ''):
    try:
        d = await db.approval_requests.find_one({'token': token})
        if not d:
            raise HTTPException(status_code=404, detail='رابط غير صحيح')
        if d.get('revoked'):
            raise HTTPException(status_code=410, detail='تم إلغاء الطلب')
        if d.get('expiresAt') and d['expiresAt'] < datetime.utcnow():
            raise HTTPException(status_code=410, detail='انتهت صلاحية الرابط')
        upd = {'status': status, 'respondedAt': datetime.utcnow(), 'responderName': name, 'responderPhone': phone, 'notes': notes}
        await db.approval_requests.update_one({'token': token}, {'$set': upd})
        nd = await db.approval_requests.find_one({'token': token})
        nd.pop('_id', None)
        for k in ('createdAt','expiresAt','respondedAt'):
            if nd.get(k) and hasattr(nd[k],'isoformat'):
                nd[k] = nd[k].isoformat()
        await _approvals_broadcast({'type':'approval_updated','token': token,'vehicleId': nd.get('vehicleId'),'customerId': nd.get('customerId'),'status': nd.get('status'),'respondedAt': nd.get('respondedAt')})
        return nd
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/approvals/stream')
async def approvals_stream(request: Request):
    async def gen():
        q: asyncio.Queue = asyncio.Queue()
        approvals_subscribers.add(q)
        try:
            while True:
                if await request.is_disconnected():
                    break
                ev = await q.get()
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        finally:
            approvals_subscribers.discard(q)
    return StreamingResponse(gen(), media_type='text/event-stream')

# -------------- NOTIFICATIONS (WhatsApp Deeplink) --------------
@router.post('/notifications/prepare')
async def prepare_notification(payload: Dict[str, Any] = Body(...)):
    try:
        phone = (payload or {}).get('phone','')
        link = (payload or {}).get('link','')
        msg = (payload or {}).get('message') or f"مرحباً، نأمل اعتماد الطلب عبر الرابط: {link}"
        # normalize phone to 966xxxxxxxxx
        norm = ''.join([c for c in phone if c.isdigit()])
        if norm.startswith('00'):
            norm = norm[2:]
        if norm.startswith('+'):
            norm = norm[1:]
        if norm.startswith('05'):
            norm = '966' + norm[1:]
        if norm.startswith('5') and len(norm) == 9:
            norm = '966' + norm
        if not norm.startswith('966'):
            norm = '966' + norm
        import urllib.parse
        deeplink = f"https://wa.me/{norm}?text={urllib.parse.quote(msg)}"
        return {'whatsappDeeplink': deeplink}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- TEMPLATES --------------
@router.post('/print/resolve-template')
async def resolve_template(payload: Dict[str, Any] = Body(...)):
    """Resolve template by type. If override_type provided == 'repair' (or invoice/vehicle_status), return the new base repair template"""
    try:
        t = (payload or {}).get('override_type') or (payload or {}).get('type') or 'repair'
        if t in ('repair','invoice','repair_invoice','vehicle_status'):
            template_path = os.path.join(os.path.dirname(__file__), 'invoice_template_repair_ar.html')
            with open(template_path, 'r', encoding='utf-8') as f:
                html = f.read()
            return { 'type': 'repair', 'template': { 'content': html, 'name': 'القالب الأساسي - إصلاح مركبة' } }
        doc = await db.templates.find_one({'type': t, 'isActive': True})
        if not doc:
            raise HTTPException(status_code=404, detail='لم يتم العثور على قالب')
        doc.pop('_id', None)
        return { 'type': t, 'template': doc }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/print/repair-invoice', response_class=HTMLResponse)
async def print_repair_invoice(payload: Dict[str, Any] = Body(...)):
    """
    Render repair invoice HTML using the built-in Arabic template.
    Expected data fields under payload:
    {
      workshop: {name, phone, email, address, tax},
      customer: {name, phone},
      vehicle: {brand, model, year, plate, statusLabel},
      items: [{description, quantity, price, total}],
      subtotal, tax, total, notes, trackLink,
      invoiceNo, invoiceDate
    }
    """
    try:
        template_path = os.path.join(os.path.dirname(__file__), 'invoice_template_repair_ar.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            tpl = f.read()
        data = payload or {}
        workshop = data.get('workshop', {})
        customer = data.get('customer', {})
        vehicle = data.get('vehicle', {})
        items = data.get('items', [])
        rows = []
        for it in items:
            desc = it.get('description','-')
            qty = it.get('quantity', 1)
            price = it.get('price', 0)
            total = it.get('total', float(qty)*float(price))
            rows.append(f"<tr><td>{desc}</td><td>{qty}</td><td>{price}</td><td>{total}</td></tr>")
        html = tpl
        reps = {
            '{{WORKSHOP_NAME}}': str(workshop.get('name','ورشة سيارات')),
            '{{WORKSHOP_TAX}}': str(workshop.get('tax','-')),
            '{{WORKSHOP_PHONE}}': str(workshop.get('phone','-')),
            '{{WORKSHOP_EMAIL}}': str(workshop.get('email','-')),
            '{{WORKSHOP_ADDRESS}}': str(workshop.get('address','-')),
            '{{INVOICE_NO}}': str(data.get('invoiceNo','INV-'+str(uuid.uuid4())[:6].upper())),
            '{{INVOICE_DATE}}': str(data.get('invoiceDate', datetime.utcnow().strftime('%Y-%m-%d'))),
            '{{CUSTOMER_NAME}}': str(customer.get('name','-')),
            '{{CUSTOMER_PHONE}}': str(customer.get('phone','-')),
            '{{VEHICLE_INFO}}': f"{vehicle.get('brand','-')} {vehicle.get('model','')} {vehicle.get('year','')}",
            '{{PLATE_NO}}': str(vehicle.get('plate','-')),
            '{{STATUS_LABEL}}': str(vehicle.get('statusLabel','-')),
            '{{ITEMS_ROWS}}': "\n".join(rows),
            '{{SUBTOTAL}}': str(data.get('subtotal','0.00')),
            '{{TAX}}': str(data.get('tax','0.00')),
            '{{TOTAL}}': str(data.get('total','0.00')),
            '{{NOTES}}': str(data.get('notes','')),
            '{{TRACK_LINK}}': str(data.get('trackLink','-')),
        }
        for k,v in reps.items():
            html = html.replace(k, v)
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
