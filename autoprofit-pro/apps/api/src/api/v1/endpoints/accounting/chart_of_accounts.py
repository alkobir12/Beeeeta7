from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....core.database import SessionLocal
from ....core.accounting.constants import SAUDI_CHART_OF_ACCOUNTS
from ....models.accounting.chart_of_accounts import Account


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/chart-of-accounts/seed-saudi")
def seed_saudi_chart_of_accounts(workshop_id: uuid.UUID, db: Session = Depends(get_db)):
    """تهيئة دليل الحسابات وفقًا للدليل السعودي لورشة معينة.

    يمكن استدعاؤها مرة واحدة بعد إنشاء الورشة.
    """
    # تأكد أنه لا توجد حسابات مسبقًا
    existing = db.query(Account).filter(Account.workshop_id == workshop_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="تم تهيئة دليل الحسابات مسبقًا")

    accounts_to_create = []

    for main_code, main_data in SAUDI_CHART_OF_ACCOUNTS.items():
        # الحساب الرئيسي (1،2،3،...)
        main_account = Account(
            code=main_data["code"],
            name_ar=main_data["name"],
            name_en=None,
            account_type=main_data["type"],
            category=None,
            workshop_id=workshop_id,
            is_system_account=True,
        )
        accounts_to_create.append(main_account)

        # الفروع / التصنيفات الفرعية
        for sub_code, sub_data in main_data.get("subcategories", {}).items():
            sub_account = Account(
                code=sub_data["code"],
                name_ar=sub_data["name"],
                name_en=None,
                account_type=main_data["type"],
                category=sub_data.get("type"),
                workshop_id=workshop_id,
                parent=main_account,
                is_system_account=True,
            )
            accounts_to_create.append(sub_account)

    for acc in accounts_to_create:
        db.add(acc)

    db.commit()

    return {"status": "success", "created": len(accounts_to_create)}


@router.get("/chart-of-accounts", response_model=List[dict])
def list_chart_of_accounts(workshop_id: uuid.UUID, db: Session = Depends(get_db)):
    """عرض جميع الحسابات في دليل الحسابات لورشة معينة."""
    accounts = (
        db.query(Account)
        .filter(Account.workshop_id == workshop_id)
        .order_by(Account.code.asc())
        .all()
    )
    # إرجاع تمثيل بسيط (يمكن لاحقًا استبداله بـ Pydantic schema)
    return [
        {
            "id": str(a.id),
            "code": a.code,
            "name_ar": a.name_ar,
            "type": a.account_type,
            "category": a.category,
            "parent_id": str(a.parent_id) if a.parent_id else None,
            "current_balance": a.current_balance,
        }
        for a in accounts
    ]
