from datetime import date, datetime
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ....core.database import SessionLocal
from ....services.accounting.report_generator import ReportGenerator
from ....models import Account


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
def get_balance_sheet(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
    as_of_date: Optional[date] = Query(None, description="تاريخ الميزانية (افتراضي اليوم)"),
    db: Session = Depends(get_db),
):
    """الحصول على الميزانية العمومية."""
    try:
        generator = ReportGenerator(db)
        report = generator.generate_balance_sheet(workshop_id, as_of_date)

        return {
            "success": True,
            "report_type": "balance_sheet",
            "generated_at": datetime.utcnow().isoformat(),
            "data": report,
        }
    except Exception as e:  # pragma: no cover - غلاف خطأ عام
        raise HTTPException(status_code=500, detail=f"خطأ في توليد التقرير: {str(e)}")


@router.get("/reports/income-statement")
def get_income_statement(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
    start_date: date = Query(..., description="تاريخ البدء"),
    end_date: date = Query(..., description="تاريخ الانتهاء"),
    db: Session = Depends(get_db),
):
    """الحصول على قائمة الدخل."""
    try:
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء")

        generator = ReportGenerator(db)
        report = generator.generate_income_statement(workshop_id, start_date, end_date)

        return {
            "success": True,
            "report_type": "income_statement",
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "duration_days": (end_date - start_date).days,
            },
            "data": report,
        }
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في توليد التقرير: {str(e)}")


@router.get("/reports/cash-flow")
def get_cash_flow(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
    start_date: date = Query(..., description="تاريخ البدء"),
    end_date: date = Query(..., description="تاريخ الانتهاء"),
    db: Session = Depends(get_db),
):
    """الحصول على قائمة التدفقات النقدية (مبسطة)."""
    try:
        generator = ReportGenerator(db)
        report = generator.generate_cash_flow(workshop_id, start_date, end_date)

        return {
            "success": True,
            "report_type": "cash_flow_statement",
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "data": report,
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في توليد التقرير: {str(e)}")


@router.get("/reports/trial-balance")
def get_trial_balance(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
    as_of_date: Optional[date] = Query(None, description="تاريخ الرصيد التجريبي"),
    db: Session = Depends(get_db),
):
    """الحصول على الرصيد التجريبي."""
    try:
        if not as_of_date:
            as_of_date = datetime.utcnow().date()

        generator = ReportGenerator(db)
        report = generator.generate_trial_balance(workshop_id, as_of_date)

        return {
            "success": True,
            "report_type": "trial_balance",
            "as_of_date": as_of_date.isoformat(),
            "data": report,
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في توليد التقرير: {str(e)}")


@router.get("/reports/general-ledger")
def get_general_ledger(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
    account_code: Optional[str] = Query(None, description="كود الحساب (اختياري)"),
    start_date: Optional[date] = Query(None, description="تاريخ البدء"),
    end_date: Optional[date] = Query(None, description="تاريخ الانتهاء"),
    db: Session = Depends(get_db),
):
    """الحصول على دفتر الأستاذ العام (مبسط)."""
    try:
        generator = ReportGenerator(db)
        report = generator.generate_general_ledger(
            workshop_id=workshop_id,
            account_code_prefix=account_code,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "success": True,
            "report_type": "general_ledger",
            "filters": {
                "account_code": account_code,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
            "data": report,
        }
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في توليد التقرير: {str(e)}")
