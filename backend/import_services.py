#!/usr/bin/env python3
"""
Import comprehensive list of automotive services
"""
from pathlib import Path
from dotenv import load_dotenv

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from supabase_service import SupabaseService

# Comprehensive automotive services list
SERVICES = [
    # خدمات المحرك - Engine Services
    {"name": "تغيير زيت المحرك", "category": "محرك", "price": 150, "duration": 30},
    {"name": "تغيير فلتر الزيت", "category": "محرك", "price": 80, "duration": 20},
    {"name": "تغيير فلتر الهواء", "category": "محرك", "price": 100, "duration": 15},
    {"name": "تغيير فلتر البنزين", "category": "محرك", "price": 120, "duration": 25},
    {"name": "تنظيف البخاخات", "category": "محرك", "price": 250, "duration": 60},
    {"name": "فحص ضغط المحرك", "category": "محرك", "price": 200, "duration": 45},
    {"name": "تنظيف ثروتل المحرك", "category": "محرك", "price": 180, "duration": 40},
    {"name": "تغيير شمعات الإشعال", "category": "محرك", "price": 200, "duration": 45},
    {"name": "تغيير كويلات الإشعال", "category": "محرك", "price": 400, "duration": 60},
    {"name": "تغيير حزام التايمن", "category": "محرك", "price": 800, "duration": 180},
    {"name": "تغيير مضخة الماء", "category": "محرك", "price": 600, "duration": 120},
    {"name": "تغيير طرمبة البنزين", "category": "محرك", "price": 700, "duration": 90},
    {"name": "تنظيف راديتر المحرك", "category": "محرك", "price": 300, "duration": 60},
    {"name": "إصلاح رأس المحرك", "category": "محرك", "price": 3000, "duration": 480},
    {
        "name": "تغيير جوان رأس المحرك",
        "category": "محرك",
        "price": 2500,
        "duration": 360,
    },
    {"name": "تغيير صفاية البلف", "category": "محرك", "price": 1200, "duration": 180},
    {
        "name": "تغيير البساتم والشنابر",
        "category": "محرك",
        "price": 4000,
        "duration": 600,
    },
    {"name": "عمرة محرك كاملة", "category": "محرك", "price": 8000, "duration": 960},
    {"name": "تنظيف كربراتير", "category": "محرك", "price": 400, "duration": 90},
    {"name": "ضبط صبابات المحرك", "category": "محرك", "price": 350, "duration": 90},
    # نظام التبريد - Cooling System
    {"name": "تعبئة ماء الرديتر", "category": "تبريد", "price": 100, "duration": 20},
    {"name": "تغيير ماء الرديتر", "category": "تبريد", "price": 200, "duration": 30},
    {"name": "تغيير ثرموستات", "category": "تبريد", "price": 250, "duration": 45},
    {"name": "تغيير مروحة التبريد", "category": "تبريد", "price": 600, "duration": 60},
    {"name": "إصلاح تهريب الرديتر", "category": "تبريد", "price": 400, "duration": 90},
    {"name": "تغيير خراطيم التبريد", "category": "تبريد", "price": 300, "duration": 60},
    {"name": "فحص نظام التبريد", "category": "تبريد", "price": 150, "duration": 30},
    # نظام الكهرباء - Electrical System
    {"name": "فحص كمبيوتر السيارة", "category": "كهرباء", "price": 200, "duration": 45},
    {
        "name": "إلغاء أعطال الكمبيوتر",
        "category": "كهرباء",
        "price": 300,
        "duration": 60,
    },
    {
        "name": "تغيير بطارية السيارة",
        "category": "كهرباء",
        "price": 400,
        "duration": 30,
    },
    {"name": "تغيير دينمو", "category": "كهرباء", "price": 800, "duration": 90},
    {"name": "تغيير سلف", "category": "كهرباء", "price": 700, "duration": 90},
    {"name": "إصلاح دينمو", "category": "كهرباء", "price": 500, "duration": 120},
    {"name": "إصلاح سلف", "category": "كهرباء", "price": 400, "duration": 90},
    {"name": "تركيب إنذار", "category": "كهرباء", "price": 600, "duration": 120},
    {"name": "تركيب كاميرا خلفية", "category": "كهرباء", "price": 500, "duration": 90},
    {"name": "تركيب شاشة", "category": "كهرباء", "price": 400, "duration": 120},
    {"name": "إصلاح لمبات", "category": "كهرباء", "price": 150, "duration": 30},
    {"name": "تغيير فيوزات", "category": "كهرباء", "price": 100, "duration": 20},
    {"name": "إصلاح مساحات", "category": "كهرباء", "price": 200, "duration": 45},
    # نظام الفرامل - Brake System
    {
        "name": "تغيير تيل الفرامل الأمامي",
        "category": "فرامل",
        "price": 300,
        "duration": 60,
    },
    {
        "name": "تغيير تيل الفرامل الخلفي",
        "category": "فرامل",
        "price": 250,
        "duration": 45,
    },
    {"name": "تغيير ديسك الفرامل", "category": "فرامل", "price": 500, "duration": 90},
    {"name": "تغيير زيت الفرامل", "category": "فرامل", "price": 200, "duration": 45},
    {"name": "تنظيف نظام الفرامل", "category": "فرامل", "price": 300, "duration": 60},
    {"name": "إصلاح هوز الفرامل", "category": "فرامل", "price": 250, "duration": 60},
    {"name": "تغيير فحمات الفرامل", "category": "فرامل", "price": 350, "duration": 60},
    {"name": "إصلاح فرامل اليد", "category": "فرامل", "price": 300, "duration": 90},
    {"name": "فحص نظام ABS", "category": "فرامل", "price": 250, "duration": 45},
    # نظام التعليق - Suspension
    {
        "name": "تغيير مساعدات أمامية",
        "category": "تعليق",
        "price": 1000,
        "duration": 120,
    },
    {"name": "تغيير مساعدات خلفية", "category": "تعليق", "price": 900, "duration": 120},
    {"name": "تغيير ذراع التعليق", "category": "تعليق", "price": 600, "duration": 90},
    {"name": "تغيير مقصات التعليق", "category": "تعليق", "price": 800, "duration": 120},
    {"name": "تغيير جلد مقص", "category": "تعليق", "price": 400, "duration": 90},
    {"name": "تغيير طرف ماصة", "category": "تعليق", "price": 300, "duration": 60},
    {"name": "تغيير معاون", "category": "تعليق", "price": 250, "duration": 45},
    {"name": "ضبط زوايا", "category": "تعليق", "price": 200, "duration": 60},
    {"name": "ترصيص جنوط", "category": "تعليق", "price": 150, "duration": 45},
    # نظام التوجيه - Steering
    {"name": "تغيير زيت الباور", "category": "توجيه", "price": 200, "duration": 30},
    {"name": "تغيير طرمبة الباور", "category": "توجيه", "price": 800, "duration": 120},
    {"name": "إصلاح عمود الكرنك", "category": "توجيه", "price": 1500, "duration": 240},
    {"name": "تغيير رولة الكرنك", "category": "توجيه", "price": 400, "duration": 90},
    {"name": "ضبط عجلة القيادة", "category": "توجيه", "price": 150, "duration": 30},
    {"name": "تغيير خراطيم الباور", "category": "توجيه", "price": 300, "duration": 60},
    # نظام العادم - Exhaust System
    {"name": "تغيير شكمان", "category": "عادم", "price": 600, "duration": 90},
    {"name": "تغيير كاتم الصوت", "category": "عادم", "price": 500, "duration": 60},
    {"name": "إصلاح تهريب العادم", "category": "عادم", "price": 300, "duration": 60},
    {"name": "تركيب فلنشات", "category": "عادم", "price": 200, "duration": 45},
    {"name": "تغيير حساس الأكسجين", "category": "عادم", "price": 400, "duration": 45},
    {"name": "تنظيف كتلايزر", "category": "عادم", "price": 500, "duration": 90},
    {"name": "تغيير كتلايزر", "category": "عادم", "price": 2000, "duration": 120},
    # نظام الوقود - Fuel System
    {"name": "تنظيف خزان البنزين", "category": "وقود", "price": 400, "duration": 120},
    {"name": "تغيير طرمبة البنزين", "category": "وقود", "price": 700, "duration": 90},
    {"name": "تنظيف رشاشات البنزين", "category": "وقود", "price": 300, "duration": 60},
    {"name": "تغيير خراطيم البنزين", "category": "وقود", "price": 250, "duration": 45},
    {"name": "فحص ضغط الوقود", "category": "وقود", "price": 200, "duration": 30},
    # ناقل الحركة - Transmission
    {"name": "تغيير زيت القير العادي", "category": "قير", "price": 300, "duration": 60},
    {
        "name": "تغيير زيت القير الأوتوماتيك",
        "category": "قير",
        "price": 600,
        "duration": 90,
    },
    {"name": "تنظيف صفاية القير", "category": "قير", "price": 400, "duration": 120},
    {"name": "إصلاح قير عادي", "category": "قير", "price": 2500, "duration": 480},
    {"name": "إصلاح قير أوتوماتيك", "category": "قير", "price": 5000, "duration": 720},
    {"name": "تغيير جوان القير", "category": "قير", "price": 800, "duration": 180},
    {"name": "تغيير ديسك القير", "category": "قير", "price": 1500, "duration": 240},
    {"name": "ضبط الدبرياج", "category": "قير", "price": 300, "duration": 60},
    {"name": "تغيير فحمات القير", "category": "قير", "price": 400, "duration": 90},
    # نظام التكييف - AC System
    {"name": "تعبئة فريون", "category": "تكييف", "price": 250, "duration": 45},
    {
        "name": "تغيير كمبروسر التكييف",
        "category": "تكييف",
        "price": 1500,
        "duration": 180,
    },
    {"name": "تغيير مروحة التكييف", "category": "تكييف", "price": 600, "duration": 90},
    {"name": "تنظيف مكثف التكييف", "category": "تكييف", "price": 300, "duration": 60},
    {"name": "تغيير فلتر التكييف", "category": "تكييف", "price": 150, "duration": 20},
    {"name": "إصلاح تهريب الفريون", "category": "تكييف", "price": 500, "duration": 120},
    {"name": "تنظيف مجاري التكييف", "category": "تكييف", "price": 200, "duration": 45},
    {"name": "فحص نظام التكييف", "category": "تكييف", "price": 200, "duration": 30},
    # الإطارات والجنوط - Tires & Wheels
    {"name": "تغيير إطار", "category": "إطارات", "price": 400, "duration": 30},
    {"name": "ترصيص إطارات", "category": "إطارات", "price": 150, "duration": 60},
    {"name": "بنشر إطار", "category": "إطارات", "price": 50, "duration": 20},
    {"name": "تبديل إطارات", "category": "إطارات", "price": 100, "duration": 30},
    {"name": "تركيب جنوط جديدة", "category": "إطارات", "price": 200, "duration": 60},
    {"name": "فحص ضغط الإطارات", "category": "إطارات", "price": 50, "duration": 15},
    # خدمات الهيكل - Body Work
    {"name": "معجون وصبغ باب", "category": "هيكل", "price": 800, "duration": 240},
    {"name": "معجون وصبغ رفرف", "category": "هيكل", "price": 700, "duration": 240},
    {"name": "معجون وصبغ كبوت", "category": "هيكل", "price": 1000, "duration": 300},
    {"name": "صبغ كامل", "category": "هيكل", "price": 5000, "duration": 960},
    {"name": "تبديل باب", "category": "هيكل", "price": 1500, "duration": 180},
    {"name": "تبديل رفرف", "category": "هيكل", "price": 1200, "duration": 120},
    {"name": "تبديل كبوت", "category": "هيكل", "price": 2000, "duration": 120},
    {"name": "إصلاح صدمة أمامية", "category": "هيكل", "price": 1500, "duration": 240},
    {"name": "إصلاح صدمة خلفية", "category": "هيكل", "price": 1500, "duration": 240},
    {"name": "تلميع خارجي", "category": "هيكل", "price": 400, "duration": 120},
    # الزجاج والأنوار - Glass & Lights
    {"name": "تبديل زجاج أمامي", "category": "زجاج", "price": 1500, "duration": 120},
    {"name": "تبديل زجاج خلفي", "category": "زجاج", "price": 1200, "duration": 90},
    {"name": "تبديل زجاج جانبي", "category": "زجاج", "price": 600, "duration": 60},
    {"name": "تلميع زجاج", "category": "زجاج", "price": 200, "duration": 60},
    {"name": "تركيب عازل حراري", "category": "زجاج", "price": 800, "duration": 180},
    {"name": "تغيير لمبة أمامية", "category": "أنوار", "price": 150, "duration": 30},
    {"name": "تغيير لمبة خلفية", "category": "أنوار", "price": 100, "duration": 20},
    {"name": "تغيير شمعة كشاف", "category": "أنوار", "price": 300, "duration": 45},
    {"name": "تلميع شمعات", "category": "أنوار", "price": 200, "duration": 60},
    # الداخلية - Interior
    {"name": "تنظيف داخلي عادي", "category": "داخلية", "price": 150, "duration": 60},
    {"name": "تنظيف داخلي شامل", "category": "داخلية", "price": 400, "duration": 180},
    {"name": "تنظيف بخار", "category": "داخلية", "price": 300, "duration": 120},
    {"name": "تلميع تابلوه", "category": "داخلية", "price": 150, "duration": 45},
    {"name": "تبديل كشن", "category": "داخلية", "price": 2000, "duration": 240},
    {"name": "تلبيس كشنات", "category": "داخلية", "price": 1500, "duration": 300},
    {"name": "إصلاح سقف السيارة", "category": "داخلية", "price": 800, "duration": 180},
    {"name": "تركيب فرش أرضية", "category": "داخلية", "price": 300, "duration": 60},
    # الغسيل - Washing
    {"name": "غسيل عادي", "category": "غسيل", "price": 50, "duration": 30},
    {"name": "غسيل شامل", "category": "غسيل", "price": 100, "duration": 60},
    {"name": "تشميع", "category": "غسيل", "price": 200, "duration": 90},
    {"name": "تلميع خارجي وداخلي", "category": "غسيل", "price": 600, "duration": 240},
    {"name": "غسيل محرك", "category": "غسيل", "price": 150, "duration": 45},
    {"name": "غسيل بخار", "category": "غسيل", "price": 250, "duration": 90},
    # الصيانة الدورية - Periodic Maintenance
    {
        "name": "صيانة دورية 5000 كم",
        "category": "صيانة دورية",
        "price": 400,
        "duration": 90,
    },
    {
        "name": "صيانة دورية 10000 كم",
        "category": "صيانة دورية",
        "price": 600,
        "duration": 120,
    },
    {
        "name": "صيانة دورية 20000 كم",
        "category": "صيانة دورية",
        "price": 1000,
        "duration": 180,
    },
    {
        "name": "صيانة دورية 40000 كم",
        "category": "صيانة دورية",
        "price": 2000,
        "duration": 300,
    },
    {"name": "صيانة شاملة", "category": "صيانة دورية", "price": 3000, "duration": 480},
    # فحوصات - Inspections
    {"name": "فحص شامل قبل الشراء", "category": "فحص", "price": 500, "duration": 120},
    {"name": "فحص كمبيوتر متقدم", "category": "فحص", "price": 300, "duration": 60},
    {"name": "فحص بالماسح الضوئي", "category": "فحص", "price": 250, "duration": 45},
    {"name": "فحص أداء المحرك", "category": "فحص", "price": 400, "duration": 90},
    {"name": "فحص نظام الفرامل", "category": "فحص", "price": 200, "duration": 45},
    {"name": "فحص نظام التعليق", "category": "فحص", "price": 200, "duration": 45},
    {"name": "فحص البطارية", "category": "فحص", "price": 100, "duration": 20},
    # خدمات خاصة - Special Services
    {"name": "برمجة مفتاح", "category": "خاص", "price": 400, "duration": 60},
    {"name": "نسخ مفتاح", "category": "خاص", "price": 200, "duration": 30},
    {"name": "فتح باب مقفل", "category": "خاص", "price": 300, "duration": 45},
    {
        "name": "تعبئة دولاب بالنيتروجين",
        "category": "خاص",
        "price": 150,
        "duration": 30,
    },
    {"name": "تركيب جهاز تتبع GPS", "category": "خاص", "price": 800, "duration": 90},
    {"name": "تركيب مثبت سرعة", "category": "خاص", "price": 1000, "duration": 120},
    {"name": "تركيب سنسر ركن", "category": "خاص", "price": 500, "duration": 90},
    {"name": "تظليل زجاج", "category": "خاص", "price": 600, "duration": 120},
    {"name": "حماية نانو سيراميك", "category": "خاص", "price": 2000, "duration": 360},
    {"name": "تركيب داش كام", "category": "خاص", "price": 600, "duration": 90},
    # خدمات متقدمة - Advanced Services
    {"name": "برمجة كمبيوتر", "category": "متقدم", "price": 800, "duration": 120},
    {"name": "تعديل تيربو", "category": "متقدم", "price": 5000, "duration": 600},
    {"name": "تركيب شاحن تيربو", "category": "متقدم", "price": 8000, "duration": 720},
    {"name": "تعديل ECU", "category": "متقدم", "price": 1500, "duration": 180},
    {"name": "رفع مستوى الأداء", "category": "متقدم", "price": 3000, "duration": 360},
    {
        "name": "تركيب نظام عادم رياضي",
        "category": "متقدم",
        "price": 4000,
        "duration": 240,
    },
    {
        "name": "تركيب دعامية رياضية",
        "category": "متقدم",
        "price": 2000,
        "duration": 180,
    },
]


