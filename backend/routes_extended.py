from fastapi import APIRouter, HTTPException, Body, Request, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse, Response
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import asyncio
import json
import uuid
import os
import io
import csv
import httpx

from motor.motor_asyncio import AsyncIOMotorGridFSBucket
import openpyxl
from openpyxl.utils import get_column_letter
import xlsxwriter
from docx import Document as DocxDocument
from bson import ObjectId

router = APIRouter(prefix="/api")

db = None
templates_bucket: Optional[AsyncIOMotorGridFSBucket] = None

approvals_subscribers: set = set()


def set_db(database):
    global db, templates_bucket
    db = database
    try:
        from bson import ObjectId
        templates_bucket = AsyncIOMotorGridFSBucket(db, bucket_name='invoice_templates')
    except Exception as e:
        print(f"GridFS bucket init failed: {e}")

@router.get('/settings')
async def get_settings():
    try:
        doc = await db.settings.find_one({"id": "app_settings"})
        if not doc:
            doc = {
                "id": "app_settings",
                "currency": "SAR",
                "taxRate": 0.0,
                "language": "ar",
                "timezone": "Asia/Riyadh",
                "invoicePrefix": "INV",
                "menuConfig": {"simple": False, "items": []}
            }
            await db.settings.insert_one(doc)
        # Ensure required menu entries exist
        items = doc.get('menuConfig', {}).get('items', [])
        def has_path(path):
            for it in items:
                if it.get('path') == path:
                    return True
                for ch in it.get('children', []) or []:
                    if ch.get('path') == path:
                        return True
            return False
        changed = False
        # CEO route
        if not has_path('/ceo'):
            items.append({"group": True, "path": "/ceo-group", "label": "المدير التنفيذي", "enabled": True, "children": [
                {"path": "/ceo", "label": "لوحة المدير", "enabled": True}
            ]})
            changed = True
        # Invoice Studio route
        if not has_path('/invoice-templates'):
            items.append({"path": "/invoice-templates", "label": "استوديو قوالب الفواتير", "enabled": True})
            changed = True
        if changed:
            doc['menuConfig']['items'] = items
            await db.settings.update_one({"id": "app_settings"}, {"$set": {"menuConfig": doc['menuConfig']}})
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _download_file_from_gridfs(file_id: str) -> bytes:
    if not templates_bucket:
        raise HTTPException(status_code=500, detail='Templates bucket not initialized')
    try:
        oid = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid file id')
    buf = io.BytesIO()
    await templates_bucket.download_to_stream(oid, buf)
    return buf.getvalue()

