from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from ...models.accounting.journal_entries import JournalEntry, JournalEntryLine
from ...models.accounting.chart_of_accounts import Account
from ...schemas.accounting.journal_entries import JournalEntryCreate


class AccountingService:
    """الخدمة الأساسية للمعاملات المحاسبية (القيود اليومية وتحديث الأرصدة)."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_journal_entry(self, entry_data: JournalEntryCreate, workshop_id: uuid.UUID) -> JournalEntry:
        """إنشاء قيد يومي جديد في حالة مسودة (draft).

        يتحقق من توازن المدين والدائن، وينشئ سطور القيد.
        """

        total_debit = sum(line.debit_amount for line in entry_data.lines)
        total_credit = sum(line.credit_amount for line in entry_data.lines)

        # السماح بهامش خطأ بسيط للفواصل العشرية
        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(f"القيد غير متوازن. المدين: {total_debit}, الدائن: {total_credit}")

        entry_number = self._generate_entry_number(workshop_id)

        journal_entry = JournalEntry(
            entry_number=entry_number,
            entry_date=entry_data.entry_date or datetime.utcnow(),
            description=entry_data.description,
            reference=entry_data.reference,
            total_debit=total_debit,
            total_credit=total_credit,
            workshop_id=workshop_id,
            status="draft",
        )

        self.db.add(journal_entry)
        self.db.flush()  # للحصول على ID قبل إنشاء السطور

        for line_data in entry_data.lines:
            line = JournalEntryLine(
                journal_entry_id=journal_entry.id,
                account_id=line_data.account_id,
                debit_amount=line_data.debit_amount,
                credit_amount=line_data.credit_amount,
                description=line_data.description,
                reference=line_data.reference,
            )
            self.db.add(line)

        self.db.commit()
        self.db.refresh(journal_entry)
        return journal_entry

    def post_journal_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> JournalEntry:
        """ترحيل قيد يومي (تحويله من مسودة إلى منشور وتحديث أرصدة الحسابات)."""

        entry = (
            self.db.query(JournalEntry)
            .filter(JournalEntry.id == entry_id, JournalEntry.status == "draft")
            .first()
        )
        if not entry:
            raise ValueError("القيد غير موجود أو ليس في حالة مسودة")

        # تحديث أرصدة الحسابات بناءً على سطور القيد
        for line in entry.lines:
            account: Any = self.db.query(Account).get(line.account_id)
            if not account:
                continue

            account.debit_balance += line.debit_amount
            account.credit_balance += line.credit_amount

            # حساب الرصيد الحالي بناءً على نوع الحساب
            if account.account_type in ["asset", "expense"]:
                # الأصول والمصروفات: الزيادة في المدين
                account.current_balance = account.debit_balance - account.credit_balance
            else:
                # الخصوم وحقوق الملكية والإيرادات: الزيادة في الدائن
                account.current_balance = account.credit_balance - account.debit_balance

        entry.status = "posted"
        entry.posted_at = datetime.utcnow()
        entry.posted_by = user_id

        self.db.commit()
        self.db.refresh(entry)
        return entry

    def _generate_entry_number(self, workshop_id: uuid.UUID) -> str:
        """توليد رقم قيد فريد حسب السنة الحالية.

        الشكل: JE-YYYY-00001
        """
        current_year = datetime.utcnow().year

        last_entry = (
            self.db.query(JournalEntry)
            .filter(
                JournalEntry.workshop_id == workshop_id,
                func.extract("year", JournalEntry.created_at) == current_year,
            )
            .order_by(JournalEntry.created_at.desc())
            .first()
        )

        if last_entry and last_entry.entry_number:
            try:
                last_num = int(last_entry.entry_number.split("-")[-1])
                new_num = last_num + 1
            except Exception:
                new_num = 1
        else:
            new_num = 1

        return f"JE-{current_year}-{str(new_num).zfill(5)}"