def import_services():
    """Import all services to Supabase"""
    supabase = SupabaseService()

    if supabase.mock_mode:
        print("❌ Supabase is in mock mode. Cannot import services.")
        return

    print(f"📋 Importing {len(SERVICES)} services to Supabase...")

    success_count = 0
    error_count = 0

    for service in SERVICES:
        try:
            # Check if service already exists
            existing = (
                supabase.client.table("services")
                .select("id")
                .eq("name", service["name"])
                .execute()
            )

            if existing.data:
                print(f"⏭️  Skipping '{service['name']}' - already exists")
                continue

            # Add active flag
            service["active"] = True
            service["vat_percent"] = 0

            # Convert to snake_case for database
            row = {
                "name": service["name"],
                "category": service["category"],
                "price": service["price"],
                "duration_minutes": service["duration"],
                "active": service["active"],
                "vat_percent": service.get("vat_percent", 0),
                "notes": service.get("notes", ""),
            }

            supabase.client.table("services").insert(row).execute()
            success_count += 1
            print(f"✅ Added: {service['name']}")

        except Exception as e:
            error_count += 1
            print(f"❌ Error adding '{service['name']}': {e}")

    print(f"\n{'='*70}")
    print(f"📊 Import Summary:")
    print(f"   ✅ Successfully imported: {success_count} services")
    print(f"   ❌ Errors: {error_count}")
    print(f"   📦 Total: {len(SERVICES)} services")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    import_services()
