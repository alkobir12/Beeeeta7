from datetime import date, datetime
from typing import Dict, Any
import uuid

from sqlalchemy.orm import Session

from ...models import Account, AccountType, Transaction


def generate_balance_sheet(db: Session, workshop_id: uuid.UUID, as_of: date | None = None) -> Dict[str, Any]:
    """توليد ميزانية عمومية مبسطة.

    حاليًا تستخدم الرصيد الحالي المخزن في جدول الحسابات (balance).
    يمكن لاحقًا تقييدها بالتاريخ باستخدام الحركات.
    """
    accounts = (
        db.query(Account)
        .filter(Account.workshop_id == workshop_id, Account.is_active == True)
        .order_by(Account.account_code.asc())
        .all()
    )

    assets = []
    liabilities = []
    equity = []

    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0

    for acc in accounts:
        row = {
            "id": str(acc.id),
            "code": acc.account_code,
            "name": acc.account_name,
            "balance": acc.balance,
        }
        if acc.account_type == AccountType.ASSET:
            assets.append(row)
            total_assets += acc.balance
        elif acc.account_type == AccountType.LIABILITY:
            liabilities.append(row)
            total_liabilities += acc.balance
        elif acc.account_type == AccountType.EQUITY:
            equity.append(row)
            total_equity += acc.balance

    return {
        "as_of": (as_of or datetime.utcnow().date()).isoformat(),
        "totals": {
            "assets": total_assets,
            "liabilities": total_liabilities,
            "equity": total_equity,
            "liabilities_plus_equity": total_liabilities + total_equity,
        },
        "sections": {
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
        },
    }


def generate_income_statement(
    db: Session,
    workshop_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> Dict[str, Any]:
    """توليد قائمة دخل مبسطة لفترة زمنية.

    تعتمد على جدول المعاملات (transactions) ونوع الحساب المرتبط.
    """
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.workshop_id == workshop_id,
            Transaction.date >= datetime.combine(start_date, datetime.min.time()),
            Transaction.date <= datetime.combine(end_date, datetime.max.time()),
            Transaction.status == "completed",
        )
        .all()
    )

    total_revenue = 0.0
    total_expenses = 0.0

    revenue_breakdown: Dict[str, float] = {}
    expense_breakdown: Dict[str, float] = {}

    for txn in txns:
        # حساب الإيرادات من الحساب الدائن إذا كان من نوع REVENUE
        if txn.credit_account and txn.credit_account.account_type == AccountType.REVENUE:
            code = txn.credit_account.account_code
            revenue_breakdown[code] = revenue_breakdown.get(code, 0.0) + txn.amount
            total_revenue += txn.amount

        # حساب المصروفات من الحساب المدين إذا كان من نوع EXPENSE
        if txn.debit_account and txn.debit_account.account_type == AccountType.EXPENSE:
            code = txn.debit_account.account_code
            expense_breakdown[code] = expense_breakdown.get(code, 0.0) + txn.amount
            total_expenses += txn.amount

    net_income = total_revenue - total_expenses

    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "totals": {
            "revenue": total_revenue,
            "expenses": total_expenses,
            "net_income": net_income,
        },
        "details": {
            "revenue_by_account": revenue_breakdown,
            "expenses_by_account": expense_breakdown,
        },
    }
