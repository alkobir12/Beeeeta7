"""
Report Generation Background Tasks
"""
from datetime import datetime, timedelta
from typing import Dict, Any
import logging
import json

from ..core.celery_app import celery_app
from ..core.database import SessionLocal
from ..services.accounting.report_generator import ReportGenerator
from ..models import Workshop

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def generate_daily_summary(self):
    """
    Generate daily financial summary for all workshops.
    Runs at 11 PM daily.
    """
    db = SessionLocal()
    try:
        workshops = db.query(Workshop).filter(Workshop.is_active == True).all()
        
        results = []
        for workshop in workshops:
            try:
                generator = ReportGenerator(db)
                
                today = datetime.utcnow().date()
                
                # Generate income statement for today
                income_data = generator.generate_income_statement(
                    workshop_id=workshop.id,
                    start_date=today,
                    end_date=today
                )
                
                results.append({
                    "workshop_id": str(workshop.id),
                    "workshop_name": workshop.name,
                    "daily_revenue": income_data.get("total_revenue", 0),
                    "daily_expenses": income_data.get("total_expenses", 0),
                    "generated_at": datetime.utcnow().isoformat()
                })
                
            except Exception as e:
                logger.error(f"Error generating summary for workshop {workshop.id}: {e}")
                continue
        
        logger.info(f"Generated daily summaries for {len(results)} workshops")
        return {"summaries": results}
        
    except Exception as e:
        logger.error(f"Error in daily summary generation: {e}")
        raise self.retry(exc=e, countdown=300)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def generate_monthly_report(self, workshop_id: str, year: int, month: int):
    """
    Generate comprehensive monthly financial report.
    """
    db = SessionLocal()
    try:
        from calendar import monthrange
        
        start_date = datetime(year, month, 1).date()
        end_date = datetime(year, month, monthrange(year, month)[1]).date()
        
        generator = ReportGenerator(db)
        
        # Generate all reports
        balance_sheet = generator.generate_balance_sheet(
            workshop_id=workshop_id,
            as_of_date=end_date
        )
        
        income_statement = generator.generate_income_statement(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date
        )
        
        cash_flow = generator.generate_cash_flow(
            workshop_id=workshop_id,
            start_date=start_date,
            end_date=end_date
        )
        
        trial_balance = generator.generate_trial_balance(
            workshop_id=workshop_id,
            as_of_date=end_date
        )
        
        report = {
            "workshop_id": workshop_id,
            "period": f"{year}-{month:02d}",
            "balance_sheet": balance_sheet,
            "income_statement": income_statement,
            "cash_flow": cash_flow,
            "trial_balance": trial_balance,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        # Save report to storage (could be S3, local file, etc.)
        report_path = f"/tmp/reports/{workshop_id}_{year}_{month:02d}.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        
        logger.info(f"Generated monthly report for workshop {workshop_id}: {year}-{month:02d}")
        return {
            "workshop_id": workshop_id,
            "period": f"{year}-{month:02d}",
            "report_path": report_path,
            "generated": True
        }
        
    except Exception as e:
        logger.error(f"Error generating monthly report: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task
def export_report_to_excel(
    workshop_id: str,
    report_type: str,
    start_date: str,
    end_date: str
) -> dict:
    """
    Export financial report to Excel format.
    """
    db = SessionLocal()
    try:
        import pandas as pd
        from datetime import datetime
        
        generator = ReportGenerator(db)
        
        start = datetime.fromisoformat(start_date).date()
        end = datetime.fromisoformat(end_date).date()
        
        if report_type == "income_statement":
            data = generator.generate_income_statement(workshop_id, start, end)
        elif report_type == "trial_balance":
            data = generator.generate_trial_balance(workshop_id, end)
        elif report_type == "general_ledger":
            data = generator.generate_general_ledger(workshop_id, start_date=start, end_date=end)
        else:
            return {"error": f"Unknown report type: {report_type}"}
        
        # Convert to Excel
        excel_path = f"/tmp/exports/{workshop_id}_{report_type}_{start_date}_{end_date}.xlsx"
        
        # Create Excel file using pandas
        # This is a simplified example
        df = pd.DataFrame(data)
        df.to_excel(excel_path, index=False)
        
        logger.info(f"Exported {report_type} to Excel: {excel_path}")
        return {
            "workshop_id": workshop_id,
            "report_type": report_type,
            "excel_path": excel_path,
            "exported": True
        }
        
    except Exception as e:
        logger.error(f"Error exporting to Excel: {e}")
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task
def calculate_kpis(workshop_id: str) -> dict:
    """
    Calculate key performance indicators for a workshop.
    """
    db = SessionLocal()
    try:
        from datetime import datetime, timedelta
        
        generator = ReportGenerator(db)
        
        today = datetime.utcnow().date()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)
        
        # Get monthly income statement
        monthly_income = generator.generate_income_statement(
            workshop_id=workshop_id,
            start_date=month_start,
            end_date=today
        )
        
        # Get yearly income statement
        yearly_income = generator.generate_income_statement(
            workshop_id=workshop_id,
            start_date=year_start,
            end_date=today
        )
        
        # Calculate KPIs
        monthly_revenue = sum(r.get('amount', 0) for r in monthly_income.get('revenues', []))
        yearly_revenue = sum(r.get('amount', 0) for r in yearly_income.get('revenues', []))
        
        kpis = {
            "workshop_id": workshop_id,
            "calculated_at": datetime.utcnow().isoformat(),
            "monthly": {
                "revenue": monthly_revenue,
                "gross_profit": monthly_income.get('gross_profit', 0),
                "net_income": monthly_income.get('net_income', 0),
                "gross_margin": (monthly_income.get('gross_profit', 0) / monthly_revenue * 100) if monthly_revenue > 0 else 0,
                "net_margin": (monthly_income.get('net_income', 0) / monthly_revenue * 100) if monthly_revenue > 0 else 0,
            },
            "yearly": {
                "revenue": yearly_revenue,
                "gross_profit": yearly_income.get('gross_profit', 0),
                "net_income": yearly_income.get('net_income', 0),
                "gross_margin": (yearly_income.get('gross_profit', 0) / yearly_revenue * 100) if yearly_revenue > 0 else 0,
                "net_margin": (yearly_income.get('net_income', 0) / yearly_revenue * 100) if yearly_revenue > 0 else 0,
            }
        }
        
        logger.info(f"Calculated KPIs for workshop {workshop_id}")
        return kpis
        
    except Exception as e:
        logger.error(f"Error calculating KPIs: {e}")
        return {"error": str(e)}
    finally:
        db.close()
