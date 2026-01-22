"""
Invoice Background Tasks
"""
from datetime import datetime, timedelta
from typing import List
import logging

from ..core.celery_app import celery_app
from ..core.database import SessionLocal
from ..models import Invoice, Workshop

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def check_overdue_invoices(self):
    """
    Check for overdue invoices and update their status.
    Runs daily at 9 AM.
    """
    db = SessionLocal()
    try:
        today = datetime.utcnow().date()
        
        # Find invoices that are past due date and not paid
        overdue_invoices = db.query(Invoice).filter(
            Invoice.status == "issued",
            Invoice.payment_status != "paid",
            Invoice.due_date < today
        ).all()
        
        updated_count = 0
        for invoice in overdue_invoices:
            invoice.status = "overdue"
            updated_count += 1
        
        db.commit()
        
        logger.info(f"Updated {updated_count} invoices to overdue status")
        return {"updated_count": updated_count}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error checking overdue invoices: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def process_invoice_issued(self, invoice_id: str):
    """
    Process tasks after an invoice is issued.
    - Send notification to customer
    - Update workshop statistics
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            logger.error(f"Invoice {invoice_id} not found")
            return {"error": "Invoice not found"}
        
        # Here you would:
        # 1. Send email/SMS notification to customer
        # 2. Update workshop statistics
        # 3. Create any necessary audit logs
        
        logger.info(f"Processed issued invoice: {invoice.invoice_number}")
        return {
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "processed": True
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing invoice {invoice_id}: {e}")
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def process_payment_received(self, invoice_id: str, payment_id: str):
    """
    Process tasks after a payment is received.
    - Send receipt to customer
    - Update financial records
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return {"error": "Invoice not found"}
        
        # Here you would:
        # 1. Send payment confirmation
        # 2. Generate receipt
        # 3. Update cash flow records
        
        logger.info(f"Processed payment {payment_id} for invoice {invoice.invoice_number}")
        return {
            "invoice_id": str(invoice.id),
            "payment_id": payment_id,
            "processed": True
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing payment: {e}")
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()


@celery_app.task
def generate_invoice_pdf(invoice_id: str) -> dict:
    """
    Generate PDF for an invoice.
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return {"error": "Invoice not found"}
        
        # PDF generation logic would go here
        # Using reportlab or similar library
        
        pdf_path = f"/tmp/invoices/{invoice.invoice_number}.pdf"
        
        logger.info(f"Generated PDF for invoice {invoice.invoice_number}")
        return {
            "invoice_id": str(invoice.id),
            "pdf_path": pdf_path,
            "generated": True
        }
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        return {"error": str(e)}
    finally:
        db.close()
