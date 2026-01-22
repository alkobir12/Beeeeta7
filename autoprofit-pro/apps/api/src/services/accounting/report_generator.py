from datetime import date, datetime
from typing import Any, Dict, List
import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ...models import Account, AccountType, Transaction


class ReportGenerator:
    """مولد التقارير المالية المعتمد على جدول الحسابات والمعاملات.

    NOTE:
    - يعتمد حاليًا على نموذج Account / Transaction الموجود في models.py
    - يمكن لاحقًا ربطه بالكامل بـ JournalEntry / JournalEntryLine إذا تم توحيد المخطط.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    #  الميزانية العمومية Balance Sheet
    # ------------------------------------------------------------------
    def generate_balance_sheet(self, workshop_id: uuid.UUID, as_of_date: date | None = None) -> Dict[str, Any]:
        """توليد ميزانية عمومية مبسطة بناءً على أرصدة الحسابات الحالية.

        يستخدم حقل balance في جدول الحسابات.
        """
        if as_of_date is None:
            as_of_date = datetime.utcnow().date()

        accounts = (
            self.db.query(Account)
            .filter(Account.workshop_id == workshop_id, Account.is_active == True)
            .order_by(Account.account_code.asc())
            .all()
        )

        assets: List[Dict[str, Any]] = []
        liabilities: List[Dict[str, Any]] = []
        equity: List[Dict[str, Any]] = []

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
            "as_of": as_of_date.isoformat(),
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

    # ------------------------------------------------------------------
    #  قائمة الدخل Income Statement
    # ------------------------------------------------------------------
    def generate_income_statement(
        self,
        workshop_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        """توليد قائمة دخل مبسطة لفترة زمنية.

        تعتمد على جدول المعاملات Transaction ونوع الحساب المدين/الدائن.
        """
        txns = (
            self.db.query(Transaction)
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

        revenue_by_account: Dict[str, float] = {}
        expense_by_account: Dict[str, float] = {}

        for txn in txns:
            # الإيرادات من الحساب الدائن إذا كان من نوع REVENUE
            if txn.credit_account and txn.credit_account.account_type == AccountType.REVENUE:
                code = txn.credit_account.account_code
                revenue_by_account[code] = revenue_by_account.get(code, 0.0) + txn.amount
                total_revenue += txn.amount

            # المصروفات من الحساب المدين إذا كان من نوع EXPENSE
            if txn.debit_account and txn.debit_account.account_type == AccountType.EXPENSE:
                code = txn.debit_account.account_code
                expense_by_account[code] = expense_by_account.get(code, 0.0) + txn.amount
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
                "revenue_by_account": revenue_by_account,
                "expenses_by_account": expense_by_account,
            },
        }

    # ------------------------------------------------------------------
    #  التدفقات النقدية Cash Flow (نسخة مبسطة جدًا)
    # ------------------------------------------------------------------
    def generate_cash_flow(
        self,
        workshop_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        """توليد قائمة تدفقات نقدية مبسطة.

        حاليًا تحسب صافي التدفق النقدي تقريبًا من المعاملات النقدية.
        يمكن تطويرها لاحقًا لتستخدم تصنيف أدق.
        """
        txns = (
            self.db.query(Transaction)
            .filter(
                Transaction.workshop_id == workshop_id,
                Transaction.date >= datetime.combine(start_date, datetime.min.time()),
                Transaction.date <= datetime.combine(end_date, datetime.max.time()),
                Transaction.status == "completed",
            )
            .all()
        )

        operating_cash = 0.0

        for txn in txns:
            # تقريب بسيط: نعتبر كل المعاملات تدفقات تشغيلية حسب نوع الحسابات
            if txn.credit_account and txn.credit_account.account_type == AccountType.REVENUE:
                operating_cash += txn.amount
            if txn.debit_account and txn.debit_account.account_type == AccountType.EXPENSE:
                operating_cash -= txn.amount

        net_cash_flow = operating_cash

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "operating_activities": {
                "net_cash_flow": operating_cash,
            },
            "investing_activities": {
                "net_cash_flow": 0.0,
            },
            "financing_activities": {
                "net_cash_flow": 0.0,
            },
            "cash_summary": {
                "net_cash_flow": net_cash_flow,
            },
        }

    # ------------------------------------------------------------------
    #  رصيد حساب حتى تاريخ / لفترة (للاستخدام في الرصيد التجريبي ودفتر الأستاذ)
    # ------------------------------------------------------------------
    def _calculate_account_balance(self, account: Account, as_of_date: date) -> float:
        """حساب رصيد حساب حتى تاريخ معين من جدول المعاملات."""
        # مجموع المدين
        debit_sum = (
            self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(
                Transaction.workshop_id == account.workshop_id,
                Transaction.date <= datetime.combine(as_of_date, datetime.max.time()),
                Transaction.debit_account_id == account.id,
                Transaction.status == "completed",
            )
            .scalar()
        )

        # مجموع الدائن
        credit_sum = (
            self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(
                Transaction.workshop_id == account.workshop_id,
                Transaction.date <= datetime.combine(as_of_date, datetime.max.time()),
                Transaction.credit_account_id == account.id,
                Transaction.status == "completed",
            )
            .scalar()
        )

        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return float(debit_sum - credit_sum)
        else:
            return float(credit_sum - debit_sum)

    def _calculate_account_period_balance(
        self,
        account: Account,
        start_date: date,
        end_date: date,
    ) -> float:
        """حساب حركة حساب لفترة محددة من جدول المعاملات."""
        debit_sum = (
            self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(
                Transaction.workshop_id == account.workshop_id,
                Transaction.date >= datetime.combine(start_date, datetime.min.time()),
                Transaction.date <= datetime.combine(end_date, datetime.max.time()),
                Transaction.debit_account_id == account.id,
                Transaction.status == "completed",
            )
            .scalar()
        )

        credit_sum = (
            self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(
                Transaction.workshop_id == account.workshop_id,
                Transaction.date >= datetime.combine(start_date, datetime.min.time()),
                Transaction.date <= datetime.combine(end_date, datetime.max.time()),
                Transaction.credit_account_id == account.id,
                Transaction.status == "completed",
            )
            .scalar()
        )

        if account.account_type in [AccountType.ASSET, AccountType.EXPENSE]:
            return float(debit_sum - credit_sum)
        else:
            return float(credit_sum - debit_sum)

    # ------------------------------------------------------------------
    #  صافي الدخل Net Income حتى تاريخ معين (للاستخدام في الميزانية)
    # ------------------------------------------------------------------
    def calculate_net_income_until(self, workshop_id: uuid.UUID, as_of_date: date) -> float:
        """حساب صافي الدخل حتى تاريخ معين (إيرادات - مصروفات)."""
        accounts = (
            self.db.query(Account)
            .filter(Account.workshop_id == workshop_id, Account.is_active == True)
            .all()
        )

        total_revenue = 0.0
        total_expenses = 0.0

        for acc in accounts:
            if acc.account_type == AccountType.REVENUE:
                total_revenue += self._calculate_account_balance(acc, as_of_date)
            elif acc.account_type == AccountType.EXPENSE:
                total_expenses += self._calculate_account_balance(acc, as_of_date)

        return total_revenue - total_expenses

    # ------------------------------------------------------------------
    #  الرصيد التجريبي Trial Balance
    # ------------------------------------------------------------------
    def generate_trial_balance(self, workshop_id: uuid.UUID, as_of_date: date) -> Dict[str, Any]:
        accounts = (
            self.db.query(Account)
            .filter(Account.workshop_id == workshop_id, Account.is_active == True)
            .order_by(Account.account_code.asc())
            .all()
        )

        rows: List[Dict[str, Any]] = []
        total_debit = 0.0
        total_credit = 0.0

        for acc in accounts:
            balance = self._calculate_account_balance(acc, as_of_date)
            if balance == 0:
                continue

            row = {
                "code": acc.account_code,
                "name": acc.account_name,
                "account_type": acc.account_type.value,
                "debit": balance if balance > 0 else 0.0,
                "credit": abs(balance) if balance < 0 else 0.0,
            }
            rows.append(row)
            total_debit += row["debit"]
            total_credit += row["credit"]

        return {
            "as_of": as_of_date.isoformat(),
            "accounts": rows,
            "totals": {
                "total_debit": total_debit,
                "total_credit": total_credit,
                "is_balanced": abs(total_debit - total_credit) < 0.01,
            },
        }

    # ------------------------------------------------------------------
    #  دفتر الأستاذ العام General Ledger (مبسط)
    # ------------------------------------------------------------------
    def generate_general_ledger(
        self,
        workshop_id: uuid.UUID,
        account_code_prefix: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 500,
    ) -> Dict[str, Any]:
        """توليد دفتر الأستاذ العام بالاعتماد على جدول المعاملات."""
        q = (
            self.db.query(Transaction)
            .join(Account, or_(
                Transaction.debit_account_id == Account.id,
                Transaction.credit_account_id == Account.id,
            ))
            .filter(Transaction.workshop_id == workshop_id)
        )

        if account_code_prefix:
            q = q.filter(Account.account_code.like(f"{account_code_prefix}%"))

        if start_date:
            q = q.filter(Transaction.date >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            q = q.filter(Transaction.date <= datetime.combine(end_date, datetime.max.time()))

        txns = q.order_by(Transaction.date.desc()).limit(limit).all()

        entries: List[Dict[str, Any]] = []

        for txn in txns:
            # لكل معاملة، نولّد سطرين محتملين (مدين/دائن)
            if txn.debit_account:
                bal = self._calculate_account_balance(txn.debit_account, txn.date.date())
                entries.append({
                    "date": txn.date.isoformat(),
                    "transaction_number": txn.transaction_number,
                    "account_code": txn.debit_account.account_code,
                    "account_name": txn.debit_account.account_name,
                    "description": txn.description,
                    "debit": txn.amount,
                    "credit": 0.0,
                    "balance": bal,
                })

            if txn.credit_account:
                bal = self._calculate_account_balance(txn.credit_account, txn.date.date())
                entries.append({
                    "date": txn.date.isoformat(),
                    "transaction_number": txn.transaction_number,
                    "account_code": txn.credit_account.account_code,
                    "account_name": txn.credit_account.account_name,
                    "description": txn.description,
                    "debit": 0.0,
                    "credit": txn.amount,
                    "balance": bal,
                })

        return {
            "entries": entries,
            "total_count": len(entries),
        }
