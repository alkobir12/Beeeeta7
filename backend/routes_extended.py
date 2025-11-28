from fastapi import APIRouter, HTTPException, Body, Request, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse, Response
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import asyncio
import json
import uuid
import os
import io
import csv

# Optional deps used in some endpoints
try:
    import openpyxl
    from openpyxl.utils import get_column_letter
except Exception:
    openpyxl = None
try:
    import xlsxwriter
except Exception:
    xlsxwriter = None
try:
    import pdfplumber
except Exception:
    pdfplumber = None

from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId
from supabase_service import SupabaseService

router = APIRouter(prefix="/api")

db = None
templates_bucket: Optional[AsyncIOMotorGridFSBucket] = None
approvals_subscribers: set = set()


# --------------------- Memory Helper ---------------------
def _mem_read(name: str) -> list:
    try:
        p = os.path.join(os.path.dirname(__file__), 'uploads', f'{name}.json')
        if not os.path.exists(p): return []
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def _mem_write(name: str, items: list):
    try:
        d = os.path.join(os.path.dirname(__file__), 'uploads')
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, f'{name}.json')
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# --------------------- DB bind ---------------------

def set_db(database):
    global db, templates_bucket
    db = database
    try:
        templates_bucket = AsyncIOMotorGridFSBucket(db, bucket_name='invoice_templates')
    except Exception as e:
        print(f"GridFS bucket init failed: {e}")


# --------------------- Settings ---------------------
@router.get('/settings')
async def get_settings():
    try:
        # Memory provider fallback
        if os.environ.get('DB_PROVIDER', 'mongo').lower() == 'memory':
            return {
                "id": "app_settings",
                "currency": "SAR",
                "taxRate": 0.0,
                "language": "ar",
                "timezone": "Asia/Riyadh",
                "invoicePrefix": "INV",
                "menuConfig": {"simple": False, "items": [
                    {"path": "/", "label": "الرئيسية", "enabled": True},
                    {"path": "/operations", "label": "العمليات", "enabled": True},
                    {"path": "/services", "label": "الخدمات", "enabled": True},
                    {"path": "/parts", "label": "قطع الغيار", "enabled": True},
                    {"path": "/catalog", "label": "كتالوج القطع", "enabled": True},
                    {"path": "/customers", "label": "العملاء", "enabled": True},
                    {"path": "/technicians", "label": "الفنيون", "enabled": True},
                    {"path": "/business-accounts", "label": "الفروع", "enabled": True},
                    {"path": "/invoice-templates", "label": "مصمم الفواتير", "enabled": True},
                    {"path": "/analytics", "label": "التحليلات", "enabled": True},
                    {"path": "/knowledge", "label": "المراجع/المعرفة", "enabled": True},
                    {"path": "/settings", "label": "الإعدادات", "enabled": True}
                ]}
            }
        doc = await db.settings.find_one({"id": "app_settings"})
        if not doc:
            doc = {
                "id": "app_settings",
                "currency": "SAR",
                "taxRate": 0.0,
                "language": "ar",
                "timezone": "Asia/Riyadh",
                "invoicePrefix": "INV",
                "menuConfig": {"simple": False, "items": [
                    {"path": "/", "label": "الرئيسية", "enabled": True},
                    {"path": "/operations", "label": "العمليات", "enabled": True},
                    {"path": "/invoice-templates", "label": "استوديو قوالب الفواتير", "enabled": True},
                    {"path": "/settings", "label": "الإعدادات", "enabled": True}
                ]}
            }
            await db.settings.insert_one(doc)
        # Ensure needed menu entries present
        items = doc.get('menuConfig', {}).get('items', [])
        def ensure(path, label, group=False, children=None):
            for it in items:
                if it.get('path') == path:
                    return
            entry = {"path": path, "label": label, "enabled": True}
            if group:
                entry['group'] = True
                entry['children'] = children or []
            items.append(entry)
        ensure('/invoice-templates', 'استوديو قوالب الفواتير')
        ensure('/operations', 'العمليات')
        ensure('/services', 'إدارة الخدمات')
        doc['menuConfig']['items'] = items
        await db.settings.update_one({"id": "app_settings"}, {"$set": {"menuConfig": doc['menuConfig']}}, upsert=True)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------- Manuals & YoshiParts helpers -----------
@router.get('/manuals/yoshi/summary')
async def get_yoshi_manual_summary(url: str):
    """ملخص سريع لصفحة YoshiParts: عدّ الصور + قائمة المخططات.

    الاستخدام: /api/manuals/yoshi/summary?url=...
    """
    try:
        from ai_knowledge_base import count_images_in_page, extract_yoshi_diagrams
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unable to import helpers: {e}")

    counts = count_images_in_page(url)
    diagrams = extract_yoshi_diagrams(url)
    return {
        'url': url,
        'counts': counts,
        'diagrams': diagrams,
    }


@router.post('/settings')
async def save_settings(payload: Dict[str, Any] = Body(...)):
    try:
        # In memory mode, don't touch MongoDB (avoids SSL / connection errors in preview)
        if os.environ.get('DB_PROVIDER', 'mongo').lower() == 'memory':
            from datetime import datetime as _dt
            return {**payload, "id": "app_settings", "updatedAt": _dt.utcnow().isoformat()}

        payload = {**payload, "id": "app_settings", "updatedAt": datetime.utcnow()}
        await db.settings.update_one({"id": "app_settings"}, {"$set": payload}, upsert=True)
        doc = await db.settings.find_one({"id": "app_settings"})
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Auth (WhatsApp OTP) ---------------------
@router.post('/auth/request-otp')
async def request_otp(payload: Dict[str, Any] = Body(...)):
    try:
        phone = (payload or {}).get('phone', '')
        otp_type = (payload or {}).get('type', 'login')
        if not phone:
            raise HTTPException(status_code=400, detail='phone required')
        # normalize phone (reuse logic similar to notifications/prepare)
        norm = ''.join([c for c in phone if c.isdigit() or c == '+'])
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
        
            norm = '966' + norm
        token = f"OTP-{str(uuid.uuid4())[:6].upper()}"
        doc = {
            'id': str(uuid.uuid4()),
            'phone': norm,
            'token': token,
            'type': otp_type,
            'createdAt': datetime.utcnow(),
            'expiresAt': datetime.utcnow() + timedelta(minutes=10),
            'used': False
        }
        await db.auth_otps.insert_one(doc)
        import urllib.parse
        msg = f"رمز الدخول الخاص بك: {token} — صالح لمدة 10 دقائق"
        deeplink = f"https://wa.me/{norm}?text={urllib.parse.quote(msg)}"
        ret = {"token": token, "whatsappDeeplink": deeplink, "expiresAt": doc['expiresAt'].isoformat()}
        return ret
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Business Accounts ---------------------
@router.get('/biz-accounts')
async def list_biz_accounts():
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            return supa.accounts_list()
        if provider == 'memory' or db is None:
            # وضع معاينة بدون قاعدة بيانات حقيقية
            return []

        docs = await db.business_accounts.find({}).sort('createdAt', -1).to_list(length=2000)
        out = []
        for d in docs:
            out.append({
                'id': d.get('id'),
                'name': d.get('name'),
                'code': d.get('code'),
                'currency': d.get('currency') or 'SAR',
                'createdAt': d.get('createdAt').isoformat() if d.get('createdAt') and hasattr(d.get('createdAt'), 'isoformat') else d.get('createdAt')
            })
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/biz-accounts')
async def create_biz_account(payload: Dict[str, Any] = Body(...)):
    try:
        name = (payload or {}).get('name')
        code = (payload or {}).get('code') or (name or '')[:4].upper()
        currency = (payload or {}).get('currency') or 'SAR'
        if not name:
            raise HTTPException(status_code=400, detail='name required')

        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            return supa.accounts_create(name=name, code=code, currency=currency)
        if provider == 'memory' or db is None:
            # وضع معاينة: نرجع كائن وهمي بدون تخزين حقيقي
            return {
                'id': str(uuid.uuid4()),
                'name': name,
                'code': code,
                'currency': currency,
                'createdAt': datetime.utcnow().isoformat()
            }

        # ensure unique code if exists (Mongo)
        exist = await db.business_accounts.find_one({'code': code})
        if exist:
            code = f"{code}-{str(uuid.uuid4())[:4].upper()}"
        doc = {'id': str(uuid.uuid4()), 'name': name, 'code': code, 'currency': currency, 'createdAt': datetime.utcnow()}
        await db.business_accounts.insert_one(doc)
        doc.pop('_id', None)
        doc['createdAt'] = doc['createdAt'].isoformat()
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------- Budgets ---------------------
@router.get('/budgets')
async def list_budgets(account_id: Optional[str] = None, period: Optional[str] = None):
    try:
        q = {}
        if account_id:
            q['accountId'] = account_id
        if period:
            q['period'] = period
        items = await db.budgets.find(q).sort('period', -1).to_list(1000)
        for it in items:
            it.pop('_id', None)
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/budgets')
async def create_budget(payload: Dict[str, Any] = Body(...)):
    try:
        account_id = payload.get('accountId')
        if not account_id:
            raise HTTPException(status_code=400, detail='accountId required')
        doc = {
            'id': str(uuid.uuid4()),
            'accountId': account_id,
            'period': payload.get('period') or datetime.utcnow().strftime('%Y-%m'),
            'incomeTarget': float(payload.get('incomeTarget') or 0),
            'expenseTarget': float(payload.get('expenseTarget') or 0),
            'notes': payload.get('notes') or '',
            'createdAt': datetime.utcnow()
        }
        await db.budgets.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Branch Cleanup (Keep only 2) ---------------------
