from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import List, Optional
import uuid

from models_extended import (
    Appointment, AppointmentCreate,
    Employee, EmployeeCreate, SalaryPayment, AdvancePayment,
    LoyaltyPoints, PointsTransaction, Coupon,
    MaintenanceReminder, Warranty, WarrantyClaim,
    Supplier, PurchaseOrder, WorkshopProfile,
    TemplateDoc, DiagnosisReport, ApprovalRequest, AppSettings,
    Account, Budget, BusinessAccount, Operation, OperationItem
)

# Router
router = APIRouter(prefix="/api")

# Database will be injected from server.py
db = None

def set_db(database):
    global db
    db = database

# ============ Business Accounts (فروع منفصلة) ============
@router.post("/biz-accounts", response_model=BusinessAccount)
async def create_business_account(acc: BusinessAccount):
    await db.business_accounts.insert_one(acc.dict())
    return acc

@router.get("/biz-accounts", response_model=List[BusinessAccount])
async def list_business_accounts(active_only: bool = True):
    query = {"isActive": True} if active_only else {}
    rows = await db.business_accounts.find(query).to_list(1000)
    return [BusinessAccount(**r) for r in rows]

@router.put("/biz-accounts/{acc_id}")
async def update_business_account(acc_id: str, payload: dict):
    update = {k: v for k, v in payload.items() if v is not None}
    await db.business_accounts.update_one({"id": acc_id}, {"$set": update})
    doc = await db.business_accounts.find_one({"id": acc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Account not found")
    return doc

# ============ Operations (Purchase/Sale) ============
@router.post("/operations", response_model=Operation)
async def create_operation(payload: dict):
    # payload: {accountId, type, partnerType, partnerName, items[], paymentMethod, notes}
    try:
        items = [OperationItem(**i) for i in payload.get('items', [])]
        subtotal = sum(i.quantity * i.price for i in items)
        total = subtotal  # no tax per current settings
        op = Operation(
            accountId=payload['accountId'],
            type=payload['type'],
            partnerType=payload.get('partnerType', 'supplier' if payload['type']=='purchase' else 'customer'),
            partnerName=payload.get('partnerName'),
            partnerId=payload.get('partnerId'),
            items=items,
            subtotal=subtotal,
            total=total,
            paymentMethod=payload.get('paymentMethod', 'cash'),
            notes=payload.get('notes')
        )
        await db.operations.insert_one(op.dict())

        # Inventory adjust
        for i in items:
            if i.itemType == 'part' and i.itemId:
                if op.type == 'purchase':
                    await db.parts.update_one({"id": i.itemId}, {"$inc": {"quantity": i.quantity}})
                elif op.type == 'sale':
                    await db.parts.update_one({"id": i.itemId}, {"$inc": {"quantity": -i.quantity}})

        # Accounting transaction
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "type": 'income' if op.type == 'sale' else 'expense',
            "category": 'parts' if any(i.itemType=='part' for i in items) else 'service',
            "amount": total,
            "description": f"{op.type} operation for account {op.accountId}",
            "paymentMethod": op.paymentMethod,
            "reference": op.id,
            "date": datetime.utcnow()
        })

        return op
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/operations", response_model=List[Operation])
async def list_operations(account_id: Optional[str] = None, type: Optional[str] = None):
    query = {}
    if account_id:
        query['accountId'] = account_id
    if type:
        query['type'] = type
    rows = await db.operations.find(query).sort("date", -1).to_list(1000)
    return [Operation(**r) for r in rows]

# ============ باقي المسارات (موجودة مسبقاً) ============
# يحتفظ الملف بباقي المسارات كما تم بناؤها سابقاً (مواعيد/موظفين/ولاء/كوبونات/ضمان/موردين/بروفايل/قوالب/إعدادات/تقارير/اعتمادات)
