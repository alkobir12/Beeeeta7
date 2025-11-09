from fastapi import APIRouter, HTTPException, Body, Request
from fastapi.responses import StreamingResponse, Response
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import asyncio
import json
import uuid

router = APIRouter(prefix="/api")

db = None

# --------------------- DB bind ---------------------

def set_db(database):
    global db
    db = database

# --------------------- Vehicles minimal ---------------------
@router.get('/vehicles/minimal')
async def vehicles_minimal():
    try:
        docs = await db.vehicles.find({}).sort('createdAt', -1).to_list(length=2000)
        out = []
        for v in docs:
            out.append({
                'id': v.get('id'),
                'plateNumber': v.get('plateNumber'),
                'brand': v.get('brand'),
                'model': v.get('model'),
                'year': v.get('year'),
                'customerId': v.get('customerId'),
                'customerName': v.get('customerName'),
            })
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------- Chart of Accounts ---------------------
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
        'COGS': ['Parts Purchase'],
        'Operating Expenses': ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Misc']
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

# --------------------- Operations ---------------------
@router.get('/operations')
async def list_operations(account_id: Optional[str] = None, type: Optional[str] = None, vehicle_id: Optional[str] = None):
    try:
        q: Dict[str, Any] = {}
        if account_id: q['accountId'] = account_id
        if type: q['type'] = type
        if vehicle_id: q['vehicleId'] = vehicle_id
        ops = await db.operations.find(q).sort('date', -1).to_list(length=2000)
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
        o = await db.operations.find_one({'id': op_id})
        if not o: raise HTTPException(status_code=404, detail='not found')
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
        await db.operations.update_one({'id': op_id}, {'$set': {**payload, 'updatedAt': datetime.utcnow()}})
        o = await db.operations.find_one({'id': op_id})
        if not o: raise HTTPException(status_code=404, detail='not found')
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

# --------------------- Transactions (sales/expenses) ---------------------
@router.get('/transactions')
async def list_transactions(type: Optional[str] = None, vehicle_id: Optional[str] = None, account_id: Optional[str] = None):
    try:
        q: Dict[str, Any] = {}
        if type: q['type'] = type
        if vehicle_id: q['vehicleId'] = vehicle_id
        if account_id: q['accountId'] = account_id
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
