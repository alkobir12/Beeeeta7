#!/usr/bin/env python3
"""سكربت لتهيئة النظام المحاسبي
تشغيل من داخل حاوية /app/src:

    python -m scripts.init_accounting [WORKSHOP_ID]

إذا لم يُمرَّر WORKSHOP_ID كمعامل، سيأخذ أول ورشة من قاعدة البيانات.
"""

import sys
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.accounting.constants import SAUDI_CHART_OF_ACCOUNTS
from models.accounting.chart_of_accounts import Account
from models import Workshop  # Workshop مُعرَّف في models.py


def initialize_chart_of_accounts(db: Session, workshop_id: uuid.UUID) -> bool:
    """تهيئة دليل الحسابات للورشة المحددة."""

    # التحقق مما إذا كان الدليل موجودًا بالفعل
    existing = db.query(Account).filter(Account.workshop_id == workshop_id).first()
    if existing:
        print(f"⚠️  دليل الحسابات موجود بالفعل للورشة {workshop_id}")
        return False

    print(f"🚀 بدء تهيئة دليل الحسابات للورشة {workshop_id}")

    accounts_created = 0

    for main_code, main_data in SAUDI_CHART_OF_ACCOUNTS.items():
        # الحساب الرئيسي (1،2،3،...)
        main_account = Account(
            code=main_data["code"],
            name_ar=main_data["name"],
            name_en=main_data.get("name_en", main_data["name"]),
            account_type=main_data["type"],
            workshop_id=workshop_id,
            is_system_account=True,
            is_active=True,
        )
        db.add(main_account)
        db.flush()  # للحصول على ID

        # الحسابات الفرعية
        for sub_code, sub_data in main_data.get("subcategories", {}).items():
            sub_account = Account(
                code=sub_data["code"],
                name_ar=sub_data["name"],
                name_en=sub_data.get("name_en", sub_data["name"]),
                account_type=main_data["type"],
                category=sub_data.get("type"),
                parent_id=main_account.id,
                workshop_id=workshop_id,
                is_system_account=True,
                is_active=True,
            )
            db.add(sub_account)
            accounts_created += 1

    db.commit()
    print(f"✅ تم إنشاء {accounts_created} حسابًا في دليل الحسابات")
    return True


def main(workshop_id_arg: Optional[str] = None) -> None:
    db = SessionLocal()
    try:
        if workshop_id_arg:
            workshop_id = uuid.UUID(workshop_id_arg)
        else:
            # افتراضيًا، خذ أول ورشة
            workshop = db.query(Workshop).first()
            if not workshop:
                print("❌ لا توجد ورشة، قم بتهيئة الورشة أولاً")
                sys.exit(1)
            workshop_id = workshop.id

        initialize_chart_of_accounts(db, workshop_id)

    except Exception as e:
        db.rollback()
        print(f"❌ خطأ في تهيئة دليل الحسابات: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
