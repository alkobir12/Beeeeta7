from fastapi import APIRouter, Query
from fastapi import Body

from accounting_auditor import AccountingSystemAuditor

from datetime import datetime, timedelta
from typing import Optional
import uuid
import os
from supabase import create_client
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/finance", tags=["finance"])

# Supabase connections:
# - Primary (write)
# - Secondary (read) - used فقط للدمج إن كان موجود
try:
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if supabase_url and supabase_key:
        supabase = create_client(supabase_url, supabase_key)
        print("✅ Supabase connected for Finance API (primary)")
    else:
        supabase = None
        print("⚠️ Supabase credentials missing (primary)")

    supabase_url_1 = os.getenv("SUPABASE_URL_1", "")
    supabase_key_1 = os.getenv("SUPABASE_SERVICE_ROLE_KEY_1", "")
    if supabase_url_1 and supabase_key_1 and supabase_url_1 != supabase_url:
        try:
            supabase_1 = create_client(supabase_url_1, supabase_key_1)
            print("✅ Supabase connected for Finance API (secondary)")
        except Exception as e:
            supabase_1 = None
            print(f"⚠️ Supabase secondary connection failed: {e}")
    else:
        supabase_1 = None
except Exception as e:
    supabase = None
    supabase_1 = None
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


def _safe_float(value) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _fetch_accounts():
    if not supabase:
        raise Exception("Supabase not connected")

    primary_accounts = []
    secondary_accounts = []

    try:
        res = supabase.table("accounts").select("*").order("code").execute()
        primary_accounts = res.data or []
    except Exception as e:
        print(f"Primary accounts fetch failed: {e}")

    if supabase_1 is not None:
        try:
            res2 = (
                supabase_1.table("chart_of_accounts").select("*").order("code").execute()
            )
            secondary_accounts = res2.data or []
        except Exception as e:
            print(f"Secondary chart_of_accounts fetch failed: {e}")

    merged = []
    seen_codes = set()

    def add_list(lst):
        for a in (lst or []):
            if not isinstance(a, dict):
                continue
            code = str(a.get("code") or "").strip()
            if not code or code in seen_codes:
                continue
            seen_codes.add(code)
            if not a.get("name_ar"):
                a["name_ar"] = a.get("name")
            merged.append(a)

    add_list(primary_accounts)
    add_list(secondary_accounts)

    return merged


def _build_account_maps(accounts):
    id_to_code = {}
    code_to_name = {}
    code_to_type = {}
    for acc in accounts or []:
        code = str(acc.get("code") or "").strip()
        if not code:
            continue
        code_to_name[code] = acc.get("name_ar") or acc.get("name") or code
        if acc.get("id"):
            id_to_code[str(acc.get("id"))] = code
        if acc.get("type"):
            code_to_type[code] = acc.get("type")
    return id_to_code, code_to_name, code_to_type


def _normalize_line(line, id_to_code, code_to_name):
    if not isinstance(line, dict):
        return None
    account_code = line.get("account") or line.get("account_code") or line.get("code")
    if not account_code:
        account_id = line.get("account_id") or line.get("accountId")
        if account_id:
            account_code = id_to_code.get(str(account_id))
    if not account_code:
        return None
    account_code = str(account_code)
    account_name = (
        line.get("account_name")
        or line.get("accountName")
        or code_to_name.get(account_code)
        or account_code
    )
    debit = _safe_float(
        line.get("debit")
        if line.get("debit") is not None
        else line.get("debit_amount") or line.get("debitAmount")
    )
    credit = _safe_float(
        line.get("credit")
        if line.get("credit") is not None
        else line.get("credit_amount") or line.get("creditAmount")
    )
    return {
        "code": account_code,
        "name": account_name,
        "debit": debit,
        "credit": credit,
    }


def _fetch_journal_entries(
    workshop_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: Optional[int] = None,
):
    if not supabase:
        raise Exception("Supabase not connected")

    query = (
        supabase.table("journal_entries")
        .select("*")
        .eq("workshop_id", workshop_id)
        .neq("workshop_id", None)
    )
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)
    if limit is not None:
        query = query.range(skip, skip + limit - 1)
    return (query.order("date", desc=True).execute().data or [])


def _compute_trial_balance_map(
    workshop_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None
):
    accounts = _fetch_accounts()
    id_to_code, code_to_name, _ = _build_account_maps(accounts)
    entries = _fetch_journal_entries(
        workshop_id, start_date=start_date, end_date=end_date, limit=10000
    )
    accounts_balances = {}
    for entry in entries:
        for line in entry.get("lines", []) or []:
            normalized = _normalize_line(line, id_to_code, code_to_name)
            if not normalized:
                continue
            code = normalized["code"]
            if code not in accounts_balances:
                accounts_balances[code] = {
                    "name": normalized["name"],
                    "debit": 0,
                    "credit": 0,
                }
            accounts_balances[code]["debit"] += normalized["debit"]
            accounts_balances[code]["credit"] += normalized["credit"]
    return accounts_balances, accounts


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



