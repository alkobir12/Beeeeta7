#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
نظام ورشة السيارات الذكي المتكامل
Integrated Car Workshop AI System

نسخة مكيّفة للعمل داخل مشروع FastAPI الحالي.
- لا يتم تشغيل الكود كبرنامج مستقل داخل الخادم
- يتم استدعاء الدوال من خلال مسارات FastAPI في routes_workshop_ai.py
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

# إعداد التسجيل
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# معلومات العميل الذكي (Genspark)
AGENT_CONFIG = {
    "agent_id": "122b55c9-1d5b-410e-8dbe-e14b994f1d90",
    "name": "خبير ميكانيكا السيارات المتقدم 2024",
    # يتم قراءة المفتاح من المتغير البيئي GENSPARK_API_KEY
    "api_key": os.getenv("GENSPARK_API_KEY", "your_api_key_here"),
    # ملاحظة: قد لا يكون هذا العنوان متاحاً من بيئة الخادم، لذلك يجب التعامل مع الأخطاء برفق
    "base_url": "https://www.genspark.ai/api/v1",
}


class CarWorkshopAI:
    """نظام ورشة السيارات الذكي الشامل"""

    def __init__(self) -> None:
        self.agent_id = AGENT_CONFIG["agent_id"]
        self.api_key = AGENT_CONFIG["api_key"]
        self.base_url = AGENT_CONFIG["base_url"]
        self.headers = {
            "Content-Type": "application/json",
        }
        if self.api_key and self.api_key != "your_api_key_here":
            self.headers["Authorization"] = f"Bearer {self.api_key}"

        # ملفات الصيانة المحلية (روابط تويوتا وغيرها)
        self.local_manuals = {
            "toyota_land_cruiser_200": {
                "url": "https://www.genspark.ai/api/files/s/FnzGsdAv",
                "name": "TOYOTA LAND CRUISER (200 SERIES).pdf",
                "engine": "1VD-FTV",
                "system": "Common Rail Diesel",
                "keywords": ["لاند كروزر", "ديزل", "حقن مشترك", "1VD-FTV"],
            },
            "toyota_hilux_manual": {
                "url": "https://www.genspark.ai/api/files/s/4cq2Y0f0",
                "name": "TOYOTA HILUX Repair manual.pdf",
                "engine": "1KD-2KD",
                "system": "Common Rail System",
                "keywords": ["هايلكس", "إنوفا", "1KD", "2KD", "ديزل"],
            },
        }

    async def send_message(self, message: str) -> Dict[str, Any]:
        """إرسال رسالة للعميل الذكي عبر Genspark.

        ملاحظة مهمة:
        - في هذه البيئة قد لا يكون الوصول إلى genspark.ai ممكناً (مشاكل DNS / 503)
        - في حال الفشل، سيتم إرجاع حقل error بدلاً من رفع استثناء،
          حتى لا يتعطل الـ API الأساسي.
        """

        payload = {
            "agent_id": self.agent_id,
            "message": message,
            "stream": False,
        }

        # إذا لم يتم تهيئة مفتاح API نرجع خطأ ودّي بدون محاولة الاتصال الخارجي
        if not self.api_key or self.api_key == "your_api_key_here":
            return {
                "error": "GENSPARK_API_KEY غير مكوّن على الخادم، لن يتم الاتصال بخدمة Genspark.",
            }

        try:
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.base_url}/chat",
                    headers=self.headers,
                    json=payload,
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    text = await response.text()
                    logger.warning(
                        "Genspark API non-200 response: %s | body=%s",
                        response.status,
                        text,
                    )
                    return {"error": f"API Error: {response.status}", "details": text}
        except Exception as e:  # noqa: BLE001
            logger.error("خطأ في الاتصال بخدمة Genspark: %s", e)
            return {"error": f"Connection error: {e}"}

    def search_local_manuals(self, query: str) -> List[Dict[str, Any]]:
        """البحث في الكتيبات المحلية بناءً على كلمات مفتاحية بسيطة."""
        results: List[Dict[str, Any]] = []
        query_lower = query.lower()

        for manual_id, manual_data in self.local_manuals.items():
            if any(keyword in query_lower for keyword in manual_data["keywords"]):
                results.append(
                    {
                        "manual_id": manual_id,
                        "name": manual_data["name"],
                        "url": manual_data["url"],
                        "engine": manual_data["engine"],
                        "system": manual_data["system"],
                        "relevance": "محلي",
                    }
                )

        return results

    async def search_internet_manuals(self, query: str) -> List[Dict[str, Any]]:
        """البحث في الإنترنت عن كتيبات الصيانة (محاكاة بسيطة حالياً)."""
        search_query = f"كتيب صيانة سيارة {query} PDF manual service"
        logger.info("Simulated internet manuals search query: %s", search_query)

        try:
            # هذا بحث صوري، يمكن استبداله بتكامل حقيقي لاحقاً
            internet_results = [
                {
                    "title": f"كتيب صيانة {query}",
                    "url": "https://example.com/manual.pdf",
                    "source": "إنترنت",
                    "relevance": "متوسطة",
                }
            ]
            return internet_results
        except Exception as e:  # noqa: BLE001
            logger.error("خطأ في البحث على الإنترنت: %s", e)
            return []

    async def diagnose_vehicle(self, vehicle_data: Dict[str, Any]) -> Dict[str, Any]:
        """تشخيص شامل للسيارة مع استخدام الكتيبات المحلية + Genspark عند الإمكان."""

        # البحث في الكتيبات المحلية
        search_query = f"{vehicle_data.get('make', '')} {vehicle_data.get('model', '')}"
        local_manuals = self.search_local_manuals(search_query)

        # إنشاء رسالة التشخيص
        diagnostic_prompt = f"""
🚗 **تشخيص السيارة:**
- الماركة: {vehicle_data.get('make')}
- الموديل: {vehicle_data.get('model')}
- السنة: {vehicle_data.get('year')}
- الكيلومترات: {vehicle_data.get('mileage')}
- نوع الوقود: {vehicle_data.get('fuel_type', 'بنزين')}

🔧 **الأعراض:**
{vehicle_data.get('symptoms', 'لا توجد أعراض')}

📚 **الكتيبات المتاحة محلياً:**
{json.dumps(local_manuals, ensure_ascii=False, indent=2) if local_manuals else 'لا توجد كتيبات محلية'}

**المطلوب:**
1. تشخيص دقيق بناءً على الأعراض
2. استخدام المعلومات من الكتيبات المتاحة إن أمكن
3. خطوات الفحص والإصلاح
4. تقدير التكلفة والوقت
5. أجزاء قد تحتاج استبدال
"""

        try:
            response = await self.send_message(diagnostic_prompt)

            # محتوى الرد قد يختلف حسب شكل استجابة Genspark
            content: str = ""
            if isinstance(response, dict):
                content = (
                    response.get("message", {})
                    .get("content", "")
                    if isinstance(response.get("message"), dict)
                    else response.get("content", "")
                )
                # إذا كان كل الرد عبارة عن خطأ نوضح ذلك
                if not content and response.get("error"):
                    content = f"تعذر الاتصال بالعميل الذكي: {response.get('error')}"

            diagnosis = {
                "timestamp": datetime.now().isoformat(),
                "vehicle_id": vehicle_data.get("vehicle_id"),
                "diagnosis": content,
                "local_manuals_found": local_manuals,
                "raw_ai_response": response,
                "confidence": "عالية" if local_manuals else "متوسطة",
            }

            return diagnosis

        except Exception as e:  # noqa: BLE001
            logger.error("خطأ أثناء التشخيص: %s", e)
            return {"error": str(e)}

    async def search_technical_info(self, query: str) -> Dict[str, Any]:
        """البحث الشامل في المعلومات التقنية (محلي + إنترنت + Genspark)."""

        local_results = self.search_local_manuals(query)

        internet_results: List[Dict[str, Any]] = []
        if len(local_results) < 2:
            internet_results = await self.search_internet_manuals(query)

        search_prompt = f"""
ابحث عن معلومات تقنية مفصلة حول: {query}

📚 **النتائج المحلية:**
{json.dumps(local_results, ensure_ascii=False, indent=2) if local_results else 'لا توجد'}

🌐 **النتائج من الإنترنت (تجريبية):**
{json.dumps(internet_results, ensure_ascii=False, indent=2) if internet_results else 'لا توجد'}

يرجى تقديم:
1. معلومات تقنية شاملة
2. مخططات وإرشادات (وصفية)
3. قيم المواصفات الفنية إن توفرت
4. إجراءات الصيانة
5. نصائح مهمة للميكانيكي
"""

        try:
            response = await self.send_message(search_prompt)

            content: str = ""
            if isinstance(response, dict):
                content = (
                    response.get("message", {})
                    .get("content", "")
                    if isinstance(response.get("message"), dict)
                    else response.get("content", "")
                )
                if not content and response.get("error"):
                    content = f"تعذر الاتصال بالعميل الذكي: {response.get('error')}"

            return {
                "query": query,
                "local_manuals": local_results,
                "internet_sources": internet_results,
                "ai_analysis": content,
                "raw_ai_response": response,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:  # noqa: BLE001
            logger.error("خطأ في البحث التقني: %s", e)
            return {"error": str(e)}

    async def manage_appointment(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """إدارة المواعيد الذكية (تقدير مدة الخدمة والأولوية والقطع المطلوبة)."""

        appointment_prompt = f"""
إدارة موعد جديد:

👤 **العميل:** {customer_data.get('customer_name')}
📱 **الهاتف:** {customer_data.get('phone')}
🚗 **السيارة:** {customer_data.get('vehicle_make')} {customer_data.get('vehicle_model')}
🔧 **نوع الخدمة:** {customer_data.get('service_type')}
📅 **التاريخ المفضل:** {customer_data.get('preferred_date')}

📝 **الوصف:**
{customer_data.get('service_description', 'لا يوجد وصف')}

المطلوب:
1. تقدير مدة الخدمة
2. تحديد الأولوية
3. قائمة بالأدوات/القطع المطلوبة
4. أفضل وقت لتنفيذ الخدمة
"""

        try:
            response = await self.send_message(appointment_prompt)

            content: str = ""
            if isinstance(response, dict):
                content = (
                    response.get("message", {})
                    .get("content", "")
                    if isinstance(response.get("message"), dict)
                    else response.get("content", "")
                )
                if not content and response.get("error"):
                    content = f"تعذر الاتصال بالعميل الذكي: {response.get('error')}"

            appointment = {
                "appointment_id": f"APT_{int(datetime.now().timestamp())}",
                "customer_data": customer_data,
                "ai_recommendation": content,
                "raw_ai_response": response,
                "status": "مجدول",
                "created_at": datetime.now().isoformat(),
            }

            return appointment

        except Exception as e:  # noqa: BLE001
            logger.error("خطأ في إدارة الموعد: %s", e)
            return {"error": str(e)}

    async def generate_service_report(self, service_data: Dict[str, Any]) -> Dict[str, Any]:
        """إنشاء تقرير خدمة شامل باللغة العربية."""

        report_prompt = f"""
إنشاء تقرير خدمة مهني:

🆔 **رقم الخدمة:** {service_data.get('service_id')}
🚗 **السيارة:** {service_data.get('vehicle_info')}
👤 **العميل:** {service_data.get('customer_name')}

🔧 **الأعمال المنجزة:**
{service_data.get('work_done', 'لا توجد تفاصيل')}

📦 **القطع المستبدلة:**
{service_data.get('parts_replaced', 'لا توجد قطع')}

المطلوب تقرير يشمل:
1. ملخص تنفيذي
2. تفاصيل الأعمال
3. التوصيات المستقبلية
4. جدول الصيانة القادمة
5. نصائح للعميل
"""

        try:
            response = await self.send_message(report_prompt)

            content: str = ""
            if isinstance(response, dict):
                content = (
                    response.get("message", {})
                    .get("content", "")
                    if isinstance(response.get("message"), dict)
                    else response.get("content", "")
                )
                if not content and response.get("error"):
                    content = f"تعذر الاتصال بالعميل الذكي: {response.get('error')}"

            report = {
                "report_id": f"RPT_{service_data.get('service_id', 'SERVICE')}_{int(datetime.now().timestamp())}",
                "service_data": service_data,
                "report_content": content,
                "raw_ai_response": response,
                "generated_at": datetime.now().isoformat(),
                "format": "digital",
            }

            return report

        except Exception as e:  # noqa: BLE001
            logger.error("خطأ في إنشاء تقرير الخدمة: %s", e)
            return {"error": str(e)}


# معلومات النظام المختصرة (تُستخدم من خلال مسارات الـ API)
SYSTEM_INFO = {
    "agent_id": AGENT_CONFIG["agent_id"],
    "agent_name": AGENT_CONFIG["name"],
    "capabilities": [
        "تشخيص ذكي مع البحث في الكتيبات",
        "إدارة ملفات الصيانة المحلية",
        "البحث على الإنترنت للمعلومات (تجريبي)",
        "جدولة المواعيد والتواصل مع العملاء الذكية",
        "تقارير الخدمة الشاملة",
    ],
    "local_manuals": [
        "Toyota Land Cruiser 200 Series (1VD-FTV)",
        "Toyota Hilux/Innova (1KD-2KD)",
    ],
}


# ملاحظات:
# - الأمثلة الأصلية (example_diagnosis، example_technical_search، example_appointment، main)
#   حُذفت من التنفيذ التلقائي لأنها غير مطلوبة داخل خادم FastAPI،
#   ويمكن إضافتها يدوياً إذا احتجنا لاختبارات يدوية خارج سياق الخادم.
