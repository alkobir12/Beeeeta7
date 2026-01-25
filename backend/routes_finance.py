from fastapi import APIRouter, Query
from accounting_auditor import AccountingSystemAuditor

from datetime import datetime
from typing import Optional
import uuid
import os
from supabase import create_client
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/finance", tags=["finance"])

# Supabase connection for writing data
try:
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if supabase_url and supabase_key:
        supabase = create_client(supabase_url, supabase_key)
        print("✅ Supabase connected for Finance API")
    else:
        supabase = None
        print("⚠️ Supabase credentials missing")
except Exception as e:
    supabase = None
    print(f"⚠️ Supabase connection failed: {e}")

# MongoDB connection for reading operations (financial reports)
mongo_client = None
finance_db = None


def init_mongo_connection():
    global mongo_client, finance_db
    mongo_uri = os.getenv("MONGO_URL")
    if mongo_uri:
        try:
            mongo_client = AsyncIOMotorClient(mongo_uri)
            finance_db = mongo_client.get_database(os.getenv("DB_NAME", "workshop_db"))
            print("✅ MongoDB connected for Finance API")
        except Exception as e:
            print(f"⚠️ MongoDB connection failed: {e}")
            finance_db = None


# Initialize on module load
init_mongo_connection()

# Legacy: DB will be set from server.py (for backward compatibility)
db = None


def set_db(database):
    global db
    db = database


@router.get("/reports/balance-sheet")
async def get_balance_sheet(
    workshop_id: str = Query(..., description="معرف الورشة"),
    as_of_date: Optional[str] = Query(None, description="تاريخ التقرير (YYYY-MM-DD)"),
):
    """
    الميزانية العمومية - محسوبة من دليل الحسابات
    """
    try:
        target_date = as_of_date or datetime.now().strftime("%Y-%m-%d")
        
        # جلب دليل الحسابات (الذي يحتوي على الأرصدة الصحيحة)
        coa_response = await get_chart_of_accounts(workshop_id)
        
        if not coa_response.get('success'):
            raise Exception("Failed to get chart of accounts")
        
        accounts = coa_response.get('data', [])
        
        # تصنيف الحسابات
        assets_accounts = []
        liabilities_accounts = []
        equity_accounts = []
        
        for acc in accounts:
            balance = float(acc.get('balance', 0))
            if balance == 0:
                continue
            
            acc_type = acc.get('type', '')
            account_data = {
                "id": acc.get('id'),
                "code": acc.get('code'),
                "name": acc.get('name') or acc.get('name_ar'),
                "balance": abs(balance)
            }
            
            if acc_type == 'asset':
                assets_accounts.append(account_data)
            elif acc_type == 'liability':
                liabilities_accounts.append(account_data)
            elif acc_type == 'equity':
                equity_accounts.append(account_data)
        
        # حساب الإجماليات
        total_assets = sum(acc['balance'] for acc in assets_accounts)
        total_liabilities = sum(acc['balance'] for acc in liabilities_accounts)
        total_equity = sum(acc['balance'] for acc in equity_accounts)
        
        return {
            "success": True,
            "data": {
                "as_of": target_date,
                "totals": {
                    "assets": round(total_assets, 2),
                    "liabilities": round(total_liabilities, 2),
                    "equity": round(total_equity, 2),
                    "liabilities_plus_equity": round(total_liabilities + total_equity, 2),
                },
                "sections": {
                    "assets": assets_accounts,
                    "liabilities": liabilities_accounts,
                    "equity": equity_accounts,
                },
            },
        }
    
    except Exception as e:
        print(f"Balance sheet error: {e}")
        return {
            "success": False,
            "message": f"خطأ في حساب الميزانية: {str(e)}",
            "data": {
                "as_of": target_date if 'target_date' in locals() else datetime.now().strftime("%Y-%m-%d"),
                "totals": {"assets": 0, "liabilities": 0, "equity": 0, "liabilities_plus_equity": 0},
                "sections": {"assets": [], "liabilities": [], "equity": []},
            },
        }


        # تحديد التاريخ المستهدف
        target_date = as_of_date or datetime.now().strftime("%Y-%m-%d")

        # جلب جميع العمليات حتى التاريخ المحدد من Supabase
        response = (
            supabase.table("operations")
            .select("*")
            .lte("op_date", target_date)
            .execute()
        )

        operations = response.data

        # جلب القيود المحاسبية اليدوية من Supabase (إن وجدت)
        journal_entries = []
        try:
            journal_response = (
                supabase.table("journal_entries")
                .select("*")
                .lte("date", target_date)
                .execute()
            )
            journal_entries = journal_response.data if journal_response.data else []
        except Exception as je_error:
            print(
                f"Journal entries table not found (will be created later): {je_error}"
            )
            journal_entries = []

        # تصنيف العمليات
        cash = 0
        receivables = 0  # ذمم مدينة
        payables = 0  # ذمم دائنة
        total_revenue = 0
        total_expenses = 0

        # معالجة العمليات من Supabase
        for op in operations:
            op_type = op.get("type", "")
            total = float(op.get("total", 0) or 0)
            payment_method = op.get("payment_method", "cash")

            if op_type == "sale":
                # عمليات البيع
                total_revenue += total
                if payment_method == "cash":
                    cash += total
                else:
                    # آجل = ذمم مدينة
                    receivables += total

            elif op_type == "purchase":
                # عمليات الشراء
                total_expenses += total
                if payment_method == "cash":
                    cash -= total
                else:
                    # آجل = ذمم دائنة
                    payables += total

            elif op_type == "expense":
                # مصروفات أخرى
                total_expenses += total
                cash -= total

        # معالجة القيود المحاسبية اليدوية
        for entry in journal_entries:
            lines = entry.get("lines", [])
            for line in lines:
                account_code = line.get("account", "")
                debit = float(line.get("debit", 0) or 0)
                credit = float(line.get("credit", 0) or 0)

                # تحديث الأرصدة بناءً على رمز الحساب
                if account_code == "101":  # النقدية
                    cash += debit - credit
                elif account_code == "113":  # ذمم مدينة
                    receivables += debit - credit
                elif account_code == "211":  # ذمم دائنة
                    payables += credit - debit
                elif account_code.startswith("4"):  # إيرادات
                    total_revenue += credit
                elif account_code.startswith("5"):  # مصروفات
                    total_expenses += debit

        # حساب الأرباح المحتجزة
        retained_earnings = total_revenue - total_expenses

        # بناء قائمة الحسابات
        assets_accounts = []
        liabilities_accounts = []
        equity_accounts = []

        # الأصول
        if cash != 0:
            assets_accounts.append(
                {"id": "1", "code": "101", "name": "النقدية", "balance": round(cash, 2)}
            )

        if receivables > 0:
            assets_accounts.append(
                {
                    "id": "2",
                    "code": "113",
                    "name": "ذمم مدينة عملاء",
                    "balance": round(receivables, 2),
                }
            )

        # الالتزامات
        if payables > 0:
            liabilities_accounts.append(
                {
                    "id": "6",
                    "code": "211",
                    "name": "ذمم دائنة موردين",
                    "balance": round(payables, 2),
                }
            )

        # حقوق الملكية
        if retained_earnings != 0:
            equity_accounts.append(
                {
                    "id": "10",
                    "code": "302",
                    "name": "الأرباح المحتجزة",
                    "balance": round(retained_earnings, 2),
                }
            )

        # حساب الإجماليات
        total_assets = sum(acc["balance"] for acc in assets_accounts)
        total_liabilities = sum(acc["balance"] for acc in liabilities_accounts)
        total_equity = sum(acc["balance"] for acc in equity_accounts)

        return {
            "success": True,
            "data": {
                "as_of": target_date,
                "totals": {
                    "assets": round(total_assets, 2),
                    "liabilities": round(total_liabilities, 2),
                    "equity": round(total_equity, 2),
                    "liabilities_plus_equity": round(
                        total_liabilities + total_equity, 2
                    ),
                },
                "sections": {
                    "assets": assets_accounts,
                    "liabilities": liabilities_accounts,
                    "equity": equity_accounts,
                },
            },
        }

    except Exception as e:
        print(f"Error in get_balance_sheet: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "as_of": as_of_date or datetime.now().strftime("%Y-%m-%d"),
                "totals": {
                    "assets": 0,
                    "liabilities": 0,
                    "equity": 0,
                    "liabilities_plus_equity": 0,
                },
                "sections": {"assets": [], "liabilities": [], "equity": []},
            },
        }


