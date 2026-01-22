"""
AI Analysis API Endpoints
"""
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...services.ai.financial_ai_service import get_ai_service


router = APIRouter()


class AnalysisRequest(BaseModel):
    """Request model for report analysis"""
    report_type: str  # balance_sheet, income_statement, cash_flow
    report_data: Dict[str, Any]
    question: Optional[str] = None
    period: Optional[str] = None


class QuestionRequest(BaseModel):
    """Request model for financial questions"""
    question: str
    context: Dict[str, Any] = {}


class FinancialSummary(BaseModel):
    """Financial summary for recommendations"""
    total_revenue: float = 0
    total_expenses: float = 0
    net_profit: float = 0
    pending_invoices: int = 0
    pending_amount: float = 0


@router.post("/analyze")
async def analyze_report(
    request: AnalysisRequest,
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
):
    """تحليل تقرير مالي باستخدام الذكاء الاصطناعي"""
    try:
        ai_service = get_ai_service()
        
        if request.report_type == "balance_sheet":
            result = await ai_service.analyze_balance_sheet(
                balance_sheet_data=request.report_data,
                workshop_id=str(workshop_id),
                question=request.question
            )
        elif request.report_type == "income_statement":
            result = await ai_service.analyze_income_statement(
                income_data=request.report_data,
                workshop_id=str(workshop_id),
                period=request.period or "الفترة الحالية",
                question=request.question
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"نوع التقرير غير مدعوم: {request.report_type}"
            )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "حدث خطأ في التحليل")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"خطأ في التحليل: {str(e)}"
        )


@router.get("/insights")
async def get_insights(
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
):
    """الحصول على رؤى مالية ذكية"""
    try:
        ai_service = get_ai_service()
        
        # In a real implementation, we would fetch actual financial data
        # For now, we'll use placeholder data
        financial_summary = {
            "total_revenue": 885000,
            "total_expenses": 690000,
            "net_profit": 195000,
            "pending_invoices": 12,
            "pending_amount": 75000
        }
        
        recommendations = await ai_service.get_financial_recommendations(
            workshop_id=str(workshop_id),
            financial_summary=financial_summary
        )
        
        return {
            "success": True,
            "workshop_id": str(workshop_id),
            "recommendations": recommendations
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"خطأ في جلب الرؤى: {str(e)}"
        )


@router.post("/ask")
async def ask_question(
    request: QuestionRequest,
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
):
    """طرح سؤال مالي على المساعد الذكي"""
    try:
        ai_service = get_ai_service()
        
        answer = await ai_service.answer_financial_question(
            question=request.question,
            context=request.context,
            workshop_id=str(workshop_id)
        )
        
        return {
            "success": True,
            "question": request.question,
            "answer": answer
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"خطأ في الإجابة: {str(e)}"
        )


@router.post("/recommendations")
async def get_recommendations(
    summary: FinancialSummary,
    workshop_id: uuid.UUID = Query(..., description="معرف الورشة"),
):
    """الحصول على توصيات مالية مخصصة"""
    try:
        ai_service = get_ai_service()
        
        recommendations = await ai_service.get_financial_recommendations(
            workshop_id=str(workshop_id),
            financial_summary=summary.model_dump()
        )
        
        return {
            "success": True,
            "workshop_id": str(workshop_id),
            "recommendations": recommendations
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"خطأ في جلب التوصيات: {str(e)}"
        )
