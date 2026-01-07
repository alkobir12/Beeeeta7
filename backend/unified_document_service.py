"""
خدمة توليد المستندات الموحدة
Unified Document Generation Service

تدمج:
- فواتير المبيعات
- تقارير التشخيص  
- عروض الأسعار
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from arabic_quotation import ArabicQuotationBuilder


class UnifiedDocumentGenerator:
    """مولد المستندات الموحد"""
    
    def __init__(self):
        self.builder = ArabicQuotationBuilder()
        self.document_types = {
            'invoice': 'فاتورة مبيعات',
            'diagnosis': 'تقرير تشخيص',
            'quote': 'عرض سعر',
            'receipt': 'إيصال استلام'
        }
    
    def generate_document(
        self,
        doc_type: str,
        workshop_data: Dict,
        customer_data: Dict,
        vehicle_data: Optional[Dict],
        items: List[Dict],
        settings: Optional[Dict] = None
    ) -> str:
        """توليد مستند موحد"""
        
        settings = settings or {}
        theme = settings.get('theme', 'أزرق')
        style = settings.get('style', 'حديث')
        tax_rate = settings.get('tax_rate', 15)
        
        # إعادة تعيين البيانات
        self.builder.reset_quotation()
        
        # تعيين بيانات الورشة/الشركة
        self.builder.set_company(
            name=workshop_data.get('name', 'ورشة الصيانة'),
            name_en=workshop_data.get('name_en', 'Maintenance Workshop'),
            address=workshop_data.get('address', ''),
            phone=workshop_data.get('phone', ''),
            email=workshop_data.get('email', ''),
            website=workshop_data.get('website', ''),
            tax_number=workshop_data.get('tax_number', workshop_data.get('taxNumber', ''))
        )
        
        # تعيين بيانات العميل
        self.builder.set_client(
            name=customer_data.get('name', customer_data.get('customerName', '')),
            company=customer_data.get('company', ''),
            address=customer_data.get('address', ''),
            phone=customer_data.get('phone', customer_data.get('customerPhone', '')),
            email=customer_data.get('email', '')
        )
        
        # تعيين وصف المشروع/المركبة
        project_desc = self._build_project_description(doc_type, vehicle_data, settings)
        self.builder.set_project(project_desc)
        
        # تعيين نسبة الضريبة
        self.builder.quotation['tax_rate'] = tax_rate
        
        # إضافة البنود
        for item in items:
            self.builder.add_item(
                description=item.get('description', item.get('name', '')),
                quantity=float(item.get('quantity', item.get('qty', 1))),
                unit_price=float(item.get('unit_price', item.get('price', 0))),
                discount=float(item.get('discount', 0))
            )
        
        # تعيين الشروط حسب نوع المستند
        self.builder.quotation['terms'] = self._get_terms_for_type(doc_type, settings)
        
        # تعديل العنوان حسب النوع
        self._customize_for_type(doc_type, settings)
        
        # توليد HTML
        return self.builder.generate_html(theme=theme, style=style)
    
    def _build_project_description(self, doc_type: str, vehicle_data: Optional[Dict], settings: Dict) -> str:
        """بناء وصف المشروع/المركبة"""
        if not vehicle_data:
            return settings.get('description', '')
        
        parts = []
        
        # معلومات المركبة
        brand = vehicle_data.get('brand', '')
        model = vehicle_data.get('model', '')
        year = vehicle_data.get('year', '')
        plate = vehicle_data.get('plateNumber', vehicle_data.get('plate', ''))
        vin = vehicle_data.get('vin', '')
        color = vehicle_data.get('color', '')
        mileage = vehicle_data.get('mileage', '')
        
        if brand or model:
            parts.append(f"المركبة: {brand} {model} {year}".strip())
        if plate:
            parts.append(f"رقم اللوحة: {plate}")
        if vin:
            parts.append(f"رقم الهيكل: {vin}")
        if color:
            parts.append(f"اللون: {color}")
        if mileage:
            parts.append(f"العداد: {mileage} كم")
        
        # ملاحظات إضافية
        notes = vehicle_data.get('notes', settings.get('notes', ''))
        if notes:
            parts.append(f"\nملاحظات: {notes}")
        
        return ' | '.join(parts) if parts else 'خدمات صيانة وإصلاح'
    
    def _get_terms_for_type(self, doc_type: str, settings: Dict) -> List[str]:
        """الحصول على الشروط حسب نوع المستند"""
        
        custom_terms = settings.get('terms', [])
        if custom_terms:
            return custom_terms
        
        if doc_type == 'invoice':
            return [
                'الأسعار شاملة ضريبة القيمة المضافة',
                'يرجى التحقق من البنود قبل مغادرة الورشة',
                'ضمان الإصلاح حسب نوع الخدمة',
                'لا يتم استرداد المبلغ بعد الخروج'
            ]
        elif doc_type == 'diagnosis':
            return [
                'هذا تقرير تشخيصي فقط وليس أمر إصلاح',
                'الأسعار تقديرية وقابلة للتغيير',
                'يتطلب موافقة العميل قبل البدء بالإصلاح',
                'صلاحية التقرير 7 أيام من تاريخ الإصدار'
            ]
        elif doc_type == 'quote':
            return [
                'هذا العرض صالح لمدة 30 يوماً من تاريخ الإصدار',
                'يتطلب دفع 50% مقدماً لبدء العمل',
                'الأسعار لا تشمل التعديلات الإضافية غير المذكورة',
                'جميع الأسعار بالريال السعودي شاملة ضريبة القيمة المضافة'
            ]
        elif doc_type == 'receipt':
            return [
                'تم استلام المركبة بحالتها الحالية',
                'يرجى الاحتفاظ بهذا الإيصال',
                'سيتم التواصل معكم عند جاهزية المركبة'
            ]
        
        return []
    
    def _customize_for_type(self, doc_type: str, settings: Dict):
        """تخصيص المستند حسب النوع"""
        
        # تعديل رقم المستند
        doc_number = settings.get('document_number')
        if doc_number:
            self.builder.quotation['number'] = doc_number
        else:
            prefix_map = {
                'invoice': 'INV',
                'diagnosis': 'DIG',
                'quote': 'QT',
                'receipt': 'RCP'
            }
            prefix = prefix_map.get(doc_type, 'DOC')
            now = datetime.now()
            self.builder.quotation['number'] = f"{prefix}-{now.year}-{now.month:02d}{now.day:02d}-{now.hour:02d}{now.minute:02d}"
        
        # تعديل صلاحية العرض
        validity_days = settings.get('validity_days', 30 if doc_type == 'quote' else 7)
        self.builder.quotation['valid_until'] = (datetime.now() + timedelta(days=validity_days)).strftime('%Y/%m/%d')
    
    def get_document_data(self) -> Dict:
        """الحصول على بيانات المستند"""
        return self.builder.to_dict()


# FastAPI Integration
def create_unified_document_routes(router):
    """إنشاء مسارات API للمستندات الموحدة"""
    from fastapi import HTTPException
    from fastapi.responses import HTMLResponse
    from pydantic import BaseModel
    from typing import List, Optional, Dict, Any
    
    class DocumentItem(BaseModel):
        description: Optional[str] = ''
        name: Optional[str] = ''
        quantity: Optional[float] = 1
        qty: Optional[float] = 1
        unit_price: Optional[float] = 0
        price: Optional[float] = 0
        discount: Optional[float] = 0
    
    class DocumentCustomer(BaseModel):
        name: Optional[str] = ''
        customerName: Optional[str] = ''
        company: Optional[str] = ''
        address: Optional[str] = ''
        phone: Optional[str] = ''
        customerPhone: Optional[str] = ''
        email: Optional[str] = ''
    
    class DocumentWorkshop(BaseModel):
        name: Optional[str] = ''
        name_en: Optional[str] = ''
        address: Optional[str] = ''
        phone: Optional[str] = ''
        email: Optional[str] = ''
        website: Optional[str] = ''
        tax_number: Optional[str] = ''
        taxNumber: Optional[str] = ''
    
    class DocumentVehicle(BaseModel):
        brand: Optional[str] = ''
        model: Optional[str] = ''
        year: Optional[str] = ''
        plateNumber: Optional[str] = ''
        plate: Optional[str] = ''
        vin: Optional[str] = ''
        color: Optional[str] = ''
        mileage: Optional[str] = ''
        notes: Optional[str] = ''
    
    class DocumentSettings(BaseModel):
        theme: Optional[str] = 'أزرق'
        style: Optional[str] = 'حديث'
        tax_rate: Optional[float] = 15
        document_number: Optional[str] = None
        validity_days: Optional[int] = 30
        description: Optional[str] = ''
        notes: Optional[str] = ''
        terms: Optional[List[str]] = None
    
    class GenerateDocumentRequest(BaseModel):
        doc_type: str = 'invoice'  # invoice, diagnosis, quote, receipt
        workshop: DocumentWorkshop
        customer: DocumentCustomer
        vehicle: Optional[DocumentVehicle] = None
        items: List[DocumentItem]
        settings: Optional[DocumentSettings] = None
    
    @router.post("/documents/generate")
    async def generate_document(request: GenerateDocumentRequest):
        """توليد مستند (فاتورة/تشخيص/عرض سعر)"""
        try:
            generator = UnifiedDocumentGenerator()
            
            # تحويل البيانات
            workshop_data = request.workshop.dict()
            customer_data = request.customer.dict()
            vehicle_data = request.vehicle.dict() if request.vehicle else None
            items = [item.dict() for item in request.items]
            settings = request.settings.dict() if request.settings else {}
            
            # توليد HTML
            html_content = generator.generate_document(
                doc_type=request.doc_type,
                workshop_data=workshop_data,
                customer_data=customer_data,
                vehicle_data=vehicle_data,
                items=items,
                settings=settings
            )
            
            return {
                'success': True,
                'doc_type': request.doc_type,
                'document_number': generator.builder.quotation['number'],
                'html': html_content,
                'data': generator.get_document_data()
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/documents/generate-html", response_class=HTMLResponse)
    async def generate_document_html(request: GenerateDocumentRequest):
        """توليد مستند وإرجاع HTML مباشرة"""
        try:
            generator = UnifiedDocumentGenerator()
            
            workshop_data = request.workshop.dict()
            customer_data = request.customer.dict()
            vehicle_data = request.vehicle.dict() if request.vehicle else None
            items = [item.dict() for item in request.items]
            settings = request.settings.dict() if request.settings else {}
            
            html_content = generator.generate_document(
                doc_type=request.doc_type,
                workshop_data=workshop_data,
                customer_data=customer_data,
                vehicle_data=vehicle_data,
                items=items,
                settings=settings
            )
            
            return HTMLResponse(content=html_content)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/documents/types")
    async def get_document_types():
        """الحصول على أنواع المستندات المتاحة"""
        generator = UnifiedDocumentGenerator()
        return {
            'types': generator.document_types,
            'themes': list(generator.builder.themes.keys()),
            'styles': ['حديث', 'كلاسيكي', 'فاخر']
        }
    
    return router


if __name__ == "__main__":
    # اختبار سريع
    generator = UnifiedDocumentGenerator()
    
    html = generator.generate_document(
        doc_type='invoice',
        workshop_data={
            'name': 'ورشة الخليج للصيانة',
            'phone': '+966 11 123 4567',
            'tax_number': '300012345600003'
        },
        customer_data={
            'name': 'أحمد محمد',
            'phone': '+966 50 123 4567'
        },
        vehicle_data={
            'brand': 'تويوتا',
            'model': 'كامري',
            'year': '2022',
            'plateNumber': 'أ ب ج 1234'
        },
        items=[
            {'description': 'تغيير زيت', 'quantity': 1, 'unit_price': 150},
            {'description': 'فلتر زيت', 'quantity': 1, 'unit_price': 50},
            {'description': 'فحص شامل', 'quantity': 1, 'unit_price': 200}
        ],
        settings={'theme': 'أزرق', 'style': 'حديث'}
    )
    
    print(f"✅ تم توليد المستند: {generator.builder.quotation['number']}")
    print(f"المجموع: {generator.builder.quotation['total']:,.2f} ر.س")