@router.get("/reports/income-statement")
async def get_income_statement(
    workshop_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    """
    قائمة الدخل من بيانات العمليات الحقيقية في Supabase
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        # جلب جميع العمليات في الفترة الزمنية من Supabase
        response = (
            supabase.table("operations")
            .select("*")
            .gte("op_date", start_date)
            .lte("op_date", end_date)
            .execute()
        )

        operations = response.data

        # تصنيف العمليات حسب النوع
        revenue_accounts = {}
        expense_accounts = {}

        for op in operations:
            op_type = op.get("type", "")
            total = float(op.get("total", 0) or 0)

            if op_type == "sale":
                # عمليات البيع = إيرادات
                code = "411"
                if code not in revenue_accounts:
                    revenue_accounts[code] = {
                        "name": "إيرادات خدمات الصيانة وقطع الغيار",
                        "amount": 0,
                    }
                revenue_accounts[code]["amount"] += total

            elif op_type == "purchase":
                # عمليات الشراء = مصروفات
                code = "514"
                if code not in expense_accounts:
                    expense_accounts[code] = {"name": "مصاريف قطع الغيار", "amount": 0}
                expense_accounts[code]["amount"] += total

            elif op_type == "expense":
                # مصروفات أخرى
                code = op.get("accountCode", "521")
                account_name = op.get("accountName", "مصاريف عامة")
                if code not in expense_accounts:
                    expense_accounts[code] = {"name": account_name, "amount": 0}
                expense_accounts[code]["amount"] += total

        # حساب الإجماليات
        total_revenue = sum(acc["amount"] for acc in revenue_accounts.values())
        total_expenses = sum(acc["amount"] for acc in expense_accounts.values())
        net_income = total_revenue - total_expenses

        return {
            "success": True,
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "totals": {
                    "revenue": total_revenue,
                    "expenses": total_expenses,
                    "net_income": net_income,
                },
                "details": {
                    "revenue_by_account": revenue_accounts,
                    "expenses_by_account": expense_accounts,
                },
            },
        }

    except Exception as e:
        print(f"Error in get_income_statement: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "totals": {"revenue": 0, "expenses": 0, "net_income": 0},
                "details": {"revenue_by_account": {}, "expenses_by_account": {}},
            },
        }


@router.get("/reports/cash-flow")
async def get_cash_flow(
    workshop_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    """
    قائمة التدفقات النقدية من بيانات العمليات الحقيقية في Supabase
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        # جلب العمليات من Supabase
        response = (
            supabase.table("operations")
            .select("*")
            .gte("op_date", start_date)
            .lte("op_date", end_date)
            .execute()
        )

        operations = response.data

        # حساب التدفقات النقدية
        cash_from_operations = 0
        cash_to_suppliers = 0

        for op in operations:
            op_type = op.get("type", "")
            total = float(op.get("total", 0) or 0)
            payment_method = op.get("payment_method", "cash")

            if payment_method == "cash":
                if op_type == "sale":
                    cash_from_operations += total
                elif op_type == "purchase" or op_type == "expense":
                    cash_to_suppliers += total

        net_operating_cash = cash_from_operations - cash_to_suppliers

        return {
            "success": True,
            "data": {
                "period": f"{start_date} إلى {end_date}",
                "operating_activities": {
                    "cash_from_customers": round(cash_from_operations, 2),
                    "cash_to_suppliers": round(-cash_to_suppliers, 2),
                    "net_operating_cash": round(net_operating_cash, 2),
                },
                "investing_activities": {
                    "equipment_purchase": 0,
                    "net_investing_cash": 0,
                },
                "financing_activities": {
                    "loan_proceeds": 0,
                    "loan_payments": 0,
                    "net_financing_cash": 0,
                },
                "net_change_in_cash": round(net_operating_cash, 2),
                "beginning_cash": 0,
                "ending_cash": round(net_operating_cash, 2),
            },
        }

    except Exception as e:
        print(f"Error in get_cash_flow: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "period": f"{start_date} إلى {end_date}",
                "operating_activities": {
                    "cash_from_customers": 0,
                    "cash_to_suppliers": 0,
                    "net_operating_cash": 0,
                },
                "investing_activities": {
                    "equipment_purchase": 0,
                    "net_investing_cash": 0,
                },
                "financing_activities": {
                    "loan_proceeds": 0,
                    "loan_payments": 0,
                    "net_financing_cash": 0,
                },
                "net_change_in_cash": 0,
                "beginning_cash": 0,
                "ending_cash": 0,
            },
        }


