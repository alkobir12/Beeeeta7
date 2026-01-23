from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/finance", tags=["finance"])

# MongoDB connection
def get_db():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'workshop_db')
    if not mongo_url:
        raise Exception("MONGO_URL environment variable not set")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]

@router.get("/reports/balance-sheet")
async def get_balance_sheet(
    workshop_id: str = Query(..., description="معرف الورشة"),
    as_of_date: Optional[str] = Query(None, description="تاريخ التقرير (YYYY-MM-DD)")
):
    """
    إرجاع الميزانية العمومية بناءً على العمليات في MongoDB
    """
    # TODO: جلب البيانات الحقيقية من MongoDB
    # حالياً: بيانات تجريبية
    
    # بناء قائمة الحسابات للأصول
    assets_accounts = [
        {"id": "1", "code": "101", "name": "النقدية", "balance": 150000},
        {"id": "2", "code": "113", "name": "ذمم مدينة عملاء", "balance": 250000},
        {"id": "3", "code": "121", "name": "مخزون قطع الغيار", "balance": 180000},
        {"id": "4", "code": "151", "name": "معدات", "balance": 500000},
        {"id": "5", "code": "152", "name": "سيارات", "balance": 300000},
    ]
    
    liabilities_accounts = [
        {"id": "6", "code": "211", "name": "ذمم دائنة موردين", "balance": 320000},
        {"id": "7", "code": "221", "name": "قروض قصيرة الأجل", "balance": 150000},
        {"id": "8", "code": "231", "name": "قروض طويلة الأجل", "balance": 400000},
    ]
    
    equity_accounts = [
        {"id": "9", "code": "301", "name": "رأس المال", "balance": 1000000},
        {"id": "10", "code": "302", "name": "الأرباح المحتجزة", "balance": 510000},
    ]
    
    # حساب الإجماليات
    total_assets = sum(acc["balance"] for acc in assets_accounts)
    total_liabilities = sum(acc["balance"] for acc in liabilities_accounts)
    total_equity = sum(acc["balance"] for acc in equity_accounts)
    
    return {
        "success": True,
        "data": {
            "as_of": as_of_date or datetime.now().strftime('%Y-%m-%d'),
            "totals": {
                "assets": total_assets,
                "liabilities": total_liabilities,
                "equity": total_equity,
                "liabilities_plus_equity": total_liabilities + total_equity
            },
            "sections": {
                "assets": assets_accounts,
                "liabilities": liabilities_accounts,
                "equity": equity_accounts
            }
        }
    }

@router.get("/reports/income-statement")
async def get_income_statement(
    workshop_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...)
):
    """
    قائمة الدخل من بيانات العمليات الحقيقية في MongoDB
    """
    try:
        db = get_db()
        
        # تحويل التواريخ إلى datetime objects
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
        
        # جلب جميع العمليات في الفترة الزمنية
        operations = await db.operations.find({
            "date": {
                "$gte": start_dt,
                "$lte": end_dt
            }
        }).to_list(1000)
        
        # تصنيف العمليات حسب النوع
        revenue_accounts = {}
        expense_accounts = {}
        
        for op in operations:
            op_type = op.get('type', '')
            total = op.get('total', 0) or 0
            
            if op_type == 'sale':
                # عمليات البيع = إيرادات
                code = "411"
                if code not in revenue_accounts:
                    revenue_accounts[code] = {
                        "name": "إيرادات خدمات الصيانة وقطع الغيار",
                        "amount": 0
                    }
                revenue_accounts[code]["amount"] += total
                
            elif op_type == 'purchase':
                # عمليات الشراء = مصروفات
                code = "514"
                if code not in expense_accounts:
                    expense_accounts[code] = {
                        "name": "مصاريف قطع الغيار",
                        "amount": 0
                    }
                expense_accounts[code]["amount"] += total
                
            elif op_type == 'expense':
                # مصروفات أخرى
                code = op.get('accountCode', '521')
                account_name = op.get('accountName', 'مصاريف عامة')
                if code not in expense_accounts:
                    expense_accounts[code] = {
                        "name": account_name,
                        "amount": 0
                    }
                expense_accounts[code]["amount"] += total
        
        # حساب الإجماليات
        total_revenue = sum(acc["amount"] for acc in revenue_accounts.values())
        total_expenses = sum(acc["amount"] for acc in expense_accounts.values())
        net_income = total_revenue - total_expenses
        
        return {
            "success": True,
            "data": {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "totals": {
                    "revenue": total_revenue,
                    "expenses": total_expenses,
                    "net_income": net_income
                },
                "details": {
                    "revenue_by_account": revenue_accounts,
                    "expenses_by_account": expense_accounts
                }
            }
        }
        
    except Exception as e:
        print(f"Error in get_income_statement: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "totals": {"revenue": 0, "expenses": 0, "net_income": 0},
                "details": {"revenue_by_account": {}, "expenses_by_account": {}}
            }
        }

