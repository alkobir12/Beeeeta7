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

from motor.motor_asyncio import AsyncIOMotorGridFSBucket
import openpyxl
from openpyxl.utils import get_column_letter
import xlsxwriter
from docx import Document as DocxDocument

router = APIRouter(prefix="/api")

db = None
templates_bucket: Optional[AsyncIOMotorGridFSBucket] = None

# SSE subscribers for approvals
approvals_subscribers: set = set()


def set_db(database):
    global db, templates_bucket
    db = database
    try:
        templates_bucket = AsyncIOMotorGridFSBucket(db, bucket_name='invoice_templates')
    except Exception as e:
        print(f"GridFS bucket init failed: {e}")

# ---------------- Settings (trimmed to keep file short in this patch) ----------------
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
                "baseRepairTemplateActive": True,
                "baseTemplates": {
                    "repair": "invoice_template_repair_ar.html",
                    "invoice": "invoice_template_repair_ar.html",
                    "vehicle_status": "invoice_template_repair_ar.html"
                },
                "menuConfig": {
                    "simple": False,
                    "items": [
                        {"path": "/", "label": "الرئيسية", "enabled": True},
                        {"path": "/operations", "label": "عمليات الشراء/البيع", "enabled": True},
                        {"path": "/invoice-templates", "label": "استوديو قوالب الفواتير", "enabled": True}
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

# ---------------- Invoice Templates (Excel-first) ----------------

def _extract_placeholders_from_text(text: str) -> List[str]:
    out = []
    if not text:
        return out
    start = 0
    while True:
        i = text.find('{{', start)
        if i == -1:
            break
        j = text.find('}}', i + 2)
        if j == -1:
            break
        out.append(text[i:j+2])
        start = j + 2
    return list(dict.fromkeys(out))

async def _store_file_to_gridfs(filename: str, content: bytes, content_type: str) -> str:
    if not templates_bucket:
        raise HTTPException(status_code=500, detail='Templates bucket not initialized')
    stream = io.BytesIO(content)
    file_id = await templates_bucket.upload_from_stream(filename, stream, metadata={'content_type': content_type})
    return str(file_id)

async def _download_file_from_gridfs(file_id: str) -> bytes:
    if not templates_bucket:
        raise HTTPException(status_code=500, detail='Templates bucket not initialized')
    from bson import ObjectId
    buf = io.BytesIO()
    await templates_bucket.download_to_stream(ObjectId(file_id), buf)
    return buf.getvalue()

@router.get('/invoice-templates')
async def list_invoice_templates():
    docs = await db.invoice_templates.find({}).sort('createdAt', -1).to_list(length=1000)
    for d in docs:
        d.pop('_id', None)
    return docs

@router.delete('/invoice-templates/{tid}')
async def delete_invoice_template(tid: str):
    await db.invoice_templates.delete_one({'id': tid})
    return {'status': 'ok'}

@router.get('/invoice-templates/{tid}')
async def get_invoice_template(tid: str):
    d = await db.invoice_templates.find_one({'id': tid})
    if not d:
        raise HTTPException(status_code=404, detail='Template not found')
    d.pop('_id', None)
    return d

@router.put('/invoice-templates/{tid}')
async def update_invoice_template(tid: str, payload: Dict[str, Any] = Body(...)):
    await db.invoice_templates.update_one({'id': tid}, {'$set': {**payload, 'updatedAt': datetime.utcnow()}})
    doc = await db.invoice_templates.find_one({'id': tid})
    doc.pop('_id', None)
    return doc

@router.post('/invoice-templates/import')
async def import_invoice_template(file: UploadFile = File(...)):
    try:
        name = file.filename
        ext = (os.path.splitext(name)[1] or '').lower()
        content = await file.read()
        fields: List[str] = []
        preview: List[List[str]] = []
        fmt = None
        if ext in ('.xlsx', '.xls'):
            fmt = 'xlsx'
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=False)
            ws = wb.active
            max_rows = min(ws.max_row, 30)
            max_cols = min(ws.max_column, 20)
            for r in range(1, max_rows+1):
                row_vals = []
                for c in range(1, max_cols+1):
                    v = ws.cell(r, c).value
                    if isinstance(v, str):
                        row_vals.append(v)
                        fields += _extract_placeholders_from_text(v)
                    else:
                        row_vals.append(v if v is not None else '')
                preview.append(row_vals)
        elif ext == '.csv':
            fmt = 'csv'
            s = content.decode('utf-8', errors='ignore')
            reader = csv.reader(io.StringIO(s))
            for i, row in enumerate(reader):
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

                if i >= 30: break
                preview.append(row[:20])
                for cell in row:
                    if isinstance(cell, str):
                        fields += _extract_placeholders_from_text(cell)
        elif ext == '.html' or ext == '.htm':
            fmt = 'html'
            text = content.decode('utf-8', errors='ignore')
            fields += _extract_placeholders_from_text(text)
            preview = [["HTML Template imported. Edit in studio."]]
        elif ext == '.docx':
            fmt = 'docx'
            docx = DocxDocument(io.BytesIO(content))
            for p in docx.paragraphs:
                fields += _extract_placeholders_from_text(p.text)
            for table in docx.tables:
                for row in table.rows:
                    preview.append([cell.text for cell in row.cells][:20])
        elif ext == '.pdf':
            fmt = 'pdf'
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    if len(pdf.pages) > 0:
                        page = pdf.pages[0]
                        table = page.extract_table()
                        if table:
                            for i, row in enumerate(table):
                                if i >= 30: break
                                preview.append([str(x) for x in row][:20])
                        else:
                            text = page.extract_text() or ''
                            fields += _extract_placeholders_from_text(text)
                            preview = [["PDF imported. No table detected."]]
            except Exception:
                preview = [["PDF imported (raw). Consider converting to Excel in studio."]]
        else:
            raise HTTPException(status_code=400, detail='صيغة غير مدعومة حالياً')
        fields = list(dict.fromkeys(fields))
        file_id = await _store_file_to_gridfs(name, content, file.content_type or 'application/octet-stream')
        tid = str(uuid.uuid4())
        doc = {
            'id': tid,
            'name': os.path.splitext(name)[0],
            'format': fmt,
            'fileId': file_id,
            'fields': fields,
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

@router.post('/invoice-templates/{tid}/save-json')
async def save_template_from_json(tid: str, payload: Dict[str, Any] = Body(...)):
    """Save a template from a grid JSON (rows: [[cells...]]) and write an xlsx into GridFS"""
    try:
        grid = payload.get('grid')
        if not isinstance(grid, list):
            raise HTTPException(status_code=400, detail='grid required')
        # Build xlsx from grid
        out = io.BytesIO()
        book = xlsxwriter.Workbook(out, {'in_memory': True})
        sheet = book.add_worksheet('Template')
        for r, row in enumerate(grid):
            if not isinstance(row, list):
                continue
            for c, val in enumerate(row):
                sheet.write(r, c, val if val is not None else '')
        book.close()
        xlsx_bytes = out.getvalue()
        # Store new file
        file_id = await _store_file_to_gridfs(f'template_{tid}.xlsx', xlsx_bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        await db.invoice_templates.update_one({'id': tid}, {'$set': {'format': 'xlsx', 'fileId': file_id, 'updatedAt': datetime.utcnow()}})
        return {'status': 'ok', 'fileId': file_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/print/invoice-xlsx')
async def print_invoice_xlsx(payload: Dict[str, Any] = Body(...)):
    """Fill an xlsx template by replacing {{PLACEHOLDERS}} and optionally expanding {{ITEMS}} rows.
    Input: { templateId?, data: { WORKSHOP_NAME, CUSTOMER_NAME, ..., ITEMS: [{description, qty, price, total}] } }
    """
    try:
        tId = (payload or {}).get('templateId')
        data = (payload or {}).get('data') or {}
        if not tId:
            # use latest default template
            tDoc = await db.invoice_templates.find_one({'isDefault': True})
            if not tDoc:
                raise HTTPException(status_code=404, detail='لا يوجد قالب افتراضي')
        else:
            tDoc = await db.invoice_templates.find_one({'id': tId})
            if not tDoc:
                raise HTTPException(status_code=404, detail='Template not found')
        file_bytes = await _download_file_from_gridfs(tDoc['fileId'])
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
        ws = wb.active
        # Replace simple placeholders in all cells
        max_r = ws.max_row
        max_c = ws.max_column
        items = data.get('ITEMS') or []
        items_anchor_row = None
        items_template_cells = None
        for r in range(1, max_r+1):
            row_has_anchor = False
            row_cells = []
            for c in range(1, max_c+1):
                cell = ws.cell(r, c)
                v = cell.value
                if isinstance(v, str):
                    if v.strip() == '{{ITEMS}}':
                        row_has_anchor = True
                    else:
                        # replace {{KEY}}
                        phs = _extract_placeholders_from_text(v)
                        nv = v
                        for ph in phs:
                            key = ph.strip('{}')
                            nv = nv.replace(ph, str(data.get(key, '')))
                        if nv != v:
                            cell.value = nv
                row_cells.append(cell.value)
            if row_has_anchor and items_anchor_row is None:
                items_anchor_row = r
                items_template_cells = row_cells
        if items_anchor_row:
            # Use the row below as template if available; else use same row
            template_row_idx = min(items_anchor_row+1, ws.max_row)
            template_vals = [ws.cell(template_row_idx, c).value for c in range(1, max_c+1)]
            # Remove anchor row and template row
            ws.delete_rows(items_anchor_row, 2)
            insert_at = items_anchor_row
            for it in items:
                # create a row based on template_vals replacing {{ITEMS.field}}
                new_vals = []
                for val in template_vals:
                    if isinstance(val, str):
                        nv = val
                        phs = _extract_placeholders_from_text(val)
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
        # Save to bytes
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return Response(content=out.getvalue(), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': 'attachment; filename="invoice.xlsx"'})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------- Existing SSE approvals endpoints would be here (omitted to keep patch short) ----------------