@router.get('/parts')
async def get_parts():
    try:
        docs = await db.parts.find({}).to_list(length=10000)
        for d in docs:
            d.pop('_id', None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/parts')
async def create_part(payload: Dict[str, Any] = Body(...)):
    try:
        name = (payload or {}).get('name')
        if not name:
            raise HTTPException(status_code=400, detail='name required')
        price = float((payload or {}).get('price') or 0)
        quantity = int(float((payload or {}).get('quantity') or 0))
        category = (payload or {}).get('category') or 'عام'
        existing = await db.parts.find_one({'name': name, 'category': category})
        if existing:
            await db.parts.update_one({'id': existing.get('id')}, {'$set': {'price': price, 'updatedAt': datetime.utcnow()}, '$inc': {'quantity': quantity}})
            doc = await db.parts.find_one({'id': existing.get('id')})
            doc.pop('_id', None)
            return doc
        doc = {
            'id': str(uuid.uuid4()),
            'name': name,
            'price': price,
            'quantity': quantity,
            'category': category,
            'createdAt': datetime.utcnow()
        }
        await db.parts.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/biz-accounts')
async def list_accounts():
    try:
        docs = await db.business_accounts.find({}).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post('/services')
async def create_service(payload: Dict[str, Any] = Body(...)):
    try:
        name = (payload or {}).get('name')
        if not name:
            raise HTTPException(status_code=400, detail='name required')
        price = float((payload or {}).get('price') or 0)
        category = (payload or {}).get('category') or 'عام'
        existing = await db.services.find_one({'name': name, 'category': category})
        if existing:
            # update price if provided
            await db.services.update_one({'id': existing.get('id')}, {'$set': {'price': price, 'updatedAt': datetime.utcnow()}})
            doc = await db.services.find_one({'id': existing.get('id')})
            doc.pop('_id', None)
            return doc
        doc = {
            'id': str(uuid.uuid4()),
            'name': name,
            'price': price,
            'category': category,
            'createdAt': datetime.utcnow()
        }
        await db.services.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/services')
async def get_services():
    try:
        docs = await db.services.find({}).to_list(length=10000)
        for d in docs:
            d.pop('_id', None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------- Invoice Templates core (keeping previous functions) --------------
@router.get('/invoice-templates')
async def list_invoice_templates():
    docs = await db.invoice_templates.find({}).sort('createdAt', -1).to_list(length=1000)
    for d in docs:
        d.pop('_id', None)
    return docs

@router.post('/invoice-templates/import-url')
async def import_invoice_template_url(payload: Dict[str, Any] = Body(...)):
    try:
        url = (payload or {}).get('url')
        if not url:
            raise HTTPException(status_code=400, detail='url required')
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url)
            if r.status_code != 200:
                raise HTTPException(status_code=400, detail=f'fetch failed: {r.status_code}')
            content = r.content
            name = url.split('/')[-1] or f'template_{uuid.uuid4().hex}'
            # Reuse existing import logic by extension
            ext = (os.path.splitext(name)[1] or '').lower()

# -------- Approval Logs helpers --------
async def _log_approval_event(token: str, vehicle_id: str, customer_id: str, title: str, amount: float, status: str, service_items: list = None, service_items_text: str = None, responded_at: datetime = None):
    try:
        doc = await db.customer_approval_logs.find_one({'token': token})
        base = {
            'token': token,
            'vehicleId': vehicle_id,
            'customerId': customer_id,
            'title': title,
            'amount': amount,
            'status': status,
            'serviceItems': service_items or [],
            'serviceItemsText': service_items_text,
        }
        if doc:
            update = { **base, 'updatedAt': datetime.utcnow() }
            if responded_at:
                update['respondedAt'] = responded_at
            await db.customer_approval_logs.update_one({'token': token}, {'$set': update})
        else:
            newdoc = { 'id': str(uuid.uuid4()), **base, 'createdAt': datetime.utcnow() }
            if responded_at:
                newdoc['respondedAt'] = responded_at
            await db.customer_approval_logs.insert_one(newdoc)
    except Exception as e:
        print(f"approval log error: {e}")

@router.get('/customers/{customer_id}/approval-logs')
async def get_customer_approval_logs(customer_id: str):
    try:
        docs = await db.customer_approval_logs.find({'customerId': customer_id}).sort('createdAt', -1).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
            for k in ('createdAt','updatedAt','respondedAt'):
                if d.get(k) and hasattr(d[k], 'isoformat'):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/vehicles/{vehicle_id}/approval-logs')
async def get_vehicle_approval_logs(vehicle_id: str):
    try:
        docs = await db.customer_approval_logs.find({'vehicleId': vehicle_id}).sort('createdAt', -1).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
            for k in ('createdAt','updatedAt','respondedAt'):
                if d.get(k) and hasattr(d[k], 'isoformat'):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

            fields: List[str] = []
            preview: List[List[str]] = []
            fmt = None
            if ext in ('.xlsx', '.xls'):
                fmt = 'xlsx'
                wb = openpyxl.load_workbook(io.BytesIO(content), data_only=False)
                ws = wb.active
                max_rows = min(ws.max_row, 30)
                max_cols = min(ws.max_column, 20)
                for r_i in range(1, max_rows+1):
                    row_vals = []
                    for c_i in range(1, max_cols+1):
                        v = ws.cell(r_i, c_i).value
                        if isinstance(v, str):
                            row_vals.append(v)
                            # basic placeholder detection
                            if '{{' in v and '}}' in v:
                                fields.append(v[v.find('{{'):v.find('}}')+2])
                        else:
                            row_vals.append(v if v is not None else '')
                    preview.append(row_vals)
            else:
                # fallback: store file as-is, mark format by ext
                fmt = ext.strip('.') or 'bin'
                preview = [[f"Imported from URL ({fmt})"]]
            file_id = await templates_bucket.upload_from_stream(name, io.BytesIO(content), metadata={'content_type': 'application/octet-stream'})
            tid = str(uuid.uuid4())
            doc = {
                'id': tid,
                'name': os.path.splitext(name)[0],
                'format': fmt,
                'fileId': str(file_id),
                'fields': list(dict.fromkeys(fields)),
                'preview': preview,
                'isDefault': False,
                'createdAt': datetime.utcnow()
            }
            await db.invoice_templates.insert_one(doc)
            doc.pop('_id', None)
            return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/invoice-templates/create-blank')
async def create_blank_template(payload: Dict[str, Any] = Body(...)):
    try:
        name = (payload or {}).get('name') or f"قالب جديد {datetime.utcnow().strftime('%H%M%S')}"
        tid = str(uuid.uuid4())
        doc = {
            'id': tid,
            'name': name,
            'format': 'xlsx',
            'fileId': None,
            'fields': [],
            'preview': [],
            'isDefault': False,
            'createdAt': datetime.utcnow()
        }
        await db.invoice_templates.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/invoice-templates/{tid}/make-default')
async def make_default_template(tid: str):
    try:
        await db.invoice_templates.update_many({}, {'$set': {'isDefault': False}})
        await db.invoice_templates.update_one({'id': tid}, {'$set': {'isDefault': True, 'updatedAt': datetime.utcnow()}})
        doc = await db.invoice_templates.find_one({'id': tid})
        if not doc:
            raise HTTPException(status_code=404, detail='Template not found')
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/invoice-templates/{tid}/update-mapping')
async def update_template_mapping(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        mapping = (payload or {}).get('mapping') or {}
        items = (payload or {}).get('items') or {}
        await db.invoice_templates.update_one({'id': tid}, {'$set': {'mapping': mapping, 'itemsConfig': items, 'updatedAt': datetime.utcnow()}})
        doc = await db.invoice_templates.find_one({'id': tid})
        if not doc:
            raise HTTPException(status_code=404, detail='Template not found')
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------- Operations Endpoints ----------------
@router.get('/operations')
async def get_operations(account_id: Optional[str] = None, type: Optional[str] = None):
    try:
        q: Dict[str, Any] = {}
        if account_id:
            q['accountId'] = account_id
        if type:
            q['type'] = type
        docs = await db.operations.find(q).sort('date', -1).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
            if d.get('date') and hasattr(d['date'], 'isoformat'):
                d['date'] = d['date'].isoformat()
        return docs
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
        # adjust inventory for parts
        if op['type'] in ('purchase', 'sale'):
            for it in items:
                if it.get('itemType') == 'part' and it.get('itemId'):
                    delta = int(float(it.get('quantity', 0)))
                    if op['type'] == 'sale':
                        delta = -delta
                    await db.parts.update_one({'id': it['itemId']}, {'$inc': {'quantity': delta}})
        # create transaction
        try:
            tx = {
                'id': str(uuid.uuid4()),
                'accountId': op['accountId'],
                'type': 'income' if op['type'] == 'sale' else 'expense',
                'category': f"operation_{op['type']}",
                'amount': subtotal,
                'description': f"{op['type']} - {op.get('partnerName') or ''}",
                'date': datetime.utcnow(),
                'reference': op['id'],
                'createdAt': datetime.utcnow()
            }
            await db.transactions.insert_one(tx)
        except Exception as ex:
            print(f"TX create failed: {ex}")
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
        q: Dict[str, Any] = {}
        if account_id:
            q['accountId'] = account_id
        ops = await db.operations.find(q).to_list(length=100000)
        def parse_date(x):
            d = x.get('date')
            if isinstance(d, str):
                try:
                    return datetime.fromisoformat(d.replace('Z','+00:00'))
                except Exception:
                    return today
            return d or today
        def agg(start):
            s=e=sc=ec=0
            for o in ops:
                d = parse_date(o)
                if d >= start:
                    t = float(o.get('total', 0))
                    if o.get('type') == 'sale': s += t; sc += 1
                    elif o.get('type') == 'purchase': e += t; ec += 1
            return s,e,s-e,sc,ec
        tS,tE,tP,tSc,tEc = agg(today)
        wS,wE,wP,wSc,wEc = agg(week_ago)
        mS,mE,mP,mSc,mEc = agg(month_start)
        return {
            'today': {'sales': tS, 'expenses': tE, 'profit': tP, 'salesCount': tSc, 'expensesCount': tEc},
            'week': {'sales': wS, 'expenses': wE, 'profit': wP, 'salesCount': wSc, 'expensesCount': wEc},
            'month': {'sales': mS, 'expenses': mE, 'profit': mP, 'salesCount': mSc, 'expensesCount': mEc}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------- CEO multi account ----------------
@router.post('/ceo/ai-analysis-multi')
async def ceo_ai_analysis_multi(payload: Dict[str, Any] = Body(...)):
    try:
        account_ids = (payload or {}).get('accountIds') or []
        question = (payload or {}).get('question') or ''
        days = int((payload or {}).get('days') or 30)
        if not account_ids:
            accs = await db.business_accounts.find({}).to_list(length=1000)
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
        # optional AI
        if question:
            try:
                import os
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                key = os.getenv('EMERGENT_LLM_KEY')
                if key:
                    sys = "أنت مساعد المدير التنفيذي. حلّل البيانات وقدّم توصيات مختصرة."
                    ctx = "\n".join([f"{a['name']}: دخل {a['income']:.0f}، مصروف {a['expenses']:.0f}، ربح {a['profit']:.0f}" for a in per])
                    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=sys).with_model('anthropic','claude-sonnet-4-20250514')
                    ans = await chat.send_message(UserMessage(text=f"السؤال: {question}\nالبيانات:\n{ctx}"))
                    result['ai'] = {'answer': ans, 'model': 'anthropic/claude-sonnet-4-20250514'}
            except Exception as ex:
                print(f"AI error: {ex}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/invoice-templates/{tid}/save-json')
async def save_template_from_json(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        grid = payload.get('grid')
        if not isinstance(grid, list):
            raise HTTPException(status_code=400, detail='grid required')
        out = io.BytesIO()
        book = xlsxwriter.Workbook(out, {'in_memory': True})
        sheet = book.add_worksheet('Template')
        for r, row in enumerate(grid):
            if not isinstance(row, list):
                continue
            for c, val in enumerate(row):
                sheet.write(r, c, '' if val is None else str(val))
        book.close()
        xlsx_bytes = out.getvalue()
        file_id = await templates_bucket.upload_from_stream(f'template_{tid}.xlsx', io.BytesIO(xlsx_bytes), metadata={'content_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
        await db.invoice_templates.update_one({'id': tid}, {'$set': {'format': 'xlsx', 'fileId': str(file_id), 'updatedAt': datetime.utcnow()}})
        return {'status': 'ok', 'fileId': str(file_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/print/invoice-xlsx')
async def print_invoice_xlsx(payload: Dict[str, Any] = Body(...)):
    try:
        t_id = (payload or {}).get('templateId') or (payload or {}).get('template_id')
        data = (payload or {}).get('data') or payload
        if not t_id:
            t_doc = await db.invoice_templates.find_one({'isDefault': True})
            if not t_doc:
                raise HTTPException(status_code=404, detail='لا يوجد قالب افتراضي للطباعة')
        else:
            t_doc = await db.invoice_templates.find_one({'id': t_id})
            if not t_doc:
                raise HTTPException(status_code=404, detail='القالب غير موجود')
        if t_doc.get('fileId'):
            file_bytes = await _download_file_from_gridfs(t_doc['fileId'])
        else:
            out = io.BytesIO()
            book = xlsxwriter.Workbook(out, {'in_memory': True})
            sheet = book.add_worksheet('Template')
            for r, row in enumerate(t_doc.get('preview') or []):
                for c, val in enumerate(row):
                    sheet.write(r, c, '' if val is None else str(val))
            book.close()
            file_bytes = out.getvalue()
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
        ws = wb.active
        max_r = ws.max_row
        max_c = ws.max_column
        items = data.get('ITEMS') or data.get('items') or []
        items_anchor_row = None
        for r in range(1, max_r+1):
            anchor = False
            for c in range(1, max_c+1):
                cell = ws.cell(r, c)
                v = cell.value
                if isinstance(v, str):
                    if v.strip() == '{{ITEMS}}':
                        anchor = True
                    else:
                        phs = []
                        s = v
                        start = 0
                        while True:
                            i = s.find('{{', start)
                            if i == -1: break
                            j = s.find('}}', i+2)
                            if j == -1: break
                            phs.append(s[i:j+2]); start = j+2
                        nv = v
                        for ph in phs:
                            key = ph.strip('{}')
                            nv = nv.replace(ph, str(data.get(key, '')))
                        if nv != v:
                            cell.value = nv
            if anchor and items_anchor_row is None:
                items_anchor_row = r
        if items_anchor_row:
            template_row_idx = min(items_anchor_row+1, ws.max_row)
            template_vals = [ws.cell(template_row_idx, c).value for c in range(1, max_c+1)]
            ws.delete_rows(items_anchor_row, 2)
            insert_at = items_anchor_row
            for it in items:
                new_vals = []
                for val in template_vals:
                    if isinstance(val, str):
                        nv = val
                        phs = []
                        s = val
                        start = 0
                        while True:
                            i = s.find('{{', start)
                            if i == -1: break
                            j = s.find('}}', i+2)
                            if j == -1: break
                            phs.append(s[i:j+2]); start = j+2
                        for ph in phs:
                            k = ph.strip('{}')
                            if k.startswith('ITEMS.'):
                                field = k.split('.',1)[1]
                                nv = nv.replace(ph, str(it.get(field, '')))
                        new_vals.append(nv)
                    else:
                        new_vals.append(val)
                ws.insert_rows(insert_at)
                for c, v in enumerate(new_vals, start=1):
                    ws.cell(insert_at, c).value = v
                insert_at += 1
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return Response(content=out.getvalue(), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': 'attachment; filename="invoice.xlsx"'})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
