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

@router.get('/biz-accounts')
async def list_accounts():
    try:
        docs = await db.business_accounts.find({}).to_list(length=1000)
        for d in docs:
            d.pop('_id', None)
        return docs
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