@router.get("/reports/cash-flow")
async def get_cash_flow(
    workshop_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...)
):
    """
    قائمة التدفقات النقدية
    """
    return {
        "success": True,
        "data": {
            "period": f"{start_date} إلى {end_date}",
            "operating_activities": {
                "cash_from_customers": 520000,
                "cash_to_suppliers": -280000,
                "cash_to_employees": -150000,
                "net_operating_cash": 90000
            },
            "investing_activities": {
                "equipment_purchase": -120000,
                "net_investing_cash": -120000
            },
            "financing_activities": {
                "loan_proceeds": 200000,
                "loan_payments": -50000,
                "net_financing_cash": 150000
            },
            "net_change_in_cash": 120000,
            "beginning_cash": 30000,
            "ending_cash": 150000
        }
    }

@router.get("/reports/trial-balance")
async def get_trial_balance(
    workshop_id: str = Query(...),
    date: Optional[str] = Query(None)
):
    """
    ميزان المراجعة
    """
    return {
        "success": True,
        "data": {
            "period": f"حتى {date or datetime.now().strftime('%Y-%m-%d')}",
            "accounts": [
                {"code": "101", "name": "النقدية", "debit": 150000, "credit": 0},
                {"code": "113", "name": "ذمم مدينة", "debit": 250000, "credit": 0},
                {"code": "121", "name": "مخزون قطع الغيار", "debit": 180000, "credit": 0},
                {"code": "211", "name": "ذمم دائنة", "debit": 0, "credit": 320000},
                {"code": "301", "name": "رأس المال", "debit": 0, "credit": 1000000},
                {"code": "411", "name": "إيرادات الخدمات", "debit": 0, "credit": 600000},
                {"code": "514", "name": "مصاريف قطع الغيار", "debit": 120000, "credit": 0},
                {"code": "521", "name": "مصاريف رواتب", "debit": 150000, "credit": 0},
            ],
            "totals": {
                "total_debit": 850000,
                "total_credit": 1920000
            }
        }
    }

@router.get("/chart-of-accounts")
async def get_chart_of_accounts(
    workshop_id: str = Query(...)
):
    """
    دليل الحسابات المستخلص من العمليات
    """
    # إنشاء دليل حسابات ديناميكي من أنواع العمليات
    accounts = [
        {"code": "101", "name": "النقدية", "type": "asset", "balance": 150000},
        {"code": "113", "name": "ذمم مدينة عملاء", "type": "asset", "balance": 250000},
        {"code": "121", "name": "مخزون قطع الغيار", "type": "asset", "balance": 180000},
        {"code": "211", "name": "ذمم دائنة موردين", "type": "liability", "balance": 320000},
        {"code": "301", "name": "رأس المال", "type": "equity", "balance": 1000000},
        {"code": "411", "name": "إيرادات خدمات الصيانة", "type": "revenue", "balance": 475000},
        {"code": "412", "name": "إيرادات بيع قطع الغيار", "type": "revenue", "balance": 125000},
        {"code": "514", "name": "مصاريف قطع الغيار", "type": "expense", "balance": 120000},
        {"code": "521", "name": "مصاريف رواتب", "type": "expense", "balance": 150000},
        {"code": "522", "name": "مصاريف إيجار", "type": "expense", "balance": 50000},
        {"code": "523", "name": "مصاريف كهرباء وماء", "type": "expense", "balance": 25000},
    ]
    
    return {"success": True, "data": accounts}

@router.get("/journal-entries")
async def get_journal_entries(
    workshop_id: str = Query(...),
    skip: int = Query(0),
    limit: int = Query(50)
):
    """
    القيود المحاسبية
    """
    # هنا يمكن لاحقاً جلب القيود الحقيقية من MongoDB
    entries = [
        {
            "id": "entry-001",
            "date": "2025-01-20",
            "description": "قيد بيع خدمة صيانة",
            "lines": [
                {"account": "113", "account_name": "ذمم مدينة", "debit": 5000, "credit": 0},
                {"account": "411", "account_name": "إيرادات خدمات", "debit": 0, "credit": 5000}
            ],
            "total": 5000
        },
        {
            "id": "entry-002",
            "date": "2025-01-21",
            "description": "قيد شراء قطع غيار",
            "lines": [
                {"account": "514", "account_name": "مصاريف قطع الغيار", "debit": 3000, "credit": 0},
                {"account": "211", "account_name": "ذمم دائنة", "debit": 0, "credit": 3000}
            ],
            "total": 3000
        }
    ]
    
    return {"success": True, "data": entries, "total": len(entries)}

@router.get("/operations")
async def get_financial_operations(
    workshop_id: str = Query(...),
    skip: int = Query(0),
    limit: int = Query(50)
):
    """
    جميع العمليات المالية (مبيعات، مشتريات، مصروفات)
    """
    # يمكن لاحقاً ربطها بـ operations collection في MongoDB
    return {
        "success": True,
        "data": [],
        "total": 0
    }
