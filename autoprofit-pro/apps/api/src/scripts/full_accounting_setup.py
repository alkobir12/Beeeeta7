#!/usr/bin/env python3
"""سكربت تهيئة النظام المحاسبي الكامل.

تشغيل من داخل حاوية /app/src:
    python -m scripts.full_accounting_setup
"""

from typing import Optional
import uuid

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models import Workshop, Account
from scripts.init_accounting import initialize_chart_of_accounts

# محاولة استيراد خدمة الضرائب السعودية إن وُجدت
try:  # pragma: no cover - استيراد اختياري
    from services.accounting.saudi_tax_service import SaudiTaxService  # type: ignore
except ImportError:  # pragma: no cover
    SaudiTaxService = None  # type: ignore


def _create_initial_system_accounts(db: Session, workshop_id: uuid.UUID) -> None:
    """إنشاء الحسابات النظامية الأولية (خزينة وبنك) في دليل الحسابات الرئيسي.

    يعتمد على نموذج Account في models.py (account_code / balance).
    """

    cash_accounts = [
        {
            "account_code": "111-001",
            "name": "خزينة الورشة الرئيسية",
            "type": "asset",
            "opening_balance": 5000.0,
        },
        {
            "account_code": "112-001",
            "name": "البنك الأهلي - الحساب الجاري",
            "type": "asset",
            "opening_balance": 10000.0,
        },
    ]

    for acc_data in cash_accounts:
        existing = (
            db.query(Account)
            .filter(
                Account.workshop_id == workshop_id,
                Account.account_code == acc_data["account_code"],
            )
            .first()
        )
        if existing:
            continue

        account = Account(
            workshop_id=workshop_id,
            account_code=acc_data["account_code"],
            account_name=acc_data["name"],
            account_type=acc_data["type"],
            balance=acc_data["opening_balance"],
            is_active=True,
        )
        db.add(account)

    db.commit()


def full_accounting_setup() -> bool:
    """تهيئة النظام المحاسبي بالكامل لورشة واحدة (أول ورشة)."""

    db = SessionLocal()
    try:
        workshop: Optional[Workshop] = db.query(Workshop).first()
        if not workshop:
            print("❌ لا توجد ورشة، قم بتهيئة الورشة أولاً (workshop_initialize)")
            return False

        print(f"🚀 بدء تهيئة النظام المحاسبي لورشة: {workshop.name} ({workshop.id})")

        # 1) تهيئة دليل الحسابات السعودي عبر سكربت init_accounting
        print("📊 1. تهيئة دليل الحسابات السعودي...")
        from scripts import init_accounting

        init_ok = init_accounting.initialize_chart_of_accounts(db, workshop.id)
        if not init_ok:
            print("⚠️  تخطي تهيئة دليل الحسابات (قد يكون مهيئًا مسبقًا)")

        # 2) تهيئة الضرائب السعودية إذا كانت الخدمة متوفرة
        if SaudiTaxService is not None:
            print("💰 2. تهيئة الضرائب السعودية...")
            try:
                tax_service = SaudiTaxService(db)  # type: ignore
                tax_service.initialize_saudi_taxes(workshop.id)
                print("✅ تم تهيئة الضرائب السعودية")
            except Exception as e:  # pragma: no cover
                print(f"⚠️  خطأ في تهيئة الضرائب: {e}")
        else:
            print("ℹ️ خدمة الضرائب السعودية SaudiTaxService غير متوفرة حالياً، تم تخطي الخطوة.")

        # 3) إنشاء حسابات نقدية نظامية أولية
        print("🏦 3. إنشاء الحسابات النقدية النظامية...")
        _create_initial_system_accounts(db, workshop.id)

        print("🎉 تم إكمال تهيئة النظام المحاسبي بنجاح!")
        return True

    except Exception as e:  # pragma: no cover
        print(f"❌ خطأ في تهيئة النظام: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    full_accounting_setup()
