# إعداد Supabase للنظام المالي
## Supabase Finance Setup Instructions

### الخطوة 1: الوصول إلى Supabase SQL Editor

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اختر مشروعك: `kqjlyozhvwswooztccag`
3. اذهب إلى **SQL Editor** من القائمة الجانبية

### الخطوة 2: تنفيذ SQL Schema

1. انسخ محتوى ملف `/app/supabase_finance_schema.sql`
2. الصقه في SQL Editor
3. اضغط **Run** أو `Ctrl+Enter`

### الخطوة 3: التحقق من الإنشاء

بعد تنفيذ السكريبت، تحقق من:

✅ **الجداول المُنشأة:**
- `journal_entries` - القيود المحاسبية
- `chart_of_accounts` - دليل الحسابات

✅ **الـ Indexes:**
- سرعة البحث بـ workshop_id
- سرعة البحث بـ date
- سرعة البحث بـ code

✅ **RLS Policies:**
- سياسات الأمان مُفعّلة
- الصلاحيات محددة

✅ **البيانات الأولية:**
- 18 حساب أساسي في دليل الحسابات
- 5 أصول + 3 التزامات + 2 حقوق ملكية + 2 إيرادات + 6 مصروفات

### الخطوة 4: اختبار الجداول

قم بتشغيل هذا الاستعلام للتحقق:

```sql
-- عرض جميع الحسابات
SELECT code, name_ar, type, balance 
FROM chart_of_accounts 
WHERE workshop_id = 'default'
ORDER BY code;

-- عدد القيود المحاسبية
SELECT COUNT(*) as total_entries 
FROM journal_entries;
```

### الخطوة 5: إنشاء حسابات خاصة بورشتك (اختياري)

```sql
-- استبدل 'YOUR_WORKSHOP_ID' بمعرف ورشتك
INSERT INTO chart_of_accounts (code, name_ar, type, workshop_id, balance)
SELECT code, name_ar, type, 'YOUR_WORKSHOP_ID', 0
FROM chart_of_accounts
WHERE workshop_id = 'default';
```

---

## ما تم إنشاؤه 📋

### جدول journal_entries
```
- id: UUID (primary key)
- workshop_id: TEXT
- date: DATE
- description: TEXT
- lines: JSONB (قائمة الحسابات المدينة والدائنة)
- total: DECIMAL(12,2)
- created_at: TIMESTAMP
```

### جدول chart_of_accounts
```
- id: UUID (primary key)
- code: TEXT (رمز الحساب)
- name_ar: TEXT (الاسم بالعربية)
- name_en: TEXT (الاسم بالإنجليزية)
- type: TEXT (asset/liability/equity/revenue/expense)
- category: TEXT
- balance: DECIMAL(12,2)
- workshop_id: TEXT
- parent_id: UUID (للحسابات الفرعية)
- is_active: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

---

## البنية الهرمية للحسابات 🏗️

```
الأصول (Assets) - 1xx
├── 101 النقدية
├── 113 ذمم مدينة عملاء
├── 121 مخزون قطع الغيار
├── 151 معدات
└── 152 مركبات

الالتزامات (Liabilities) - 2xx
├── 211 ذمم دائنة موردين
├── 221 قروض قصيرة الأجل
└── 231 قروض طويلة الأجل

حقوق الملكية (Equity) - 3xx
├── 301 رأس المال
└── 302 الأرباح المحتجزة

الإيرادات (Revenue) - 4xx
├── 411 إيرادات خدمات الصيانة
└── 412 إيرادات بيع قطع الغيار

المصروفات (Expenses) - 5xx
├── 514 مصاريف قطع الغيار
├── 521 مصاريف رواتب
├── 522 مصاريف إيجار
├── 523 مصاريف كهرباء وماء
├── 524 مصاريف صيانة
└── 525 مصاريف إعلانات
```

---

## الاستخدام من Backend 🔌

الكود في `/app/backend/routes_finance.py` جاهز للاستخدام:

```python
# إنشاء قيد محاسبي
POST /api/finance/journal-entries?workshop_id=YOUR_ID
{
  "date": "2025-01-23",
  "description": "قيد بيع",
  "lines": [
    {"account": "101", "account_name": "النقدية", "debit": 1000, "credit": 0},
    {"account": "411", "account_name": "إيرادات", "debit": 0, "credit": 1000}
  ],
  "total": 1000
}

# جلب دليل الحسابات
GET /api/finance/chart-of-accounts?workshop_id=YOUR_ID

# جلب القيود المحاسبية
GET /api/finance/journal-entries?workshop_id=YOUR_ID
```

---

## المميزات ✨

✅ **Performance:**
- Indexes على جميع الأعمدة المهمة
- JSONB لتخزين القيود بكفاءة

✅ **Security:**
- Row Level Security (RLS) مُفعّل
- Policies قابلة للتخصيص

✅ **Data Integrity:**
- CHECK constraints على الأنواع
- UNIQUE constraint على (workshop_id, code)
- Foreign keys للحسابات الفرعية

✅ **Flexibility:**
- دعم حسابات متعددة لورش مختلفة
- إمكانية إنشاء حسابات فرعية
- حقول إضافية (category, parent_id)

---

## الخطوات التالية 📝

بعد إنشاء الجداول:

1. ✅ تشغيل SQL في Supabase
2. ✅ التحقق من إنشاء الجداول
3. ✅ اختبار API من Frontend
4. ⚠️ حل مشكلة MongoDB Atlas (optional)
5. 🎉 البدء في استخدام النظام المالي!

---

## دعم فني 🆘

إذا واجهت مشاكل:
- تأكد من صلاحيات SQL Editor
- تحقق من service_role_key في .env
- راجع logs في Supabase Dashboard

**النظام جاهز للاستخدام! 🚀**
