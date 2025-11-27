"""مسارات تكامل نظام ورشة السيارات الذكي (CarWorkshopAI).

توفّر هذه المسارات واجهة REST فوق الكلاس CarWorkshopAI الموجود في
workshop_ai_system.py حتى يمكن استدعاؤه من الواجهة (React) بسهولة.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from workshop_ai_system import CarWorkshopAI, SYSTEM_INFO

router = APIRouter(prefix="/api/ai/workshop", tags=["Workshop AI"])

# مثيل واحد يُستخدم لكل الطلبات لتقليل إنشاء الاتصالات
_ai = CarWorkshopAI()


class VehicleDiagnosisRequest(BaseModel):
    vehicle_id: Optional[str] = Field(None, description="معرّف السيارة في نظام الورشة")
    make: str = Field(..., description="الماركة، مثلاً: تويوتا")
    model: str = Field(..., description="الموديل، مثلاً: لاند كروزر")
    year: Optional[str] = Field(None, description="سنة الصنع")
    mileage: Optional[int] = Field(None, description="عدد الكيلومترات")
    fuel_type: Optional[str] = Field("بنزين", description="نوع الوقود")
    symptoms: Optional[str] = Field(None, description="وصف الأعراض")


class TechnicalSearchRequest(BaseModel):
    query: str = Field(..., description="نص البحث التقني")


class AppointmentRequest(BaseModel):
    customer_name: str = Field(..., description="اسم العميل")
    phone: str = Field(..., description="رقم الهاتف")
    vehicle_make: str = Field(..., description="ماركة السيارة")
    vehicle_model: str = Field(..., description="موديل السيارة")
    service_type: str = Field(..., description="نوع الخدمة المطلوبة")
    preferred_date: Optional[str] = Field(None, description="التاريخ/الوقت المفضل بصيغة ISO")
    service_description: Optional[str] = Field("", description="وصف مختصر لما يريده العميل")


class ServiceReportRequest(BaseModel):
    service_id: str = Field(..., description="معرّف الخدمة أو العملية")
    vehicle_info: str = Field(..., description="وصف مختصر للسيارة")
    customer_name: str = Field(..., description="اسم العميل")
    work_done: str = Field(..., description="تفاصيل الأعمال المنجزة")
    parts_replaced: Optional[str] = Field("", description="قائمة بالقطع المستبدلة")


@router.get("/info")
async def workshop_ai_info() -> Dict[str, Any]:
    """إرجاع معلومات عن وكيل ورشة السيارات الذكي وإمكانياته.

    لا يتم فيها أي اتصال خارجي؛ تعتمد فقط على SYSTEM_INFO.
    مفيدة للفحص السريع من الواجهة أو عبر curl.
    """

    return {
        **SYSTEM_INFO,
        "timestamp": datetime.utcnow().isoformat(),
        "has_genspark_key": bool(_ai.api_key and _ai.api_key != "your_api_key_here"),
    }


@router.post("/diagnose")
async def diagnose_vehicle(payload: VehicleDiagnosisRequest):
    """تشخيص ذكي لمركبة بناءً على بياناتها والأعراض المذكورة.

    - يحاول استخدام كتيبات تويوتا المحلية إن توفرت
    - يحاول الاتصال بـ Genspark إذا كان GENSPARK_API_KEY متوفراً
    - في حال فشل الاتصال بخدمة Genspark يتم إرجاع رسالة خطأ داخل الحقل `error`
      مع بقاء استجابة الـ API نفسها 200 (لتفادي تعطل الواجهة).
    """

    data = payload.dict()
    result = await _ai.diagnose_vehicle(data)
    return result


@router.post("/search-technical")
async def search_technical(payload: TechnicalSearchRequest):
    """بحث تقني متقدم عن أعطال أو أنظمة أو مكوّنات.

    تستخدم الكتيبات المحلية والبحث الصوري في الإنترنت
    ثم تحاول استخدام Genspark لتوليد شرح عربي مفصل.
    """

    result = await _ai.search_technical_info(payload.query)
    return result


@router.post("/appointment")
async def manage_appointment(payload: AppointmentRequest):
    """إنشاء موعد ذكي مع توصيات بالمدة والأولوية والقطع المطلوبة."""

    result = await _ai.manage_appointment(payload.dict())
    return result


@router.post("/service-report")
async def generate_service_report(payload: ServiceReportRequest):
    """توليد تقرير خدمة احترافي باللغة العربية."""

    result = await _ai.generate_service_report(payload.dict())
    return result
