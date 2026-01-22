from datetime import datetime, date
from typing import Any, Dict, List
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from ...models import Invoice, InvoiceItem, InvoicePayment, Account
from ...schemas.accounting.journal_entries import JournalEntryCreate, JournalEntryLineCreate
from .accounting_service import AccountingService


class InvoiceService:
    """خدمة إدارة الفواتير المتكاملة مع المحاسبة (قيود يومية)."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.accounting_service = AccountingService(db)

    # ------------------------------------------------------------------
    #  إنشاء فاتورة
    # ------------------------------------------------------------------
    def create_invoice(self, invoice_data: Dict, workshop_id: uuid.UUID, user_id: uuid.UUID) -> Invoice:
        """إنشاء فاتورة جديدة (مسودة)."""

        invoice_number = self._generate_invoice_number(workshop_id)
        totals = self._calculate_invoice_totals(invoice_data["items"])

        invoice = Invoice(
            invoice_number=invoice_number,
            invoice_type=invoice_data.get("invoice_type", "sale"),
            invoice_date=invoice_data.get("invoice_date", datetime.utcnow()),
            due_date=invoice_data.get("due_date"),
            # عميل
            customer_id=invoice_data.get("customer_id"),
            customer_name=invoice_data.get("customer_name", "عميل نقدي"),
            customer_vat_number=invoice_data.get("customer_vat_number"),
            customer_address=invoice_data.get("customer_address"),
            # مبالغ
            subtotal=totals["subtotal"],
            discount_amount=totals["discount_amount"],
            tax_amount=totals["tax_amount"],
            shipping_amount=invoice_data.get("shipping_amount", 0.0),
            total_amount=totals["total_amount"],
            amount_paid=0.0,
            balance_due=totals["total_amount"],
            # ضرائب
            tax_rate=invoice_data.get("tax_rate", 15.0),
            tax_type_id=invoice_data.get("tax_type_id"),
            # معلومات إضافية
            currency=invoice_data.get("currency", "SAR"),
            terms_and_conditions=invoice_data.get("terms_and_conditions"),
            notes=invoice_data.get("notes"),
            workshop_id=workshop_id,
            created_by=user_id,
            status="draft",
        )

        self.db.add(invoice)
        self.db.flush()  # للحصول على invoice.id

        # إضافة البنود
        for item_data in invoice_data["items"]:
            item_subtotal = item_data["quantity"] * item_data["unit_price"]
            item_discount = item_subtotal * (item_data.get("discount_percent", 0.0) / 100.0)
            item_taxable = item_subtotal - item_discount

            tax_rate = item_data.get("tax_rate", invoice.tax_rate)
            item_tax = item_taxable * (tax_rate / 100.0) if item_data.get("is_taxable", True) else 0.0
            item_total = item_taxable + item_tax

            item = InvoiceItem(
                invoice_id=invoice.id,
                item_type=item_data.get("item_type", "service"),
                product_id=item_data.get("product_id"),
                service_id=item_data.get("service_id"),
                description=item_data["description"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                discount_percent=item_data.get("discount_percent", 0.0),
                subtotal=item_subtotal,
                discount_amount=item_discount,
                taxable_amount=item_taxable,
                tax_amount=item_tax,
                total_amount=item_total,
                is_taxable=item_data.get("is_taxable", True),
                tax_rate=tax_rate,
            )
            self.db.add(item)

        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    # ------------------------------------------------------------------
    #  إصدار فاتورة + إنشاء وترحيل القيد
    # ------------------------------------------------------------------
    def issue_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        """إصدار الفاتورة وإنشاء القيد المحاسبي وترحيله."""

        invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError("الفاتورة غير موجودة")
        if invoice.status != "draft":
            raise ValueError("الفاتورة ليست في حالة مسودة")

        entry_data = self._create_journal_entry_for_invoice(invoice)

        # إنشاء القيد وترحيله
        je = self.accounting_service.create_journal_entry(entry_data, invoice.workshop_id)
        je = self.accounting_service.post_journal_entry(je.id, invoice.created_by)

        invoice.status = "issued"
        invoice.journal_entry_id = je.id
        invoice.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    # ------------------------------------------------------------------
    #  تسجيل دفعة على فاتورة
    # ------------------------------------------------------------------
    def record_payment(self, invoice_id: uuid.UUID, payment_data: Dict, user_id: uuid.UUID) -> InvoicePayment:
        """تسجيل دفعة على فاتورة + إنشاء قيد محاسبي بسيط."""

        invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError("الفاتورة غير موجودة")
        if invoice.status == "cancelled":
            raise ValueError("لا يمكن تسجيل دفعة على فاتورة ملغاة")

        amount = payment_data["amount"]
        if amount > invoice.balance_due + 0.01:
            raise ValueError(f"المبلغ يتجاوز المبلغ المتبقي: {invoice.balance_due}")

        payment = InvoicePayment(
            invoice_id=invoice_id,
            payment_date=payment_data.get("payment_date", datetime.utcnow()),
            payment_method=payment_data["payment_method"],
            amount=amount,
            reference_number=payment_data.get("reference_number"),
            bank_name=payment_data.get("bank_name"),
            check_number=payment_data.get("check_number"),
            card_last_four=payment_data.get("card_last_four"),
            workshop_id=invoice.workshop_id,
            received_by=user_id,
        )
        self.db.add(payment)

        # تحديث رصيد الفاتورة
        invoice.amount_paid += amount
        invoice.balance_due = max(0.0, invoice.balance_due - amount)

        # تحديث حالة الدفع
        if invoice.balance_due <= 0.01:
            invoice.payment_status = "paid"
            invoice.status = "paid"
        elif invoice.amount_paid > 0:
            invoice.payment_status = "partial"

        # (اختياري) إنشاء قيد محاسبي للدفعة – يمكن تنفيذه لاحقًا
        # self._create_journal_entry_for_payment(invoice, payment, user_id)

        self.db.commit()
        self.db.refresh(payment)
        return payment

    # ------------------------------------------------------------------
    #  Helpers
    # ------------------------------------------------------------------
    def _calculate_invoice_totals(self, items: List[Dict]) -> Dict[str, float]:
        """حساب مجاميع الفاتورة من قائمة البنود."""
        subtotal = 0.0
        discount_amount = 0.0
        taxable_amount = 0.0
        tax_amount = 0.0
        total_amount = 0.0

        for item in items:
            item_subtotal = item["quantity"] * item["unit_price"]
            item_discount = item_subtotal * (item.get("discount_percent", 0.0) / 100.0)
            item_taxable = item_subtotal - item_discount
            item_tax = 0.0
            if item.get("is_taxable", True):
                item_tax = item_taxable * (item.get("tax_rate", 15.0) / 100.0)
            item_total = item_taxable + item_tax

            subtotal += item_subtotal
            discount_amount += item_discount
            taxable_amount += item_taxable
            tax_amount += item_tax
            total_amount += item_total

        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "taxable_amount": taxable_amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
        }

    def _generate_invoice_number(self, workshop_id: uuid.UUID) -> str:
        """توليد رقم فاتورة فريد بالشكل: INV-YYYY-00001."""
        current_year = datetime.utcnow().year

        last_invoice = (
            self.db.query(Invoice)
            .filter(
                Invoice.workshop_id == workshop_id,
                func.extract("year", Invoice.created_at) == current_year,
            )
            .order_by(Invoice.created_at.desc())
            .first()
        )

        if last_invoice and last_invoice.invoice_number:
            try:
                parts = last_invoice.invoice_number.split("-")
                last_num = int(parts[-1]) if len(parts) >= 3 else 0
                new_num = last_num + 1
            except Exception:
                new_num = 1
        else:
            new_num = 1

        return f"INV-{current_year}-{str(new_num).zfill(5)}"

    def _get_account_id_by_code(self, workshop_id: uuid.UUID, code: str) -> uuid.UUID:
        """الحصول على معرف الحساب باستخدام الكود من جدول Account الرئيسي."""
        account = (
            self.db.query(Account)
            .filter(Account.workshop_id == workshop_id, Account.account_code == code)
            .first()
        )
        if not account:
            raise ValueError(f"الحساب برقم {code} غير موجود")
        return account.id

    def _create_journal_entry_for_invoice(self, invoice: Invoice) -> JournalEntryCreate:
        """إنشاء بيانات القيد المحاسبي للفاتورة (مبيعات أو مشتريات)."""
        lines: List[JournalEntryLineCreate] = []

        if invoice.invoice_type == "sale":
            # العملاء مدينون، الإيرادات دائنة، الضريبة دائن
            lines.append(
                JournalEntryLineCreate(
                    account_id=self._get_account_id_by_code(invoice.workshop_id, "113"),
                    debit_amount=invoice.total_amount,
                    credit_amount=0.0,
                    description=f"فاتورة بيع {invoice.invoice_number}",
                    reference=invoice.invoice_number,
                )
            )
            lines.append(
                JournalEntryLineCreate(
                    account_id=self._get_account_id_by_code(invoice.workshop_id, "411"),
                    debit_amount=0.0,
                    credit_amount=invoice.subtotal,
                    description=f"إيرادات خدمات - {invoice.invoice_number}",
                    reference=invoice.invoice_number,
                )
            )
            if invoice.tax_amount > 0:
                lines.append(
                    JournalEntryLineCreate(
                        account_id=self._get_account_id_by_code(invoice.workshop_id, "212"),
                        debit_amount=0.0,
                        credit_amount=invoice.tax_amount,
                        description=f"ضريبة مبيعات - {invoice.invoice_number}",
                        reference=invoice.invoice_number,
                    )
                )
        else:
            # فاتورة شراء
            lines.append(
                JournalEntryLineCreate(
                    account_id=self._get_account_id_by_code(invoice.workshop_id, "211"),
                    debit_amount=0.0,
                    credit_amount=invoice.total_amount,
                    description=f"فاتورة شراء {invoice.invoice_number}",
                    reference=invoice.invoice_number,
                )
            )
            lines.append(
                JournalEntryLineCreate(
                    account_id=self._get_account_id_by_code(invoice.workshop_id, "514"),
                    debit_amount=invoice.subtotal,
                    credit_amount=0.0,
                    description=f"مشتريات - {invoice.invoice_number}",
                    reference=invoice.invoice_number,
                )
            )
            if invoice.tax_amount > 0:
                lines.append(
                    JournalEntryLineCreate(
                        account_id=self._get_account_id_by_code(invoice.workshop_id, "212"),
                        debit_amount=invoice.tax_amount,
                        credit_amount=0.0,
                        description=f"ضريبة مشتريات - {invoice.invoice_number}",
                        reference=invoice.invoice_number,
                    )
                )

        return JournalEntryCreate(
            entry_date=invoice.invoice_date,
            description=f"فاتورة {invoice.invoice_type} رقم {invoice.invoice_number}",
            reference=invoice.invoice_number,
            lines=lines,
        )

    # ------------------------------------------------------------------
    #  ملخص الفواتير لفترة
    # ------------------------------------------------------------------
    def get_invoice_summary(self, workshop_id: uuid.UUID, start_date: date, end_date: date) -> Dict[str, Any]:
        """ملخص الفواتير (مبيعات ومشتريات) لفترة زمنية."""

        issued = (
            self.db.query(Invoice)
            .filter(
                Invoice.workshop_id == workshop_id,
                Invoice.invoice_type == "sale",
                Invoice.status.in_(["issued", "sent", "paid", "partially_paid"]),
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
            )
            .all()
        )

        received = (
            self.db.query(Invoice)
            .filter(
                Invoice.workshop_id == workshop_id,
                Invoice.invoice_type == "purchase",
                Invoice.status.in_(["issued", "sent", "paid", "partially_paid"]),
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
            )
            .all()
        )

        total_sales = sum(inv.total_amount for inv in issued)
        total_purchases = sum(inv.total_amount for inv in received)
        outstanding_sales = sum(inv.balance_due for inv in issued)
        outstanding_purchases = sum(inv.balance_due for inv in received)

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "sales": {
                "total_invoices": len(issued),
                "total_amount": total_sales,
                "outstanding_amount": outstanding_sales,
                "collected_amount": total_sales - outstanding_sales,
                "vat_amount": sum(inv.tax_amount for inv in issued),
            },
            "purchases": {
                "total_invoices": len(received),
                "total_amount": total_purchases,
                "outstanding_amount": outstanding_purchases,
                "paid_amount": total_purchases - outstanding_purchases,
                "vat_amount": sum(inv.tax_amount for inv in received),
            },
        }
