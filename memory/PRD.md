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

### Preview Visibility + Smart Accounting UI Verification (10 May 2026)

**ما تم في هذه الجولة:**
1. **ربط SmartAccountSelect فعلياً داخل صفحة العمليات** (`Operations.jsx`):
   - استبدال حقل الحساب التقليدي بمكوّن `SmartAccountSelect`.
   - إظهار تلميح واضح بأن آخر 3 حسابات مستخدمة تُعرض أولاً.
   - تم التحقق بصرياً وبتقرير اختبار أن العنصر يظهر في تبويب **الربط**.

2. **تحسين منطق خيارات الدفع في `ConfirmPaymentDialog.jsx`:**
   - طرق الدفع الأساسية أصبحت: `bank`, `cash`, `pos`.
   - خيار `supplier_balance` يظهر فقط عند توفر شرطين معًا:
     - `allowSupplierBalance=true`
     - `supplierId` موجود.

3. **ربط سداد رصيد المورد من زيارة المركبة** (`VehicleDetails.jsx`):
   - استخراج الموردين من بنود الزيارة (itemType='supplier').
   - تفعيل السداد من رصيد المورد فقط عند وجود **مورد واحد** في الزيارة.
   - عند تعدد الموردين، يظهر تنبيه واجهة يوضح تعطيل الخيار حتى لا يحدث التباس.
   - إضافة استدعاء backend إلى:
     - `POST /api/smart-accounting/supplier-balance-payment`

4. **اختبار واجهة شامل عبر testing agent:**
   - التقرير: `/app/test_reports/iteration_168.json`
   - النتيجة: **Frontend 100% PASS**
   - لا توجد Bugs أو Action Items مفتوحة في الجولة الحالية.

### Journal Entry Create Form: SmartAccountSelect + Context Filtering (10 May 2026)

**تحديثات صفحة إنشاء القيد (`JournalEntries.jsx`):**
1. استبدال اختيار الحساب التقليدي داخل بنود القيد بمكوّن `SmartAccountSelect` لكل سطر.
2. تطبيق فلترة ذكية للحسابات حسب:
   - نوع الحركة (`sale` / `purchase` / `expense`)
   - جهة السطر (`debit` أو `credit`)
3. إضافة حقل طرف ديناميكي `entry-party-name-input`:
   - عند `sale` يظهر كـ **العميل**
   - عند `purchase/expense` يظهر كـ **المورد**
4. عند الحفظ يتم تطبيع الوصف وإضافة وسوم الطرف:
   - `[PARTY:...]`
   - `[PARTY_TYPE:customer|supplier|open]`

**الاختبار:**
- تقرير الاختبار: `/app/test_reports/iteration_169.json`
- النتيجة: **Frontend 100% PASS**
- جميع data-testid المطلوبة موجودة وتعمل.

### SmartAccountSelect Upgrade (Based on user-provided script) — 10 May 2026

**تمت ترقية المكوّن `SmartAccountSelect.jsx` ليشمل المنطق الذكي المتقدم:**
1. دعم Props أوسع ومتوافق مع القديم:
   - `entryType/lineType/description`
   - مع الإبقاء على `operationType/fieldKey` لضمان عدم كسر الصفحات الحالية.
2. فلترة حسب نوع الحركة + اتجاه السطر + البحث بالنص (اسم/كود).
3. ترتيب النتائج داخل أقسام UX واضحة:
   - `مقترح من الوصف`
   - `المفضلة`
   - `الأخيرة`
   - `كل الحسابات المتاحة`
4. إضافة keywords suggestions من الوصف (مثل: إيجار/رواتب/صيانة/تحصيل…).
5. إضافة `data-testid` تفصيلية لعناصر القائمة الذكية (dropdown/search/sections/options).

**التحقق بعد الترقية:**
- تقرير الاختبار: `/app/test_reports/iteration_170.json`
- النتيجة: **Frontend 100% PASS**
- تم التحقق من:
  - ظهور خيارات الحسابات (187 خيار في اختبار line-account-0)
  - وجود البحث داخل القائمة
  - استمرار عمل الفلترة الطرفية (عميل/مورد)
  - عدم وجود Regression في صفحة العمليات.

### Supplier-Balance Payment Restore + Operation Duplicate Guard (10 May 2026)