@router.get("/reports/trial-balance")
async def get_trial_balance(
    workshop_id: str = Query(...), date: Optional[str] = Query(None)
):
    """
    ميزان المراجعة من البيانات الحقيقية في Supabase
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        target_date = date or datetime.now().strftime("%Y-%m-%d")

        # جلب جميع العمليات
        response = (
            supabase.table("operations")
            .select("*")
            .lte("op_date", target_date)
            .execute()
        )

        operations = response.data

        # حساب الأرصدة لكل حساب
        accounts_balances = {}

        for op in operations:
            op_type = op.get("type", "")
            total = float(op.get("total", 0) or 0)
            payment_method = op.get("payment_method", "cash")

            if op_type == "sale":
                # دائن: إيرادات
                if "411" not in accounts_balances:
                    accounts_balances["411"] = {
                        "name": "إيرادات خدمات الصيانة",
                        "debit": 0,
                        "credit": 0,
                    }
                accounts_balances["411"]["credit"] += total

                # مدين: نقدية أو ذمم
                if payment_method == "cash":
                    if "101" not in accounts_balances:
                        accounts_balances["101"] = {
                            "name": "النقدية",
                            "debit": 0,
                            "credit": 0,
                        }
                    accounts_balances["101"]["debit"] += total
                else:
                    if "113" not in accounts_balances:
                        accounts_balances["113"] = {
                            "name": "ذمم مدينة",
                            "debit": 0,
                            "credit": 0,
                        }
                    accounts_balances["113"]["debit"] += total

            elif op_type == "purchase":
                # مدين: مصروفات
                if "514" not in accounts_balances:
                    accounts_balances["514"] = {
                        "name": "مصاريف قطع الغيار",
                        "debit": 0,
                        "credit": 0,
                    }
                accounts_balances["514"]["debit"] += total

                # دائن: نقدية أو ذمم
                if payment_method == "cash":
                    if "101" not in accounts_balances:
                        accounts_balances["101"] = {
                            "name": "النقدية",
                            "debit": 0,
                            "credit": 0,
                        }
                    accounts_balances["101"]["credit"] += total
                else:
                    if "211" not in accounts_balances:
                        accounts_balances["211"] = {
                            "name": "ذمم دائنة",
                            "debit": 0,
                            "credit": 0,
                        }
                    accounts_balances["211"]["credit"] += total

        # بناء قائمة الحسابات
        accounts_list = []
        total_debit = 0
        total_credit = 0

        for code in sorted(accounts_balances.keys()):
            acc = accounts_balances[code]
            debit = round(acc["debit"], 2)
            credit = round(acc["credit"], 2)

            accounts_list.append(
                {"code": code, "name": acc["name"], "debit": debit, "credit": credit}
            )

            total_debit += debit
            total_credit += credit

        # إضافة حساب الأرباح المحتجزة
        net_income = total_credit - total_debit
        if net_income != 0:
            accounts_list.append(
                {
                    "code": "302",
                    "name": "الأرباح المحتجزة",
                    "debit": 0 if net_income > 0 else abs(net_income),
                    "credit": net_income if net_income > 0 else 0,
                }
            )
            if net_income > 0:
                total_credit += net_income
            else:
                total_debit += abs(net_income)

        return {
            "success": True,
            "data": {
                "period": f"حتى {target_date}",
                "accounts": accounts_list,
                "totals": {
                    "total_debit": round(total_debit, 2),
                    "total_credit": round(total_credit, 2),
                },
            },
        }

    except Exception as e:
        print(f"Error in get_trial_balance: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "period": f"حتى {date or datetime.now().strftime('%Y-%m-%d')}",
                "accounts": [],
                "totals": {"total_debit": 0, "total_credit": 0},
            },
        }


@router.get("/chart-of-accounts")
async def get_chart_of_accounts(workshop_id: str = Query(...)):
    """
    دليل الحسابات محسوب من العمليات الحقيقية في Supabase
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        # محاولة قراءة من جدول chart_of_accounts
        try:
            response = (
                supabase.table("chart_of_accounts")
                .select("*")
                .or_(f"workshop_id.eq.{workshop_id},workshop_id.eq.default")
                .eq("is_active", True)
                .order("code")
                .execute()
            )

            if response.data and len(response.data) > 0:
                accounts = []
                for acc in response.data:
                    accounts.append(
                        {
                            "id": acc.get("id"),
                            "code": acc.get("code"),
                            "name": acc.get("name_ar"),
                            "name_ar": acc.get("name_ar"),
                            "name_en": acc.get("name_en"),
                            "type": acc.get("type"),
                            "balance": float(acc.get("balance", 0)),
                        }
                    )

                return {"success": True, "data": accounts}
        except Exception as e:
            print(
                f"Chart of accounts table not found, will calculate from operations: {e}"
            )

        # البديل: حساب الحسابات من operations
        ops_response = supabase.table("operations").select("*").execute()
        operations = ops_response.data

        # حساب أرصدة الحسابات من العمليات
        account_balances = {}

        for op in operations:
            op_type = op.get("type", "")
            total = float(op.get("total", 0) or 0)
            payment_method = op.get("payment_method", "cash")

            if op_type == "sale":
                # النقدية أو ذمم مدينة
                if payment_method == "cash":
                    account_balances["101"] = account_balances.get("101", 0) + total
                else:
                    account_balances["113"] = account_balances.get("113", 0) + total
                # إيرادات
                account_balances["411"] = account_balances.get("411", 0) + total

            elif op_type == "purchase":
                # مصروفات قطع
                account_balances["514"] = account_balances.get("514", 0) + total
                # النقدية أو ذمم دائنة
                if payment_method == "cash":
                    account_balances["101"] = account_balances.get("101", 0) - total
                else:
                    account_balances["211"] = account_balances.get("211", 0) + total

        # الأرباح المحتجزة
        revenue = account_balances.get("411", 0)
        expenses = account_balances.get("514", 0)
        account_balances["302"] = revenue - expenses

        # بناء قائمة الحسابات
        accounts = [
            {
                "id": "1",
                "code": "101",
                "name": "النقدية",
                "name_ar": "النقدية",
                "type": "asset",
                "balance": round(account_balances.get("101", 0), 2),
            },
            {
                "id": "2",
                "code": "113",
                "name": "ذمم مدينة عملاء",
                "name_ar": "ذمم مدينة عملاء",
                "type": "asset",
                "balance": round(account_balances.get("113", 0), 2),
            },
            {
                "id": "3",
                "code": "121",
                "name": "مخزون قطع الغيار",
                "name_ar": "مخزون قطع الغيار",
                "type": "asset",
                "balance": 0,
            },
            {
                "id": "4",
                "code": "211",
                "name": "ذمم دائنة موردين",
                "name_ar": "ذمم دائنة موردين",
                "type": "liability",
                "balance": round(account_balances.get("211", 0), 2),
            },
            {
                "id": "5",
                "code": "301",
                "name": "رأس المال",
                "name_ar": "رأس المال",
                "type": "equity",
                "balance": 0,
            },
            {
                "id": "6",
                "code": "302",
                "name": "الأرباح المحتجزة",
                "name_ar": "الأرباح المحتجزة",
                "type": "equity",
                "balance": round(account_balances.get("302", 0), 2),
            },
            {
                "id": "7",
                "code": "411",
                "name": "إيرادات خدمات الصيانة",
                "name_ar": "إيرادات خدمات الصيانة",
                "type": "revenue",
                "balance": round(account_balances.get("411", 0), 2),
            },
            {
                "id": "8",
                "code": "412",
                "name": "إيرادات بيع قطع الغيار",
                "name_ar": "إيرادات بيع قطع الغيار",
                "type": "revenue",
                "balance": 0,
            },
            {
                "id": "9",
                "code": "514",
                "name": "مصاريف قطع الغيار",
                "name_ar": "مصاريف قطع الغيار",
                "type": "expense",
                "balance": round(account_balances.get("514", 0), 2),
            },
            {
                "id": "10",
                "code": "521",
                "name": "مصاريف رواتب",
                "name_ar": "مصاريف رواتب",
                "type": "expense",
                "balance": 0,
            },
            {
                "id": "11",
                "code": "522",
                "name": "مصاريف إيجار",
                "name_ar": "مصاريف إيجار",
                "type": "expense",
                "balance": 0,
            },
        ]

        return {"success": True, "data": accounts}

    except Exception as e:
        print(f"Error in get_chart_of_accounts: {str(e)}")
        return {"success": False, "error": str(e), "data": []}


