"""
Tax API Endpoints
Saudi VAT and Zakat calculations
"""
from datetime import date
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ...services.tax.saudi_tax_service import get_tax_service, VATRate


router = APIRouter()


class VATCalculationRequest(BaseModel):
    """طلب حساب ضريبة القيمة المضافة"""
    amount: float = Field(..., gt=0, description="المبلغ")
    rate_type: str = Field(default="standard", description="نوع النسبة: standard, zero, exempt")
    is_inclusive: bool = Field(default=False, description="هل المبلغ شامل الضريبة")


class InvoiceItem(BaseModel):
    """بند الفاتورة"""
    description: str
    amount: float
    quantity: float = 1
    vat_rate: str = "standard"


class InvoiceVATRequest(BaseModel):
    """طلب حساب ضريبة فاتورة"""
    items: List[InvoiceItem]
    discount: float = 0


class ZakatCalculationRequest(BaseModel):
    """طلب حساب الزكاة"""
    zakatable_base: float = Field(..., description="الوعاء الزكوي")
    year_start: date = Field(..., description="بداية السنة المالية")
    year_end: date = Field(..., description="نهاية السنة المالية")


class WithholdingTaxRequest(BaseModel):
    """طلب حساب ضريبة الاستقطاع"""
    amount: float = Field(..., gt=0)
    payment_type: str = Field(..., description="نوع الدفعة: management_fees, royalties, technical_services, dividends, interest")


class VATReturnRequest(BaseModel):
    """طلب إعداد إقرار الضريبة"""
    period_start: date
    period_end: date
    standard_sales: float = 0
    zero_rated_sales: float = 0
    exempt_sales: float = 0
    sales_vat: float = 0
    standard_purchases: float = 0
    purchases_vat: float = 0


@router.post("/vat/calculate")
def calculate_vat(request: VATCalculationRequest):
    """حساب ضريبة القيمة المضافة"""
    try:
        tax_service = get_tax_service()
        
        rate_map = {
            "standard": VATRate.STANDARD,
            "zero": VATRate.ZERO,
            "exempt": VATRate.EXEMPT
        }
        rate_type = rate_map.get(request.rate_type, VATRate.STANDARD)
        
        result = tax_service.calculate_vat(
            amount=request.amount,
            rate_type=rate_type,
            is_inclusive=request.is_inclusive
        )
        
        return {
            "success": True,
            "base_amount": float(result.base_amount),
            "vat_amount": float(result.tax_amount),
            "total_amount": float(result.total_amount),
            "vat_rate": float(result.tax_rate),
            "is_inclusive": request.is_inclusive
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في حساب الضريبة: {str(e)}")


@router.post("/vat/invoice")
def calculate_invoice_vat(request: InvoiceVATRequest):
    """حساب ضريبة القيمة المضافة لفاتورة كاملة"""
    try:
        tax_service = get_tax_service()
        
        rate_map = {
            "standard": VATRate.STANDARD,
            "zero": VATRate.ZERO,
            "exempt": VATRate.EXEMPT
        }
        
        items = [
            {
                "amount": item.amount,
                "quantity": item.quantity,
                "vat_rate": rate_map.get(item.vat_rate, VATRate.STANDARD)
            }
            for item in request.items
        ]
        
        result = tax_service.calculate_invoice_vat(items, request.discount)
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في حساب ضريبة الفاتورة: {str(e)}")


@router.post("/zakat/calculate")
def calculate_zakat(request: ZakatCalculationRequest):
    """حساب الزكاة"""
    try:
        tax_service = get_tax_service()
        
        result = tax_service.calculate_zakat(
            zakatable_base=request.zakatable_base,
            year_start=request.year_start,
            year_end=request.year_end
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في حساب الزكاة: {str(e)}")


@router.post("/withholding/calculate")
def calculate_withholding_tax(request: WithholdingTaxRequest):
    """حساب ضريبة الاستقطاع"""
    try:
        tax_service = get_tax_service()
        
        valid_types = ["management_fees", "royalties", "technical_services", "dividends", "interest"]
        if request.payment_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"نوع الدفعة غير صحيح. الأنواع المتاحة: {', '.join(valid_types)}"
            )
        
        result = tax_service.calculate_withholding_tax(
            amount=request.amount,
            payment_type=request.payment_type
        )
        
        return {
            "success": True,
            "gross_amount": float(result.base_amount),
            "withholding_tax": float(result.tax_amount),
            "net_amount": float(result.total_amount),
            "tax_rate": float(result.tax_rate),
            "payment_type": request.payment_type
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في حساب ضريبة الاستقطاع: {str(e)}")


@router.post("/vat/return")
def generate_vat_return(request: VATReturnRequest):
    """إعداد إقرار ضريبة القيمة المضافة"""
    try:
        tax_service = get_tax_service()
        
        sales_data = {
            "standard_sales": request.standard_sales,
            "zero_rated_sales": request.zero_rated_sales,
            "exempt_sales": request.exempt_sales,
            "vat_amount": request.sales_vat
        }
        
        purchases_data = {
            "standard_purchases": request.standard_purchases,
            "vat_amount": request.purchases_vat
        }
        
        result = tax_service.generate_vat_return(
            sales_data=sales_data,
            purchases_data=purchases_data,
            period_start=request.period_start,
            period_end=request.period_end
        )
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في إعداد الإقرار: {str(e)}")


@router.get("/vat/validate-number")
def validate_tax_number(tax_number: str = Query(..., description="الرقم الضريبي")):
    """التحقق من صحة الرقم الضريبي"""
    try:
        tax_service = get_tax_service()
        result = tax_service.validate_tax_number(tax_number)
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في التحقق: {str(e)}")


@router.get("/rates")
def get_tax_rates():
    """الحصول على نسب الضرائب الحالية"""
    return {
        "success": True,
        "rates": {
            "vat": {
                "standard": 15,
                "zero_rated": 0,
                "description": "ضريبة القيمة المضافة"
            },
            "zakat": {
                "rate": 2.5,
                "description": "الزكاة على رأس المال"
            },
            "withholding": {
                "management_fees": 20,
                "royalties": 15,
                "technical_services": 5,
                "dividends": 5,
                "interest": 5,
                "description": "ضريبة الاستقطاع على المدفوعات للخارج"
            }
        },
        "authority": "ZATCA - هيئة الزكاة والضريبة والجمارك",
        "last_updated": "2024-01-01"
    }