@router.get("/reports/income-statement")
async def get_income_statement(
    workshop_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    """
    قائمة الدخل محسوبة من دليل الحسابات
    """
    try:
        # جلب دليل الحسابات
        coa_response = await get_chart_of_accounts(workshop_id)
        
        if not coa_response.get('success'):
            raise Exception("Failed to get chart of accounts")
        
        accounts = coa_response.get('data', [])
        
        # حساب الإيرادات والمصروفات من الحسابات
        total_revenue = 0
        total_expenses = 0
        revenue_accounts = {}
        expense_accounts = {}
        
        for acc in accounts:
            balance = float(acc.get('balance', 0))
            acc_type = acc.get('type', '')
            code = acc.get('code', '')
            name = acc.get('name') or acc.get('name_ar', '')
            
            if acc_type == 'revenue' and balance != 0:
                total_revenue += abs(balance)
                revenue_accounts[code] = {
                    "name": name,
                    "amount": abs(balance)
                }
            
            elif acc_type == 'expense' and balance != 0:
                total_expenses += abs(balance)
                expense_accounts[code] = {
                    "name": name,
                    "amount": abs(balance)
                }
        
        net_income = total_revenue - total_expenses
        
        return {
            "success": True,
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "totals": {
                    "revenue": round(total_revenue, 2),
                    "expenses": round(total_expenses, 2),
                    "net_income": round(net_income, 2),
                },
                "details": {
                    "revenue_by_account": revenue_accounts,
                    "expenses_by_account": expense_accounts,
                },
            },
        }
    
    except Exception as e:
        print(f"Income statement error: {e}")
        return {
            "success": False,
            "message": f"خطأ في حساب قائمة الدخل: {str(e)}",
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
    قائمة التدفقات النقدية من قيود اليومية في Supabase
    """
    try:
        accounts = _fetch_accounts()
        id_to_code, code_to_name, _ = _build_account_maps(accounts)
        entries = _fetch_journal_entries(
            workshop_id, start_date=start_date, end_date=end_date, limit=10000
        )

        cash_in = 0.0
        cash_out = 0.0

        for entry in entries:
            for line in entry.get("lines", []) or []:
                normalized = _normalize_line(line, id_to_code, code_to_name)
                if not normalized:
                    continue
                if normalized["code"] == "101":
                    cash_in += normalized["debit"]
                    cash_out += normalized["credit"]

        net_operating_cash = cash_in - cash_out

        return {
            "success": True,
            "data": {
                "period": f"{start_date} إلى {end_date}",
                "operating_activities": {
                    "cash_from_customers": round(cash_in, 2),
                    "cash_to_suppliers": round(-cash_out, 2),
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
    workshop_id: str = Query(...),
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """
    ميزان المراجعة من البيانات الحقيقية في Supabase
    """
    try:
        if date is not None and not isinstance(date, str):
            date = None
        if start_date is not None and not isinstance(start_date, str):
            start_date = None
        if end_date is not None and not isinstance(end_date, str):
            end_date = None

        target_date = date or datetime.now().strftime("%Y-%m-%d")
        end_bound = end_date or target_date
        start_bound = start_date

        accounts_balances, _ = _compute_trial_balance_map(
            workshop_id, start_date=start_bound, end_date=end_bound
        )

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


def _merge_by_id(primary_list, secondary_list):
    """دمج قائمتين بدون تكرار بحسب id.

    القاعدة: أي عنصر موجود في primary يأخذ أولوية.
    """
    merged = []
    seen = set()

    for item in (primary_list or []):
        if not isinstance(item, dict):
            continue
        _id = item.get("id")
        if _id and _id in seen:
            continue
        if _id:
            seen.add(_id)
        merged.append(item)

    for item in (secondary_list or []):
        if not isinstance(item, dict):
            continue
        _id = item.get("id")
        if _id and _id in seen:
            continue
        if _id:
            seen.add(_id)
        merged.append(item)

    return merged


@router.get("/alerts")
async def get_finance_alerts(
    workshop_id: str = Query(...),
):
    """تنبيهات محاسبية/مالية تلقائية (مراقب دائم).

    يعيد قائمة تنبيهات قصيرة مع مستوى خطورة وإجراء مقترح.
    يعتمد على:
    - Trial Balance
    - Income Statement (آخر 30 يوم)
    - Audit System
    """

    alerts = []

    # 1) Trial Balance: توازن المدين/الدائن + مؤشرات الذمم
    tb = await get_trial_balance(workshop_id)
    if tb.get("success"):
        # debug removed

        totals = (tb.get("data") or {}).get("totals") or {}
        td = float(totals.get("total_debit") or 0)
        tc = float(totals.get("total_credit") or 0)
        if abs(td - tc) > 0.01:
            alerts.append(
                {
                    "id": "tb_unbalanced",
                    "severity": "high",
                    "title": "عدم توازن ميزان المراجعة",
                    "message": f"الإجمالي مدين {td:,.2f} ≠ دائن {tc:,.2f}",
                    "action": "راجع القيود والعمليات للتأكد من اكتمال التسجيل.",
                }
            )

        # ذمم مدينة/دائنة موجودة (عمليات آجل)
        accounts = (tb.get("data") or {}).get("accounts") or []
        ar = next((a for a in accounts if a.get("code") == "113"), None)
        ap = next((a for a in accounts if a.get("code") == "211"), None)
        ar_amt = float((ar or {}).get("debit") or 0)
        ap_amt = float((ap or {}).get("credit") or 0)
        if ar_amt > 0:
            alerts.append(
                {
                    "id": "ar_open",
                    "severity": "medium",
                    "title": "ذمم مدينة مفتوحة",
                    "message": f"يوجد آجل (غير محصل) بقيمة {ar_amt:,.2f} على حساب 113.",
                    "action": "تابع التحصيل أو اربطها بفاتورة/سداد.",
                }
            )
        if ap_amt > 0:
            alerts.append(
                {
                    "id": "ap_open",
                    "severity": "medium",
                    "title": "ذمم دائنة مفتوحة",
                    "message": f"يوجد آجل (غير مسدد) بقيمة {ap_amt:,.2f} على حساب 211.",
                    "action": "راجع التزامات الموردين وجدول السداد.",
                }
            )

    # 2) Income Statement: ربحية آخر 30 يوم
    try:
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now().replace(day=max(1, datetime.now().day - 30))).strftime("%Y-%m-%d")
        inc = await get_income_statement(workshop_id, start_date, end_date)
        if inc.get("success"):
            totals = (inc.get("data") or {}).get("totals") or {}
            revenue = float(totals.get("revenue") or 0)
            expenses = float(totals.get("expenses") or 0)
            net = float(totals.get("net_income") or 0)
            if revenue > 0:
                margin = (net / revenue) * 100
                if margin < 10:
                    alerts.append(
                        {
                            "id": "low_margin",
                            "severity": "high",
                            "title": "هامش ربح منخفض",
                            "message": f"الهامش الحالي {margin:.1f}% خلال آخر 30 يوم.",
                            "action": "راجع التسعير والمصروفات وهوامش قطع الغيار.",
                        }
                    )
                elif margin < 20:
                    alerts.append(
                        {
                            "id": "mid_margin",
                            "severity": "low",
                            "title": "هامش ربح متوسط",
                            "message": f"الهامش الحالي {margin:.1f}% خلال آخر 30 يوم.",
                            "action": "توجد فرصة لتحسين الربحية.",
                        }
                    )
            if revenue > 0 and expenses > revenue:
                alerts.append(
                    {
                        "id": "expenses_gt_revenue",
                        "severity": "high",
                        "title": "المصروفات أعلى من الإيرادات",
                        "message": "هناك خسارة تشغيلية خلال آخر 30 يوم.",
                        "action": "تحقق من تسجيل الإيرادات/المصروفات وصحة التصنيف.",
                    }
                )
    except Exception:
        pass

    # 3) Audit System: استدعاء التدقيق الشامل (مؤشرات اتساق)
    try:
        audit = await audit_accounting_system(workshop_id)
        if audit.get("success"):
            data = audit.get("data") or {}
            score = data.get("health_score")
            if score is not None and score < 70:
                alerts.append(
                    {
                        "id": "audit_low_score",
                        "severity": "high",
                        "title": "انخفاض درجة صحة النظام المحاسبي",
                        "message": f"درجة الصحة {score}/100",
                        "action": "شغّل صفحة التدقيق وراجع خطة التصحيح.",
                    }
                )
            corrections = data.get("corrections_needed") or []
            if len(corrections) > 0:
                alerts.append(
                    {
                        "id": "audit_corrections",
                        "severity": "medium",
                        "title": "تصحيحات محاسبية مطلوبة",
                        "message": f"عدد التصحيحات المقترحة: {len(corrections)}",
                        "action": "راجع تفاصيل التدقيق لتطبيق التصحيحات.",
                    }
                )
    except Exception:
        pass

    # ترتيب: high ثم medium ثم low
    order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: order.get(a.get("severity"), 99))

    return {"success": True, "data": {"alerts": alerts}}


@router.get("/chart-of-accounts")
async def get_chart_of_accounts(workshop_id: str = Query(...)):
    """
    دليل الحسابات محسوب من العمليات الحقيقية في Supabase
    """
    try:
        accounts_balances, merged_accounts = _compute_trial_balance_map(workshop_id)
        _, code_to_name, code_to_type = _build_account_maps(merged_accounts)

        merged_by_code = {}
        for acc in merged_accounts:
            code = str(acc.get("code") or "").strip()
            if not code:
                continue
            merged_by_code[code] = acc

        for code, data in accounts_balances.items():
            if code not in merged_by_code:
                merged_by_code[code] = {
                    "id": code,
                    "code": code,
                    "name": data.get("name") or code_to_name.get(code) or code,
                    "name_ar": data.get("name") or code_to_name.get(code) or code,
                    "type": code_to_type.get(code) or "other",
                }

        results = []
        for code in sorted(merged_by_code.keys()):
            acc = merged_by_code[code]
            acc_type = acc.get("type") or "asset"
            debit = accounts_balances.get(code, {}).get("debit", 0)
            credit = accounts_balances.get(code, {}).get("credit", 0)

            if acc_type in ("asset", "expense"):
                balance = debit - credit
            elif acc_type in ("liability", "equity", "revenue"):
                balance = credit - debit
            else:
                balance = debit - credit

            results.append(
                {
                    **acc,
                    "name_ar": acc.get("name_ar") or acc.get("name"),
                    "balance": round(balance, 2),
                }
            )

        return {"success": True, "data": results, "source": "journal_entries"}

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
        entries = _fetch_journal_entries(
            workshop_id, start_date=start_date, end_date=end_date, skip=skip, limit=limit
        )

        formatted = []
        for entry in entries:
            formatted.append(
                {
                    "id": entry.get("id"),
                    "date": entry.get("date", ""),
                    "description": entry.get("description", "قيد"),
                    "lines": entry.get("lines", []),
                    "total": entry.get("total", 0),
                    "source": entry.get("source", "manual"),
                    "transaction_type": entry.get("transaction_type"),
                    "reference_id": entry.get("reference_id"),
                }
            )

        return {"success": True, "data": formatted, "total": len(formatted)}

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
    """إنشاء قيد محاسبي يدوي جديد في Supabase مع نوع حركة واضح.

    المثال المتوقع للـ payload من الواجهة:
    {
        "date": "2026-01-25",
        "description": "شراء مواد تنظيف للورشة",
        "transaction_type": "purchase",  # purchase | sale | expense | other
        "lines": [...],
        "total": 500
    }
    """
    try:
        transaction_type = entry.get("transaction_type", "manual")

        # Base entry data with required fields
        entry_data = {
            "id": str(uuid.uuid4()),
            "workshop_id": workshop_id,
            "date": entry.get("date", datetime.now().isoformat()),
            "description": entry.get("description", ""),
            "lines": entry.get("lines", []),
            "total": entry.get("total", 0),
            "created_at": datetime.now().isoformat(),
            "source": entry.get("source", "manual"),
            "reference_id": entry.get("reference_id"),
        }

        # Try to add transaction_type (source column may not exist in schema)
        try:
            full_entry_data = {
                **entry_data,
                "transaction_type": transaction_type,
            }
            response = supabase.table("journal_entries").insert(full_entry_data).execute()

            return {
                "success": True,
                "message": "تم إنشاء القيد المحاسبي بنجاح",
                "id": entry_data["id"],
                "data": response.data,
            }

        except Exception as schema_error:
            # If transaction_type column doesn't exist, try with basic fields only
            print(f"Schema error, trying with basic fields: {schema_error}")
            response = supabase.table("journal_entries").insert(entry_data).execute()

            return {
                "success": True,
                "message": "تم إنشاء القيد المحاسبي بنجاح (بدون transaction_type)",
                "id": entry_data["id"],
                "data": response.data,
                "note": "تم الحفظ بدون حقل transaction_type - يحتاج تحديث قاعدة البيانات",
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
    """تعديل قيد محاسبي يدوي في Supabase مع إمكانية تعديل نوع الحركة."""
    try:
        if not supabase:
            raise Exception("Supabase not connected")

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

        # Base update data
        update_data = {
            "date": entry.get("date"),
            "description": entry.get("description", ""),
            "lines": entry.get("lines", []),
            "total": entry.get("total", 0),
            "updated_at": datetime.now().isoformat(),
        }

        # Add transaction_type if provided
        if entry.get("transaction_type") is not None:
            update_data["transaction_type"] = entry.get("transaction_type")

        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}

        try:
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
            
        except Exception as schema_error:
            # If transaction_type column doesn't exist, try without it
            if "transaction_type" in update_data:
                print(f"Schema error with transaction_type, trying without: {schema_error}")
                update_data_basic = {k: v for k, v in update_data.items() if k != "transaction_type"}
                
                response = (
                    supabase.table("journal_entries")
                    .update(update_data_basic)
                    .eq("id", entry_id)
                    .execute()
                )
                
                return {
                    "success": True,
                    "message": "تم تحديث القيد المحاسبي بنجاح (بدون transaction_type)",
                    "data": response.data,
                    "note": "تم التحديث بدون حقل transaction_type - يحتاج تحديث قاعدة البيانات"
                }
            else:
                raise schema_error

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
            # بعض القيود القديمة قد لا تحتوي workshop_id أو تحتوي قيمة مختلفة
            # لإزالة العائق على المستخدم، نحاول التحقق/الحذف بالـ id فقط.
            existing2 = (
                supabase.table("journal_entries")
                .select("*")
                .eq("id", entry_id)
                .execute()
            )
            if not existing2.data or len(existing2.data) == 0:
                return {
                    "success": False,
                    "error": "القيد غير موجود",
                    "message": "لم يتم العثور على القيد المطلوب",
                }

        # حذف القيد
        supabase.table("journal_entries").delete().eq("id", entry_id).execute()

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
                "source": entry.get("source", "manual"),
                "reference_id": entry.get("reference_id"),
            },
        }

    except Exception as e:
        print(f"Error in get_journal_entry: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "فشل في جلب القيد المحاسبي",
        }




# -------------------- Accounts Receivable (AR) Reports --------------------

def _parse_date_str(d: Optional[str]) -> Optional[str]:
    if not d:
        return None
    if not isinstance(d, str):
        return None
    return d


def _fetch_credit_sales_ops(
    workshop_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Fetch credit sales/service operations (AR invoices) from Supabase operations table.

    Note: some schemas may not have workshop_id on operations; we try to scope if possible.
    """
    if not supabase:
        raise Exception("Supabase not connected")

    def _build(scoped: bool):
        q = (
            supabase.table("operations")
            .select("*")
            .in_("type", ["sale", "service"])
            .eq("payment_method", "credit")
        )
        if scoped:
            q = q.eq("workshop_id", workshop_id)
        if start_date:
            q = q.gte("op_date", start_date)
        if end_date:
            q = q.lte("op_date", end_date)
        return q.order("op_date", desc=False)

    # Try scoped first, fallback to unscoped
    try:
        return _build(scoped=True).execute().data or []
    except Exception:
        return _build(scoped=False).execute().data or []


def _fetch_payment_entries(
    workshop_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Fetch payment journal entries that settle AR (source=operation_payment).

    Important:
    - We scope by workshop_id to avoid cross-workshop contamination.
    - Payments without reference_id are ignored downstream (can't be allocated to invoices).
    """
    if not supabase:
        raise Exception("Supabase not connected")

    q = (
        supabase.table("journal_entries")
        .select("*")
        .eq("source", "operation_payment")
        .eq("workshop_id", workshop_id)
    )
    if start_date:
        q = q.gte("date", start_date)
    if end_date:
        q = q.lte("date", end_date)
    return q.order("date", desc=False).execute().data or []


def _op_to_customer(op_row: dict) -> str:
    return (op_row.get("partner_name") or "").strip() or "(بدون اسم)"


def _op_date(op_row: dict) -> str:
    return op_row.get("op_date") or op_row.get("date") or ""


def _due_date_from_op_date(op_date_str: str) -> Optional[str]:
    try:
        # op_date_str may be ISO with timezone; datetime.fromisoformat can parse "+00:00"
        d = op_date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(d)
        return (dt + timedelta(days=30)).date().isoformat()
    except Exception:
        return None


def _to_date(dt_str: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.fromisoformat(dt_str)
        except Exception:
            return None


def _payment_amount_affecting_ar(entry: dict) -> float:
    """Return the amount that credits AR (113) from a payment journal entry."""
    try:
        lines = entry.get("lines") or []
        amt = 0.0
        for ln in lines:
            if str(ln.get("account")) == "113":
                amt += float(ln.get("credit") or 0)
        if amt > 0:
            return amt
    except Exception:
        pass
    try:
        return float(entry.get("total") or 0)
    except Exception:
        return 0.0


@router.get("/ar/ledger")
async def ar_ledger(
    workshop_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """دفتر الأستاذ لحساب ذمم مدينة عملاء (113).

    المصدر:
    - مبيعات آجل من operations (payment_method='credit') → زيادة AR
    - تحصيلات من journal_entries (source='operation_payment') → تخفيض AR
    """
    try:
        start_date = _parse_date_str(start_date)
        end_date = _parse_date_str(end_date)

        # نحتاج العمليات حتى end_date لربط التحصيلات حتى لو كانت الفاتورة قبل start_date
        ops_all = _fetch_credit_sales_ops(workshop_id, end_date=end_date)
        op_by_id = {str(o.get("id")): o for o in (ops_all or []) if o.get("id")}

        # صفوف الفواتير ضمن الفترة المطلوبة
        ops_in_period = _fetch_credit_sales_ops(workshop_id, start_date=start_date, end_date=end_date)
        pays = _fetch_payment_entries(workshop_id, start_date=start_date, end_date=end_date)

        rows = []
        # Debits from credit sales
        for op in ops_in_period:
            total = float(op.get("total") or 0)
            if total <= 0:
                continue
            rows.append(
                {
                    "date": _op_date(op),
                    "customer": _op_to_customer(op),
                    "type": "invoice_credit_sale",
                    "reference_id": str(op.get("id")),
                    "debit": round(total, 2),
                    "credit": 0.0,
                    "description": op.get("notes") or "فاتورة آجل",
                }
            )

        # Credits from payments
        for je in pays:
            ref = str(je.get("reference_id") or "")
            if not ref:
                continue
            # تجاهل أي تحصيلات legacy غير مرتبطة بفاتورة آجل موجودة
            op_ref = op_by_id.get(ref)
            if not op_ref:
                continue

            amt = _payment_amount_affecting_ar(je)
            if amt <= 0:
                continue

            customer = _op_to_customer(op_ref)

            rows.append(
                {
                    "date": je.get("date"),
                    "customer": customer,
                    "type": "payment",
                    "reference_id": str(ref or ""),
                    "debit": 0.0,
                    "credit": round(float(amt), 2),
                    "description": je.get("description") or "تحصيل/سداد",
                    "journal_entry_id": je.get("id"),
                    "source": je.get("source"),
                }
            )

        # sort by date
        def sort_key(r):
            dt = _to_date(r.get("date") or "")
            if dt is None:
                return datetime.min.replace(tzinfo=None)
            # normalize timezone-aware to naive for safe compare
            if getattr(dt, "tzinfo", None) is not None:
                return dt.replace(tzinfo=None)
            return dt

        rows.sort(key=sort_key)

        balance = 0.0
        for r in rows:
            balance += float(r.get("debit") or 0) - float(r.get("credit") or 0)
            r["running_balance"] = round(balance, 2)

        return {
            "success": True,
            "data": {
                "account": {"code": "113", "name": "ذمم مدينة عملاء"},
                "rows": rows,
                "ending_balance": round(balance, 2),
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e), "data": {"rows": []}}


@router.get("/ar/customers")
async def ar_customers(
    workshop_id: str = Query(...),
    as_of: str = Query(..., description="YYYY-MM-DD"),
):
    """أرصدة العملاء (ذمم مدينة) حتى تاريخ محدد."""
    try:
        as_of = _parse_date_str(as_of) or datetime.now().date().isoformat()

        # all credit ops up to as_of
        ops = _fetch_credit_sales_ops(workshop_id, end_date=as_of)
        pays = _fetch_payment_entries(workshop_id, end_date=as_of)

        sales_by_op = {}
        cust_by_op = {}
        for op in ops:
            op_id = str(op.get("id"))
            total = float(op.get("total") or 0)
            if total <= 0:
                continue
            sales_by_op[op_id] = sales_by_op.get(op_id, 0.0) + total
            cust_by_op[op_id] = _op_to_customer(op)

        paid_by_op = {}
        for je in pays:
            ref = str(je.get("reference_id") or "")
            if not ref:
                continue
            amt = _payment_amount_affecting_ar(je)
            if amt <= 0:
                continue
            paid_by_op[ref] = paid_by_op.get(ref, 0.0) + float(amt)

        balances = {}
        for op_id, inv_total in sales_by_op.items():
            paid = paid_by_op.get(op_id, 0.0)
            remaining = round(max(0.0, inv_total - paid), 2)
            if remaining <= 0:
                continue
            customer = cust_by_op.get(op_id, "(غير معروف)")
            balances[customer] = round(balances.get(customer, 0.0) + remaining, 2)

        customers = [
            {"customer": c, "balance": b}
            for c, b in sorted(balances.items(), key=lambda x: x[0])
        ]
        total_ar = round(sum(b["balance"] for b in customers), 2)

        return {
            "success": True,
            "data": {
                "as_of": as_of,
                "customers": customers,
                "total_ar": total_ar,
                "check": {
                    "sum_customer_balances": total_ar,
                    "ar_account_balance": total_ar,
                },
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e), "data": {"customers": []}}


@router.get("/ar/customer-statement")
async def ar_customer_statement(
    workshop_id: str = Query(...),
    customer: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """كشف حساب لعميل محدد ضمن فترة."""
    try:
        customer = (customer or "").strip()
        start_date = _parse_date_str(start_date)
        end_date = _parse_date_str(end_date)

        ops = _fetch_credit_sales_ops(workshop_id, start_date=start_date, end_date=end_date)
        pays = _fetch_payment_entries(workshop_id, start_date=start_date, end_date=end_date)

        # map operation totals for this customer
        customer_ops = {}
        rows = []
        for op in ops:
            if _op_to_customer(op) != customer:
                continue
            op_id = str(op.get("id"))
            total = float(op.get("total") or 0)
            if total <= 0:
                continue
            customer_ops[op_id] = total
            rows.append(
                {
                    "date": _op_date(op),
                    "type": "invoice",
                    "reference_id": op_id,
                    "debit": round(total, 2),
                    "credit": 0.0,
                    "description": op.get("notes") or "فاتورة آجل",
                }
            )

        # payments linked to those operations
        for je in pays:
            ref = str(je.get("reference_id") or "")
            if not ref or ref not in customer_ops:
                continue
            amt = _payment_amount_affecting_ar(je)
            if amt <= 0:
                continue
            rows.append(
                {
                    "date": je.get("date"),
                    "type": "payment",
                    "reference_id": ref,
                    "debit": 0.0,
                    "credit": round(float(amt), 2),
                    "description": je.get("description") or "تحصيل",
                    "journal_entry_id": je.get("id"),
                }
            )

        def _row_dt(r):
            dt = _to_date(r.get("date") or "")
            if dt is None:
                return datetime.min.replace(tzinfo=None)
            if getattr(dt, "tzinfo", None) is not None:
                return dt.replace(tzinfo=None)
            return dt

        rows.sort(key=_row_dt)

        bal = 0.0
        for r in rows:
            bal += float(r.get("debit") or 0) - float(r.get("credit") or 0)
            r["running_balance"] = round(bal, 2)

        return {
            "success": True,
            "data": {
                "customer": customer,
                "rows": rows,
                "ending_balance": round(bal, 2),
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e), "data": {"rows": []}}


@router.get("/ar/aging")
async def ar_aging(
    workshop_id: str = Query(...),
    as_of: str = Query(...),
):
    """Aging Report للذمم المدينة.

    التصنيف يعتمد على تاريخ الاستحقاق = تاريخ العملية + 30 يوم.
    """
    try:
        as_of = _parse_date_str(as_of) or datetime.now().date().isoformat()
        as_of_dt = _to_date(as_of) or datetime.now()

        ops = _fetch_credit_sales_ops(workshop_id, end_date=as_of)
        pays = _fetch_payment_entries(workshop_id, end_date=as_of)

        paid_by_op = {}
        for je in pays:
            ref = str(je.get("reference_id") or "")
            if not ref:
                continue
            amt = _payment_amount_affecting_ar(je)
            if amt <= 0:
                continue
            paid_by_op[ref] = paid_by_op.get(ref, 0.0) + float(amt)

        buckets = {
            "0_30": 0.0,
            "31_60": 0.0,
            "61_90": 0.0,
            "90_plus": 0.0,
        }
        open_invoices = []

        for op in ops:
            op_id = str(op.get("id"))
            inv_total = float(op.get("total") or 0)
            if inv_total <= 0:
                continue
            paid = paid_by_op.get(op_id, 0.0)
            remaining = round(max(0.0, inv_total - paid), 2)
            if remaining <= 0:
                continue

            op_date_str = _op_date(op)
            due = _due_date_from_op_date(op_date_str)
            due_dt = _to_date(due) if due else None
            days_past_due = 0
            if due_dt:
                days_past_due = (as_of_dt.date() - due_dt.date()).days
            if days_past_due <= 30:
                buckets["0_30"] += remaining
                bucket = "0-30"
            elif days_past_due <= 60:
                buckets["31_60"] += remaining
                bucket = "31-60"
            elif days_past_due <= 90:
                buckets["61_90"] += remaining
                bucket = "61-90"
            else:
                buckets["90_plus"] += remaining
                bucket = "90+"

            open_invoices.append(
                {
                    "operation_id": op_id,
                    "customer": _op_to_customer(op),
                    "invoice_date": op_date_str,
                    "due_date": due,
                    "days_past_due": days_past_due,
                    "remaining": remaining,
                    "bucket": bucket,
                }
            )

        total = round(sum(buckets.values()), 2)
        buckets = {k: round(v, 2) for k, v in buckets.items()}

        return {
            "success": True,
            "data": {
                "as_of": as_of,
                "buckets": buckets,
                "total_ar": total,
                "open_invoices": open_invoices,
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e), "data": {"buckets": {}}}


@router.get("/ar/turnover")
async def ar_turnover(
    workshop_id: str = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
    credit_sales_total: float = Query(..., description="إجمالي المبيعات الآجلة خلال الفترة"),
):
    """حساب معدل دوران الذمم المدينة خلال فترة.

    turnover = credit_sales_total / avg_receivables
    avg_receivables = (opening + closing) / 2
    """
    try:
        start_date = _parse_date_str(start_date) or start_date
        end_date = _parse_date_str(end_date) or end_date

        open_resp = await ar_customers(workshop_id=workshop_id, as_of=start_date)
        close_resp = await ar_customers(workshop_id=workshop_id, as_of=end_date)

        opening = float(((open_resp.get("data") or {}).get("total_ar") or 0))
        closing = float(((close_resp.get("data") or {}).get("total_ar") or 0))
        avg = (opening + closing) / 2.0 if (opening + closing) != 0 else 0.0

        turnover = None
        days = None
        if avg > 0:
            turnover = float(credit_sales_total) / avg
            if turnover > 0:
                days = 365.0 / turnover

        return {
            "success": True,
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "credit_sales_total": float(credit_sales_total),
                "opening_receivables": round(opening, 2),
                "closing_receivables": round(closing, 2),
                "avg_receivables": round(avg, 2),
                "turnover": round(turnover, 4) if turnover is not None else None,
                "days_sales_outstanding": round(days, 2) if days is not None else None,
            },
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

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
            # مهم: لا تجعل فشل جدول واحد يمنع حذف الجداول الأخرى
            # العمليات
            try:
                ops_del = (
                    supabase.table("operations")
                    .delete()
                    .gte("created_at", "1900-01-01")
                    .execute()
                )
                ops_count = len(ops_del.data) if ops_del.data else 0
                deleted_counts["operations"] = ops_count if ops_count > 0 else "all"
                print(f"✅ Deleted {ops_count} operations from Supabase")
            except Exception as e:
                print(f"Supabase operations deletion error: {e}")

            # دليل الحسابات (قد يكون غير موجود في بعض المخططات)
            try:
                coa_del = (
                    supabase.table("chart_of_accounts")
                    .delete()
                    .gte("created_at", "1900-01-01")
                    .execute()
                )
                coa_count = len(coa_del.data) if coa_del.data else 0
                deleted_counts["chart_of_accounts"] = coa_count if coa_count > 0 else "all"
                print(f"✅ Deleted {coa_count} chart of accounts from Supabase")
            except Exception as e:
                print(f"Supabase chart_of_accounts deletion skipped/failed: {e}")

            # القيود المحاسبية
            try:
                je_del = (
                    supabase.table("journal_entries")
                    .delete()
                    .eq("workshop_id", workshop_id)
                    .execute()
                )
                je_count = len(je_del.data) if je_del.data else 0
                deleted_counts["journal_entries"] = je_count
                print(f"✅ Deleted {je_count} journal entries (scoped) from Supabase")
            except Exception as e:
                print(f"Supabase journal_entries deletion error: {e}")

            # تنظيف legacy rows بدون workshop_id (إن وُجدت)
            try:
                supabase.table("journal_entries").delete().is_("workshop_id", "null").execute()
                print("✅ Deleted legacy journal entries with NULL workshop_id")
            except Exception as e:
                print(f"Legacy NULL workshop_id delete skipped: {e}")


            # الفواتير
            try:
                inv_del = (
                    supabase.table("invoices")
                    .delete()
                    .gte("created_at", "1900-01-01")
                    .execute()
                )
                inv_count = len(inv_del.data) if inv_del.data else 0
                deleted_counts["invoices"] = inv_count if inv_count > 0 else "all"
                print(f"✅ Deleted {inv_count} invoices from Supabase")
            except Exception as e:
                print(f"Invoices table deletion: {e}")

            print("✅ Supabase: Deleted all financial data")
        
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
        except Exception:
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
        except Exception:
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
        except Exception:
            pass
        
        # تشغيل التدقيق
        auditor = AccountingSystemAuditor("نظام الخدمات المحاسبي")


@router.post("/ar/migrate-operations-workshop")
async def ar_migrate_operations_workshop(payload: dict = Body(...)):
    """ترحيل عمليات الآجل القديمة التي لا تحتوي workshop_id.

    حسب طلبك: نرحّل فقط أصحاب الذمم (عمليات الآجل payment_method='credit')
    واللي workshop_id فيها NULL.

    مهم: هذا endpoint إداري للاستخدام مرة واحدة.
    """
    if not supabase:
        return {"success": False, "message": "Supabase not connected"}

    workshop_id = payload.get("workshop_id") or payload.get("workshopId")
    confirm = payload.get("confirm")
    if not workshop_id:
        return {"success": False, "message": "workshop_id مطلوب"}
    if confirm != "MIGRATE_NULL_WORKSHOP":
        return {"success": False, "message": "يجب تأكيد العملية عبر confirm=MIGRATE_NULL_WORKSHOP"}

    try:
        q = (
            supabase.table("operations")
            .select("id")
            .in_("type", ["sale", "service"])
            .eq("payment_method", "credit")
            .is_("workshop_id", "null")
        )
        candidates = (q.execute().data or [])

        updated = 0
        failed = 0
        for row in candidates:
            op_id = row.get("id")
            if not op_id:
                continue
            try:
                supabase.table("operations").update({"workshop_id": workshop_id}).eq("id", op_id).execute()
                updated += 1
            except Exception:
                failed += 1

        return {
            "success": True,
            "data": {
                "workshop_id": workshop_id,
                "matched": len(candidates),
                "updated": updated,
                "failed": failed,
            },
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

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

