from datetime import date
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ....core.database import SessionLocal
from ....services.accounting.report_generator import (
    generate_balance_sheet,
    generate_income_statement,
)


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/health")
def accounting_health():
    """نقطة صحّة لوحدة المحاسبة."""
    return {"status": "healthy", "service": "accounting", "version": "1.0.0"}


@router.get("/reports/balance-sheet")
def balance_sheet(
    workshop_id: uuid.UUID,
    as_of: date | None = None,
    db: Session = Depends(get_db),
):
    """الميزانية العمومية لورشة معينة."""
    report = generate_balance_sheet(db, workshop_id, as_of)
    return report


@router.get("/reports/income-statement")
def income_statement(
    workshop_id: uuid.UUID,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    """قائمة الدخل لفترة زمنية لورشة معينة."""
    report = generate_income_statement(db, workshop_id, start_date, end_date)
    return report
