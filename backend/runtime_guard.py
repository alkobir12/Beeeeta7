"""
Runtime Self-Healing & Optimization Guard
- Request Deduplication
- Invoice Protection
- Simple In-Memory Cache
- Traffic Monitoring

ملاحظة: هذا الحارس خفيف، الهدف منه المراقبة والحماية من التكرار السريع
بدون كسر أي تدفق للمستخدم.
"""

import time
from functools import lru_cache
from typing import Callable, Any

from fastapi import Request

# =========================
# 1️⃣ Request Deduplication
# =========================
REQUEST_GUARD: dict[str, float] = {}


def allow_request(key: str, ttl: int = 3) -> bool:
    """السماح/منع تكرار نفس الطلب خلال فترة قصيرة.

    key: معرف موحّد للطلب (مثال: method:path:ip)
    ttl: بالثواني المسموح بينها وبين نفس الطلب.
    """
    now = time.time()
    last = REQUEST_GUARD.get(key)
    if last and (now - last) < ttl:
        # تم تنفيذ نفس الطلب خلال فترة قصيرة
        return False
    REQUEST_GUARD[key] = now
    return True


# =========================
# 2️⃣ Invoice Protection
# =========================
INVOICE_GUARD: dict[str, float] = {}


def allow_invoice(vehicle_id: str, customer_id: str, ttl: int = 10) -> bool:
    """منع توليد نفس الفاتورة لنفس المركبة + العميل خلال فترة قصيرة."""
    key = f"invoice:{vehicle_id}:{customer_id}"
    now = time.time()
    last = INVOICE_GUARD.get(key)
    if last and (now - last) < ttl:
        return False
    INVOICE_GUARD[key] = now
    return True


# =========================
# 3️⃣ Lightweight Cache
# =========================
@lru_cache(maxsize=512)
def cache_read(key: str, loader: Callable[[], Any]):
    """قراءة مع كاش بسيط في الذاكرة.

    key: مفتاح فريد للكاش.
    loader: دالة تسترجع البيانات من المصدر (مثلاً قاعدة البيانات).
    """
    # NOTE: lru_cache يستخدم (key, loader) كمفتاح، لذلك يجب أن يكون loader ثابتاً
    return loader()


# =========================
# 4️⃣ Traffic Monitor
# =========================
REQUEST_COUNTER: dict[str, int] = {}


def monitor(request: Request) -> None:
    path = request.url.path
    REQUEST_COUNTER[path] = REQUEST_COUNTER.get(path, 0) + 1


def report() -> dict[str, Any]:
    """تقرير مبسّط عن أعلى المسارات استخداماً وحجم الحارس."""
    return {
        "top_requests": sorted(
            REQUEST_COUNTER.items(), key=lambda x: x[1], reverse=True
        )[:10],
        "guard_size": len(REQUEST_GUARD),
        "invoice_guard_size": len(INVOICE_GUARD),
    }


# =========================
# 5️⃣ FastAPI Middleware
# =========================
async def runtime_guard_middleware(request: Request, call_next):
    """Middleware خفيف يراقب الطلبات ويمنع التكرار السريع بدون كسر التدفق.

    - يحدّث عداد الطلبات لكل مسار.
    - يستخدم allow_request لمنع التكرار السريع، لكن لا يرجع خطأ للمستخدم؛
      الهدف هنا هو فتح الباب لاحقاً للتحسين بدون التأثير على الإنتاج.
    """
    monitor(request)

    # منع تكرار الطلبات المتطابقة بسرعة لنفس الـ IP (من ناحية القياس فقط حالياً)
    guard_key = f"{request.method}:{request.url.path}:{request.client.host}"
    _ = allow_request(guard_key)  # لا نغيّر سلوك الطلب حالياً، فقط نسجّل

    response = await call_next(request)
    return response
