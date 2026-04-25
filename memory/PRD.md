# AutoPro Workshop Management System PRD

## Original Problem Statement
نظام إدارة ورشة سيارات متكامل يدعم اللغة العربية، مع وحدات محاسبية ومالية شاملة.

---

## Code Architecture
```
/app
├── backend
│   ├── server.py
│   ├── routes_finance.py          ← legacy→new code migration, updated _infer_account_type
│   ├── routes_extended.py         ← ACCOUNT_NAME_MAP, LEGACY_TO_NEW_CODE, new codes in JE builder
│   ├── routes_finance_bot.py
│   ├── smart_inventory_service.py ← Rakan analytics fix (items scan)
│   └── accounting_auditor.py
└── frontend
    └── src
        ├── components/Sidebar.jsx  ← UX overhaul (collapse all, scroll to group)
        └── pages/
            ├── JournalEntries.jsx  ← LEGACY_MAP for display
            ├── ComprehensiveFinancial.jsx
            ├── VehicleDetails.jsx  ← RakanLinkedPartPicker (clean)
            └── PartsDashboard.jsx
```

---

## What's Been Implemented

### شامل: تنظيف البيانات + ترحيل الأكواد (25 Apr 2026)
**ما تم:**
1. **حذف بيانات الاختبار**: 6 عمليات + 2 قيد يومية تجريبية حُذفت نهائياً
2. **ترحيل 45 قيد**: جميع سطور قيود اليومية بالأكواد القديمة (1101→003، 1102→004، 1103→005، 1104→006، 4100→026، 4000→025، 6100→036، 6101→037) ترحيلاً فعلياً في Supabase
3. **endpoint جديد**: `POST /api/finance/reports/migrate-legacy-codes?workshop_id=...&apply_changes=true`
4. **routes_extended.py**:
   - `ACCOUNT_NAME_MAP` محدّث بالأكواد الجديدة + القديمة للتوافق
   - `LEGACY_TO_NEW_CODE` map جديد
   - `_normalize_account_code` يحوّل legacy تلقائياً
   - `_build_operation_journal_entry` يستخدم أكواداً جديدة: 003/004/005/026/036
5. **routes_finance.py**:
   - `_infer_account_type_from_code` يتعرف على الأكواد الجديدة (001-059) والقديمة (1000-6999)
   - `AR_ACCOUNT_CODES`, `CASH_ACCOUNT_CODES`, `BANK_ACCOUNT_CODES` محدّثة
   - `_to_new_code()` helper جديد
   - جميع دوال القراءة (income-statement, balance-sheet, reclassify) تدعم الأكوادين
6. **حذف ملفات backup**: AIFinancial_chat_backup, BalanceSheet_backup, CashFlow_backup, IncomeStatement_backup, Invoices_backup, TrialBalance_backup, Settings_broken

**نتائج الاختبار 8/8 (100%):**
- ✅ لا عمليات اختبار
- ✅ لا قيود بأكواد قديمة
- ✅ income-statement: 27,081 ر.س
- ✅ تحليلات راكان: 153 ر.س

### Journal Entry UUID Bug Fix (25 Apr 2026)
- `_build_operation_journal_entry`: UUID لا يُستخدم كـ revenue code → يُستخدم 026 بدلاً منه
- تقرير اختبار: `/app/test_reports/iteration_166.json` — 32/32 PASS

### Sidebar UX Overhaul (25 Apr 2026)
- جميع المجموعات تبدأ مطوية + scroll تلقائي عند الفتح

### Rakan Analytics Fix (25 Apr 2026)
- `_is_rakan_operation` يفحص `items` داخل العملية → اكتشاف قطع راكان من ملف المركبة

### RakanLinkedPartPicker Cleanup (25 Apr 2026)
- إزالة العنوان والتحذير من المكوّن + إزالة سجل الموردين من ملف المركبة

---

## Legacy → New Code Mapping (المرجع)
| Legacy | جديد | الاسم |
|--------|------|-------|
| 1101 | 003 | النقد |
| 1102 | 004 | البنك |
| 1103 | 005 | العملاء |
| 1104 | 006 | نقاط بيع |
| 4000 | 025 | الإيرادات |
| 4100 | 026 | إيرادات الخدمات |
| 5000 | 030 | تكلفة الخدمات |
| 6000 | 035 | المصروفات التشغيلية |
| 6100 | 036 | مصروفات عامة وإدارية |
| 6101 | 037 | رواتب إدارية |

---

## Prioritized Backlog

### P1 (Next)
- إكمال Auto-Linking + Contradiction Engine + Escalation Workflow لبوت المدقق المالي

### P2
- OCR / التحقق من المستندات المرفوعة في البوت المالي

### Refactoring
- تنظيف `server.py` ونقل `/suppliers` لملف مستقل

## Key API Endpoints
- `GET /api/finance/reports/income-statement`
- `GET /api/suppliers`
- `GET /api/accounts/tree`
- `GET /api/inventory/rakan-analytics`
- `POST /api/finance/reports/migrate-legacy-codes`