**1) استعادة ميزة السداد عبر رصيد المورد في ConfirmPaymentDialog**
- إعادة إظهار خيار `supplier_balance` في نافذة تأكيد السداد.
- عند عدم توفر `supplierId` مسبقاً، أصبح يمكن اختيار المورد مباشرة داخل النافذة.
- تمرير `supplierId` المختار إلى callbacks لجميع المسارات (Operations / Debt / Vehicle).

**2) ربط السداد عبر رصيد المورد بسجل حركة المورد**
- إضافة endpoint جديد:
  - `POST /api/smart-accounting/operations/{op_id}/confirm-via-supplier-balance`
- هذا المسار يقوم بـ:
  - إنشاء حركة سداد من رصيد المورد (`supplier_balance_payment` journal source)
  - تحديث حالة العملية إلى `paid/partial` حسب المتبقي.
- تحسين robustness في `supplier_balance_payment`:
  - تحقق صريح من `supplier_id` (بدلاً من 500)
  - معالجة بيئات لا تحتوي جدول `suppliers` بدون كسر endpoint.

**3) تعزيز منع تكرار العمليات قبل الحفظ**
- تطوير منطق كشف التكرار في `Operations.jsx` ليقارن أكثر من إشارة:
  - النوع + المبلغ + الشريك + اللوحة + التاريخ + الفاتورة + توقيع البنود
- إضافة استثناء ذكي: **نفس العميل مع لوحة مختلفة** لا يُعتبر تكراراً مباشراً.
- عند الاشتباه، يظهر prompt تأكيد واضح قبل متابعة الحفظ.

**الاختبار والتحقق**
- تم تشغيل اختبارات backend المضافة:
  - `pytest -q /app/backend/tests/test_supplier_balance_payment_iter171.py -q`
  - النتيجة: PASS (مع warnings فقط داخل ملف الاختبار نفسه).
- تم إصلاح خطأ 500 الذي ظهر أثناء اختبار endpoint الجديد.

### Operation Type/Payment Mapping Hardening + Flow Consistency (10 May 2026)

**استجابة لطلب مطابقة المسميات والربط المحاسبي الكامل:**

1. **تحديث أنواع الحركة في واجهة العمليات**
   - إضافة/تأكيد الأنواع التالية في `OPERATION_TYPE_OPTIONS`:
     - شراء
     - بيع
     - سند قبض (مركبة)
     - تسوية (عميل/مورد)
     - مرتجع بيع
   - الإبقاء على الأنواع الإضافية المطلوبة تشغيلياً (مرتجع شراء/سداد مستحقات/مصروف نقدي).

2. **إزالة خيار محفظة نهائياً من تبويب الربط/الدفع**
   - `PAYMENT_METHOD_OPTIONS` أصبحت: `cash`, `card`, `transfer`, `credit` فقط.
   - تم التأكد أيضاً أن `ConfirmPaymentDialog` لا يحتوي أي خيار Wallet.

3. **تشديد قواعد الربط (Frontend + Backend)**
   - بيع/مرتجع بيع: يجب ربط العملية بمركبة أو عميل.
   - شراء/مرتجع شراء: يجب تحديد مورد.
   - سند قبض (`receipt_voucher`): يجب ربط العملية بمركبة.
   - تسوية (`settlement`): يجب ربطها بعميل أو مورد.
   - تم تنفيذ نفس القواعد في backend داخل `create_operation` لمنع أي تجاوز حتى لو تم الالتفاف على الواجهة.

4. **توحيد الربط المحاسبي لطريقة الدفع**
   - تم تحديث التوجيه المحاسبي بحيث `card` → حساب POS (`006`) وليس البنك.
   - في `payment_order` مع عميل: تم تصحيح حساب الذمم المدينة إلى `005` بدلاً من الكود القديم `1103`.

5. **تحسين فلترة الحسابات في تبويب الربط**
   - `SmartAccountSelect` في العمليات أصبح `includeAll=false` لإظهار الحسابات ذات الصلة فقط بنوع الحركة/جهة القيد.

**نتيجة الاختبار (Testing Agent):**
- التقرير: `/app/test_reports/iteration_171.json`
- Backend: **100% (14/14 PASS)**
- Frontend: **100% PASS**
- تم التحقق صراحةً من غياب Wallet وصحة قواعد الربط المذكورة.

### Sub-screens Alignment + Journal Explanation Screen (10 May 2026)

