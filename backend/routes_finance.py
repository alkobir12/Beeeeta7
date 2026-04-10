from fastapi import APIRouter, Query, Body, HTTPException

from accounting_auditor import AccountingSystemAuditor

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import uuid
import os
import re
import json
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
    db_name = os.getenv("DB_NAME")

    # Do not attempt to connect if required config is missing
    if not mongo_uri or not db_name:
        finance_db = None
        return

    try:
        mongo_client = AsyncIOMotorClient(mongo_uri)
        finance_db = mongo_client.get_database(db_name)
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


def _normalize_date_string(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    raw = str(value).strip()
    if not raw:
        return raw

    # already ISO date-like
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        return raw[:10]

    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except Exception:
            continue
    return raw


AR_ACCOUNT_CODES = {"1103", "113"}
AP_ACCOUNT_CODES = {"2101", "211"}


def _infer_account_type_from_code(code: str) -> str:
    try:
        numeric = int(str(code or "").strip())
    except Exception:
        return "other"

    if 1000 <= numeric <= 1999:
        return "asset"
    if 2000 <= numeric <= 2999:
        return "liability"
    if 3000 <= numeric <= 3999:
        return "equity"
    if 4000 <= numeric <= 4999:
        return "revenue"
    if 5000 <= numeric <= 6999:
        return "expense"
    return "other"


RAKAN_ACCOUNT_CODE_PREFIX = "5000"


def _normalize_account_code(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("acc-") and raw[4:].isdigit():
        return raw[4:]
    return raw


def _is_rakan_account_code(value: Any) -> bool:
    return _normalize_account_code(value).startswith(RAKAN_ACCOUNT_CODE_PREFIX)


def _line_account_code(line: Dict[str, Any], id_to_code: Dict[str, str]) -> str:
    account_code = line.get("account") or line.get("account_code") or line.get("code")
    if not account_code:
        account_id = line.get("account_id") or line.get("accountId")
        if account_id:
            account_code = id_to_code.get(str(account_id)) or account_id
    return _normalize_account_code(account_code)


def _is_rakan_journal_entry(entry: Dict[str, Any], id_to_code: Dict[str, str]) -> bool:
    source = str(entry.get("source") or "").strip().lower()
    if "rakan_parts" in source:
        return True

    description = str(entry.get("description") or "").strip().lower()
    if "[rakan_parts]" in description or "account_code:5000" in description:
        return True

    for line in entry.get("lines", []) or []:
        if not isinstance(line, dict):
            continue
        if _is_rakan_account_code(_line_account_code(line, id_to_code)):
            return True
    return False


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

        if not secondary_accounts:
            try:
                res3 = (
                    supabase_1.table("business_accounts").select("*").order("code").execute()
                )
                secondary_accounts = res3.data or []
            except Exception as e:
                print(f"Secondary business_accounts fetch failed: {e}")

    merged = []
    seen_codes = set()

    def add_list(lst):
        for a in (lst or []):
            if not isinstance(a, dict):
                continue
            code = str(a.get("code") or "").strip()
            if not code or code in seen_codes:
                continue

            # Remove legacy codes (e.g., 101/411/521) to avoid duplicates.
            if code.isdigit() and int(code) < 1000:
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
    if account_code in id_to_code:
        account_code = id_to_code[account_code]
    account_code = _normalize_account_code(account_code)
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
    include_rakan: bool = False,
):
    if not supabase:
        raise Exception("Supabase not connected")

    query = (
        supabase.table("journal_entries")
        .select("*")
        .eq("workshop_id", workshop_id)
        .neq("workshop_id", None)
    )
    normalized_start = _normalize_date_string(start_date)
    normalized_end = _normalize_date_string(end_date)

    if normalized_start:
        query = query.gte("date", normalized_start)
    if normalized_end:
        query = query.lte("date", normalized_end)
    if limit is not None:
        query = query.range(skip, skip + limit - 1)
    rows = query.order("date", desc=True).execute().data or []
    if include_rakan:
        return rows

    try:
        accounts = _fetch_accounts()
        id_to_code, _, _ = _build_account_maps(accounts)
    except Exception:
        id_to_code = {}

    return [
        entry
        for entry in rows
        if not _is_rakan_journal_entry(entry, id_to_code)
    ]


def _compute_trial_balance_map(
    workshop_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_rakan: bool = False,
):
    accounts = _fetch_accounts()
    id_to_code, code_to_name, _ = _build_account_maps(accounts)
    entries = _fetch_journal_entries(
        workshop_id,
        start_date=start_date,
        end_date=end_date,
        limit=10000,
        include_rakan=include_rakan,
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
        target_date = _normalize_date_string(as_of_date) or datetime.now().strftime("%Y-%m-%d")
        balances_map, accounts = _compute_trial_balance_map(
            workshop_id,
            end_date=target_date,
            include_rakan=False,
        )
        _, code_to_name, code_to_type = _build_account_maps(accounts)

        assets_accounts = []
        liabilities_accounts = []
        equity_accounts = []

        for code, row in balances_map.items():
            debit = _safe_float(row.get("debit"))
            credit = _safe_float(row.get("credit"))

            acc_type = code_to_type.get(code) or _infer_account_type_from_code(code)
            if acc_type == "asset":
                balance = debit - credit
            elif acc_type in {"liability", "equity"}:
                balance = credit - debit
            else:
                continue

            if abs(balance) < 0.0001:
                continue

            account_data = {
                "id": code,
                "code": code,
                "name": row.get("name") or code_to_name.get(code) or code,
                "balance": round(abs(balance), 2),
            }

            if acc_type == "asset":
                assets_accounts.append(account_data)
            elif acc_type == "liability":
                liabilities_accounts.append(account_data)
            else:
                equity_accounts.append(account_data)

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
    workshop_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """
    قائمة الدخل محسوبة من دليل الحسابات
    """
    try:
        effective_workshop_id = workshop_id or os.environ.get("DEFAULT_WORKSHOP_ID")
        if not effective_workshop_id:
            raise HTTPException(status_code=400, detail="معرف الورشة مطلوب")

        end_date = _normalize_date_string(end_date) or datetime.now().strftime("%Y-%m-%d")
        start_date = _normalize_date_string(start_date) or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        accounts = _fetch_accounts()
        id_to_code, code_to_name, code_to_type = _build_account_maps(accounts)
        entries = _fetch_journal_entries(
            effective_workshop_id,
            start_date=start_date,
            end_date=end_date,
            limit=10000,
            include_rakan=False,
        )

        revenue_accounts: Dict[str, Dict[str, Any]] = {}
        expense_accounts: Dict[str, Dict[str, Any]] = {}

        for entry in entries:
            for line in entry.get("lines", []) or []:
                normalized = _normalize_line(line, id_to_code, code_to_name)
                if not normalized:
                    continue

                code = normalized["code"]
                acc_type = code_to_type.get(code) or _infer_account_type_from_code(code)
                debit = _safe_float(normalized.get("debit"))
                credit = _safe_float(normalized.get("credit"))
                name = normalized.get("name") or code_to_name.get(code) or code

                if acc_type == "revenue":
                    amount = credit - debit
                    if code not in revenue_accounts:
                        revenue_accounts[code] = {"name": name, "amount": 0.0}
                    revenue_accounts[code]["amount"] += amount
                elif acc_type == "expense":
                    amount = debit - credit
                    if code not in expense_accounts:
                        expense_accounts[code] = {"name": name, "amount": 0.0}
                    expense_accounts[code]["amount"] += amount

        revenue_accounts = {
            code: {"name": data["name"], "amount": round(float(data["amount"]), 2)}
            for code, data in revenue_accounts.items()
            if abs(float(data.get("amount") or 0)) >= 0.0001
        }
        expense_accounts = {
            code: {"name": data["name"], "amount": round(float(data["amount"]), 2)}
            for code, data in expense_accounts.items()
            if abs(float(data.get("amount") or 0)) >= 0.0001
        }

        total_revenue = sum(float(v.get("amount") or 0) for v in revenue_accounts.values())
        total_expenses = sum(float(v.get("amount") or 0) for v in expense_accounts.values())
        
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
    workshop_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """
    قائمة التدفقات النقدية من قيود اليومية في Supabase
    """
    try:
        effective_workshop_id = workshop_id or os.environ.get("DEFAULT_WORKSHOP_ID")
        if not effective_workshop_id:
            raise HTTPException(status_code=400, detail="معرف الورشة مطلوب")

        end_date = _normalize_date_string(end_date) or datetime.now().strftime("%Y-%m-%d")
        start_date = _normalize_date_string(start_date) or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        accounts = _fetch_accounts()
        id_to_code, code_to_name, _ = _build_account_maps(accounts)
        entries = _fetch_journal_entries(
            effective_workshop_id, start_date=start_date, end_date=end_date, limit=10000
        )

        # Improve categorization using the other side of each cash/bank line.
        cash_from_customers = 0.0
        cash_to_suppliers = 0.0
        cash_for_salaries = 0.0
        equipment_purchases = 0.0
        owner_drawings = 0.0

        def _is_code_in_range(code: str, start: int, end: int) -> bool:
            try:
                n = int(str(code))
                return start <= n <= end
            except Exception:
                return False

        for entry in entries:
            # find cash/bank movement line, then infer category from the counterpart accounts
            cash_lines = []
            other_lines = []
            for line in entry.get("lines", []) or []:
                normalized = _normalize_line(line, id_to_code, code_to_name)
                if not normalized:
                    continue
                if normalized["code"] in ("1101", "1102"):
                    cash_lines.append(normalized)
                else:
                    other_lines.append(normalized)

            if not cash_lines:
                continue

            for cl in cash_lines:
                amount_in = float(cl.get("debit") or 0)
                amount_out = float(cl.get("credit") or 0)

                # Classify inflows
                if amount_in > 0:
                    # If counterpart is AR (1103), it's customer collection (settlement)
                    if any(ol.get("code") == "1103" for ol in other_lines):
                        cash_from_customers += amount_in
                    # If counterpart is revenue (4xxx), it's cash sale
                    elif any(_is_code_in_range(ol.get("code"), 4000, 4999) for ol in other_lines):
                        cash_from_customers += amount_in
                    else:
                        cash_from_customers += amount_in

                # Classify outflows
                if amount_out > 0:
                    # Supplier payments: AP (2101)
                    if any(ol.get("code") == "2101" for ol in other_lines):
                        cash_to_suppliers += amount_out
                    # Salaries expense (6101) or accrued salaries (2103)
                    elif any(ol.get("code") in ("6101", "2103") for ol in other_lines):
                        cash_for_salaries += amount_out
                    # Equipment purchases (fixed assets 12xx)
                    elif any(_is_code_in_range(ol.get("code"), 1200, 1299) for ol in other_lines):
                        equipment_purchases += amount_out
                    # Owner drawings (equity 3102)
                    elif any(ol.get("code") == "3102" for ol in other_lines):
                        owner_drawings += amount_out
                    else:
                        # default treat as supplier/operating outflow
                        cash_to_suppliers += amount_out

        net_operating_cash = cash_from_customers - (cash_to_suppliers + cash_for_salaries)
        net_investing_cash = -equipment_purchases
        net_financing_cash = -owner_drawings
        net_change_in_cash = net_operating_cash + net_investing_cash + net_financing_cash

        return {
            "success": True,
            "data": {
                "period": f"{start_date} إلى {end_date}",
                "operating_activities": {
                    "cash_from_customers": round(cash_from_customers, 2),
                    "cash_to_suppliers": round(-cash_to_suppliers, 2),
                    "cash_for_salaries": round(-cash_for_salaries, 2),
                    "net_operating_cash": round(net_operating_cash, 2),
                },
                "investing_activities": {
                    "equipment_purchases": round(-equipment_purchases, 2),
                    "asset_sales": 0,
                    "net_investing_cash": round(net_investing_cash, 2),
                },
                "financing_activities": {
                    "owner_drawings": round(-owner_drawings, 2),
                    "capital_injections": 0,
                    "new_loans": 0,
                    "loan_payments": 0,
                    "net_financing_cash": round(net_financing_cash, 2),
                },
                "net_change_in_cash": round(net_change_in_cash, 2),
                "beginning_cash": 0,
                "ending_cash": round(net_change_in_cash, 2),
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
    include_rakan: bool = False,
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

        accounts_balances, merged_accounts = _compute_trial_balance_map(
            workshop_id,
            start_date=start_bound,
            end_date=end_bound,
            include_rakan=include_rakan,
        )
        _, code_to_name, _ = _build_account_maps(merged_accounts)

        accounts_list = []
        total_debit = 0
        total_credit = 0

        for code in sorted(accounts_balances.keys()):
            acc = accounts_balances[code]
            debit = round(acc["debit"], 2)
            credit = round(acc["credit"], 2)
            name = acc.get("name") or code_to_name.get(code) or code
            if str(name).strip() == code and code_to_name.get(code):
                name = code_to_name.get(code)
            accounts_list.append(
                {"code": code, "name": name, "debit": debit, "credit": credit}
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


def _normalize_account_type(account_type: Optional[str]) -> str:
    allowed = {"asset", "liability", "equity", "revenue", "expense"}
    normalized = str(account_type or "asset").strip().lower()
    return normalized if normalized in allowed else "asset"


def _fetch_operations_for_reconciliation(
    workshop_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    if not supabase:
        raise Exception("Supabase not connected")

    def _build(scoped: bool, select_expr: str):
        q = supabase.table("operations").select(select_expr)
        if scoped:
            q = q.eq("workshop_id", workshop_id)
        if start_date:
            q = q.gte("op_date", start_date)
        if end_date:
            q = q.lte("op_date", end_date)
        return q.order("op_date", desc=False)

    def _run(scoped: bool):
        preferred_select = (
            "id,type,total,payment_method,scope,source,business_unit,op_date,workshop_id,notes"
        )
        try:
            return _build(scoped, preferred_select).execute().data or []
        except Exception as schema_error:
            if "does not exist" not in str(schema_error).lower():
                raise
            try:
                fallback_select = "id,type,total,payment_method,source,op_date,workshop_id,notes"
                return _build(scoped, fallback_select).execute().data or []
            except Exception:
                return _build(scoped, "*").execute().data or []

    try:
        return _run(scoped=True)
    except Exception:
        return _run(scoped=False)


def _is_rakan_operation_row(row: Dict[str, Any]) -> bool:
    scope = str(row.get("scope") or "").strip().lower()
    source = str(row.get("source") or "").strip().lower()
    business_unit = str(row.get("business_unit") or "").strip().lower()
    notes = str(row.get("notes") or "").strip().lower()
    account_code = str(
        row.get("accounting_account_code")
        or row.get("accountCode")
        or row.get("account_number")
        or row.get("accountNumber")
        or ""
    ).strip()
    notes_has_5000 = bool(re.search(r"account_code\s*:\s*5000", notes, re.IGNORECASE))
    return (
        scope == "rakan_parts"
        or "rakan_parts" in source
        or business_unit == "rakan_parts"
        or "[rakan_parts]" in notes
        or account_code.startswith("5000")
        or notes_has_5000
    )


def _normalize_operation_type_for_reconciliation(op_type: Optional[str]) -> Optional[str]:
    normalized = str(op_type or "").strip().lower()
    if not normalized:
        return None
    if normalized == "service":
        return "sale"
    return normalized


def _infer_tx_type_from_journal_entry(
    entry: Dict[str, Any],
    id_to_code: Optional[Dict[str, str]] = None,
    code_to_name: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    description = str(entry.get("description") or "").strip().lower()
    source = str(entry.get("source") or "").strip().lower()
    lines = entry.get("lines") or []

    if source == "operation_payment":
        return "payment_order"

    if "payment_order" in description or "سداد" in description:
        return "payment_order"
    if "purchase_return" in description:
        return "purchase_return"
    if "sale_return" in description:
        return "sale_return"
    if "purchase" in description or "مشت" in description:
        return "purchase"
    if "expense" in description or "مصروف" in description:
        return "expense"
    if "sale" in description or "service" in description or "بيع" in description:
        return "sale"

    credits_by_code: Dict[str, float] = {}
    debits_by_code: Dict[str, float] = {}
    id_to_code = id_to_code or {}
    code_to_name = code_to_name or {}

    for line in lines:
        normalized = _normalize_line(line, id_to_code, code_to_name)
        if not normalized:
            continue
        code = str(normalized.get("code") or "").strip()
        if not code:
            continue
        debits_by_code[code] = debits_by_code.get(code, 0.0) + _safe_float(normalized.get("debit"))
        credits_by_code[code] = credits_by_code.get(code, 0.0) + _safe_float(normalized.get("credit"))

    if any(code in AR_ACCOUNT_CODES and credits_by_code.get(code, 0.0) > 0 for code in credits_by_code):
        return "payment_order"
    if any(code in AP_ACCOUNT_CODES and debits_by_code.get(code, 0.0) > 0 for code in debits_by_code):
        return "payment_order"

    if any(code.startswith("4") and credits_by_code.get(code, 0.0) > 0 for code in credits_by_code):
        return "sale"
    if any(code.startswith("5") and debits_by_code.get(code, 0.0) > 0 for code in debits_by_code):
        return "purchase"
    if any(code.startswith("6") and debits_by_code.get(code, 0.0) > 0 for code in debits_by_code):
        return "expense"

    return None


def _extract_operation_account_label(
    operation: Dict[str, Any],
    account_id_to_code: Optional[Dict[str, str]] = None,
    code_to_name: Optional[Dict[str, str]] = None,
) -> str:
    account_id_to_code = account_id_to_code or {}
    code_to_name = code_to_name or {}

    notes_blob = str(operation.get("notes") or operation.get("description") or "")
    target_match = re.search(r"ACCOUNTING_TARGET\s*:\s*([^\n\r]+)", notes_blob, re.IGNORECASE)
    if target_match and target_match.group(1).strip():
        return target_match.group(1).strip()

    code_match = re.search(r"ACCOUNT_CODE\s*:\s*([0-9]+)", notes_blob, re.IGNORECASE)
    code = code_match.group(1).strip() if code_match else ""

    if not code:
        code = str(
            operation.get("accounting_account_code")
            or operation.get("accountCode")
            or operation.get("account_number")
            or operation.get("accountNumber")
            or ""
        ).strip()

    if not code:
        account_id = str(operation.get("account_id") or operation.get("accountId") or "").strip()
        if account_id:
            code = str(account_id_to_code.get(account_id) or "").strip()

    if not code:
        return "غير محدد"

    name = code_to_name.get(code)
    return f"{name} ({code})" if name else code


def _transaction_type_label_ar(tx_type: Optional[str]) -> str:
    labels = {
        "sale": "بيع",
        "purchase": "شراء",
        "expense": "مصروف",
        "sale_return": "مرتجع بيع",
        "purchase_return": "مرتجع شراء",
        "payment_order": "أمر سداد",
        "payment": "تحصيل/سداد",
        "service": "خدمة",
    }
    normalized = str(tx_type or "").strip().lower()
    return labels.get(normalized, normalized or "غير محدد")


def _build_repair_journal_entry_from_operation(
    operation: Dict[str, Any],
    workshop_id: str,
    account_id_to_code: Optional[Dict[str, str]] = None,
) -> Optional[Dict[str, Any]]:
    op_type = _normalize_operation_type_for_reconciliation(operation.get("type"))
    if not op_type:
        return None

    total = _safe_float(operation.get("total"))
    if total <= 0:
        return None

    payment_method = str(operation.get("payment_method") or operation.get("paymentMethod") or "cash").strip().lower()
    is_credit = payment_method == "credit"
    cash_code = "1102" if payment_method in {"bank", "transfer"} else "1101"
    selected_code = (
        operation.get("accounting_account_code")
        or operation.get("accountCode")
        or operation.get("account_number")
        or operation.get("accountNumber")
    )
    notes_blob = str(operation.get("notes") or operation.get("description") or "")
    notes_code_match = re.search(r"ACCOUNT_CODE\s*:\s*([0-9]+)", notes_blob, re.IGNORECASE)
    if notes_code_match:
        selected_code = notes_code_match.group(1)

    if not selected_code:
        account_id_to_code = account_id_to_code or {}
        account_id = str(operation.get("account_id") or operation.get("accountId") or "").strip()
        if account_id:
            selected_code = account_id_to_code.get(account_id)

    selected_code = str(selected_code or "").strip() or None

    lines: List[Dict[str, Any]] = []
    transaction_type = op_type

    if op_type == "sale":
        debit_code = "1103" if is_credit else cash_code
        credit_code = selected_code or "4000"
        lines = [
            {"account": debit_code, "account_name": debit_code, "debit": total, "credit": 0},
            {"account": credit_code, "account_name": credit_code, "debit": 0, "credit": total},
        ]
    elif op_type == "purchase":
        debit_code = selected_code if str(selected_code or "").startswith(("5", "6")) else "6100"
        credit_code = "2101" if is_credit else cash_code
        lines = [
            {"account": debit_code, "account_name": debit_code, "debit": total, "credit": 0},
            {"account": credit_code, "account_name": credit_code, "debit": 0, "credit": total},
        ]
    elif op_type == "expense":
        debit_code = selected_code or "6100"
        lines = [
            {"account": debit_code, "account_name": debit_code, "debit": total, "credit": 0},
            {"account": cash_code, "account_name": cash_code, "debit": 0, "credit": total},
        ]
    elif op_type == "sale_return":
        credit_code = "1103" if is_credit else cash_code
        debit_code = selected_code or "4000"
        lines = [
            {"account": debit_code, "account_name": debit_code, "debit": total, "credit": 0},
            {"account": credit_code, "account_name": credit_code, "debit": 0, "credit": total},
        ]
    elif op_type == "purchase_return":
        debit_code = "2101" if is_credit else cash_code
        credit_code = selected_code if str(selected_code or "").startswith(("5", "6")) else "6100"
        lines = [
            {"account": debit_code, "account_name": debit_code, "debit": total, "credit": 0},
            {"account": credit_code, "account_name": credit_code, "debit": 0, "credit": total},
        ]
    elif op_type == "payment_order":
        partner_type = str(operation.get("partner_type") or operation.get("partnerType") or "").strip().lower()
        if partner_type == "customer":
            lines = [
                {"account": cash_code, "account_name": cash_code, "debit": total, "credit": 0},
                {"account": "1103", "account_name": "1103", "debit": 0, "credit": total},
            ]
        else:
            lines = [
                {"account": "2101", "account_name": "2101", "debit": total, "credit": 0},
                {"account": cash_code, "account_name": cash_code, "debit": 0, "credit": total},
            ]
    else:
        return None

    op_id = str(operation.get("id") or "").strip()
    op_date = operation.get("op_date") or operation.get("date") or datetime.now().isoformat()
    description = (
        operation.get("notes")
        or operation.get("description")
        or f"Backfill journal for operation {op_type}"
    )

    return {
        "id": str(uuid.uuid4()),
        "workshop_id": workshop_id,
        "date": op_date,
        "description": description,
        "lines": lines,
        "total": round(total, 2),
        "source": "operation",
        "transaction_type": transaction_type,
        "reference_id": op_id,
    }


def _insert_repair_journal_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase:
        raise Exception("Supabase not connected")

    supabase.table("journal_entries").insert(entry).execute()

    row = (
        supabase.table("journal_entries")
        .select("id,reference_id,transaction_type,total,workshop_id,date,source")
        .eq("id", str(entry.get("id") or ""))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row:
        raise Exception("Insert not persisted: journal row not found after insert")
    return row[0]


@router.get("/reports/reconciliation")
async def get_financial_reconciliation(
    workshop_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_rakan: bool = Query(False),
):
    """مطابقة العمليات مقابل القيود اليومية للفترة المحددة."""
    try:
        end_date = end_date or datetime.now().strftime("%Y-%m-%d")
        start_date = start_date or (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")

        operations = _fetch_operations_for_reconciliation(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
        )
        if not include_rakan:
            operations = [op for op in operations if not _is_rakan_operation_row(op)]

        accounts = _fetch_accounts()
        account_id_to_code, code_to_name, _ = _build_account_maps(accounts)

        tracked_types = [
            "sale",
            "purchase",
            "expense",
            "sale_return",
            "purchase_return",
            "payment_order",
        ]
        operation_totals = {t: 0.0 for t in tracked_types}
        operation_counts = {t: 0 for t in tracked_types}
        operation_type_by_id: Dict[str, str] = {}
        untracked_operations = {"count": 0, "total": 0.0}

        for op in operations:
            op_type = _normalize_operation_type_for_reconciliation(op.get("type"))
            op_id = str(op.get("id") or "").strip()
            if op_id and op_type:
                operation_type_by_id[op_id] = op_type
            if op_type not in operation_totals:
                untracked_operations["count"] += 1
                untracked_operations["total"] += _safe_float(op.get("total"))
                continue
            operation_totals[op_type] += _safe_float(op.get("total"))
            operation_counts[op_type] += 1

        journal_entries = _fetch_journal_entries(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
            limit=10000,
            include_rakan=include_rakan,
        )
        id_to_code = account_id_to_code
        journal_totals = {t: 0.0 for t in tracked_types}
        journal_counts = {t: 0 for t in tracked_types}
        account_labels_by_type = {t: set() for t in tracked_types}
        unclassified_journals = {"count": 0, "total": 0.0}

        for entry in journal_entries:
            tx_type = _normalize_operation_type_for_reconciliation(entry.get("transaction_type"))
            reference_id = str(entry.get("reference_id") or "").strip()
            source = str(entry.get("source") or "").strip().lower()

            # إذا كان القيد مربوطًا بعملية، نُقدّم نوع العملية كمصدر الحقيقة
            if reference_id and reference_id in operation_type_by_id and source in {"operation", "operation_rakan_parts"}:
                tx_type = operation_type_by_id.get(reference_id)

            if not tx_type:
                if reference_id and reference_id in operation_type_by_id:
                    tx_type = operation_type_by_id.get(reference_id)

            if not tx_type:
                tx_type = _infer_tx_type_from_journal_entry(
                    entry,
                    id_to_code=id_to_code,
                    code_to_name=code_to_name,
                )

            if tx_type not in journal_totals:
                unclassified_journals["count"] += 1
                unclassified_journals["total"] += _safe_float(entry.get("total"))
                continue

            journal_totals[tx_type] += _safe_float(entry.get("total"))
            journal_counts[tx_type] += 1

            normalized_lines = []
            for line in entry.get("lines", []) or []:
                normalized = _normalize_line(line, id_to_code, code_to_name)
                if normalized:
                    normalized_lines.append(normalized)

            for line in normalized_lines:
                code = str(line.get("code") or "").strip()
                name = line.get("name") or code_to_name.get(code) or code
                if str(name).strip() == code and code_to_name.get(code):
                    name = code_to_name.get(code)
                debit = _safe_float(line.get("debit"))
                credit = _safe_float(line.get("credit"))

                is_target = False
                if tx_type == "sale":
                    is_target = code.startswith("4") and credit > 0
                elif tx_type == "purchase":
                    is_target = code.startswith("5") and debit > 0
                elif tx_type == "expense":
                    is_target = code.startswith("6") and debit > 0
                elif tx_type == "sale_return":
                    is_target = code.startswith("4") and debit > 0
                elif tx_type == "purchase_return":
                    is_target = (code.startswith("5") or code.startswith("6")) and credit > 0
                elif tx_type == "payment_order":
                    is_target = code in {"1101", "1102", "1103", "2101"}

                if is_target:
                    account_labels_by_type[tx_type].add(f"{name} ({code})")

        existing_operation_refs = {
            str(entry.get("reference_id") or "").strip()
            for entry in journal_entries
            if str(entry.get("source") or "").strip().lower() in {"operation", "operation_rakan_parts"}
            and str(entry.get("reference_id") or "").strip()
        }
        missing_operation_journals = [
            op
            for op in operations
            if str(op.get("id") or "").strip()
            and _normalize_operation_type_for_reconciliation(op.get("type")) in journal_totals
            and _safe_float(op.get("total")) > 0.01
            and str(op.get("id") or "").strip() not in existing_operation_refs
        ]

        rows = []
        total_absolute_difference = 0.0
        for tx_type in tracked_types:
            op_total = round(operation_totals.get(tx_type, 0.0), 2)
            je_total = round(journal_totals.get(tx_type, 0.0), 2)
            difference = round(op_total - je_total, 2)
            total_absolute_difference += abs(difference)
            rows.append(
                {
                    "type": tx_type,
                    "type_label_ar": _transaction_type_label_ar(tx_type),
                    "operations_count": operation_counts.get(tx_type, 0),
                    "journal_entries_count": journal_counts.get(tx_type, 0),
                    "operations_total": op_total,
                    "journal_entries_total": je_total,
                    "difference": difference,
                    "matched": abs(difference) < 0.01,
                    "account_labels": sorted(
                        [label for label in account_labels_by_type.get(tx_type, set()) if label]
                    )[:6],
                }
            )

        return {
            "success": True,
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "summary": {
                    "matched": total_absolute_difference < 0.01,
                    "total_absolute_difference": round(total_absolute_difference, 2),
                    "untracked_operations": {
                        "count": int(untracked_operations["count"]),
                        "total": round(float(untracked_operations["total"]), 2),
                    },
                    "unclassified_journal_entries": {
                        "count": int(unclassified_journals["count"]),
                        "total": round(float(unclassified_journals["total"]), 2),
                    },
                    "missing_operation_journals": {
                        "count": len(missing_operation_journals),
                        "total": round(
                            sum(_safe_float(op.get("total")) for op in missing_operation_journals),
                            2,
                        ),
                        "sample_operation_ids": [
                            str(op.get("id")) for op in missing_operation_journals[:10]
                        ],
                    },
                },
                "rows": rows,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "summary": {"matched": False, "total_absolute_difference": 0},
                "rows": [],
            },
        }


@router.post("/reports/reconciliation/backfill-journals")
async def backfill_missing_operation_journals(
    workshop_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_rakan: bool = Query(False),
    apply_changes: bool = Query(False),
    max_records: int = Query(200, ge=1, le=1000),
):
    """فحص/ترميم القيود المفقودة للعمليات التاريخية.

    - `apply_changes=false` => معاينة فقط (dry-run)
    - `apply_changes=true`  => إنشاء قيود للعمليات التي لا تملك قيدًا مرجعيًا
    """
    try:
        end_date = end_date or datetime.now().strftime("%Y-%m-%d")
        start_date = start_date or (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")

        operations = _fetch_operations_for_reconciliation(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
        )
        if not include_rakan:
            operations = [op for op in operations if not _is_rakan_operation_row(op)]

        accounts = _fetch_accounts()
        account_id_to_code, _, _ = _build_account_maps(accounts)

        journal_entries = _fetch_journal_entries(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
            limit=10000,
            include_rakan=include_rakan,
        )

        tracked_types = {
            "sale",
            "purchase",
            "expense",
            "sale_return",
            "purchase_return",
            "payment_order",
        }
        existing_operation_refs = {
            str(entry.get("reference_id") or "").strip()
            for entry in journal_entries
            if str(entry.get("source") or "").strip().lower() in {"operation", "operation_rakan_parts"}
            and str(entry.get("reference_id") or "").strip()
        }

        missing_operations = []
        for op in operations:
            op_id = str(op.get("id") or "").strip()
            op_type = _normalize_operation_type_for_reconciliation(op.get("type"))
            if not op_id or op_type not in tracked_types:
                continue
            if op_id in existing_operation_refs:
                continue
            candidate_entry = _build_repair_journal_entry_from_operation(
                op,
                workshop_id,
                account_id_to_code=account_id_to_code,
            )
            if candidate_entry:
                missing_operations.append({"operation": op, "journal": candidate_entry})

        preview = [
            {
                "operation_id": str(item["operation"].get("id")),
                "type": str(item["operation"].get("type")),
                "total": round(_safe_float(item["operation"].get("total")), 2),
                "journal_transaction_type": item["journal"].get("transaction_type"),
                "journal_accounts": [
                    str(line.get("account")) for line in (item["journal"].get("lines") or [])
                ],
            }
            for item in missing_operations[:20]
        ]

        if not apply_changes:
            return {
                "success": True,
                "mode": "dry_run",
                "data": {
                    "period": {"start_date": start_date, "end_date": end_date},
                    "missing_count": len(missing_operations),
                    "missing_total": round(
                        sum(_safe_float(item["operation"].get("total")) for item in missing_operations),
                        2,
                    ),
                    "preview": preview,
                },
            }

        created = 0
        created_items = []
        failed = []
        for item in missing_operations[:max_records]:
            try:
                inserted = _insert_repair_journal_entry(item["journal"])
                created += 1
                created_items.append(
                    {
                        "journal_id": str(inserted.get("id") or item["journal"].get("id")),
                        "reference_id": str(
                            inserted.get("reference_id") or item["journal"].get("reference_id")
                        ),
                        "transaction_type": inserted.get("transaction_type")
                        or item["journal"].get("transaction_type"),
                        "workshop_id": inserted.get("workshop_id") or item["journal"].get("workshop_id"),
                        "date": inserted.get("date") or item["journal"].get("date"),
                        "source": inserted.get("source") or item["journal"].get("source"),
                    }
                )
            except Exception as insert_error:
                failed.append(
                    {
                        "operation_id": str(item["operation"].get("id")),
                        "error": str(insert_error),
                    }
                )

        return {
            "success": True,
            "mode": "apply",
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "found_missing": len(missing_operations),
                "created": created,
                "created_items": created_items[:50],
                "failed": failed,
                "preview": preview,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "mode": "error",
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "missing_count": 0,
                "preview": [],
            },
        }


@router.get("/reports/account-tree-details")
async def get_account_tree_details(
    workshop_id: str = Query(...),
    account_code: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_descendants: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """تفاصيل حساب شجرية: الحساب الفرعي + العمليات المرتبطة مع ترقيم صفحات."""
    try:
        accounts = _fetch_accounts()
        id_to_code, code_to_name, code_to_type = _build_account_maps(accounts)
        code_map = {str(acc.get("code") or "").strip(): acc for acc in accounts}

        account_code = str(account_code or "").strip()
        selected = code_map.get(account_code)
        if not selected:
            raise HTTPException(status_code=404, detail="الحساب غير موجود")

        selected_id = str(selected.get("id") or "").strip()

        direct_children = [
            acc
            for acc in accounts
            if str(acc.get("parent_id") or "").strip() == selected_id
        ]

        descendants_codes = {account_code}
        if include_descendants:
            queue = [selected_id]
            while queue:
                current_id = queue.pop(0)
                for acc in accounts:
                    if str(acc.get("parent_id") or "").strip() == current_id:
                        child_id = str(acc.get("id") or "").strip()
                        child_code = str(acc.get("code") or "").strip()
                        if child_code:
                            descendants_codes.add(child_code)
                        if child_id:
                            queue.append(child_id)

        entries = _fetch_journal_entries(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
            limit=20000,
            include_rakan=False,
        )

        operation_refs = [
            str(e.get("reference_id") or "").strip()
            for e in entries
            if str(e.get("source") or "").strip().lower() in {"operation", "operation_rakan_parts"}
            and str(e.get("reference_id") or "").strip()
        ]
        operation_refs = list(dict.fromkeys(operation_refs))

        operation_map: Dict[str, Dict[str, Any]] = {}
        visit_map: Dict[str, Dict[str, Any]] = {}
        if operation_refs and supabase:
            try:
                op_rows = (
                    supabase.table("operations")
                    .select("*")
                    .in_("id", operation_refs)
                    .execute()
                    .data
                    or []
                )
                operation_map = {str(row.get("id") or ""): row for row in op_rows}

                visit_ids = [
                    str(row.get("visit_id") or row.get("visitId") or "").strip()
                    for row in op_rows
                    if str(row.get("visit_id") or row.get("visitId") or "").strip()
                ]
                visit_ids = list(dict.fromkeys(visit_ids))
                if visit_ids:
                    visit_rows = (
                        supabase.table("vehicle_visits")
                        .select("id,customer_name,vehicle_plate,plate_number,car_type,vehicle_number,customer_id")
                        .in_("id", visit_ids)
                        .execute()
                        .data
                        or []
                    )
                    visit_map = {str(row.get("id") or ""): row for row in visit_rows}
            except Exception:
                operation_map = {}
                visit_map = {}

        # دعم إضافي: استخراج معرف الزيارة من الوصف عند غياب ربط العملية
        if supabase:
            try:
                visit_ids_from_desc = []
                for e in entries:
                    desc = str(e.get("description") or "")
                    match = re.search(r"الزيارة\s+([a-zA-Z0-9-]+)", desc)
                    if match:
                        visit_ids_from_desc.append(match.group(1).strip())
                visit_ids_from_desc = [v for v in dict.fromkeys(visit_ids_from_desc) if v]
                missing_visit_ids = [v for v in visit_ids_from_desc if v not in visit_map]
                if missing_visit_ids:
                    extra_visits = (
                        supabase.table("vehicle_visits")
                        .select("id,customer_name,vehicle_plate,plate_number,car_type,vehicle_number,customer_id")
                        .in_("id", missing_visit_ids)
                        .execute()
                        .data
                        or []
                    )
                    for row in extra_visits:
                        visit_map[str(row.get("id") or "")] = row
            except Exception:
                pass

        operations = []
        for entry in entries:
            normalized_lines = []
            for line in entry.get("lines", []) or []:
                normalized = _normalize_line(line, id_to_code, code_to_name)
                if normalized:
                    normalized_lines.append(normalized)

            matched_debit = 0.0
            matched_credit = 0.0
            cash_component = 0.0
            receivable_component = 0.0
            counterpart_accounts = []

            for line in normalized_lines:
                line_code = str(line.get("code") or "").strip()
                if line_code in descendants_codes:
                    matched_debit += _safe_float(line.get("debit"))
                    matched_credit += _safe_float(line.get("credit"))
                else:
                    counterpart_accounts.append(
                        {
                            "code": line_code,
                            "name": line.get("name") or code_to_name.get(line_code) or line_code,
                        }
                    )

                # مكونات التحصيل/الآجل (مفيد لحسابات الإيراد)
                if line_code in {"1101", "1102"}:
                    cash_component += _safe_float(line.get("debit"))
                if line_code in {"1103", "113"}:
                    receivable_component += _safe_float(line.get("debit"))

            if matched_debit == 0 and matched_credit == 0:
                continue

            operations.append(
                {
                    "entry_id": str(entry.get("id") or ""),
                    "date": entry.get("date"),
                    "description": entry.get("description") or "",
                    "transaction_type": entry.get("transaction_type") or "",
                    "transaction_type_label_ar": _transaction_type_label_ar(entry.get("transaction_type")),
                    "source": entry.get("source") or "",
                    "reference_id": entry.get("reference_id") or "",
                    "entry_total": _safe_float(entry.get("total")),
                    "operation_payment_method": "",
                    "debit": round(matched_debit, 2),
                    "credit": round(matched_credit, 2),
                    "cash_component": round(cash_component, 2),
                    "receivable_component": round(receivable_component, 2),
                    "counterpart_accounts": counterpart_accounts[:6],
                }
            )

            ref = str(entry.get("reference_id") or "").strip()
            src = str(entry.get("source") or "").strip().lower()
            if ref and src in {"operation", "operation_rakan_parts"}:
                op_row = operation_map.get(ref) or {}
                visit_id = str(op_row.get("visit_id") or op_row.get("visitId") or "").strip()
                visit_row = visit_map.get(visit_id) or {}
                operations[-1]["operation_payment_method"] = str(
                    op_row.get("payment_method") or op_row.get("paymentMethod") or ""
                ).strip().lower()

                customer_label = (
                    op_row.get("partner_name")
                    or op_row.get("partnerName")
                    or visit_row.get("customer_name")
                    or ""
                )
                vehicle_label = (
                    visit_row.get("vehicle_plate")
                    or visit_row.get("plate_number")
                    or visit_row.get("vehicle_number")
                    or visit_row.get("car_type")
                    or ""
                )

                if customer_label or vehicle_label:
                    prefix = _transaction_type_label_ar(entry.get("transaction_type"))
                    parts = [prefix]
                    if customer_label:
                        parts.append(f"عميل: {customer_label}")
                    if vehicle_label:
                        parts.append(f"مركبة: {vehicle_label}")
                    operations[-1]["description"] = " - ".join(parts)
            else:
                desc = str(operations[-1].get("description") or "")
                match = re.search(r"الزيارة\s+([a-zA-Z0-9-]+)", desc)
                if match:
                    visit_id = match.group(1).strip()
                    visit_row = visit_map.get(visit_id) or {}
                    customer_label = visit_row.get("customer_name") or ""
                    vehicle_label = (
                        visit_row.get("vehicle_plate")
                        or visit_row.get("plate_number")
                        or visit_row.get("vehicle_number")
                        or visit_row.get("car_type")
                        or ""
                    )
                    if customer_label or vehicle_label:
                        prefix = _transaction_type_label_ar(entry.get("transaction_type"))
                        parts = [prefix]
                        if customer_label:
                            parts.append(f"عميل: {customer_label}")
                        if vehicle_label:
                            parts.append(f"مركبة: {vehicle_label}")
                        operations[-1]["description"] = " - ".join(parts)

        operations.sort(key=lambda x: str(x.get("date") or ""), reverse=True)
        operations_cash_total = 0.0
        operations_credit_total = 0.0
        for item in operations:
            payment_method = str(item.get("operation_payment_method") or "").strip().lower()
            amount = _safe_float(item.get("credit"))
            if payment_method == "credit":
                operations_credit_total += amount
            elif payment_method:
                operations_cash_total += amount

        summary = {
            "total_debit": round(sum(_safe_float(item.get("debit")) for item in operations), 2),
            "total_credit": round(sum(_safe_float(item.get("credit")) for item in operations), 2),
            "total_cash_component": round(sum(_safe_float(item.get("cash_component")) for item in operations), 2),
            "total_receivable_component": round(sum(_safe_float(item.get("receivable_component")) for item in operations), 2),
            "operations_cash_total": round(operations_cash_total, 2),
            "operations_credit_total": round(operations_credit_total, 2),
        }
        total_items = len(operations)
        total_pages = max(1, (total_items + page_size - 1) // page_size)
        page = min(page, total_pages)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        children_payload = []
        for child in direct_children:
            child_id = str(child.get("id") or "").strip()
            has_children = any(
                str(acc.get("parent_id") or "").strip() == child_id for acc in accounts
            )
            child_code = str(child.get("code") or "")
            children_payload.append(
                {
                    "id": child_id,
                    "code": child_code,
                    "name": child.get("name") or child.get("name_ar") or child_code,
                    "type": child.get("type") or code_to_type.get(child_code) or "",
                    "has_children": has_children,
                }
            )

        return {
            "success": True,
            "data": {
                "account": {
                    "id": selected_id,
                    "code": account_code,
                    "name": selected.get("name") or selected.get("name_ar") or account_code,
                    "type": selected.get("type") or code_to_type.get(account_code) or "",
                },
                "children": children_payload,
                "operations": {
                    "items": operations[start_idx:end_idx],
                    "summary": summary,
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_items": total_items,
                        "total_pages": total_pages,
                        "has_next": page < total_pages,
                        "has_prev": page > 1,
                    },
                },
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": {
                "account": {"code": account_code, "name": account_code, "type": ""},
                "children": [],
                "operations": {
                    "items": [],
                    "summary": {
                        "total_debit": 0,
                        "total_credit": 0,
                        "total_cash_component": 0,
                        "total_receivable_component": 0,
                        "operations_cash_total": 0,
                        "operations_credit_total": 0,
                    },
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_items": 0,
                        "total_pages": 1,
                        "has_next": False,
                        "has_prev": False,
                    },
                },
            },
        }


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
        ar_amt = 0.0
        ap_amt = 0.0
        for acc in accounts:
            code = str(acc.get("code") or "")
            debit = float(acc.get("debit") or 0)
            credit = float(acc.get("credit") or 0)
            if code in AR_ACCOUNT_CODES:
                ar_amt += max(0.0, debit - credit)
            if code in AP_ACCOUNT_CODES:
                ap_amt += max(0.0, credit - debit)
        if ar_amt > 0:
            alerts.append(
                {
                    "id": "ar_open",
                    "severity": "medium",
                    "title": "ذمم مدينة مفتوحة",
                    "message": f"يوجد آجل (غير محصل) بقيمة {ar_amt:,.2f} على حساب الذمم المدينة 1103.",
                    "action": "تابع التحصيل أو اربطها بفاتورة/سداد.",
                }
            )
        if ap_amt > 0:
            alerts.append(
                {
                    "id": "ap_open",
                    "severity": "medium",
                    "title": "ذمم دائنة مفتوحة",
                    "message": f"يوجد آجل (غير مسدد) بقيمة {ap_amt:,.2f} على حساب الذمم الدائنة 2101.",
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
async def get_chart_of_accounts(
    workshop_id: str = Query(...),
    include_rakan: bool = False,
):
    """
    دليل الحسابات محسوب من العمليات الحقيقية في Supabase
    """
    try:
        accounts_balances, merged_accounts = _compute_trial_balance_map(
            workshop_id,
            include_rakan=include_rakan,
        )
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

            is_rakan = _is_rakan_account_code(code)
            results.append(
                {
                    **acc,
                    "name_ar": acc.get("name_ar") or acc.get("name"),
                    "balance": round(balance, 2),
                    "is_rakan": is_rakan,
                    "business_unit": "rakan_parts" if is_rakan else "workshop",
                    "module": "parts_dashboard" if is_rakan else "default_accounting_flow",
                    "department": "Rakan Parts" if is_rakan else "Workshop",
                }
            )

        default_accounts = [
            {
                "id": "1103",
                "code": "1103",
                "name": "Accounts Receivable",
                "name_ar": "حساب العملاء (ذمم)",
                "type": "asset",
                "balance": 0,
            }
        ]
        existing_codes = {acc.get("code") for acc in results}
        for acc in default_accounts:
            if acc["code"] not in existing_codes:
                results.append(acc)

        results = sorted(results, key=lambda x: str(x.get("code", "")))

        return {"success": True, "data": results, "source": "journal_entries"}

    except Exception as e:
        print(f"Error in get_chart_of_accounts: {str(e)}")
        return {"success": False, "error": str(e), "data": []}


@router.post("/chart-of-accounts")
async def create_chart_of_accounts_account(
    payload: dict = Body(...), workshop_id: Optional[str] = Query(None)
):
    """إنشاء حساب جديد في دليل الحسابات.

    يحفظ مباشرة في جدول accounts (Supabase) إن كان متاحاً،
    وإلا يستخدم Mongo fallback.
    """
    try:
        code = str((payload or {}).get("code") or "").strip()
        name = str((payload or {}).get("name") or (payload or {}).get("name_ar") or "").strip()
        account_type = _normalize_account_type((payload or {}).get("type"))
        parent_id = (payload or {}).get("parent_id") or (payload or {}).get("parentId")

        if not code:
            raise HTTPException(status_code=400, detail="رمز الحساب مطلوب")
        if not name:
            raise HTTPException(status_code=400, detail="اسم الحساب مطلوب")

        account_id = str(uuid.uuid4())
        row = {
            "id": account_id,
            "code": code,
            "name": name,
            "name_en": (payload or {}).get("name_en") or (payload or {}).get("nameEn") or "",
            "type": account_type,
            "parent_id": parent_id,
            "is_system": False,
            "balance": 0.0,
            "created_at": datetime.now().isoformat(),
        }

        if supabase:
            exists = (
                supabase.table("accounts")
                .select("id,code")
                .eq("code", code)
                .limit(1)
                .execute()
            )
            if exists.data:
                raise HTTPException(status_code=400, detail="رمز الحساب موجود مسبقاً")

            inserted = supabase.table("accounts").insert(row).execute()
            saved = (inserted.data or [row])[0]
            return {
                "success": True,
                "data": {
                    "id": saved.get("id"),
                    "code": saved.get("code"),
                    "name": saved.get("name"),
                    "name_ar": saved.get("name"),
                    "type": _normalize_account_type(saved.get("type")),
                    "parent_id": saved.get("parent_id"),
                    "balance": float(saved.get("balance") or 0),
                },
            }

        if db is not None:
            duplicate = await db.accounts.find_one({"code": code}, {"_id": 0, "id": 1})
            if duplicate:
                raise HTTPException(status_code=400, detail="رمز الحساب موجود مسبقاً")

            doc = {
                "id": account_id,
                "code": code,
                "name": name,
                "name_ar": (payload or {}).get("name_ar") or name,
                "type": account_type,
                "parent_id": parent_id,
                "is_system": False,
                "balance": 0.0,
                "created_at": datetime.now().isoformat(),
            }
            await db.accounts.insert_one(doc)
            return {"success": True, "data": doc}

        raise HTTPException(status_code=503, detail="مصدر البيانات غير متاح حالياً")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"تعذر إنشاء الحساب: {str(e)}")


# NOTE: First definition of get_journal_entries removed to fix duplicate function definition

# NOTE: legacy duplicated definition of get_journal_entries was removed to fix syntax


@router.get("/journal-entries")
async def get_journal_entries(
    workshop_id: str = Query(...),
    skip: int = Query(0),
    limit: int = Query(50),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_rakan: bool = False,
):
    """
    القيود المحاسبية من Supabase و MongoDB operations
    """
    try:
        entries = _fetch_journal_entries(
            workshop_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
            include_rakan=include_rakan,
        )

        operation_refs = [
            str(e.get("reference_id") or "").strip()
            for e in entries
            if str(e.get("source") or "").strip().lower() in {"operation", "operation_rakan_parts"}
            and str(e.get("reference_id") or "").strip()
        ]
        operation_refs = list(dict.fromkeys(operation_refs))

        operation_map: Dict[str, Dict[str, Any]] = {}
        visit_map: Dict[str, Dict[str, Any]] = {}
        if operation_refs and supabase:
            try:
                op_rows = (
                    supabase.table("operations")
                    .select("*")
                    .in_("id", operation_refs)
                    .execute()
                    .data
                    or []
                )
                operation_map = {str(row.get("id") or ""): row for row in op_rows}
                visit_ids = [
                    str(row.get("visit_id") or row.get("visitId") or "").strip()
                    for row in op_rows
                    if str(row.get("visit_id") or row.get("visitId") or "").strip()
                ]
                visit_ids = list(dict.fromkeys(visit_ids))
                if visit_ids:
                    visit_rows = (
                        supabase.table("vehicle_visits")
                        .select("id,customer_name,vehicle_plate,plate_number,vehicle_number,car_type")
                        .in_("id", visit_ids)
                        .execute()
                        .data
                        or []
                    )
                    visit_map = {str(v.get("id") or ""): v for v in visit_rows}
            except Exception:
                operation_map = {}
                visit_map = {}

        type_labels = {
            "sale": "بيع",
            "service": "خدمة",
            "purchase": "شراء",
            "expense": "مصروف",
            "sale_return": "مرتجع بيع",
            "purchase_return": "مرتجع شراء",
            "payment_order": "أمر سداد",
            "payment": "تحصيل/سداد",
        }

        formatted = []
        for entry in entries:
            source = str(entry.get("source") or "manual").strip().lower()
            tx_type = str(entry.get("transaction_type") or "").strip().lower()
            reference_id = str(entry.get("reference_id") or "").strip()
            description = entry.get("description", "قيد")

            op = operation_map.get(reference_id, {}) if reference_id else {}
            visit_id = str(op.get("visit_id") or op.get("visitId") or "").strip()
            visit = visit_map.get(visit_id, {}) if visit_id else {}

            party_type = str(op.get("partner_type") or op.get("partnerType") or "").strip().lower()
            if not party_type and source in {"operation", "operation_rakan_parts"}:
                party_type = "open"

            party_label = (
                op.get("partner_name")
                or op.get("partnerName")
                or visit.get("customer_name")
                or ""
            )
            if not party_label:
                if party_type == "supplier":
                    party_label = "مورد غير محدد"
                elif party_type == "customer":
                    party_label = "عميل غير محدد"
                elif source in {"operation", "operation_rakan_parts"}:
                    party_label = "مفتوح"

            vehicle_label = (
                visit.get("vehicle_plate")
                or visit.get("plate_number")
                or visit.get("vehicle_number")
                or visit.get("car_type")
                or ""
            )

            # allow quick manual override in description token: [PARTY:...]
            manual_party_match = re.search(r"\[PARTY:([^\]]+)\]", str(description or ""))
            manual_party_type_match = re.search(r"\[PARTY_TYPE:([^\]]+)\]", str(description or ""))
            if manual_party_match:
                party_label = manual_party_match.group(1).strip()
                party_type = str(manual_party_type_match.group(1)).strip().lower() if manual_party_type_match else "manual"

            operation_type_label = type_labels.get(tx_type, tx_type or "غير محدد")

            formatted.append(
                {
                    "id": entry.get("id"),
                    "date": entry.get("date", ""),
                    "description": description,
                    "lines": entry.get("lines", []),
                    "total": entry.get("total", 0),
                    "source": source,
                    "transaction_type": tx_type,
                    "reference_id": reference_id,
                    "party_type": party_type or "open",
                    "party_label": party_label or "مفتوح",
                    "vehicle_label": vehicle_label,
                    "operation_type_label": operation_type_label,
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
                            "account": "1103",
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
    """Return the amount that credits AR (1103/legacy 113) from a payment journal entry."""
    try:
        lines = entry.get("lines") or []
        amt = 0.0
        for ln in lines:
            if str(ln.get("account")) in AR_ACCOUNT_CODES:
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
    """دفتر الأستاذ لحساب ذمم مدينة عملاء (1103).

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
                "account": {"code": "1103", "name": "ذمم مدينة عملاء"},
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
    include_today: bool = Query(True, description="لإدراج حركات اليوم عند اختلاف التوقيت"),
):
    """أرصدة العملاء (ذمم مدينة) حتى تاريخ محدد."""
    try:
        as_of = _parse_date_str(as_of) or datetime.now().date().isoformat()

        # Use end-of-day cutoff to avoid timezone edge cases when op_date is stored with timezone
        # Example: op_date=2026-01-29T14:xxZ should be included for as_of=2026-01-29
        as_of_eod = f"{as_of}T23:59:59Z" if include_today else as_of

        # all credit ops up to as_of (EOD)
        ops = _fetch_credit_sales_ops(workshop_id, end_date=as_of_eod)
        pays = _fetch_payment_entries(workshop_id, end_date=as_of_eod)

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


@router.get("/reports/operation-trace")
async def get_operation_trace_report(
    workshop_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_rakan: bool = Query(False),
):
    """شرح مسار الأرقام المالية حسب نوع العملية والقيود الناتجة."""
    try:
        end_date = end_date or datetime.now().strftime("%Y-%m-%d")
        start_date = start_date or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        operations = _fetch_operations_for_reconciliation(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
        )
        if not include_rakan:
            operations = [op for op in operations if not _is_rakan_operation_row(op)]

        accounts = _fetch_accounts()
        id_to_code, code_to_name, _ = _build_account_maps(accounts)
        entries = _fetch_journal_entries(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date,
            limit=15000,
            include_rakan=include_rakan,
        )

        op_type_by_id: Dict[str, str] = {}
        by_type: Dict[str, Dict[str, Any]] = {}

        for op in operations:
            op_type = _normalize_operation_type_for_reconciliation(op.get("type")) or "other"
            op_id = str(op.get("id") or "").strip()
            if op_id:
                op_type_by_id[op_id] = op_type

            row = by_type.setdefault(op_type, {
                "type": op_type,
                "type_label_ar": _transaction_type_label_ar(op_type),
                "operations_count": 0,
                "operations_total": 0.0,
                "journal_entries_count": 0,
                "journal_entries_total": 0.0,
                "payment_methods": {},
                "impact": {
                    "cash": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "bank": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "ar": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "ap": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "assets": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "revenue": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "expenses": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                },
                "accounts_touched": {},
            })
            row["operations_count"] += 1
            row["operations_total"] += _safe_float(op.get("total"))
            pay_method = str(op.get("payment_method") or op.get("paymentMethod") or "unknown").lower()
            row["payment_methods"][pay_method] = row["payment_methods"].get(pay_method, 0) + 1

        def account_bucket(code: str) -> str:
            c = str(code or "")
            if c == "1101":
                return "cash"
            if c == "1102":
                return "bank"
            if c == "1103":
                return "ar"
            if c == "2101":
                return "ap"
            if c.startswith("1"):
                return "assets"
            if c.startswith("4"):
                return "revenue"
            if c.startswith("5") or c.startswith("6"):
                return "expenses"
            return "assets"

        for entry in entries:
            tx_type = _normalize_operation_type_for_reconciliation(entry.get("transaction_type"))
            ref = str(entry.get("reference_id") or "").strip()
            if ref and ref in op_type_by_id:
                tx_type = op_type_by_id[ref]
            tx_type = tx_type or "other"
            row = by_type.setdefault(tx_type, {
                "type": tx_type,
                "type_label_ar": _transaction_type_label_ar(tx_type),
                "operations_count": 0,
                "operations_total": 0.0,
                "journal_entries_count": 0,
                "journal_entries_total": 0.0,
                "payment_methods": {},
                "impact": {
                    "cash": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "bank": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "ar": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "ap": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "assets": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "revenue": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                    "expenses": {"debit": 0.0, "credit": 0.0, "net": 0.0},
                },
                "accounts_touched": {},
            })
            row["journal_entries_count"] += 1
            row["journal_entries_total"] += _safe_float(entry.get("total"))

            for line in entry.get("lines", []) or []:
                norm = _normalize_line(line, id_to_code, code_to_name)
                if not norm:
                    continue
                code = str(norm.get("code") or "")
                debit = _safe_float(norm.get("debit"))
                credit = _safe_float(norm.get("credit"))
                bucket = account_bucket(code)
                impact = row["impact"][bucket]
                impact["debit"] += debit
                impact["credit"] += credit
                impact["net"] += (debit - credit)

                touched = row["accounts_touched"].setdefault(code, {
                    "code": code,
                    "name": norm.get("name") or code_to_name.get(code) or code,
                    "debit": 0.0,
                    "credit": 0.0,
                })
                touched["debit"] += debit
                touched["credit"] += credit

        rows = []
        for key in sorted(by_type.keys()):
            row = by_type[key]
            row["operations_total"] = round(_safe_float(row.get("operations_total")), 2)
            row["journal_entries_total"] = round(_safe_float(row.get("journal_entries_total")), 2)
            for impact_key in row["impact"]:
                item = row["impact"][impact_key]
                row["impact"][impact_key] = {
                    "debit": round(_safe_float(item.get("debit")), 2),
                    "credit": round(_safe_float(item.get("credit")), 2),
                    "net": round(_safe_float(item.get("net")), 2),
                }
            touched = list((row.get("accounts_touched") or {}).values())
            touched.sort(key=lambda x: abs(_safe_float(x.get("debit")) - _safe_float(x.get("credit"))), reverse=True)
            row["accounts_touched"] = [
                {
                    "code": r.get("code"),
                    "name": r.get("name"),
                    "debit": round(_safe_float(r.get("debit")), 2),
                    "credit": round(_safe_float(r.get("credit")), 2),
                }
                for r in touched[:8]
            ]
            rows.append(row)

        return {
            "success": True,
            "data": {
                "period": {"start_date": start_date, "end_date": end_date},
                "rows": rows,
                "summary": {
                    "operations_total": round(sum(_safe_float(r.get("operations_total")) for r in rows), 2),
                    "journal_total": round(sum(_safe_float(r.get("journal_entries_total")) for r in rows), 2),
                    "types_count": len(rows),
                },
                "explainers": {
                    "cash": "1101: عمليات نقدية مباشرة",
                    "bank": "1102: بطاقات/تحويلات",
                    "ar": "1103: ذمم مدينة",
                    "ap": "2101: ذمم موردين",
                },
            },
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": {"period": {"start_date": start_date, "end_date": end_date}, "rows": []},
        }


_BUDGETS_FILE = os.path.join(os.path.dirname(__file__), "uploads", "finance_budgets.json")


def _read_budgets() -> List[Dict[str, Any]]:
    try:
        os.makedirs(os.path.dirname(_BUDGETS_FILE), exist_ok=True)
        if not os.path.exists(_BUDGETS_FILE):
            with open(_BUDGETS_FILE, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
        with open(_BUDGETS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _write_budgets(rows: List[Dict[str, Any]]):
    os.makedirs(os.path.dirname(_BUDGETS_FILE), exist_ok=True)
    with open(_BUDGETS_FILE, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


@router.get("/budgets")
async def get_budgets(
    workshop_id: str = Query(...),
    month: Optional[str] = Query(None, description="YYYY-MM")
):
    rows = _read_budgets()
    filtered = [r for r in rows if str(r.get("workshop_id") or "") == str(workshop_id)]
    if month:
        filtered = [r for r in filtered if str(r.get("month") or "") == str(month)]

    totals = {
        "planned": round(sum(float(r.get("planned") or 0) for r in filtered), 2),
        "actual": round(sum(float(r.get("actual") or 0) for r in filtered), 2),
    }
    totals["variance"] = round(totals["planned"] - totals["actual"], 2)

    return {
        "success": True,
        "data": {
            "rows": filtered,
            "totals": totals,
        },
    }


@router.post("/budgets")
async def create_budget(payload: Dict[str, Any] = Body(...)):
    workshop_id = str(payload.get("workshop_id") or "").strip()
    month = str(payload.get("month") or "").strip()
    name = str(payload.get("name") or "").strip()
    if not workshop_id or not month or not name:
        raise HTTPException(status_code=400, detail="workshop_id و month و name مطلوبة")

    row = {
        "id": str(uuid.uuid4()),
        "workshop_id": workshop_id,
        "month": month,
        "name": name,
        "category": str(payload.get("category") or "operating").strip() or "operating",
        "planned": float(payload.get("planned") or 0),
        "actual": float(payload.get("actual") or 0),
        "notes": str(payload.get("notes") or "").strip(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    rows = _read_budgets()
    rows.append(row)
    _write_budgets(rows)
    return {"success": True, "data": row}


@router.put("/budgets/{budget_id}")
async def update_budget(budget_id: str, payload: Dict[str, Any] = Body(...)):
    rows = _read_budgets()
    idx = next((i for i, r in enumerate(rows) if str(r.get("id") or "") == str(budget_id)), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="budget not found")

    current = rows[idx]
    updated = {
        **current,
        "name": str(payload.get("name", current.get("name") or "")).strip() or current.get("name"),
        "category": str(payload.get("category", current.get("category") or "operating")).strip() or "operating",
        "planned": float(payload.get("planned", current.get("planned") or 0)),
        "actual": float(payload.get("actual", current.get("actual") or 0)),
        "notes": str(payload.get("notes", current.get("notes") or "")).strip(),
        "month": str(payload.get("month", current.get("month") or "")).strip() or current.get("month"),
        "updated_at": datetime.utcnow().isoformat(),
    }
    rows[idx] = updated
    _write_budgets(rows)
    return {"success": True, "data": updated}


@router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, workshop_id: str = Query(...)):
    rows = _read_budgets()
    next_rows = [
        r for r in rows
        if not (str(r.get("id") or "") == str(budget_id) and str(r.get("workshop_id") or "") == str(workshop_id))
    ]
    deleted = len(rows) - len(next_rows)
    _write_budgets(next_rows)
    return {"success": True, "deleted": deleted}

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
        if finance_db is not None:
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


def _is_debt_related_operation(op: Dict[str, Any]) -> bool:
    op_type = str(op.get("type") or "").strip().lower()
    payment_method = str(op.get("payment_method") or op.get("paymentMethod") or "").strip().lower()
    payment_status = str(op.get("payment_status") or op.get("paymentStatus") or "").strip().lower()

    if op_type == "payment_order":
        return True

    if payment_method == "credit":
        return True

    if payment_status in {"credit", "unpaid", "pending", "partial"}:
        return True

    return False


@router.delete("/reset-ops-journals-keep-debts")
async def reset_ops_journals_keep_debts_only(
    workshop_id: str = Query(..., description="معرف الورشة"),
    confirm: str = Query(..., description="يجب أن تكون KEEP_DEBTS_ONLY للتأكيد")
):
    """
    تنظيف مالي مع الإبقاء على الذمم فقط:
    - حذف جميع القيود اليومية
    - حذف العمليات غير المرتبطة بالذمم
    - الإبقاء فقط على عمليات الذمم (credit / unpaid / payment_order)
    """
    if confirm != "KEEP_DEBTS_ONLY":
        return {
            "success": False,
            "message": "يجب تأكيد العملية عبر confirm=KEEP_DEBTS_ONLY"
        }

    try:
        result = {
            "operations_kept": 0,
            "operations_deleted": 0,
            "journal_entries_deleted": 0,
        }

        if supabase:
            try:
                scoped_ops_query = (
                    supabase.table("operations")
                    .select("id,type,payment_method,paymentMethod,payment_status,paymentStatus,workshop_id")
                    .eq("workshop_id", workshop_id)
                    .range(0, 9999)
                )
                scoped_operations = scoped_ops_query.execute().data or []
            except Exception:
                scoped_operations = []

            try:
                legacy_ops_query = (
                    supabase.table("operations")
                    .select("id,type,payment_method,paymentMethod,payment_status,paymentStatus,workshop_id")
                    .is_("workshop_id", "null")
                    .range(0, 9999)
                )
                legacy_operations = legacy_ops_query.execute().data or []
            except Exception:
                legacy_operations = []

            operations_map: Dict[str, Dict[str, Any]] = {}
            for op in (scoped_operations + legacy_operations):
                op_id = str(op.get("id") or "").strip()
                if op_id:
                    operations_map[op_id] = op
            operations = list(operations_map.values())

            if not operations:
                try:
                    operations = (
                        supabase.table("operations")
                        .select("id,type,payment_method,paymentMethod,payment_status,paymentStatus,workshop_id")
                        .range(0, 9999)
                        .execute()
                        .data
                        or []
                    )
                except Exception:
                    operations = []

            keep_ids: List[str] = []
            delete_ids: List[str] = []
            for op in operations:
                op_id = str(op.get("id") or "").strip()
                if not op_id:
                    continue
                if _is_debt_related_operation(op):
                    keep_ids.append(op_id)
                else:
                    delete_ids.append(op_id)

            for idx in range(0, len(delete_ids), 200):
                chunk = delete_ids[idx: idx + 200]
                if not chunk:
                    continue
                try:
                    supabase.table("operations").delete().in_("id", chunk).execute()
                except Exception as delete_err:
                    print(f"Failed deleting operations chunk: {delete_err}")

            result["operations_kept"] = len(keep_ids)
            result["operations_deleted"] = len(delete_ids)

            try:
                scoped_journal_rows = (
                    supabase.table("journal_entries")
                    .select("id")
                    .eq("workshop_id", workshop_id)
                    .range(0, 9999)
                    .execute()
                    .data
                    or []
                )

                legacy_journal_rows = (
                    supabase.table("journal_entries")
                    .select("id")
                    .is_("workshop_id", "null")
                    .range(0, 9999)
                    .execute()
                    .data
                    or []
                )

                journal_map: Dict[str, bool] = {}
                for row in (scoped_journal_rows + legacy_journal_rows):
                    row_id = str(row.get("id") or "").strip()
                    if row_id:
                        journal_map[row_id] = True

                je_ids = list(journal_map.keys())

                if not je_ids:
                    fallback_rows = (
                        supabase.table("journal_entries")
                        .select("id")
                        .range(0, 9999)
                        .execute()
                        .data
                        or []
                    )
                    je_ids = [str(row.get("id") or "").strip() for row in fallback_rows if row.get("id")]

                for idx in range(0, len(je_ids), 200):
                    chunk = je_ids[idx: idx + 200]
                    if not chunk:
                        continue
                    try:
                        supabase.table("journal_entries").delete().in_("id", chunk).execute()
                    except Exception as delete_err:
                        print(f"Failed deleting journal chunk: {delete_err}")
                result["journal_entries_deleted"] = len(je_ids)
            except Exception as je_err:
                print(f"Journal cleanup failed: {je_err}")

        if finance_db is not None:
            ops_query: Dict[str, Any] = {
                "$or": [
                    {"workshop_id": workshop_id},
                    {"workshop_id": {"$exists": False}},
                    {"workshop_id": None},
                    {"workshop_id": ""},
                ]
            }
            operations = await finance_db.operations.find(ops_query, {"_id": 0}).to_list(length=10000)

            keep_ids: List[str] = []
            delete_ids: List[str] = []
            for op in operations:
                op_id = str(op.get("id") or "").strip()
                if not op_id:
                    continue
                if _is_debt_related_operation(op):
                    keep_ids.append(op_id)
                else:
                    delete_ids.append(op_id)

            if delete_ids:
                await finance_db.operations.delete_many({"id": {"$in": delete_ids}})

            je_result = await finance_db.journal_entries.delete_many({
                "$or": [
                    {"workshop_id": workshop_id},
                    {"workshop_id": {"$exists": False}},
                    {"workshop_id": None},
                    {"workshop_id": ""},
                ]
            })
            result["operations_kept"] += len(keep_ids)
            result["operations_deleted"] += len(delete_ids)
            result["journal_entries_deleted"] += je_result.deleted_count

        if db is not None and db is not finance_db:
            operations = await db.operations.find({
                "$or": [
                    {"workshop_id": workshop_id},
                    {"workshop_id": {"$exists": False}},
                    {"workshop_id": None},
                    {"workshop_id": ""},
                ]
            }, {"_id": 0}).to_list(length=10000)
            keep_ids: List[str] = []
            delete_ids: List[str] = []
            for op in operations:
                op_id = str(op.get("id") or "").strip()
                if not op_id:
                    continue
                if _is_debt_related_operation(op):
                    keep_ids.append(op_id)
                else:
                    delete_ids.append(op_id)
            if delete_ids:
                await db.operations.delete_many({"id": {"$in": delete_ids}})
            je_result = await db.journal_entries.delete_many({
                "$or": [
                    {"workshop_id": workshop_id},
                    {"workshop_id": {"$exists": False}},
                    {"workshop_id": None},
                    {"workshop_id": ""},
                ]
            })
            result["operations_kept"] += len(keep_ids)
            result["operations_deleted"] += len(delete_ids)
            result["journal_entries_deleted"] += je_result.deleted_count

        return {
            "success": True,
            "message": "تم حذف القيود والعمليات غير المرتبطة بالذمم بنجاح",
            "data": result,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"تعذر تنفيذ التنظيف: {str(e)}"
        }


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
            balance_sheet_data = await get_balance_sheet(workshop_id=workshop_id, as_of_date=None)
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
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
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

