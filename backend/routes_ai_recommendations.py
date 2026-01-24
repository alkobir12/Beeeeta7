"""
مسارات التوصيات الذكية
AI Recommendations Routes
"""

from fastapi import APIRouter
from typing import Optional
from datetime import datetime

from ai_recommendations_service import ai_recommendations

router = APIRouter(prefix="/api/ai-recommendations")

# قاعدة بيانات مؤقتة
recommendations_db = []


@router.get("")
async def get_recommendations(
    type: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    الحصول على التوصيات
    """

    # توليد توصيات تلقائية (بيانات تجريبية)
    sample_recommendations = [
        {
            "id": "REC001",
            "type": "pricing",
            "title": "تحسين سعر خدمة تغيير الزيت",
            "description": "سعر السوق الحالي لخدمة تغيير الزيت يتراوح بين 180-200 ريال. السعر الحالي 150 ريال. يُقترح رفع السعر إلى 180 ريال.",
            "current_value": 150,
            "recommended_value": 180,
            "expected_impact": "+20% زيادة في الإيرادات",
            "priority": "high",
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        },
        {
            "id": "REC002",
            "type": "inventory",
            "title": "إعادة طلب فلتر زيت",
            "description": "المخزون الحالي 100 قطعة، الحد الأدنى 20، معدل الاستهلاك الشهري 40 قطعة. يُقترح طلب 80 قطعة.",
            "current_value": 100,
            "recommended_value": 180,
            "expected_impact": "ضمان عدم نفاد المخزون لمدة شهرين",
            "priority": "medium",
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        },
        {
            "id": "REC003",
            "type": "customer",
            "title": "عرض خاص للعميل أحمد محمد",
            "description": "عميل قيم (إجمالي تعاملات: 15,000 ر.س). لديه 5,000 ر.س مستحقة. مقترح: خصم 10% على الصيانة القادمة لتشجيع الدفع.",
            "current_value": 5000,
            "recommended_value": 0,
            "expected_impact": "زيادة ولاء العميل وتحصيل المستحقات",
            "priority": "low",
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        },
        {
            "id": "REC004",
            "type": "service",
            "title": "إضافة خدمة فحص شامل",
            "description": 'لوحظ طلب متزايد على الفحص الشامل قبل السفر. مقترح: إضافة باقة "فحص ما قبل السفر" بسعر 350 ر.س.',
            "current_value": 0,
            "recommended_value": 350,
            "expected_impact": "+15% زيادة في الإيرادات الشهرية",
            "priority": "medium",
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        },
    ]

    # تصفية حسب المعايير
    filtered = sample_recommendations

    if type:
        filtered = [r for r in filtered if r["type"] == type]
    if priority:
        filtered = [r for r in filtered if r["priority"] == priority]
    if status:
        filtered = [r for r in filtered if r["status"] == status]

    return {"recommendations": filtered, "count": len(filtered)}


@router.post("/generate")
async def generate_recommendations():
    """
    توليد توصيات جديدة بناءً على البيانات الحالية
    """

    # في الإنتاج، سنجلب البيانات من قاعدة البيانات
    # حالياً: نستخدم بيانات تجريبية

    services = []
    parts = []
    customers = []
    operations = []
    accounts = []

    # توليد التوصيات
    recs = ai_recommendations.get_all_recommendations(
        services=services,
        parts=parts,
        customers=customers,
        operations=operations,
        accounts=accounts,
    )

    return {"success": True, "generated": len(recs), "recommendations": recs}


@router.put("/{recommendation_id}/status")
async def update_recommendation_status(
    recommendation_id: str, status: str  # accepted, rejected, implemented
):
    """
    تحديث حالة توصية
    """

    # في الإنتاج، سنحدث في قاعدة البيانات

    return {
        "success": True,
        "recommendation_id": recommendation_id,
        "new_status": status,
    }


@router.post("/ai-analysis")
async def get_ai_analysis(data: dict):
    """
    الحصول على تحليل AI شامل
    """

    ai_response = ai_recommendations.generate_ai_recommendations_with_gemini(data)

    return {
        "success": True,
        "ai_analysis": ai_response,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/stats")
async def get_recommendations_stats():
    """
    إحصائيات التوصيات
    """

    # بيانات تجريبية
    return {
        "total": 12,
        "by_priority": {"high": 3, "medium": 5, "low": 4},
        "by_status": {"pending": 8, "accepted": 3, "rejected": 1},
        "by_type": {"pricing": 4, "inventory": 3, "customer": 3, "service": 2},
        "implemented_value": 15000,  # القيمة المتوقعة من التوصيات المنفذة
    }
