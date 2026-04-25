# AutoPro Workshop Management System PRD

## Original Problem Statement
نظام إدارة ورشة سيارات متكامل يدعم اللغة العربية، مع وحدات محاسبية ومالية شاملة، وبوت واتساب ذكي، ووحدة MoltBot للذكاء الاصطناعي.

---

## Core Requirements
1. **Workshop Management**: Vehicle/customer management, visit tracking, service/parts catalog
2. **Financial Module**: Operations, journal entries, chart of accounts, financial reports
3. **MoltBot AI**: Intelligent code editor for FastAPI project analysis and modification
4. **Smart Guidance**: Step-by-step instructions for elderly users
5. **PDF/Document**: Invoice, quotation, diagnosis report generation
6. **WhatsApp Bot**: Customer communication via Infobip API + Auto notifications

---

## What's Been Implemented

### Sidebar UX Overhaul (25 Apr 2026)
- جميع مجموعات القائمة الجانبية (المخزون / المالية / المستندات) تبدأ **مطوية** افتراضياً على كل الشاشات
- عند فتح مجموعة، يتمرر الشريط تلقائياً لإظهار أبنائها كاملاً
- أيقونة `v` = مطوية (اضغط لفتح) / `^` = مفتوحة (اضغط لطي) — اتجاه واضح
- المجموعة التي تحتوي الصفحة الحالية تُفتح تلقائياً عند الانتقال إليها
- حل نهائي لمشكلة "الأبناء تختفي خارج حدود الشريط"

### Rakan Analytics Fix (25 Apr 2026)
- إصلاح `_is_rakan_operation` في `smart_inventory_service.py` ليفحص `items` داخل العملية
- إضافة `_rakan_items_total` لاستخراج مبلغ قطع راكان من العمليات المختلطة (ورشة + راكان)
- تحليلات راكان تعمل الآن: عمليتان | إيراد 153 ر.س ✅

### RakanLinkedPartPicker Cleanup (25 Apr 2026)
- إزالة عنوان «🧩 اختر قطعة راكان المرتبطة» من المكوّن
- إزالة رسالة التحذير «⚠️ هذا البند يُسجَّل في تحليلات راكان فقط...»
- إزالة بلوك «سجل حركة الموردين» من ملف المركبة — يبقى فقط في صفحة الموردين
- يبقى فقط القائمة المنسدلة لاختيار القطعة + الإدخال اليدوي

### Vehicle File: Auto Rakan Part Picker (25 Apr 2026)
- مكوّن `RakanLinkedPartPicker` يظهر تلقائياً عند اختيار مورد «راكان»
- قائمة منسدلة لقطع راكان + إدخال يدوي
- الاختيار يُحفظ كـ `linkedPart` و`linkedPartManualEntry`

### Rakan Independence + Supplier Movements (Final, 25 Apr 2026)
- راكان وحدة مستقلة عن الورشة — لا يُنشأ قيد محاسبي لعملياته
- تحليلات راكان في تبويب «تحليلات قطع راكان» في لوحة تحكم القطع
- سجل حركات الموردين يُقرأ من `journal_entries` ويظهر في صفحة الموردين فقط

### Net Income Card Cleanup + Backend Performance Overhaul (24 Apr 2026)
- إصلاح كرت «صافي الدخل» وإزالة الحقول المكررة
- TTL caches للـ hotspots: accounts/tree → 0.17s، income-statement → 0.18s
- دالة `invalidate_finance_caches()` تُستدعى بعد أي تعديل على القيود

### Duplicate Accounts Cleanup (24 Apr 2026)
- حذف 32 حساب مكرر/تجريبي من Supabase (211 → 179 حساباً)
- توحيد الأسماء المتباينة إملائياً

### Financial Mismatch Fix (24 Apr 2026)
- توحيد مصدر الأرقام: accounts/tree يقرأ من income-statement مباشرة
- Delta بين الصفحات = صفر كامل

---

## Code Architecture
```
/app
├── backend
│   ├── server.py
│   ├── routes_finance.py
│   ├── routes_extended.py
│   ├── routes_finance_bot.py
│   ├── smart_inventory_service.py   ← Rakan analytics fix
│   └── accounting_auditor.py
└── frontend
    └── src
        ├── components
        │   └── Sidebar.jsx          ← UX overhaul
        └── pages
            ├── ChartOfAccountsLiquid.jsx
            ├── ComprehensiveFinancial.jsx
            ├── Suppliers.jsx
            ├── VehicleDetails.jsx   ← RakanLinkedPartPicker
            └── PartsDashboard.jsx
```

## Key Technical Concepts
- Dual Database: Supabase (Primary) + MongoDB (Fallback)
- In-memory caching for heavy financial queries
- Rakan = independent business unit — no journal entries, tracked in Parts Analytics only
- Operations from vehicle visits: Rakan items detected via `items[].itemType=supplier + name=راكان`

## Prioritized Backlog

### P1 (Next)
- إكمال Auto-Linking + Contradiction Engine + Escalation Workflow لبوت المدقق المالي

### P2
- OCR / التحقق من المستندات المرفوعة في البوت المالي

### Refactoring
- تنظيف `server.py` المتضخم ونقل `/suppliers` إلى ملف مستقل
- تحسين أداء `VehicleDetails` و`ChartOfAccountsLiquid` لتفادي timeouts

## Key API Endpoints
- `GET /api/finance/reports/income-statement`
- `GET /api/suppliers`
- `GET /api/finance/operations`
- `GET /api/accounts`
- `GET /api/inventory/rakan-analytics`

## DB Schema (key fields)
- `accounts`: `{id, code, name, legacy_code, balance}`
- `journal_entries`: `{id, lines: [{account, debit, credit}], date}`
- `operations`: `{id, items: [{itemType, name, linkedPart}], supplierArchiveTotal, workshopTotal}`
