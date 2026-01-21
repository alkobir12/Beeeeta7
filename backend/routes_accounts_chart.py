"""
مسارات دليل الحسابات
Chart of Accounts Routes
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid

from models_financial import Account, AccountBase

router = APIRouter(prefix="/api/accounts-chart")

# قاعدة بيانات مؤقتة (ستُستبدل بـ MongoDB/Supabase)
accounts_db = []

# بيانات افتراضية
DEFAULT_ACCOUNTS = [
    {'code': '1001', 'name': 'الصندوق', 'type': 'asset', 'balance': 50000},
    {'code': '1002', 'name': 'البنك', 'type': 'asset', 'balance': 100000},
    {'code': '2001', 'name': 'حسابات العملاء', 'type': 'asset', 'balance': 25000},
    {'code': '3001', 'name': 'مخزون قطع الغيار', 'type': 'asset', 'balance': 75000},
    {'code': '4001', 'name': 'إيرادات خدمات الصيانة', 'type': 'revenue', 'balance': 0},
    {'code': '4002', 'name': 'إيرادات بيع قطع الغيار', 'type': 'revenue', 'balance': 0},
    {'code': '5001', 'name': 'تكلفة قطع الغيار المباعة', 'type': 'expense', 'balance': 0},
    {'code': '5002', 'name': 'رواتب الموظفين', 'type': 'expense', 'balance': 0},
    {'code': '5003', 'name': 'مصاريف التشغيل', 'type': 'expense', 'balance': 0},
    {'code': '5004', 'name': 'إيجار الورشة', 'type': 'expense', 'balance': 0},
    {'code': '5005', 'name': 'كهرباء وماء', 'type': 'expense', 'balance': 0},
    {'code': '6001', 'name': 'حسابات الموردين', 'type': 'liability', 'balance': 15000},
]

def _initialize_accounts():
    """تهيئة الحسابات الافتراضية"""
    if not accounts_db:
        for acc_data in DEFAULT_ACCOUNTS:
            account = Account(
                id=str(uuid.uuid4()),
                code=acc_data['code'],
                name=acc_data['name'],
                type=acc_data['type'],
                balance=acc_data['balance'],
                parentAccount=None,
                createdAt=datetime.now(),
                active=True
            )
            accounts_db.append(account.dict())

@router.get("")
async def get_accounts():
    """الحصول على جميع الحسابات"""
    _initialize_accounts()
    return {"accounts": accounts_db}

@router.get("/{account_id}")
async def get_account(account_id: str):
    """الحصول على حساب معين"""
    _initialize_accounts()
    account = next((a for a in accounts_db if a['id'] == account_id), None)
    if not account:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    return account

@router.post("")
async def create_account(account: AccountBase):
    """إنشاء حساب جديد"""
    _initialize_accounts()
    
    # التحقق من عدم تكرار الرمز
    if any(a['code'] == account.code for a in accounts_db):
        raise HTTPException(status_code=400, detail="رمز الحساب موجود مسبقاً")
    
    new_account = Account(
        id=str(uuid.uuid4()),
        code=account.code,
        name=account.name,
        type=account.type,
        parentAccount=account.parentAccount,
        balance=0,
        createdAt=datetime.now(),
        active=True
    )
    
    accounts_db.append(new_account.dict())
    return {"success": True, "account": new_account}

@router.put("/{account_id}")
async def update_account(account_id: str, updates: dict):
    """تحديث حساب"""
    _initialize_accounts()
    
    account = next((a for a in accounts_db if a['id'] == account_id), None)
    if not account:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    
    # تحديث الحقول المسموحة
    allowed_fields = ['name', 'type', 'parentAccount', 'active']
    for field in allowed_fields:
        if field in updates:
            account[field] = updates[field]
    
    return {"success": True, "account": account}

@router.post("/{account_id}/adjust")
async def adjust_balance(account_id: str, amount: float, description: str):
    """
    تعديل رصيد حساب (للتسويات)
    """
    _initialize_accounts()
    
    account = next((a for a in accounts_db if a['id'] == account_id), None)
    if not account:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    
    account['balance'] += amount
    
    return {
        "success": True,
        "account": account,
        "adjustment": {
            "amount": amount,
            "description": description,
            "new_balance": account['balance']
        }
    }

@router.get("/balance-sheet/summary")
async def get_balance_sheet():
    """
    الحصول على ملخص الميزانية
    """
    _initialize_accounts()
    
    assets = sum(a['balance'] for a in accounts_db if a['type'] == 'asset')
    liabilities = sum(a['balance'] for a in accounts_db if a['type'] == 'liability')
    equity = assets - liabilities
    revenue = sum(a['balance'] for a in accounts_db if a['type'] == 'revenue')
    expenses = sum(a['balance'] for a in accounts_db if a['type'] == 'expense')
    
    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "revenue": revenue,
        "expenses": expenses,
        "net_income": revenue - expenses,
        "balanced": abs((assets - liabilities - equity)) < 0.01
    }