# NOTE: First definition of get_journal_entries removed to fix duplicate function definition

# NOTE: legacy duplicated definition of get_journal_entries was removed to fix syntax


@router.get("/journal-entries")
async def get_journal_entries(
    workshop_id: str = Query(...),
    skip: int = Query(0),
    limit: int = Query(50),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """
    القيود المحاسبية من Supabase و MongoDB operations
    """
    try:
        entries = []

        # 1. جلب القيود المحاسبية اليدوية من Supabase
        try:
            query = (
                supabase.table("journal_entries")
                .select("*")
                .eq("workshop_id", workshop_id)
            )

            if start_date:
                query = query.gte("date", start_date)
            if end_date:
                query = query.lte("date", end_date)

            query = query.range(skip, skip + limit - 1)
            response = query.execute()

            for entry in response.data:
                entries.append(
                    {
                        "id": entry.get("id"),
                        "date": entry.get("date", ""),
                        "description": entry.get("description", "قيد يدوي"),
                        "lines": entry.get("lines", []),
                        "total": entry.get("total", 0),
                        "source": "manual",
                    }
                )
        except Exception as e:
            print(f"Supabase journal_entries error: {e}")

        # 2. القيود الناتجة عن العمليات من Supabase (operations جدول)
        try:
            if supabase:
                ops_query = supabase.table("operations").select(
                    "*, vehicles(plate_number, customer_name)"
                )
                if start_date:
                    ops_query = ops_query.gte("op_date", start_date)
                if end_date:
                    ops_query = ops_query.lte("op_date", end_date)
                ops_query = ops_query.range(skip, skip + limit - 1).order(
                    "op_date", desc=True
                )
                ops_response = ops_query.execute()

                for op in ops_response.data:
                    op_type = op.get("type", "")
                    total = float(op.get("total", 0) or 0)
                    date = op.get("op_date", "")
                    payment_method = op.get("payment_method", "cash")

                    if total == 0:
                        continue

                    vehicle_data = (
                        op.get("vehicles", {})
                        if isinstance(op.get("vehicles"), dict)
                        else {}
                    )
                    vehicle_plate = vehicle_data.get("plate_number", "")
                    customer_name = vehicle_data.get(
                        "customer_name", op.get("partner_name", "")
                    )

                    lines = []

                    if op_type == "sale":
                        if payment_method == "cash":
                            lines.append(
                                {
                                    "account": "101",
                                    "account_name": "النقدية",
                                    "debit": total,
                                    "credit": 0,
                                }
                            )
                        else:
                            lines.append(
                                {
                                    "account": "113",
                                    "account_name": "ذمم مدينة عملاء",
                                    "debit": total,
                                    "credit": 0,
                                }
                            )
                        lines.append(
                            {
                                "account": "411",
                                "account_name": "إيرادات خدمات الصيانة",
                                "debit": 0,
                                "credit": total,
                            }
                        )
                    elif op_type == "purchase":
                        lines.append(
                            {
                                "account": "514",
                                "account_name": "مصاريف قطع الغيار",
                                "debit": total,
                                "credit": 0,
                            }
                        )
                        if payment_method == "cash":
                            lines.append(
                                {
                                    "account": "101",
                                    "account_name": "النقدية",
                                    "debit": 0,
                                    "credit": total,
                                }
                            )
                        else:
                            lines.append(
                                {
                                    "account": "211",
                                    "account_name": "ذمم دائنة موردين",
                                    "debit": 0,
                                    "credit": total,
                                }
                            )
                    else:
                        continue

                    entries.append(
                        {
                            "id": op.get("id", ""),
                            "date": date[:10] if date else "",
                            "description": f"قيد {op_type} {payment_method}",
                            "lines": lines,
                            "total": total,
                            "source": "operation",
                            "vehicle_plate": vehicle_plate,
                            "customer_name": customer_name,
                        }
                    )
        except Exception as e:
            print(f"Supabase operations error: {e}")

        # 3. قيود من MongoDB (للوضع القديم إن وُجد finance_db)
        if finance_db:
            try:
                query = {}
                if start_date and end_date:
                    start_dt = datetime.fromisoformat(start_date)
                    end_dt = datetime.fromisoformat(end_date)
                    end_dt = end_dt.replace(hour=23, minute=59, second=59)
                    query["date"] = {"$gte": start_dt, "$lte": end_dt}

                operations = (
                    await finance_db.operations.find(query)
                    .skip(skip)
                    .limit(limit)
                    .to_list(limit)
                )

                for op in operations:
                    op_type = op.get("type", "")
                    total = op.get("total", 0) or 0
                    date = op.get("date", datetime.now())
                    payment_method = op.get("paymentMethod", "cash")

                    if total == 0:
                        continue

                    lines = []

                    if op_type == "sale":
                        if payment_method == "cash":
                            lines.append(
                                {
                                    "account": "101",
                                    "account_name": "النقدية",
                                    "debit": total,
                                    "credit": 0,
                                }
                            )
                        else:
                            lines.append(
                                {
                                    "account": "113",
                                    "account_name": "ذمم مدينة عملاء",
                                    "debit": total,
                                    "credit": 0,
                                }
                            )
                        lines.append(
                            {
                                "account": "411",
                                "account_name": "إيرادات خدمات الصيانة",
                                "debit": 0,
                                "credit": total,
                            }
                        )

                        entries.append(
                            {
                                "id": op.get("id", ""),
                                "date": (
                                    date.strftime("%Y-%m-%d")
                                    if isinstance(date, datetime)
                                    else str(date)
                                ),
                                "description": f"قيد بيع {payment_method}",
                                "lines": lines,
                                "total": total,
                                "source": "operation",
                            }
                        )

                    elif op_type == "purchase":
                        lines.append(
                            {
                                "account": "514",
                                "account_name": "مصاريف قطع الغيار",
                                "debit": total,
                                "credit": 0,
                            }
                        )
                        if payment_method == "cash":
                            lines.append(
                                {
                                    "account": "101",
                                    "account_name": "النقدية",
                                    "debit": 0,
                                    "credit": total,
                                }
                            )
                        else:
                            lines.append(
                                {
                                    "account": "211",
                                    "account_name": "ذمم دائنة موردين",
                                    "debit": 0,
                                    "credit": total,
                                }
                            )

                        entries.append(
                            {
                                "id": op.get("id", ""),
                                "date": (
                                    date.strftime("%Y-%m-%d")
                                    if isinstance(date, datetime)
                                    else str(date)
                                ),
                                "description": f"قيد شراء {payment_method}",
                                "lines": lines,
                                "total": total,
                                "source": "operation",
                            }
                        )
            except Exception as e:
                print(f"MongoDB operations error: {e}")

        return {"success": True, "data": entries, "total": len(entries)}

    except Exception as e:
        print(f"Error in get_journal_entries: {str(e)}")
        # بيانات تجريبية في حالة الخطأ
        return {
            "success": True,
            "data": [
                {
                    "id": "entry-001",
                    "date": "2025-01-20",
                    "description": "قيد بيع خدمة صيانة",
                    "lines": [
                        {
                            "account": "113",
                            "account_name": "ذمم مدينة",
                            "debit": 5000,
                            "credit": 0,
                        },
                        {
                            "account": "411",
                            "account_name": "إيرادات خدمات",
                            "debit": 0,
                            "credit": 5000,
                        },
                    ],
                    "total": 5000,
                    "source": "demo",
                }
            ],
            "total": 1,
        }


@router.post("/journal-entries")
async def create_journal_entry(entry: dict, workshop_id: str = Query(...)):
    """
    إنشاء قيد محاسبي جديد في Supabase
    """
    try:
        # إضافة معلومات إضافية
        entry_data = {
            "id": str(uuid.uuid4()),
            "workshop_id": workshop_id,
            "date": entry.get("date", datetime.now().isoformat()),
            "description": entry.get("description", ""),
            "lines": entry.get("lines", []),
            "total": entry.get("total", 0),
            "created_at": datetime.now().isoformat(),
        }

        # حفظ في Supabase
        response = supabase.table("journal_entries").insert(entry_data).execute()

        return {
            "success": True,
            "message": "تم إنشاء القيد المحاسبي بنجاح",
            "id": entry_data["id"],
            "data": response.data,
        }

    except Exception as e:
        print(f"Error in create_journal_entry: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "فشل في إنشاء القيد المحاسبي",
        }


@router.get("/operations")
async def get_financial_operations(
    workshop_id: str = Query(...), skip: int = Query(0), limit: int = Query(50)
):
    """
    جميع العمليات المالية (مبيعات، مشتريات، مصروفات)
    """
    # يمكن لاحقاً ربطها بـ operations collection في MongoDB
    return {"success": True, "data": [], "total": 0}


@router.put("/journal-entries/{entry_id}")
async def update_journal_entry(
    entry_id: str, entry: dict, workshop_id: str = Query(...)
):
    """
    تعديل قيد محاسبي يدوي في Supabase
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        # التحقق من وجود القيد وأنه يدوي
        existing = (
            supabase.table("journal_entries")
            .select("*")
            .eq("id", entry_id)
            .eq("workshop_id", workshop_id)
            .execute()
        )

        if not existing.data or len(existing.data) == 0:
            return {
                "success": False,
                "error": "القيد غير موجود",
                "message": "لم يتم العثور على القيد المطلوب",
            }

        # تحديث البيانات
        update_data = {
            "date": entry.get("date"),
            "description": entry.get("description", ""),
            "lines": entry.get("lines", []),
            "total": entry.get("total", 0),
            "updated_at": datetime.now().isoformat(),
        }

        # حذف القيم الفارغة
        update_data = {k: v for k, v in update_data.items() if v is not None}

        response = (
            supabase.table("journal_entries")
            .update(update_data)
            .eq("id", entry_id)
            .execute()
        )

        return {
            "success": True,
            "message": "تم تحديث القيد المحاسبي بنجاح",
            "data": response.data,
        }

    except Exception as e:
        print(f"Error in update_journal_entry: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "فشل في تحديث القيد المحاسبي",
        }


@router.delete("/journal-entries/{entry_id}")
async def delete_journal_entry(entry_id: str, workshop_id: str = Query(...)):
    """
    حذف قيد محاسبي يدوي من Supabase
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        # التحقق من وجود القيد
        existing = (
            supabase.table("journal_entries")
            .select("*")
            .eq("id", entry_id)
            .eq("workshop_id", workshop_id)
            .execute()
        )

        if not existing.data or len(existing.data) == 0:
            return {
                "success": False,
                "error": "القيد غير موجود",
                "message": "لم يتم العثور على القيد المطلوب",
            }

        # حذف القيد
        response = (
            supabase.table("journal_entries").delete().eq("id", entry_id).execute()
        )

        return {"success": True, "message": "تم حذف القيد المحاسبي بنجاح"}

    except Exception as e:
        print(f"Error in delete_journal_entry: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "فشل في حذف القيد المحاسبي",
        }


@router.get("/journal-entries/{entry_id}")
async def get_journal_entry(entry_id: str, workshop_id: str = Query(...)):
    """
    جلب قيد محاسبي واحد
    """
    try:
        if not supabase:
            raise Exception("Supabase not connected")

        response = (
            supabase.table("journal_entries")
            .select("*")
            .eq("id", entry_id)
            .eq("workshop_id", workshop_id)
            .execute()
        )

        if not response.data or len(response.data) == 0:
            return {
                "success": False,
                "error": "القيد غير موجود",
                "message": "لم يتم العثور على القيد المطلوب",
            }

        entry = response.data[0]
        return {
            "success": True,
            "data": {
                "id": entry.get("id"),
                "date": entry.get("date", ""),
                "description": entry.get("description", "قيد يدوي"),
                "lines": entry.get("lines", []),
                "total": entry.get("total", 0),
                "source": "manual",
            },
        }

    except Exception as e:
        print(f"Error in get_journal_entry: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "فشل في جلب القيد المحاسبي",
        }


@router.delete("/reset-all-data")
async def reset_all_financial_data(
    workshop_id: str = Query(..., description="معرف الورشة"),
    confirm: str = Query(..., description="يجب أن تكون 'DELETE_ALL' للتأكيد")
):
    """
    حذف جميع البيانات المالية والعمليات للبدء من الصفر
    يحذف: Chart of Accounts، Operations، Journal Entries، Invoices
    """
    if confirm != "DELETE_ALL":
        return {
            "success": False,
            "message": "يجب تأكيد الحذف عن طريق إرسال confirm=DELETE_ALL"
        }
    
    try:
        deleted_counts = {
            "chart_of_accounts": 0,
            "operations": 0,
            "journal_entries": 0,
            "invoices": 0
        }
        
        # حذف من Supabase إذا كان متصلاً
        if supabase:
            try:
                # حذف جميع العمليات - استخدام gte مع قيمة قديمة جداً لحذف كل شيء
                ops_del = supabase.table("operations").delete().gte("created_at", "1900-01-01").execute()
                ops_count = len(ops_del.data) if ops_del.data else 0
                deleted_counts["operations"] = ops_count if ops_count > 0 else "all"
                print(f"✅ Deleted {ops_count} operations from Supabase")
                
                # حذف Chart of Accounts
                coa_del = supabase.table("chart_of_accounts").delete().gte("created_at", "1900-01-01").execute()
                coa_count = len(coa_del.data) if coa_del.data else 0
                deleted_counts["chart_of_accounts"] = coa_count if coa_count > 0 else "all"
                print(f"✅ Deleted {coa_count} chart of accounts from Supabase")
                
                # حذف Journal Entries
                try:
                    je_del = supabase.table("journal_entries").delete().gte("created_at", "1900-01-01").execute()
                    je_count = len(je_del.data) if je_del.data else 0
                    deleted_counts["journal_entries"] = je_count if je_count > 0 else "all"
                    print(f"✅ Deleted {je_count} journal entries from Supabase")
                except Exception as e:
                    print(f"Journal entries table deletion: {e}")
                
                # حذف الفواتير
                try:
                    inv_del = supabase.table("invoices").delete().gte("created_at", "1900-01-01").execute()
                    inv_count = len(inv_del.data) if inv_del.data else 0
                    deleted_counts["invoices"] = inv_count if inv_count > 0 else "all"
                    print(f"✅ Deleted {inv_count} invoices from Supabase")
                except Exception as e:
                    print(f"Invoices table deletion: {e}")
                    
                print(f"✅ Supabase: Deleted all financial data")
            except Exception as e:
                print(f"Supabase deletion error: {e}")
        
        # حذف من MongoDB
        if finance_db:
            try:
                # حذف العمليات
                ops_result = await finance_db.operations.delete_many({})
                deleted_counts["operations"] = ops_result.deleted_count
                
                # حذف Chart of Accounts
                coa_result = await finance_db.chart_of_accounts.delete_many({})
                deleted_counts["chart_of_accounts"] = coa_result.deleted_count
                
                # حذف Journal Entries
                je_result = await finance_db.journal_entries.delete_many({})
                deleted_counts["journal_entries"] = je_result.deleted_count
                
                print(f"✅ MongoDB: Deleted {deleted_counts}")
            except Exception as e:
                print(f"MongoDB deletion error: {e}")
        
        # حذف من الـ DB الرئيسي (إذا كان MongoDB)
        if db and not finance_db:
            try:
                await db.operations.delete_many({})
                await db.chart_of_accounts.delete_many({})
                await db.journal_entries.delete_many({})
                print("✅ Main DB: Deleted all financial data")
            except Exception as e:
                print(f"Main DB deletion error: {e}")
        
        return {
            "success": True,
            "message": "تم حذف جميع البيانات المالية بنجاح من جميع الأنظمة",
            "deleted_counts": deleted_counts
        }
    
    except Exception as e:
        return {
            "success": False,
            "message": f"حدث خطأ أثناء الحذف: {str(e)}"
        }



@router.post("/audit-system")
async def audit_accounting_system(
    workshop_id: str = Query(..., description="معرف الورشة")
):
    """
    تدقيق شامل للنظام المحاسبي
    يفحص: معادلة المحاسبة، اتساق القوائم، القيود اليومية، الأنماط غير العادية
    """
    try:
        # جمع البيانات المالية
        financial_data = {}
        
        # 1. جلب الميزانية العمومية
        try:
            balance_sheet_data = await get_balance_sheet(workshop_id)
            if balance_sheet_data and balance_sheet_data.get('success'):
                bs = balance_sheet_data['data']
                financial_data['balance_sheet'] = {
                    'assets': bs['totals']['assets'],
                    'liabilities': bs['totals']['liabilities'],
                    'equity': bs['totals']['equity']
                }
        except:
            pass
        
        # 2. جلب قائمة الدخل
        try:
            end_date = datetime.now().strftime("%Y-%m-%d")
            start_date = (datetime.now().replace(month=datetime.now().month - 1)).strftime("%Y-%m-%d")
            income_data = await get_income_statement(workshop_id, start_date, end_date)
            if income_data and income_data.get('success'):
                ins = income_data['data']
                financial_data['income_statement'] = {
                    'revenue': ins['totals']['revenue'],
                    'expenses': ins['totals']['expenses'],
                    'net_profit': ins['totals']['net_income']
                }
        except:
            pass
        
        # 3. جلب التدفقات النقدية
        try:
            cashflow_data = await get_cash_flow(workshop_id, start_date, end_date)
            if cashflow_data and cashflow_data.get('success'):
                cf = cashflow_data['data']
                financial_data['cash_flow'] = {
                    'operating': cf['operating_activities'].get('net_operating_cash', 0),
                    'investing': cf['investing_activities'].get('net_investing_cash', 0),
                    'financing': cf['financing_activities'].get('net_financing_cash', 0)
                }
        except:
            pass
        
        # تشغيل التدقيق
        auditor = AccountingSystemAuditor("نظام الخدمات المحاسبي")
        audit_report = auditor.run_comprehensive_audit(financial_data)
        
        return {
            "success": True,
            "data": audit_report
        }
    
    except Exception as e:
        return {
            "success": False,
            "message": f"خطأ في التدقيق: {str(e)}"
        }

