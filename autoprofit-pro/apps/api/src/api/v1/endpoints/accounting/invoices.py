from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from ....core.database import SessionLocal
from ....services.accounting.invoice_service import InvoiceService
from ....models import Invoice


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/invoices")
def create_invoice(
    invoice_data: Dict[str, Any],
    x_workshop_id: uuid.UUID = Header(..., alias="X-Workshop-ID"),
    x_user_id: uuid.UUID = Header(..., alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    """إنشاء فاتورة جديدة (مسودة) لورشة معينة.

    يتوقع جسم JSON مماثل لـ test_invoice.json الذي أرسلته.
    """
    service = InvoiceService(db)
    try:
        inv = service.create_invoice(invoice_data, x_workshop_id, x_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في إنشاء الفاتورة: {e}")

    return {
        "success": True,
        "invoice_id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "status": inv.status,
        "total_amount": inv.total_amount,
        "balance_due": inv.balance_due,
    }


@router.post("/invoices/{invoice_id}/issue")
def issue_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """إصدار فاتورة موجودة وإنشاء القيد المحاسبي الخاص بها."""
    service = InvoiceService(db)
    try:
        inv = service.issue_invoice(invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في إصدار الفاتورة: {e}")

    return {
        "success": True,
        "invoice_id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "status": inv.status,
        "journal_entry_id": str(inv.journal_entry_id) if inv.journal_entry_id else None,
    }


@router.post("/invoices/{invoice_id}/payments")
def add_invoice_payment(
    invoice_id: uuid.UUID,
    payment_data: Dict[str, Any],
    x_user_id: uuid.UUID = Header(..., alias="X-User-ID"),
    db: Session = Depends(get_db),
):
    """تسجيل دفعة على فاتورة."""
    service = InvoiceService(db)
    try:
        payment = service.record_payment(invoice_id, payment_data, x_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"خطأ في تسجيل الدفعة: {e}")

    return {
        "success": True,
        "payment_id": str(payment.id),
        "invoice_id": str(payment.invoice_id),
        "amount": payment.amount,
        "status": payment.status,
    }


@router.get("/invoices")
def list_invoices(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
    invoice_type: Optional[str] = Query(None, description="نوع الفاتورة (sale/purchase)"),
    status: Optional[str] = Query(None, description="حالة الفاتورة"),
    db: Session = Depends(get_db),
):
    """عرض قائمة الفواتير مع فلاتر بسيطة."""
    q = db.query(Invoice).filter(Invoice.workshop_id == workshop_id)
    if invoice_type:
        q = q.filter(Invoice.invoice_type == invoice_type)
    if status:
        q = q.filter(Invoice.status == status)

    invoices: List[Invoice] = q.order_by(Invoice.invoice_date.desc()).limit(200).all()

    return [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_type": inv.invoice_type,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "customer_name": inv.customer_name,
            "total_amount": inv.total_amount,
            "amount_paid": inv.amount_paid,
            "balance_due": inv.balance_due,
            "status": inv.status,
            "payment_status": inv.payment_status,
        }
        for inv in invoices
    ]
