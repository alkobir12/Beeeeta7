"""
Saudi Tax Service - VAT and Zakat Calculations
According to ZATCA (Zakat, Tax and Customs Authority) regulations
"""
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class TaxType(str, Enum):
    VAT = "vat"  # ضريبة القيمة المضافة
    ZAKAT = "zakat"  # الزكاة
    WITHHOLDING = "withholding"  # ضريبة الاستقطاع


class VATRate(str, Enum):
    STANDARD = "15"  # النسبة الأساسية 15%
    ZERO = "0"  # نسبة الصفر
    EXEMPT = "exempt"  # معفى


@dataclass
class TaxCalculation:
    """نتيجة حساب الضريبة"""
    base_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    tax_rate: Decimal
    tax_type: TaxType


class SaudiTaxService:
    """
    خدمة الضرائب السعودية
    تشمل حساب ضريبة القيمة المضافة والزكاة
    """
    
    # نسب الضرائب الرسمية
    STANDARD_VAT_RATE = Decimal("15.00")  # 15%
    ZAKAT_RATE = Decimal("2.5")  # 2.5% على رأس المال
    WITHHOLDING_TAX_RATES = {
        "management_fees": Decimal("20"),
        "royalties": Decimal("15"),
        "technical_services": Decimal("5"),
        "dividends": Decimal("5"),
        "interest": Decimal("5"),
    }
    
    def __init__(self):
        self.rounding = ROUND_HALF_UP
    
    def calculate_vat(
        self,
        amount: float,
        rate_type: VATRate = VATRate.STANDARD,
        is_inclusive: bool = False
    ) -> TaxCalculation:
        """
        حساب ضريبة القيمة المضافة
        
        Args:
            amount: المبلغ
            rate_type: نوع النسبة (15% أو 0% أو معفى)
            is_inclusive: هل المبلغ شامل الضريبة
        
        Returns:
            نتيجة الحساب
        """
        amount_decimal = Decimal(str(amount))
        
        if rate_type == VATRate.EXEMPT or rate_type == VATRate.ZERO:
            return TaxCalculation(
                base_amount=amount_decimal,
                tax_amount=Decimal("0"),
                total_amount=amount_decimal,
                tax_rate=Decimal("0"),
                tax_type=TaxType.VAT
            )
        
        rate = self.STANDARD_VAT_RATE / Decimal("100")
        
        if is_inclusive:
            # المبلغ شامل الضريبة
            base_amount = amount_decimal / (1 + rate)
            tax_amount = amount_decimal - base_amount
            total_amount = amount_decimal
        else:
            # المبلغ غير شامل الضريبة
            base_amount = amount_decimal
            tax_amount = amount_decimal * rate
            total_amount = amount_decimal + tax_amount
        
        return TaxCalculation(
            base_amount=base_amount.quantize(Decimal("0.01"), self.rounding),
            tax_amount=tax_amount.quantize(Decimal("0.01"), self.rounding),
            total_amount=total_amount.quantize(Decimal("0.01"), self.rounding),
            tax_rate=self.STANDARD_VAT_RATE,
            tax_type=TaxType.VAT
        )
    
    def calculate_invoice_vat(
        self,
        items: List[Dict[str, Any]],
        discount: float = 0
    ) -> Dict[str, Any]:
        """
        حساب ضريبة القيمة المضافة لفاتورة كاملة
        
        Args:
            items: قائمة البنود [{"amount": float, "vat_rate": VATRate}]
            discount: قيمة الخصم
        
        Returns:
            تفاصيل الفاتورة مع الضرائب
        """
        subtotal = Decimal("0")
        total_vat = Decimal("0")
        item_details = []
        
        for item in items:
            amount = Decimal(str(item.get("amount", 0)))
            quantity = Decimal(str(item.get("quantity", 1)))
            rate_type = item.get("vat_rate", VATRate.STANDARD)
            
            line_total = amount * quantity
            vat_calc = self.calculate_vat(float(line_total), rate_type)
            
            subtotal += vat_calc.base_amount
            total_vat += vat_calc.tax_amount
            
            item_details.append({
                "base_amount": float(vat_calc.base_amount),
                "vat_amount": float(vat_calc.tax_amount),
                "total_amount": float(vat_calc.total_amount),
                "vat_rate": float(vat_calc.tax_rate)
            })
        
        discount_decimal = Decimal(str(discount))
        
        # تطبيق الخصم على المبلغ الأساسي
        if discount_decimal > 0:
            discount_ratio = discount_decimal / subtotal if subtotal > 0 else Decimal("0")
            vat_on_discount = total_vat * discount_ratio
            total_vat -= vat_on_discount
            subtotal -= discount_decimal
        
        return {
            "subtotal": float(subtotal.quantize(Decimal("0.01"), self.rounding)),
            "discount": float(discount_decimal),
            "vat_amount": float(total_vat.quantize(Decimal("0.01"), self.rounding)),
            "vat_rate": float(self.STANDARD_VAT_RATE),
            "total": float((subtotal + total_vat).quantize(Decimal("0.01"), self.rounding)),
            "items": item_details
        }
    
    def calculate_zakat(
        self,
        zakatable_base: float,
        year_start: date,
        year_end: date
    ) -> Dict[str, Any]:
        """
        حساب الزكاة على رأس المال
        
        Args:
            zakatable_base: الوعاء الزكوي (رأس المال + الاحتياطيات + الأرباح المحتجزة - الأصول الثابتة)
            year_start: بداية السنة المالية
            year_end: نهاية السنة المالية
        
        Returns:
            تفاصيل حساب الزكاة
        """
        base = Decimal(str(zakatable_base))
        
        # حساب عدد أيام السنة الهجرية (354 يوم تقريباً)
        days_in_year = (year_end - year_start).days
        hijri_year_days = 354
        
        # نسبة الزكاة المعدلة حسب أيام السنة
        adjusted_rate = self.ZAKAT_RATE * Decimal(str(days_in_year)) / Decimal(str(hijri_year_days))
        
        zakat_amount = base * (adjusted_rate / Decimal("100"))
        
        return {
            "zakatable_base": float(base),
            "zakat_rate": float(self.ZAKAT_RATE),
            "adjusted_rate": float(adjusted_rate.quantize(Decimal("0.01"), self.rounding)),
            "zakat_amount": float(zakat_amount.quantize(Decimal("0.01"), self.rounding)),
            "period_days": days_in_year,
            "period_start": year_start.isoformat(),
            "period_end": year_end.isoformat()
        }
    
    def calculate_withholding_tax(
        self,
        amount: float,
        payment_type: str
    ) -> TaxCalculation:
        """
        حساب ضريبة الاستقطاع على المدفوعات للخارج
        
        Args:
            amount: قيمة المدفوعات
            payment_type: نوع المدفوعات (management_fees, royalties, etc.)
        
        Returns:
            نتيجة الحساب
        """
        amount_decimal = Decimal(str(amount))
        rate = self.WITHHOLDING_TAX_RATES.get(payment_type, Decimal("5"))
        
        tax_amount = amount_decimal * (rate / Decimal("100"))
        
        return TaxCalculation(
            base_amount=amount_decimal,
            tax_amount=tax_amount.quantize(Decimal("0.01"), self.rounding),
            total_amount=(amount_decimal - tax_amount).quantize(Decimal("0.01"), self.rounding),
            tax_rate=rate,
            tax_type=TaxType.WITHHOLDING
        )
    
    def generate_vat_return(
        self,
        sales_data: Dict[str, Any],
        purchases_data: Dict[str, Any],
        period_start: date,
        period_end: date
    ) -> Dict[str, Any]:
        """
        إعداد إقرار ضريبة القيمة المضافة
        
        Returns:
            بيانات الإقرار الضريبي
        """
        # ضريبة المخرجات (على المبيعات)
        output_vat = Decimal(str(sales_data.get("vat_amount", 0)))
        standard_sales = Decimal(str(sales_data.get("standard_sales", 0)))
        zero_rated_sales = Decimal(str(sales_data.get("zero_rated_sales", 0)))
        exempt_sales = Decimal(str(sales_data.get("exempt_sales", 0)))
        
        # ضريبة المدخلات (على المشتريات)
        input_vat = Decimal(str(purchases_data.get("vat_amount", 0)))
        standard_purchases = Decimal(str(purchases_data.get("standard_purchases", 0)))
        
        # صافي الضريبة المستحقة أو المستردة
        net_vat = output_vat - input_vat
        
        return {
            "period": {
                "start": period_start.isoformat(),
                "end": period_end.isoformat()
            },
            "sales": {
                "standard_rated": {
                    "amount": float(standard_sales),
                    "vat": float(standard_sales * self.STANDARD_VAT_RATE / 100)
                },
                "zero_rated": {
                    "amount": float(zero_rated_sales),
                    "vat": 0
                },
                "exempt": {
                    "amount": float(exempt_sales),
                    "vat": 0
                },
                "total_sales": float(standard_sales + zero_rated_sales + exempt_sales),
                "output_vat": float(output_vat)
            },
            "purchases": {
                "standard_rated": {
                    "amount": float(standard_purchases),
                    "vat": float(input_vat)
                },
                "input_vat": float(input_vat)
            },
            "summary": {
                "output_vat": float(output_vat),
                "input_vat": float(input_vat),
                "net_vat": float(net_vat),
                "vat_due": float(net_vat) if net_vat > 0 else 0,
                "vat_refund": float(abs(net_vat)) if net_vat < 0 else 0
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def validate_tax_number(self, tax_number: str) -> Dict[str, Any]:
        """
        التحقق من صحة الرقم الضريبي السعودي
        
        الرقم الضريبي يتكون من 15 رقم:
        - أول رقم: 3 (للمؤسسات السعودية)
        - الأرقام من 2-11: رقم السجل التجاري
        - الأرقام من 12-14: رقم الفرع
        - الرقم 15: رقم التحقق
        """
        # إزالة المسافات والشرطات
        clean_number = tax_number.replace(" ", "").replace("-", "")
        
        if len(clean_number) != 15:
            return {
                "valid": False,
                "error": "الرقم الضريبي يجب أن يتكون من 15 رقم"
            }
        
        if not clean_number.isdigit():
            return {
                "valid": False,
                "error": "الرقم الضريبي يجب أن يحتوي على أرقام فقط"
            }
        
        if clean_number[0] != "3":
            return {
                "valid": False,
                "error": "الرقم الضريبي السعودي يجب أن يبدأ بالرقم 3"
            }
        
        return {
            "valid": True,
            "tax_number": clean_number,
            "formatted": f"{clean_number[:3]}-{clean_number[3:13]}-{clean_number[13:]}",
            "commercial_registration": clean_number[1:11]
        }


# Singleton instance
_tax_service: Optional[SaudiTaxService] = None


def get_tax_service() -> SaudiTaxService:
    """Get or create tax service instance"""
    global _tax_service
    if _tax_service is None:
        _tax_service = SaudiTaxService()
    return _tax_service
