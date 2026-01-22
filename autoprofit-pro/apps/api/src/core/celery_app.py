"""
Celery Application Configuration
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Get Redis URL from environment
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "autoprofit",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "src.tasks.invoice_tasks",
        "src.tasks.report_tasks",
        "src.tasks.notification_tasks",
    ]
)

# Celery Configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Riyadh",
    enable_utc=True,
    
    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Result settings
    result_expires=3600,  # 1 hour
    
    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
    
    # Beat schedule for periodic tasks
    beat_schedule={
        # Generate daily summary report at 11 PM
        "daily-summary-report": {
            "task": "src.tasks.report_tasks.generate_daily_summary",
            "schedule": {
                "hour": 23,
                "minute": 0,
            },
        },
        # Check overdue invoices every day at 9 AM
        "check-overdue-invoices": {
            "task": "src.tasks.invoice_tasks.check_overdue_invoices",
            "schedule": {
                "hour": 9,
                "minute": 0,
            },
        },
        # Send payment reminders every Monday at 10 AM
        "weekly-payment-reminders": {
            "task": "src.tasks.notification_tasks.send_payment_reminders",
            "schedule": {
                "day_of_week": 0,  # Monday
                "hour": 10,
                "minute": 0,
            },
        },
    },
)

# Optional: Configure task routes
celery_app.conf.task_routes = {
    "src.tasks.report_tasks.*": {"queue": "reports"},
    "src.tasks.notification_tasks.*": {"queue": "notifications"},
    "src.tasks.invoice_tasks.*": {"queue": "invoices"},
}