**1) توحيد قواعد الربط في شاشة القيود اليدوية (`JournalEntries`)**
- إضافة أنواع الحركة الفرعية المتوافقة مع نفس منطق العمليات:
  - `receipt_voucher` = سند قبض (مرتبط بمركبة)
  - `settlement` = تسوية (عميل/مورد)
- إضافة حقل `entry-vehicle-reference-input` (مرجع المركبة).
- إضافة validation في القيود اليدوية:
  - بيع/مرتجع بيع → يتطلب عميل أو مرجع مركبة.
  - سند قبض → يتطلب مرجع مركبة.
  - تسوية → تتطلب طرف (عميل/مورد) ونوع طرف صحيح.
- دعم toggle واضح في التسوية لاختيار عميل/مورد.

**2) إضافة شاشة/بطاقة "تفسير القيد" داخل صفحة العمليات**
- إضافة بطاقة `operation-journal-explanation-card` في خطوات إنشاء العملية.
- البطاقة تعرض:
  - سطور مدين/دائن المتوقعة
  - كود الحساب المتوقع لكل طرف
  - سبب الاختيار (reasoning) حسب نوع الحركة وطريقة الدفع.

**نتائج الاختبار:**
- تقرير: `/app/test_reports/iteration_172.json`
- Frontend: **100% PASS**
- تم التحقق من وجود الأنواع الجديدة، مرجع المركبة، قواعد التحقق، وبطاقة تفسير القيد، واستمرار غياب خيار Wallet.

### JournalEntries Liquid System UI Upgrade (10 May 2026)

**طلب المستخدم:** تحويل صفحة **دفتر اليومية** إلى أسلوب Liquid مع الحفاظ الكامل على الوظائف.

**ما تم تنفيذه في `JournalEntries.jsx`:**
1. إعادة تصميم بصري Liquid للصفحة كاملة:
   - خلفية متعددة الطبقات (radial gradients)
   - عناصر orb ضوئية خفيفة
   - بطاقات زجاجية (glass) مع borders ولمعان داخلي
2. تحسين البطاقات الرئيسية:
   - Header card
   - AI assistant card
   - Stat cards
   - Filters card
   - Journal entries table card
3. الحفاظ على كل الوظائف والـ data-testid بدون كسر:
   - فتح مودال قيد جديد
   - البحث والفلاتر
   - الأزرار التشغيلية (تحديث/حذف الكل مع إبقاء الذمم)

**نتائج الاختبار:**
- تقرير: `/app/test_reports/iteration_173.json`
- Frontend: **100% PASS**
- لا توجد مشاكل UI/Integration/Design في التقرير.

### P1: Auto-Linking + Contradiction Engine + Escalation Workflow (26 Apr 2026)

**3 محركات جديدة في `routes_finance_bot.py`:**

1. **Auto-Linking Engine** (`_auto_link_finding`):
   - عند `open_investigation` يجلب تلقائياً القيود المحاسبية المرتبطة بالحساب/المبلغ (هامش ±10%)
   - يجلب العمليات المرتبطة زمنياً
   - يُعيد `{journal_entries, operations, accounts_involved, summary_text}`
   - endpoint: `POST /api/finance-bot/auto-link`

2. **Contradiction Engine** (`_detect_contradictions`):
   - فحص 1: إيراد الملاحظة vs. قائمة الدخل الفعلية (score threshold 15%)
   - فحص 2: تناقضات داخلية بين findings على نفس الحساب
   - فحص 3: وصف يذكر مبالغ لكن القيمة المسجّلة صفر
   - endpoint: `POST /api/finance-bot/detect-contradictions`

3. **Escalation Workflow** (`_build_escalation_report`):
   - Auto-Escalation: بعد 6 جولات probing بدون حل على finding بخطورة high/critical
   - تقرير تصعيد كامل: finding details + توضيح المستخدم + التناقضات + الأدلة
   - endpoint: `GET /api/finance-bot/sessions/{session_id}/report`

**Frontend (`AbuFahadFloatingChat.jsx`):**
- عرض `contradictions` المكتشفة (amber panel)
- عرض `linked_data` القيود المرتبطة (sky panel)
- زر "تقرير التصعيد الكامل" عند `state=escalated`

**النتائج المؤكدة:**
- Auto-link: 3 قيود مرتبطة لحساب 005 ✅
- Contradiction: كشف revenue_mismatch (50000 vs 27081) بخطورة high ✅
- Auto-Escalation: يُفعَّل في الجولة السادسة بالضبط ✅
- Escalation Report: تقرير كامل مع التوصية ✅

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
