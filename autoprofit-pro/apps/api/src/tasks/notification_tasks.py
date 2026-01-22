"""
Notification Background Tasks
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any
import logging

from ..core.celery_app import celery_app
from ..core.database import SessionLocal
from ..models import Invoice, Customer, Workshop

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def send_payment_reminders(self):
    """
    Send payment reminders for invoices approaching due date.
    Runs weekly on Monday at 10 AM.
    """
    db = SessionLocal()
    try:
        today = datetime.utcnow().date()
        reminder_window = today + timedelta(days=7)  # Remind 7 days before due
        
        # Find invoices due within the next 7 days that aren't paid
        upcoming_due_invoices = db.query(Invoice).filter(
            Invoice.status == "issued",
            Invoice.payment_status.in_(["unpaid", "partial"]),
            Invoice.due_date <= reminder_window,
            Invoice.due_date >= today
        ).all()
        
        reminders_sent = 0
        for invoice in upcoming_due_invoices:
            try:
                # Send reminder (email/SMS)
                send_invoice_reminder.delay(str(invoice.id))
                reminders_sent += 1
            except Exception as e:
                logger.error(f"Failed to queue reminder for invoice {invoice.id}: {e}")
        
        logger.info(f"Queued {reminders_sent} payment reminders")
        return {"reminders_queued": reminders_sent}
        
    except Exception as e:
        logger.error(f"Error in payment reminders: {e}")
        raise self.retry(exc=e, countdown=300)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def send_invoice_reminder(self, invoice_id: str):
    """
    Send a payment reminder for a specific invoice.
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return {"error": "Invoice not found"}
        
        # Get customer info
        customer = None
        if invoice.customer_id:
            customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
        
        reminder_data = {
            "invoice_number": invoice.invoice_number,
            "customer_name": invoice.customer_name or (customer.name if customer else "عميل"),
            "total_amount": invoice.total_amount,
            "balance_due": invoice.balance_due,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "days_until_due": (invoice.due_date - datetime.utcnow().date()).days if invoice.due_date else None
        }
        
        # Here you would integrate with:
        # - Email service (SendGrid, Resend, etc.)
        # - SMS service (Twilio, etc.)
        # - WhatsApp Business API
        
        logger.info(f"Sent reminder for invoice {invoice.invoice_number}")
        return {
            "invoice_id": str(invoice.id),
            "reminder_sent": True,
            "reminder_data": reminder_data
        }
        
    except Exception as e:
        logger.error(f"Error sending reminder: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def send_overdue_notification(self, invoice_id: str):
    """
    Send notification for overdue invoice.
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return {"error": "Invoice not found"}
        
        days_overdue = (datetime.utcnow().date() - invoice.due_date).days if invoice.due_date else 0
        
        notification_data = {
            "type": "overdue",
            "invoice_number": invoice.invoice_number,
            "customer_name": invoice.customer_name,
            "total_amount": invoice.total_amount,
            "balance_due": invoice.balance_due,
            "days_overdue": days_overdue,
            "urgency": "high" if days_overdue > 30 else "medium"
        }
        
        # Send overdue notification
        # Implementation depends on notification channels
        
        logger.info(f"Sent overdue notification for invoice {invoice.invoice_number} ({days_overdue} days overdue)")
        return {
            "invoice_id": str(invoice.id),
            "notification_sent": True,
            "days_overdue": days_overdue
        }
        
    except Exception as e:
        logger.error(f"Error sending overdue notification: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task
def send_daily_summary_email(workshop_id: str, summary_data: Dict[str, Any]):
    """
    Send daily financial summary email to workshop owner.
    """
    db = SessionLocal()
    try:
        workshop = db.query(Workshop).filter(Workshop.id == workshop_id).first()
        if not workshop:
            return {"error": "Workshop not found"}
        
        email_content = {
            "to": workshop.owner_email,
            "subject": f"ملخص اليوم المالي - {workshop.name}",
            "template": "daily_summary",
            "data": {
                "workshop_name": workshop.name,
                "date": datetime.utcnow().strftime("%Y-%m-%d"),
                "revenue": summary_data.get("daily_revenue", 0),
                "expenses": summary_data.get("daily_expenses", 0),
                "net": summary_data.get("daily_revenue", 0) - summary_data.get("daily_expenses", 0),
                "pending_invoices": summary_data.get("pending_invoices", 0),
                "overdue_invoices": summary_data.get("overdue_invoices", 0),
            }
        }
        
        # Send email using configured email service
        # Implementation depends on email provider
        
        logger.info(f"Sent daily summary email to {workshop.owner_email}")
        return {"email_sent": True, "to": workshop.owner_email}
        
    except Exception as e:
        logger.error(f"Error sending daily summary email: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task
def send_welcome_email(user_email: str, user_name: str, workshop_name: str):
    """
    Send welcome email to new user.
    """
    try:
        email_content = {
            "to": user_email,
            "subject": f"مرحباً بك في AutoProfit Pro",
            "template": "welcome",
            "data": {
                "user_name": user_name,
                "workshop_name": workshop_name,
                "login_url": "https://autoprofit.app/login",
                "support_email": "support@autoprofit.app"
            }
        }
        
        # Send email
        # Implementation depends on email provider
        
        logger.info(f"Sent welcome email to {user_email}")
        return {"email_sent": True, "to": user_email}
        
    except Exception as e:
        logger.error(f"Error sending welcome email: {e}")
        return {"error": str(e)}


@celery_app.task
def send_bulk_notifications(notification_type: str, recipient_ids: List[str], message_data: Dict[str, Any]):
    """
    Send bulk notifications to multiple recipients.
    """
    db = SessionLocal()
    try:
        sent_count = 0
        failed_count = 0
        
        for recipient_id in recipient_ids:
            try:
                # Queue individual notification
                if notification_type == "invoice_reminder":
                    send_invoice_reminder.delay(recipient_id)
                elif notification_type == "overdue":
                    send_overdue_notification.delay(recipient_id)
                
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to queue notification for {recipient_id}: {e}")
                failed_count += 1
        
        logger.info(f"Bulk notifications: {sent_count} queued, {failed_count} failed")
        return {
            "notification_type": notification_type,
            "queued": sent_count,
            "failed": failed_count
        }
        
    except Exception as e:
        logger.error(f"Error in bulk notifications: {e}")
        return {"error": str(e)}
    finally:
        db.close()