@router.post('/biz-accounts/cleanup')
async def cleanup_biz_accounts(keep: int = 2, mode: str = 'hard'):
    """Delete all branches and keep only N (default 2) most recent.
    mode: 'hard' = physical delete, 'soft' = set {'archived': True, 'active': False}
    Ensures at least 2 accounts exist by creating defaults if needed.
    """
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        keep = max(0, int(keep or 2))

        if provider == 'supabase':
            supa = SupabaseService()
            # لجعل السلوك بسيط في Supabase: نحذف كل شيء ونحتفظ بعدد N الأحدث
            rows = supa.accounts_list()
            to_keep = [r['id'] for r in rows[:keep] if r.get('id')]
            to_drop = [r['id'] for r in rows[keep:] if r.get('id')]
            if to_drop:
                if mode == 'soft':
                    # لا يوجد archived في السكيمة الحالية، نستخدم active=False كبديل
                    supa.client.table('business_accounts').update({'active': False}).in_('id', to_drop).execute()
                else:
                    supa.client.table('business_accounts').delete().in_('id', to_drop).execute()
            # ضمان وجود فرعين على الأقل
            created = []
            remain_count = len(to_keep)
            while remain_count < 2:
                base_code = 'ACC' if remain_count == 0 else f'BR{remain_count+1:02d}'
                doc = {
                    'name': 'Main Workshop' if remain_count == 0 else f'Branch {remain_count+1}',
                    'code': base_code,
                    'currency': 'SAR',
                }
                res = supa.client.table('business_accounts').insert(doc).execute()
                row = (res.data or [{}])[0]
                created.append({'id': row.get('id'), 'name': row.get('name')})
                to_keep.append(row.get('id'))
                remain_count += 1
            return {'status': 'ok', 'kept': to_keep, 'created': created, 'final': []}

        if provider == 'memory' or db is None:
            # في وضع المعاينة لا نقوم بأي حذف حقيقي
            return {'status': 'ok', 'kept': [], 'created': [], 'final': []}

        # Mongo behavior (قديم)
        # Sort by updatedAt desc then createdAt desc
        docs = await db.business_accounts.find({}).sort([('updatedAt', -1), ('createdAt', -1)]).to_list(length=5000)
        to_keep = [d.get('id') for d in docs[:keep] if d.get('id')]
        to_drop = [d.get('id') for d in docs[keep:] if d.get('id')]
        if to_drop:
            if mode == 'soft':
                await db.business_accounts.update_many({'id': {'$in': to_drop}}, {'$set': {'archived': True, 'active': False, 'updatedAt': datetime.utcnow()}})
            else:
                await db.business_accounts.delete_many({'id': {'$in': to_drop}})
        # Ensure at least 2 exist
        remain_count = await db.business_accounts.count_documents({'archived': {'$ne': True}})
        created = []
        while remain_count < 2:
            base_code = 'ACC' if remain_count == 0 else f'BR{remain_count+1:02d}'
            doc = {
                'id': str(uuid.uuid4()),
                'name': 'Main Workshop' if remain_count == 0 else f'Branch {remain_count+1}',
                'code': base_code,
                'currency': 'SAR',
                'createdAt': datetime.utcnow()
            }
            await db.business_accounts.insert_one(doc)
            created.append({'id': doc['id'], 'name': doc['name']})
            remain_count += 1
        # return final state (2 accounts)
        final_docs = await db.business_accounts.find({'archived': {'$ne': True}}).sort([('updatedAt', -1), ('createdAt', -1)]).to_list(length=10)
        for d in final_docs:
            d.pop('_id', None)
            if d.get('createdAt') and hasattr(d['createdAt'], 'isoformat'):
                d['createdAt'] = d['createdAt'].isoformat()
            if d.get('updatedAt') and hasattr(d['updatedAt'], 'isoformat'):
                d['updatedAt'] = d['updatedAt'].isoformat()
        return {'status': 'ok', 'kept': to_keep, 'created': created, 'final': final_docs[:2]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Pending Operations (Vehicles awaiting action) ---------------------
@router.get('/operations/pending')
async def operations_pending(status: Optional[str] = None, technician_id: Optional[str] = None):
    """Return list of vehicles considered 'pending' = not ready/delivered.
    Optional filter by single status or technician_id.
    """
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            vehs = supa.vehicles_list()
            pending_statuses = ['diagnosis', 'quotation', 'repair']
            vehs = [v for v in vehs if v.get('status') in pending_statuses]
            if status and status != 'all':
                vehs = [v for v in vehs if v.get('status') == status]
            if technician_id:
                vehs = [v for v in vehs if v.get('technicianId') == technician_id]
            return {'count': len(vehs), 'items': vehs}

        if provider == 'memory' or db is None:
            vrows = _mem_read('vehicles')
            pending = [v for v in vrows if v.get('status') in ['diagnosis','quotation','repair']]
            return {'count': len(pending), 'items': pending}

        pending_statuses = ['diagnosis', 'quotation', 'repair']
        q: Dict[str, Any] = {'status': {'$in': pending_statuses}}
        if status:
            if status == 'all':
                pass
            else:
                q['status'] = status
        if technician_id:
            q['technicianId'] = technician_id
        fields = {'_id': 0, 'id': 1, 'plateNumber': 1, 'brand': 1, 'model': 1, 'year': 1, 'status': 1, 'technicianId': 1, 'technicianName': 1, 'entryDate': 1, 'estimatedCompletion': 1, 'customerName': 1, 'customerPhone': 1}
        docs = await db.vehicles.find(q, fields).sort('entryDate', -1).to_list(length=2000)
        for d in docs:
            for k in ('entryDate','estimatedCompletion'):
                if d.get(k) and hasattr(d[k], 'isoformat'):
                    d[k] = d[k].isoformat()
        return {'count': len(docs), 'items': docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/operations/analytics/pending')
async def operations_pending_analytics():
    """Summary counts for pending vehicles and overdue stats."""
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            vehs = supa.vehicles_list()
            pending_statuses = ['diagnosis', 'quotation', 'repair']
            vehs = [v for v in vehs if v.get('status') in pending_statuses]
            by_status = {s: 0 for s in pending_statuses}
            overdue = 0
            now = datetime.utcnow()
            for v in vehs:
                st = v.get('status')
                if st in by_status: by_status[st] += 1
                est = v.get('estimatedCompletion')
                if est:
                    try:
                        dt = datetime.fromisoformat(est.replace('Z','+00:00'))
                        if dt.tzinfo: dt = dt.replace(tzinfo=None)
                        if dt < now: overdue += 1
                    except: pass
            return {'total': len(vehs), 'byStatus': by_status, 'overdue': overdue}

        if provider == 'memory' or db is None:
            vrows = _mem_read('vehicles')
            by = {'diagnosis':0,'quotation':0,'repair':0}
            for v in vrows:
                st = v.get('status')
                if st in by: by[st]+=1
            return {'total': sum(by.values()), 'byStatus': by, 'overdue': 0}

        pending_statuses = ['diagnosis', 'quotation', 'repair']
        now = datetime.utcnow()
        fields = {'_id': 0, 'status': 1, 'estimatedCompletion': 1}
        docs = await db.vehicles.find({'status': {'$in': pending_statuses}}, fields).to_list(length=20000)
        by_status: Dict[str, int] = {s: 0 for s in pending_statuses}
        overdue = 0
        for d in docs:
            st = d.get('status')
            if st in by_status:
                by_status[st] += 1
            est = d.get('estimatedCompletion')
            if est and hasattr(est, 'isoformat'):
                # est is datetime
                if est < now:
                    overdue += 1
        total = len(docs)
        return {'total': total, 'byStatus': by_status, 'overdue': overdue}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/biz-accounts/{aid}')
async def update_biz_account(aid: str, payload: Dict[str, Any] = Body(...)):
    try:
        upd = {}
        for k in ('name','currency'):
            if (payload or {}).get(k) is not None:
                upd[k] = payload[k]
        if not upd:
            return {'status': 'no_changes'}
        await db.business_accounts.update_one({'id': aid}, {'$set': {**upd, 'updatedAt': datetime.utcnow()}})
        d = await db.business_accounts.find_one({'id': aid})
        if not d:
            raise HTTPException(status_code=404, detail='not found')
        d.pop('_id', None)
        if d.get('createdAt') and hasattr(d['createdAt'], 'isoformat'):
            d['createdAt'] = d['createdAt'].isoformat()
        if d.get('updatedAt') and hasattr(d['updatedAt'], 'isoformat'):
            d['updatedAt'] = d['updatedAt'].isoformat()
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- COA ---------------------
DEFAULT_COA = {
    'Assets': {
        'Current Assets': ['Cash', 'Bank'],
        'Fixed Assets': ['Equipment']
    },
    'Liabilities': {
        'Current Liabilities': ['Accounts Payable']
    },
    'Equity': {
        'Owner Equity': []
    },
    'Income': {
        'Sales': ['Services Income', 'Parts Income'],
        'Other Income': []
    },
    'Expenses': {
        'Operating Expenses': ['Electricity', 'Water', 'Fuel', 'Rent', 'Salaries', 'Utilities', 'Marketing', 'Misc'],
        'Personal Expenses': ['Personal']
    }
}

@router.get('/coa/tree')
async def coa_tree():
    try:
        doc = await db.coa.find_one({'id': 'root_tree'})
    except Exception:
        doc = None
    if not doc:
        doc = {'id': 'root_tree', 'tree': DEFAULT_COA, 'createdAt': datetime.utcnow()}
        await db.coa.insert_one(doc)
    doc.pop('_id', None)
    return doc

@router.post('/coa/tree')
async def save_coa_tree(payload: Dict[str, Any] = Body(...)):
    try:
        tree = (payload or {}).get('tree')
        if not isinstance(tree, dict):
            raise HTTPException(status_code=400, detail='tree invalid')
        await db.coa.update_one({'id': 'root_tree'}, {'$set': {'tree': tree, 'updatedAt': datetime.utcnow()}}, upsert=True)
        doc = await db.coa.find_one({'id': 'root_tree'})
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Operations & Analytics ---------------------
@router.get('/operations')
async def list_operations(account_id: Optional[str] = None, type: Optional[str] = None, vehicle_id: Optional[str] = None):
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            ops = supa.operations_list()
            if account_id: ops = [o for o in ops if o.get('accountId') == account_id]
            if type: ops = [o for o in ops if o.get('type') == type]
            if vehicle_id: ops = [o for o in ops if o.get('vehicleId') == vehicle_id]
            return ops

        if provider == 'memory' or db is None:
            ops = _mem_read('operations')
            if account_id: ops = [o for o in ops if o.get('accountId') == account_id]
            if type: ops = [o for o in ops if o.get('type') == type]
            if vehicle_id: ops = [o for o in ops if o.get('vehicleId') == vehicle_id]
            return ops

        q: Dict[str, Any] = {}
        if account_id:
            q['accountId'] = account_id
        if type:
            q['type'] = type
        if vehicle_id:
            q['vehicleId'] = vehicle_id
        ops = await db.operations.find(q, {'_id': 0, 'id':1, 'type':1, 'partnerName':1, 'total':1, 'items':1, 'date':1}).sort('date', -1).to_list(length=2000)
        for o in ops:
            o.pop('_id', None)
            if o.get('date') and hasattr(o['date'], 'isoformat'):
                o['date'] = o['date'].isoformat()
        return ops
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/operations/{op_id}')
async def get_operation(op_id: str):
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            # TODO: implement get one in supabase service
            supa = SupabaseService()
            ops = supa.operations_list()
            for o in ops:
                if o.get('id') == op_id: return o
            raise HTTPException(status_code=404, detail='not found')

        if provider == 'memory' or db is None:
            ops = _mem_read('operations')
            for o in ops:
                if o.get('id') == op_id: return o
            raise HTTPException(status_code=404, detail='not found')

        o = await db.operations.find_one({'id': op_id})
        if not o:
            raise HTTPException(status_code=404, detail='not found')
        o.pop('_id', None)
        if o.get('date') and hasattr(o['date'], 'isoformat'):
            o['date'] = o['date'].isoformat()
        return o
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/operations/{op_id}')
async def update_operation(op_id: str, payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            # Mock update for now as SupabaseService doesn't have update yet
            return payload

        if provider == 'memory' or db is None:
            ops = _mem_read('operations')
            for i, o in enumerate(ops):
                if o.get('id') == op_id:
                    ops[i] = {**o, **payload, 'updatedAt': datetime.utcnow().isoformat()}
                    _mem_write('operations', ops)
                    return ops[i]
            raise HTTPException(status_code=404, detail='not found')

        await db.operations.update_one({'id': op_id}, {'$set': {**payload, 'updatedAt': datetime.utcnow()}})
        o = await db.operations.find_one({'id': op_id})
        if not o:
            raise HTTPException(status_code=404, detail='not found')
        o.pop('_id', None)
        if o.get('date') and hasattr(o['date'], 'isoformat'):
            o['date'] = o['date'].isoformat()
        return o
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/operations')
async def create_operation(payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            return supa.operations_create(payload)

        if provider == 'memory' or db is None:
            rows = _mem_read('operations')
            items = payload.get('items') or []
            subtotal = sum((float(it.get('price',0))*float(it.get('qty',1))) for it in items)
            doc = {
                'id': str(uuid.uuid4()),
                'type': payload.get('type','service'),
                'accountId': payload.get('accountId'),
                'vehicleId': payload.get('vehicleId'),
                'partnerType': payload.get('partnerType'),
                'partnerName': payload.get('partnerName'),
                'items': items,
                'subtotal': subtotal,
                'total': subtotal,
                'paymentMethod': payload.get('paymentMethod','cash'),
                'notes': payload.get('notes'),
                'date': datetime.utcnow().isoformat(),
                'createdAt': datetime.utcnow().isoformat()
            }
            rows.append(doc)
            _mem_write('operations', rows)
            return doc

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
            'vehicleId': payload.get('vehicleId'),
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
        # inventory adjust for parts
        if op['type'] in ('purchase', 'sale'):
            for it in items:
                if it.get('itemType') == 'part' and it.get('itemId'):
                    delta = int(float(it.get('quantity', 0)))
                    if op['type'] == 'sale':
                        delta = -delta
                    await db.parts.update_one({'id': it['itemId']}, {'$inc': {'quantity': delta}})
        # transaction record (income/expense)
        tx = {
            'id': str(uuid.uuid4()),
            'accountId': op['accountId'],
            'vehicleId': op.get('vehicleId'),
            'type': 'income' if op['type'] == 'sale' else 'expense',
            'category': f"operation_{op['type']}",
            'amount': subtotal,
            'description': f"{op['type']} - {op.get('partnerName') or ''}",
            'date': op['date'],
            'reference': op['id'],
            'createdAt': datetime.utcnow()
        }
        try:
            await db.transactions.insert_one(tx)
        except Exception:
            pass
        op.pop('_id', None)
        if hasattr(op['date'], 'isoformat'):
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
        
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        ops = []
        
        if provider == 'supabase':
            supa = SupabaseService()
            ops = supa.operations_list()
            if account_id:
                ops = [o for o in ops if o.get('accountId') == account_id]
        elif provider == 'memory' or db is None:
            ops = _mem_read('operations')
            if account_id:
                ops = [o for o in ops if o.get('accountId') == account_id]
        else:
            q: Dict[str, Any] = {}
            if account_id:
                q['accountId'] = account_id
            ops = await db.operations.find(q, {'_id': 0, 'type': 1, 'total': 1, 'date': 1}).to_list(length=100000)

        def parse_date(x):
            d = x.get('date')
            if isinstance(d, str):
                try:
                    return datetime.fromisoformat(d.replace('Z','+00:00'))
                except Exception:
                    return today
            return d or today
        def agg(start):
            sales = 0.0
            expenses = 0.0
            sales_count = 0
            expenses_count = 0
            for o in ops:
                d = parse_date(o)
                # naive comparison fix
                if d.tzinfo is not None and start.tzinfo is None:
                    d = d.replace(tzinfo=None)
                
                if d >= start:
                    t = float(o.get('total', 0))
                    if o.get('type') == 'sale':
                        sales += t
                        sales_count += 1
                    elif o.get('type') == 'purchase':
                        expenses += t
                        expenses_count += 1
            return sales, expenses, sales - expenses, sales_count, expenses_count
        tS, tE, tP, tSc, tEc = agg(today)
        wS, wE, wP, wSc, wEc = agg(week_ago)
        mS, mE, mP, mSc, mEc = agg(month_start)
        return {
            'today': {'sales': tS, 'expenses': tE, 'profit': tP, 'salesCount': tSc, 'expensesCount': tEc},
            'week': {'sales': wS, 'expenses': wE, 'profit': wP, 'salesCount': wSc, 'expensesCount': wEc},
            'month': {'sales': mS, 'expenses': mE, 'profit': mP, 'salesCount': mSc, 'expensesCount': mEc}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Transactions & Expenses ---------------------
@router.get('/transactions')
async def list_transactions(type: Optional[str] = None, vehicle_id: Optional[str] = None, account_id: Optional[str] = None):
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            return supa.transactions_list(type=type, account_id=account_id)

        if provider == 'memory' or db is None:
            return []

        q: Dict[str, Any] = {}
        if type:
            q['type'] = type
        if vehicle_id:
            q['vehicleId'] = vehicle_id
        if account_id:
            q['accountId'] = account_id
        docs = await db.transactions.find(q).sort('date', -1).to_list(length=5000)
        for d in docs:
            d.pop('_id', None)
            if d.get('date') and hasattr(d['date'], 'isoformat'):
                d['date'] = d['date'].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/expenses')
async def create_expense(payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get('DB_PROVIDER', 'mongo').lower()
        if provider == 'supabase':
            supa = SupabaseService()
            return supa.transactions_create(payload)

        if provider == 'memory' or db is None:
            return {
                'id': str(uuid.uuid4()),
                'accountId': payload.get('accountId', ''),
                'vehicleId': payload.get('vehicleId'),
                'type': 'expense',
                'category': payload.get('category', 'Operating Expenses'),
                'amount': float(payload.get('amount') or 0),
                'description': payload.get('description', ''),
                'date': datetime.utcnow().isoformat(),
                'reference': payload.get('reference'),
                'createdAt': datetime.utcnow().isoformat()
            }

        tx = {
            'id': str(uuid.uuid4()),
            'accountId': payload.get('accountId', ''),
            'vehicleId': payload.get('vehicleId'),
            'type': 'expense',
            'category': payload.get('category', 'Operating Expenses'),
            'amount': float(payload.get('amount') or 0),
            'description': payload.get('description', ''),
            'date': datetime.utcnow(),
            'reference': payload.get('reference'),
            'createdAt': datetime.utcnow()
        }
        await db.transactions.insert_one(tx)
        tx.pop('_id', None)
        if hasattr(tx['date'], 'isoformat'):
            tx['date'] = tx['date'].isoformat()
        return tx
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Approvals + Logs + SSE ---------------------
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
            'serviceItems': payload.get('serviceItems') or [],
            'serviceItemsText': payload.get('serviceItemsText'),
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
async def respond_public_approval(token: str, request: Request, status: str = 'approved', name: str = '', phone: str = '', notes: str = ''):
    try:
        d = await db.approval_requests.find_one({'token': token})
        if not d:
            raise HTTPException(status_code=404, detail='رابط غير صحيح')
        if d.get('revoked'):
            raise HTTPException(status_code=410, detail='تم إلغاء الطلب')
        if d.get('expiresAt') and d['expiresAt'] < datetime.utcnow():
            raise HTTPException(status_code=410, detail='انتهت صلاحية الرابط')
        
        # Digital Signature Logic
        import hashlib
        client_ip = request.client.host

        
        user_agent = request.headers.get('user-agent', 'unknown')
        timestamp = datetime.utcnow().isoformat()
        
        # Create a hash of the approval data
        raw_data = f"{token}:{status}:{timestamp}:{client_ip}:{user_agent}"
        signature = hashlib.sha256(raw_data.encode()).hexdigest()
        
        upd = {
            'status': status, 
            'respondedAt': datetime.utcnow(), 
            'responderName': name, 
            'responderPhone': phone, 
            'notes': notes,
            'clientIp': client_ip,
            'userAgent': user_agent,
            'signature': signature
        }
        
        await db.approval_requests.update_one({'token': token}, {'$set': upd})
        
        # Append to customer history
        if d.get('customerId'):
            history_entry = {
                'token': token,
                'vehicleId': d.get('vehicleId'),
                'status': status,
                'respondedAt': timestamp,
                'clientIp': client_ip,
                'signature': signature,
                'title': d.get('title')
            }
            await db.customers.update_one(
                {'id': d.get('customerId')},
                {'$push': {'approvalsHistory': history_entry}}
            )

        nd = await db.approval_requests.find_one({'token': token})
        nd.pop('_id', None)
        for k in ('createdAt','expiresAt','respondedAt'):
            if nd.get(k) and hasattr(nd[k],'isoformat'):
                nd[k] = nd[k].isoformat()
        # log
        try:
            await _log_approval_event(token, nd.get('vehicleId'), nd.get('customerId'), nd.get('title','طلب اعتماد'), float(nd.get('amount') or 0), nd.get('status'), nd.get('serviceItems') or [], nd.get('serviceItemsText'), datetime.utcnow())
        except Exception as le:
            print(f"log approval error: {le}")
        # broadcast SSE
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


# --------------------- WhatsApp Deeplink ---------------------
@router.post('/notifications/prepare')
async def prepare_notification(payload: Dict[str, Any] = Body(...)):
    try:
        phone = (payload or {}).get('phone','')
        link = (payload or {}).get('link','')
        msg = (payload or {}).get('message') or f"مرحباً، نأمل اعتماد الطلب عبر الرابط: {link}"
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


# --------------------- Templates (Compatibility minimal) ---------------------
@router.get('/templates')
async def list_templates():
    # compat: map to invoice templates list
    try:
        docs = await db.invoice_templates.find({}).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/templates')
async def create_print_template(payload: Dict[str, Any] = Body(...)):
    """إنشاء نموذج طباعة جديد من المصمم"""
    try:
        doc = {
            'id': str(uuid.uuid4()),
            'type': payload.get('type', 'invoice'),
            'name': payload.get('name', 'قالب جديد'),
            'content': payload.get('content', ''),
            'isActive': payload.get('isActive', False),
            'createdAt': datetime.now(timezone.utc).isoformat()
        }
        await db.print_templates.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete('/templates/{template_id}')
async def delete_template(template_id: str):
    """حذف نموذج طباعة"""
    try:
        result = await db.print_templates.delete_one({'id': template_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Template not found')
        return {'message': 'Template deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/templates/{template_id}/make-default')
async def make_template_default(template_id: str):
    """جعل النموذج افتراضي"""
    try:
        # Get template first
        template = await db.print_templates.find_one({'id': template_id})
        if not template:
            raise HTTPException(status_code=404, detail='Template not found')
        
        template_type = template.get('type', 'invoice')
        
        # Remove default from all templates of same type
        await db.print_templates.update_many(
            {'type': template_type},
            {'$set': {'isActive': False}}
        )
        
        # Set this template as default
        await db.print_templates.update_one(
            {'id': template_id},
            {'$set': {'isActive': True}}
        )
        
        return {'message': 'Template set as default', 'id': template_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/templates/{template_id}/apply-to-all')
async def apply_template_to_all(template_id: str):
    """تطبيق النموذج على جميع الأنواع"""
    try:
        template = await db.print_templates.find_one({'id': template_id})
        if not template:
            raise HTTPException(status_code=404, detail='Template not found')
        
        content = template.get('content', '')
        name = template.get('name', 'قالب')
        
        # Apply to all types
        types = ['invoice', 'diagnosis', 'quote', 'receipt', 'vehicle_estimate']
        applied = []
        
        for t in types:
            await db.print_templates.update_one(
                {'type': t},
                {'$set': {'content': content, 'name': f'{name} - {t}', 'isActive': True}},
                upsert=True
            )
            applied.append(t)
        
        return {'message': 'Template applied to all types', 'applied': applied}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/print/render', response_class=HTMLResponse)
async def print_render(payload: Dict[str, Any] = Body(...)):
    """Compatibility render endpoint: if html provided return it; otherwise attempt to resolve repair template and apply data placeholders."""
    try:
        html = (payload or {}).get('html')
        data = (payload or {}).get('data') or {}
        if not html:
            # fallback to built-in simple doc
            html = "<html><body><h3>وثيقة</h3><p>{{CUSTOMER_NAME}}</p></body></html>"
        # replace {{KEY}} with values
        for k, v in data.items():
            html = html.replace(f"{{{{{k}}}}}", str(v))
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Print: Resolve Template ---------------------
@router.post('/print/resolve-template')
async def print_resolve_template(payload: Dict[str, Any] = Body(...)):
    try:
        override_type = (payload or {}).get('override_type') or (payload or {}).get('type') or 'invoice'
        # Try DB first
        tpl = await db.print_templates.find_one({'type': override_type, 'isActive': True})
        if tpl:
            tpl.pop('_id', None)
            return {'type': override_type, 'template': tpl}
        # Fallback to bundled files
        root = os.path.dirname(os.path.abspath(__file__))
        fname = None
        if override_type in ('invoice','sales_invoice'):
            fname = os.path.join(root, 'invoice_template_repair_ar.html')
            if not os.path.exists(fname):
                fname = os.path.join(root, 'invoice_template_mechanic.html')
        elif override_type in ('diagnosis','vehicle_estimate'):
            fname = os.path.join(root, 'invoice_template_modern.html')
        elif override_type in ('quote','receipt'):
            fname = os.path.join(root, 'invoice_template_modern.html')
        content = None
        if fname and os.path.exists(fname):
            with open(fname, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = "<html><body><h1>قالب طباعة افتراضي</h1><div>{{CUSTOMER_NAME}}</div></body></html>"
        tpl = {'id': str(uuid.uuid4()), 'name': f'Default {override_type}', 'content': content, 'isActive': True, 'type': override_type}
        return {'type': override_type, 'template': tpl}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Invoice Templates (Excel-first + Design) ---------------------
@router.get('/invoice-templates')
async def list_invoice_templates():
    # In memory mode, avoid hitting Mongo (returns empty list instead of 500)
    if os.environ.get('DB_PROVIDER', 'mongo').lower() == 'memory':
        return []
    docs = await db.invoice_templates.find({'archived': {'$ne': True}}).sort('createdAt', -1).to_list(length=1000)
    out = []
    for d in docs:
        d.pop('_id', None)
        out.append(d)
    return out

@router.get('/invoice-templates/{tid}')
async def get_invoice_template(tid: str):
    d = await db.invoice_templates.find_one({'id': tid})
    if not d:
        raise HTTPException(status_code=404, detail='Template not found')
    d.pop('_id', None)
    return d

@router.delete('/invoice-templates/{tid}')
async def delete_invoice_template(tid: str):
    # Soft delete: archive instead of physical delete
    await db.invoice_templates.update_one({'id': tid}, {'$set': {'archived': True, 'archivedAt': datetime.utcnow()}})
    return {'status': 'archived'}

@router.put('/invoice-templates/{tid}')
async def update_invoice_template(tid: str, payload: Dict[str, Any] = Body(...)):
    await db.invoice_templates.update_one({'id': tid}, {'$set': {**payload, 'updatedAt': datetime.utcnow()}})
    doc = await db.invoice_templates.find_one({'id': tid})
    if not doc:
        raise HTTPException(status_code=404, detail='Template not found')
    doc.pop('_id', None)
    return doc

@router.post('/invoice-templates/create-blank')
async def create_blank_template(payload: Dict[str, Any] = Body(None)):
    try:
        name = (payload or {}).get('name') or 'قالب فارغ'
        rows = int((payload or {}).get('rows') or 12)
        cols = int((payload or {}).get('cols') or 8)
        preview = [[ '' for _ in range(cols) ] for _ in range(rows)]
        # place a default ITEMS anchor and headers row
        if rows >= 2:
            preview[0][0] = '{{WORKSHOP_NAME}}'
            preview[0][3] = '{{CUSTOMER_NAME}}'
            preview[1][0] = '{{ITEMS}}'
        doc = {
            'id': str(uuid.uuid4()),
            'name': name,
            'format': 'xlsx',
            'fileId': None,
            'fields': ['{{WORKSHOP_NAME}}','{{CUSTOMER_NAME}}','{{ITEMS}}'],
            'preview': preview,
            'mapping': {},
            'itemsConfig': {'anchor': '{{ITEMS}}', 'columns': {'description':'','qty':'','price':'','total':''}},
            'elements': [],
            'schema': [],
            'page': {'size': 'A4', 'orientation': 'portrait'},
            'isDefault': False,
            'createdAt': datetime.utcnow()
        }
        await db.invoice_templates.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/invoice-templates/{tid}/design')
async def save_design(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        elements = (payload or {}).get('elements') or []
        schema = (payload or {}).get('schema') or []
        page = (payload or {}).get('page') or {'size': 'A4', 'orientation': 'portrait'}
        await db.invoice_templates.update_one({'id': tid}, {'$set': {'elements': elements, 'schema': schema, 'page': page, 'updatedAt': datetime.utcnow()}})
        d = await db.invoice_templates.find_one({'id': tid})
        if not d:
            raise HTTPException(status_code=404, detail='Template not found')
        d.pop('_id', None)
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/invoice-templates/{tid}/save-json')
async def save_template_from_json(tid: str, payload: Dict[str, Any] = Body(...)):
    # also persist mapping/items if provided for unified save
    alt_mapping = (payload or {}).get('mapping')
    alt_items = (payload or {}).get('items')
    if alt_mapping is not None or alt_items is not None:
        try:
            await db.invoice_templates.update_one({'id': tid}, {'$set': {'mapping': alt_mapping or {}, 'itemsConfig': alt_items or {}, 'updatedAt': datetime.utcnow()}})
        except Exception:
            pass
    try:
        if not xlsxwriter:
            raise HTTPException(status_code=500, detail='xlsxwriter not installed')
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
        file_id = None
        if templates_bucket:
            try:
                file_oid = await templates_bucket.upload_from_stream(f'template_{tid}.xlsx', io.BytesIO(xlsx_bytes), metadata={'content_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
                file_id = str(file_oid)
            except Exception as e:
                print(f"gridfs upload failed: {e}")
        await db.invoice_templates.update_one({'id': tid}, {'$set': {'format': 'xlsx', 'fileId': file_id, 'updatedAt': datetime.utcnow()}})
        return {'status': 'ok', 'fileId': file_id}
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

@router.post('/invoice-templates/{tid}/save-named')
async def save_named_copy(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        if not xlsxwriter:
            raise HTTPException(status_code=500, detail='xlsxwriter not installed')
        name = (payload or {}).get('name') or 'فاتوره'
        grid = (payload or {}).get('grid') or []
        mapping = (payload or {}).get('mapping') or {}
        items_cfg = (payload or {}).get('itemsConfig') or {}
        sample_data = (payload or {}).get('data') or {}
        elements = (payload or {}).get('elements') or []
        schema = (payload or {}).get('schema') or []
        page = (payload or {}).get('page') or {'size': 'A4', 'orientation': 'portrait'}
        
        # build xlsx from grid
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
        file_id = None
        if templates_bucket:
            try:
                file_oid = await templates_bucket.upload_from_stream(f'{name}_{uuid.uuid4().hex}.xlsx', io.BytesIO(xlsx_bytes), metadata={'content_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
                file_id = str(file_oid)
            except Exception as e:
                print(f"gridfs upload failed: {e}")
        new_id = str(uuid.uuid4())
        doc = {
            'id': new_id,
            'name': name,
            'format': 'xlsx',
            'fileId': file_id,
            'fields': [],
            'preview': grid,
            'mapping': mapping,
            'itemsConfig': items_cfg,
            'elements': elements,
            'schema': schema,
            'page': page,
            'sampleData': sample_data,
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

@router.post('/invoice-templates/{tid}/auto-save')
async def auto_save_template(tid: str, payload: Dict[str, Any] = Body(...)):
    """Auto-save from Studio: persist design/grid/mapping/items and ensure a snapshot model copy saved-named=فاتوره if not exists."""
    try:
        grid = (payload or {}).get('grid')
        mapping = (payload or {}).get('mapping')
        items_cfg = (payload or {}).get('itemsConfig')
        elements = (payload or {}).get('elements')
        schema = (payload or {}).get('schema')
        page = (payload or {}).get('page')
        updates = {'updatedAt': datetime.utcnow()}
        if grid is not None:
            updates['preview'] = grid
        if mapping is not None:
            updates['mapping'] = mapping
        if items_cfg is not None:
            updates['itemsConfig'] = items_cfg
        if elements is not None:
            updates['elements'] = elements
        if schema is not None:
            updates['schema'] = schema
        if page is not None:
            updates['page'] = page
        if updates:
            await db.invoice_templates.update_one({'id': tid}, {'$set': updates})
        # create snapshot if no previous snapshot with name startswith 'فاتوره'
        snap = await db.invoice_templates.find_one({'name': {'$regex': '^فاتوره'}, 'sourceId': tid, 'archived': {'$ne': True}})
        if not snap:
            # minimal snapshot without heavy XLSX write for performance
            new_id = str(uuid.uuid4())
            base = await db.invoice_templates.find_one({'id': tid})
            if base:
                base.pop('_id', None)
                base.update({'id': new_id, 'name': 'فاتوره', 'sourceId': tid, 'isDefault': False, 'createdAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()})
                await db.invoice_templates.insert_one(base)
        doc = await db.invoice_templates.find_one({'id': tid})
        doc.pop('_id', None)
        return {'status': 'ok', 'template': doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Duplicate code removed

@router.post('/print/invoice-xlsx')
async def print_invoice_xlsx(payload: Dict[str, Any] = Body(...)):
    try:
        if not openpyxl:
            raise HTTPException(status_code=500, detail='openpyxl not installed')
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
        # load bytes
        if t_doc.get('fileId') and templates_bucket:
            buf = io.BytesIO()
            await templates_bucket.download_to_stream(ObjectId(t_doc['fileId']), buf)
            file_bytes = buf.getvalue()
        else:
            # build from preview
            if not xlsxwriter:
                raise HTTPException(status_code=500, detail='xlsxwriter not installed')
            out = io.BytesIO()
            book = xlsxwriter.Workbook(out, {'in_memory': True})
            sheet = book.add_worksheet('Template')
            for r, row in enumerate(t_doc.get('preview') or []):
                for c, val in enumerate(row):
                    sheet.write(r, c, '' if val is None else str(val))
            book.close()
            file_bytes = out.getvalue()
        # fill
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
                        s = v
                        start = 0
                        phs = []
                        while True:
                            i = s.find('{{', start)
                            if i == -1:
                                break
                            j = s.find('}}', i+2)
                            if j == -1:
                                break
                            phs.append(s[i:j+2])
                            start = j+2
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
                        s = val
                        start = 0
                        phs = []
                        nv = val
                        while True:
                            i = s.find('{{', start)
                            if i == -1:
                                break
                            j = s.find('}}', i+2)
                            if j == -1:
                                break
                            phs.append(s[i:j+2])
                            start = j+2
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


# --------------------- CEO Analytics (multi-account) ---------------------
@router.post('/ceo/ai-analysis-multi')
async def ceo_ai_analysis_multi(payload: Dict[str, Any] = Body(...)):
    try:
        account_ids = (payload or {}).get('accountIds') or []
        question = (payload or {}).get('question') or ''
        days = int((payload or {}).get('days') or 30)
        if not account_ids:
            accs = await db.business_accounts.find({}).to_list(length=1000)
            account_ids = [a.get('id') for a in accs if a.get('id')]
        end = datetime.utcnow()
        start = end - timedelta(days=days)
        tx = await db.transactions.find({'date': {'$gte': start, '$lte': end}, 'accountId': {'$in': account_ids}}).to_list(length=100000)
        per = []
        acc_docs = await db.business_accounts.find({'id': {'$in': account_ids}}).to_list(length=1000)
        name_map = {a.get('id'): a.get('name','Account') for a in acc_docs}
        for aid in account_ids:
            ftx = [t for t in tx if t.get('accountId') == aid]
            income = sum(float(t.get('amount',0)) for t in ftx if t.get('type')=='income')
            expense = sum(float(t.get('amount',0)) for t in ftx if t.get('type')=='expense')
            # classify expenses
            exp_operating = sum(float(t.get('amount',0)) for t in ftx if t.get('type')=='expense' and (t.get('category') in ['Electricity','Water','Fuel','Rent','Salaries','Utilities','Marketing','Misc','Operating Expenses']))
            exp_personal = sum(float(t.get('amount',0)) for t in ftx if t.get('type')=='expense' and (t.get('category') in ['Personal','Personal Expenses']))
            profit = income - expense
            per.append({'id': aid, 'name': name_map.get(aid,'Account'), 'income': income, 'expenses': expense, 'operatingExpenses': exp_operating, 'personalExpenses': exp_personal, 'profit': profit, 'profitMargin': (profit/income*100.0) if income>0 else 0.0})
        totals_income = sum(a['income'] for a in per)
        totals_expenses = sum(a['expenses'] for a in per)
        totals_profit = totals_income - totals_expenses
        result = {'accounts': per, 'totals': {'income': totals_income, 'expenses': totals_expenses, 'profit': totals_profit, 'profitMargin': (totals_profit/totals_income*100.0) if totals_income>0 else 0.0}, 'ai': None, 'periodDays': days}
        # Optional AI
        if question:
            try:
                import os
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                key = os.getenv('EMERGENT_LLM_KEY')
                if key:
                    sys = "أنت مساعد المدير التنفيذي. حلّل بيانات المبيعات والمصروفات التشغيلية والشخصية لكل حساب وقدّم توصيات تنفيذية مختصرة."
                    ctx_lines = [f"{a['name']}: دخل {a['income']:.0f}، مصروف {a['expenses']:.0f}، تشغيلي {a['operatingExpenses']:.0f}، شخصي {a['personalExpenses']:.0f}، ربح {a['profit']:.0f}" for a in per]
                    ctx = "\n".join(ctx_lines)
                    chat = LlmChat(api_key=key, session_id=str(uuid.uuid4()), system_message=sys).with_model('anthropic','claude-sonnet-4.5-20250929')
                    ans = await chat.send_message(UserMessage(text=f"السؤال: {question}\nالبيانات:\n{ctx}"))
                    result['ai'] = {'answer': ans, 'model': 'openai/gpt-5'}
            except Exception as ex:
                print(f"AI error: {ex}")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- CEO Accounts (seed + get) ---------------------
@router.post('/ceo/seed-accounts')
async def ceo_seed_accounts():
    try:
        created = 0
        # simple idempotent seeding of 24 accounts
        existing = await db.business_accounts.count_documents({})
        if existing < 24:
            base = [
                ('Main Workshop','MAIN'),
                ('Family','FAM'),
                ('Personal','PER'),
            ]
            for name, code in base:
                doc = {'id': str(uuid.uuid4()), 'name': name, 'code': code, 'currency': 'SAR', 'createdAt': datetime.utcnow()}
                await db.business_accounts.insert_one(doc)
                created += 1
            # add revenue/expense leaves
            for i in range(1,22):
                doc = {'id': str(uuid.uuid4()), 'name': f'Branch {i}', 'code': f'BR{i:02d}', 'currency': 'SAR', 'createdAt': datetime.utcnow()}
                await db.business_accounts.insert_one(doc)
                created += 1
        return {'status': 'ok', 'created': created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/ceo/accounts')
async def ceo_accounts_tree():
    try:
        tree = {
            'الإيرادات': [
                {'name': 'الخدمات', 'code': 'SRV'},
                {'name': 'قطع الغيار', 'code': 'PRT'}
            ],
            'المصروفات': [
                {'name': 'رواتب', 'code': 'SAL'},
                {'name': 'كهرباء', 'code': 'ELEC'},
                {'name': 'ماء', 'code': 'WTR'},
                {'name': 'وقود', 'code': 'FUEL'},
                {'name': 'إيجار', 'code': 'RENT'}
            ]
        }
        return {'tree': tree}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Production Activation ---------------------
@router.post('/seed/print-templates')
async def seed_print_templates():
    try:
        added = []
        defaults = [
            ('invoice','قالب فاتورة افتراضي'),
            ('sales_invoice','قالب فاتورة مبيعات'),
            ('diagnosis','قالب تقرير تشخيص'),
            ('vehicle_estimate','قالب تقدير مركبة'),
            ('quote','قالب عرض سعر'),
            ('purchase_order','قالب أمر شراء'),
            ('vendor_bill','قالب فاتورة مورد'),
            ('receipt','قالب إيصال')
        ]
        for t, name in defaults:
            exists = await db.print_templates.find_one({'type': t})
            if not exists:
                content = f"<html><body><h1>{name}</h1><div>{{{{CUSTOMER_NAME}}}}</div></body></html>"
                doc = {'id': str(uuid.uuid4()), 'type': t, 'name': name, 'content': content, 'isActive': True, 'createdAt': datetime.utcnow()}
                await db.print_templates.insert_one(doc)
                added.append(t)
        return {'added': added}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/seed/professional-templates')
async def seed_professional_templates():
    """إضافة قوالب الفواتير الاحترافية الجديدة"""
    try:
        import os
        added = []
        
        # Modern Professional Template
        modern_path = os.path.join(os.path.dirname(__file__), 'invoice_template_modern_pro.html')
        if os.path.exists(modern_path):
            with open(modern_path, 'r', encoding='utf-8') as f:
                modern_content = f.read()
            exists = await db.print_templates.find_one({'type': 'invoice_modern_pro'})
            if not exists:
                doc = {
                    'id': str(uuid.uuid4()),
                    'type': 'invoice_modern_pro',
                    'name': 'قالب فاتورة احترافي - عصري',
                    'content': modern_content,
                    'isActive': True,
                    'createdAt': datetime.utcnow(),
                    'description': 'قالب عصري مع تدرجات لونية وتصميم نظيف'
                }
                await db.print_templates.insert_one(doc)
                added.append('invoice_modern_pro')
        
        # Classic Professional Template
        classic_path = os.path.join(os.path.dirname(__file__), 'invoice_template_classic_pro.html')
        if os.path.exists(classic_path):
            with open(classic_path, 'r', encoding='utf-8') as f:
                classic_content = f.read()
            exists = await db.print_templates.find_one({'type': 'invoice_classic_pro'})
            if not exists:
                doc = {
                    'id': str(uuid.uuid4()),
                    'type': 'invoice_classic_pro',
                    'name': 'قالب فاتورة احترافي - كلاسيكي',
                    'content': classic_content,
                    'isActive': True,
                    'createdAt': datetime.utcnow(),
                    'description': 'قالب كلاسيكي رسمي مع إطارات وجداول منظمة'
                }
                await db.print_templates.insert_one(doc)
                added.append('invoice_classic_pro')
        
        return {'status': 'success', 'added': added, 'count': len(added)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Helpers ----------
def _is_template_empty(doc: Dict[str, Any]) -> bool:
    if not doc:
        return True
    if doc.get('fileId'):
        return False
    if doc.get('elements'):
        return False
    # preview grid check: if empty or only empty strings
    prev = doc.get('preview') or []
    non_empty = False
    for row in prev:
        for cell in (row or []):
            if str(cell or '').strip():
                non_empty = True
                break
        if non_empty:
            break
    if non_empty:
        return False
    # mapping/items
    if (doc.get('mapping') or {}) or (doc.get('itemsConfig') or {}):
        return False
    return True

@router.post('/invoice-templates/cleanup-empty')
async def cleanup_empty_templates(purge: Optional[bool] = False):
    try:
        docs = await db.invoice_templates.find({}).to_list(length=5000)
        to_archive = []
        to_delete = []
        for d in docs:
            if _is_template_empty(d) and not d.get('isDefault'):
                if purge:
                    to_delete.append(d.get('id'))
                else:
                    to_archive.append(d.get('id'))
        archived = 0
        deleted = 0
        if to_archive:
            await db.invoice_templates.update_many({'id': {'$in': to_archive}}, {'$set': {'archived': True, 'archivedAt': datetime.utcnow()}})
            archived = len(to_archive)
        if to_delete:
            await db.invoice_templates.delete_many({'id': {'$in': to_delete}})
            deleted = len(to_delete)
        return {'archived': archived, 'deleted': deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# improve delete safety
@router.delete('/invoice-templates/{tid}/hard')
async def hard_delete_template(tid: str):
    try:
        d = await db.invoice_templates.find_one({'id': tid})
        if not d:
            return {'status': 'ok'}
        if d.get('isDefault'):
            raise HTTPException(status_code=400, detail='لا يمكن حذف القالب الافتراضي')
        await db.invoice_templates.delete_one({'id': tid})
        return {'status': 'deleted'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/create-indexes')
async def admin_create_indexes():
    try:
        await db.approval_requests.create_index('token', unique=True)
        await db.approval_requests.create_index('vehicleId')
        await db.transactions.create_index('date')
        await db.transactions.create_index('accountId')
        await db.vehicles.create_index('customerId')
        await db.quotes.create_index('customerId')
        await db.sales_orders.create_index('customerId')
        await db.vendor_bills.create_index('supplierId')
        await db.document_dependencies.create_index([('fromDoc.docId', 1)])
        await db.document_dependencies.create_index([('toDoc.docId', 1)])
        return {'status': 'ok'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/seed/clone-basics')
async def seed_clone_basics():
    try:
        # accounts
        accounts = []
        names = [('Main Workshop','MAIN'), ('Family','FAM'), ('Personal','PER')]
        for name, code in names:
            acc = await db.business_accounts.find_one({'code': code})
            if not acc:
                acc = {'id': str(uuid.uuid4()), 'name': name, 'code': code, 'currency': 'SAR', 'createdAt': datetime.utcnow()}
                await db.business_accounts.insert_one(acc)
            accounts.append(acc)
        # budgets for current month
        from calendar import monthrange
        now = datetime.utcnow()
        period = now.strftime('%Y-%m')
        for acc in accounts:
            b = await db.budgets.find_one({'accountId': acc['id'], 'period': period})
            if not b:
                b = {'id': str(uuid.uuid4()), 'accountId': acc['id'], 'period': period, 'incomeTarget': 30000.0, 'expenseTarget': 15000.0, 'createdAt': datetime.utcnow()}
                await db.budgets.insert_one(b)
        # sample transactions
        inc = {'id': str(uuid.uuid4()), 'accountId': accounts[0]['id'], 'type': 'income', 'category': 'customer_receipt', 'amount': 1200.0, 'description': 'إيراد اختباري', 'date': now, 'createdAt': now}
        exp = {'id': str(uuid.uuid4()), 'accountId': accounts[0]['id'], 'type': 'expense', 'category': 'Electricity', 'amount': 300.0, 'description': 'مصروف كهرباء', 'date': now, 'createdAt': now}
        await db.transactions.insert_one(inc)
        await db.transactions.insert_one(exp)
        return {'status': 'ok', 'accounts': [{'id': a['id'], 'name': a['name']} for a in accounts], 'budgets': period}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ Genspark Agent Proxy ============
@router.post('/public-agent/chat')
async def public_agent_chat(payload: Dict[str, Any] = Body(...)):
    try:
        message = payload.get('message')
        session_id = payload.get('sessionId')
        
        # Import here to avoid circular imports if any
        from genspark_service import chat_with_genspark
        
        # Run in thread pool to avoid blocking
        result = await asyncio.to_thread(chat_with_genspark, message, session_id)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
