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

### Centralizing Financial Statements (11 May 2026)

**طلب المستخدم:** إزالة القوائم المالية من صفحة المساعد المالي (تبويب التحليل المالي)، واعتماد القوائم الرئيسية فقط في صفحة القوائم المالية بالقسم المالي.

**ما تم تنفيذه في `AIFinancial.jsx`:**
1. إزالة قسم قائمة **ميزان المراجعة التفصيلي** من تبويب التحليل المالي.
2. إضافة بطاقة توضيحية تؤكد أن القوائم المالية أصبحت مركزية في صفحة القسم المالي.
3. إضافة زر مباشر للانتقال إلى صفحة القوائم المالية:
   - `data-testid="assistant-go-financial-statements-button"`
   - الوجهة: `/accounting/comprehensive`
4. إضافة معرف اختبار للرسالة التوضيحية:
   - `data-testid="assistant-financial-statements-centralized-note"`

**التحقق:**
- Frontend test agent: ✅ جميع النقاط PASS
  - ظهور الرسالة التوضيحية
  - ظهور زر الانتقال
  - اختفاء `trial-balance-count`
  - نجاح الانتقال إلى `/accounting/comprehensive`

### P0 Fix — Journal Entries Crash After Data Cleanup (11 May 2026)

**المشكلة:** انهيار React في صفحة دفتر اليومية `/accounting/journal-entries` بعد حذف بيانات اختبار.

**الإصلاح المنفذ:**
1. **`JournalEntries.jsx`**
   - إضافة طبقة `null-safe` عند قراءة API (تطبيع `entries` و `lines` قبل الاستخدام).
   - منع أي crash ناتج عن عناصر `null` أو هياكل بيانات ناقصة.
   - تحصين الطباعة وتفاصيل القيد ضد `lines` غير الصالحة.
2. **`SmartAccountSelect.jsx`**
   - تطبيع آمن للحسابات الواردة من `allAccounts` أو API.
   - منع crash عند وجود عناصر حسابات ناقصة/فارغة.

**التحقق والاختبار:**
- Lint: ✅ بدون أخطاء لملفي الواجهة المعدلين.
- Testing Agent: `/app/test_reports/iteration_186.json`
  - Frontend: **100% PASS**
  - لا `Script error` ولا `handleError` في Console.
  - فتح المودال + SmartAccountSelect يعملان بدون انهيار.

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

### Mobile UX Fix — Journal Entry Account Names & Overflow (10 May 2026)

**مشكلة المستخدم:** في شاشة إنشاء قيد على الجوال، أسماء الحسابات/الكود غير واضحة والحجم كبير، مع overflow أفقي.

**الإصلاحات المنفذة:**
1. `SmartAccountSelect.jsx`
   - إضافة `compact` mode.
   - تحسين عرض النص ليكون:
     - `[code] name` عند توفر الاسم
     - `[code]` كـ fallback عند غياب الاسم
   - تحسين truncate/width لقراءة أفضل على الجوال.

2. `JournalEntries.jsx`
   - إضافة layout موبايل مستقل لبنود القيد (`entry-lines-mobile-list`) على شكل cards.
   - إخفاء جدول الديسكتوب على الجوال (`hidden md:table`).
   - إبقاء إدخال المدين/الدائن واضحاً ضمن شبكة 2 عمود في الجوال.

**نتيجة الاختبار:**
- تقرير: `/app/test_reports/iteration_175.json`
- Frontend: **100% PASS**
- تم إصلاح overflow بالكامل: من ~12px إلى **0px** على viewport 390x844.

### Debit/Credit Color Safety + Account Dropdown Stability (10 May 2026)

**طلبات المستخدم المنفذة:**
1. تمييز بصري واضح لتجنب خطأ القيد:
   - عند اختيار حساب:
     - حقل **مدين** يظهر بخلفية/حدود خضراء.
     - حقل **دائن** يظهر بخلفية/حدود حمراء.
   - إضافة Legend ثابت داخل المودال:
     - `مدين = أخضر`
     - `دائن = أحمر`

2. إصلاح ظهور قائمة الحسابات السفلية:
   - ربط مباشر بـ `coaAccounts` داخل JournalEntries.
   - إضافة fallback قوي داخل `SmartAccountSelect` (`CORE_FALLBACK_ACCOUNTS`) عند بطء/فشل التحميل حتى لا تظهر القائمة فارغة.

**الاختبار:**
- تقرير: `/app/test_reports/iteration_176.json`
- Frontend: **100% PASS**
- تم التحقق من:
  - التلوين الأحمر/الأخضر يعمل حسب اختيار الحساب.
  - القائمة لم تعد فارغة (ظهور 187 خيار في الاختبار).
  - الجوال والديسكتوب يعملان بشكل صحيح.

### Linkage Integrity Layer (Vehicle File ↔ Operations ↔ Journal) — 10 May 2026

**أين يوضع كشف الربط؟ (تم التنفيذ):**
1. **صفحة العمليات**
   - بطاقة ملخص: `operations-integrity-summary-card`
   - داخل كل بطاقة عملية: شارة حالة الربط + تفاصيل التحذيرات عند التوسيع.
2. **ملف المركبة (تبويب الزيارات)**
   - بطاقة ملخص ربط: `vehicle-linkage-summary-card`
   - قائمة مشاكل الربط: `vehicle-linkage-issues-list` (عند وجود أخطاء).
3. **دفتر اليومية**
   - حالة الربط لكل قيد في العرضين (جوال/ديسكتوب):
     - `entry-card-linkage-{id}`
     - `entry-row-linkage-{id}`

**Backend جديد:**
- `POST /api/operations/integrity/check`
  - يدقق العلاقة بين: العملية، المركبة/الزيارة، وقيد اليومية (reference_id).
  - يعيد `items + summary` مع تحذيرات مثل:
    - `missing_journal_entry`
    - `visit_vehicle_mismatch`
    - `potential_duplicate`

**التكرار (Duplicate) والتحذيرات:**
- تم دعم مؤشر تكرار محتمل ضمن endpoint ويظهر في ملخص العمليات.
- تم إصلاح ملاحظة اختبارية مرتبطة بـ `workshop_id` في Supabase داخل endpoint.

**الاختبار:**
- تقرير: `/app/test_reports/iteration_177.json`
- Backend: **PASS 100%**
- Frontend: تم التحقق من ظهور مكونات العمليات بالكامل، وباقي العناصر مثبتة في الكود مع data-testid.

### Interpretive Rule Update (دخل/خرج) — 10 May 2026

**طلب المستخدم:**
- "الذي دخل لك = مدين"
- "الذي خرج منك = دائن"
- تطبيق القاعدة في صفحة إنشاء قيد وتحديث بلوك تفسير القيد في العمليات.

**ما تم تنفيذه:**
1. **Operations.jsx**
   - تحديث `operation-journal-explanation-card` لإظهار القاعدتين النصيتين بشكل ثابت.
   - سطور المعاينة أصبحت تعرض: `side + account + flow` حيث flow = `دخل لك / خرج منك`.
   - تحسين الصياغة التفسيرية خصوصاً في الشراء:
     - المشتريات = مدين
     - الصندوق/البنك أو الذمم = دائن

2. **JournalEntries.jsx (Modal إنشاء قيد)**
   - إضافة بطاقة جديدة `entry-explanation-rule-card` داخل نموذج الإنشاء.
   - تعرض:
     - القاعدتين النصيتين
     - سطر مدين وسطر دائن مع الحساب الملتقط من مدخلات المستخدم.

3. **إصلاح تحذير منخفض من الاختبار**
   - تمت معالجة ملاحظة `Maximum update depth exceeded` في `Operations.jsx` عبر تثبيت dependency الفحص إلى `activeOpsIdsKey` بدلاً من الكائنات المباشرة.

**الاختبار:**
- تقرير: `/app/test_reports/iteration_178.json`
- النتيجة: Frontend **PASS 100%**
- تمت مراجعة logs بعد الإصلاح، ولم يعد يظهر تحذير Maximum update depth.

### Unified Bot Update — Merge Auditor into Quick + Create Linking Enhancements (10 May 2026)

**تنفيذ طلب المستخدم (B):**
1. **دمج تبويب المدقق مع فوري**
   - التبويبات أصبحت 3 فقط:
     - `المساعد`
     - `إنشاء`
     - `فوري`
   - تبويب `فوري` الآن مدمج:
     - Quick action panel (تسجيل فوري)
     - رسائل/أوامر التدقيق المالي في نفس التبويب.

2. **تحسين تبويب إنشاء (ربط وتوافق)**
   - تحسين payload الإنشاء للتوافق مع الصفحات المرتبطة:
     - `originalType`
     - `vehicleId / vehicleInfo`
     - `notes` مع tag: `BOT_TEMPLATE`
   - إضافة validation أقوى للربط:
     - بيع يتطلب عميل/مركبة
     - شراء يتطلب مورد

3. **كروت أنواع العملية تعرض آخر العمليات**
   - كل كرت قالب يعرض `آخر X عمليات`.
   - عند اختيار القالب يظهر block `template-recent-operations-list`:
     - قائمة آخر العمليات لنفس النوع (قابلة للنقر لتعبئة الحقول)
     - أو رسالة: `لا توجد عمليات سابقة لهذا النوع بعد.`

**الاختبار:**
- تقرير: `/app/test_reports/iteration_179.json`
- Frontend: **100% PASS**
- تم التحقق من:
  - اختفاء تبويب المدقق المنفصل
  - عمل الدمج داخل فوري
  - ظهور عدادات وآخر العمليات في كروت الإنشاء
  - عدم وجود Regression في الإنشاء.

### NLP Page Assistant (Rule-based) داخل المساعد الموحد — 10 May 2026

**طلب المستخدم:**
- Page Assistant ذكي يقرأ الصفحة الحالية وحقولها.
- يقترح تصحيحًا ويطبقه فقط بعد موافقة المستخدم.
- النطاق: كل الصفحات المالية (C).
- منطق النسخة الأولى: Rule-based (A).
- واجهة الاقتراحات مدمجة داخل المساعد الموحد.

**ما تم تنفيذه:**
1. **Backend (FastAPI)**
   - إضافة ملف: `routes_nlp_page_assistant.py`
   - Endpoints:
     - `POST /api/nlp/page/context`
     - `POST /api/nlp/page/apply_correction`
   - محرك قواعد Rule-based + تعلم بسيط من:
     - approved_entries
     - corrected_entries
     - rejected_entries
   - أمثلة قواعد مفعلة:
     - card + account 004 ⇒ اقتراح 006
     - sale بدون ربط عميل/مركبة ⇒ اقتراح ربط
     - journal line فيها debit+credit معًا ⇒ اقتراح تصحيح

2. **Frontend (UnifiedBotWidget)**
   - مراقبة تغيّر أي `input/select/textarea` في الصفحات المالية.
   - إرسال page context تلقائيًا إلى endpoint مع debounce.
   - عرض `page-suggestion-box` داخل البوت نفسه (apply / ignore).
   - عند Apply: استدعاء endpoint التطبيق + محاولة تعبئة الحقول المصححة في الواجهة.

3. **تكامل عام**
   - تضمين Router الجديد في `server.py`.
   - الحفاظ على عمل تبويبات البوت الثلاثة (المساعد، إنشاء، فوري) دون كسر.

**الاختبار:**
- تقرير: `/app/test_reports/iteration_180.json`
- Backend: **100% (10/10)**
- Frontend: **100%**
- ملفات الاختبار الناتجة:
  - `/app/backend/tests/test_nlp_page_assistant.py`
  - `/app/test_reports/pytest/pytest_nlp_page_assistant_iter180.xml`

### Floating Bot Open/Visibility Fix (All Pages) — 10 May 2026

**المشكلة:**
- المستخدم أبلغ أن البوت العائم لا يفتح عند الضغط عليه في كل الصفحات.

**الإصلاح:**
1. في `UnifiedBotWidget.jsx`:
   - استبدال toggle بفتح صريح عبر `forceOpenBotPanel`.
   - رفع طبقات العرض:
     - trigger z-index = `2147483000`
     - panel z-index = `2147482999`
   - الحفاظ على الإغلاق من زر `unified-bot-close` داخل النافذة.

**التحقق:**
- تقرير: `/app/test_reports/iteration_181.json`
- Frontend: **100% (12/12)** عبر 3 صفحات:
  - operations
  - accounting/journal-entries
  - suppliers
- النتيجة: **FIXED** (الزر يظهر والنافذة تفتح بشكل صحيح).

### Mobile Chat Panel Layout Fix (Unified Bot) — 10 May 2026

**مشكلة المستخدم:**
- الزر صحيح، لكن نافذة المحادثة لا تظهر بشكل صحيح على الجوال.
- المطلوب: الجوال صحيح + سطح المكتب بالأسفل لليسار.

**الإصلاح المنفذ في `UnifiedBotWidget.jsx`:**
1. تثبيت تموضع النافذة كـ `fixed` فعلياً (إزالة تعارض `relative` الذي كان يفسد القياسات).
2. تحسين أبعاد الجوال:
   - عرض: `92vw`
   - max-width: `420px`
   - تموضع: `left-3` + bottom مع safe-area.
3. الحفاظ على تموضع الديسكتوب بالأسفل لليسار:
   - `lg:left-6` + `lg:bottom-20`.
4. الحفاظ على z-index عالي جدًا لضمان الظهور فوق كل عناصر الصفحة.

**نتيجة الاختبار (وكيل الاختبار):**
- Mobile 390x844: PASS (النافذة كاملة داخل الشاشة وبدون قص).
- Desktop 1920x1080: PASS (النافذة أسفل يسار كما طُلب).
- Close button + Tabs + z-index: PASS.

### Mobile Chat Input Overlap Fix (Unified Bot) — 10 May 2026

**مشكلة جديدة من المستخدم:**
- الدردشة لا تعمل على الجوال لأن زر البوت العائم كان يغطي خانة إدخال الرسائل.

**الإصلاح المطبق:**
1. إخفاء زر البوت العائم عند فتح النافذة:
   - تطبيق شرط render: `!open && (...)` على `unified-bot-trigger`.
2. التأكد من إمكانية الإغلاق وإعادة الظهور:
   - زر `unified-bot-close` داخل النافذة يغلق panel.
   - trigger يعود للظهور بعد الإغلاق.
3. تحسين قابلية الاختبار:
   - إضافة `data-testid="unified-bot-close"`.

**الاختبار:**
- تقرير: `/app/test_reports/iteration_182.json`
- Frontend: **100% (5/5)**
- النتيجة: **FIXED**
  - trigger يختفي عند فتح panel
  - input قابل للكتابة والإرسال على الجوال
  - لا توجد Regression على الديسكتوب.

### Create-Intent Response Fix (No More "هات تقرير/كشف") — 10 May 2026

**مشكلة المستخدم:**
- عند كتابة أمر إنشاء عملية باللهجة العربية، كان البوت يرد برد خاطئ من نوع:
  - "هات تقرير/كشف..."

**المطلوب:**
- نمط B:
  - عرض **ملخص قبل التنفيذ**
  - إظهار **النواقص**
  - منع أسئلة "تقرير/كشف" في أوامر الإنشاء.

**الإصلاح المطبق في `UnifiedBotWidget.jsx`:**
1. إضافة `parseCreateIntent` مع تطبيع عربي (`normalizeArabicText`) لالتقاط الصيغ:
   - انشى / انشي / سجل / سوي ...
2. معالجة أوامر الإنشاء محلياً (بدون المرور لردود LLM العامة).
3. استخراج ذكي:
   - نوع العملية (بيع قطع/شراء/رواتب/مصروف...)
   - الطرف (بعد "على ...")
   - المبلغ (إن وجد)
4. إظهار `create-result` يحتوي:
   - 🧾 ملخص قبل التنفيذ
   - ⚠️ النواقص (مثال: المبلغ)

**الاختبار:**
- تقرير: `/app/test_reports/iteration_183.json`
- Frontend: **100%**
- النتيجة: **FIXED**
  - لا توجد عبارات تقرير/كشف في أوامر الإنشاء
  - القالب المناسب يتحدد (مثال: بيع قطع)
  - النواقص تظهر كما طُلب.

### Interactive Draft Cards for Create Commands (10 May 2026)

**طلب المستخدم:**
- ردود البوت تكون تفاعلية عند أوامر الإنشاء.
- النواقص/المعاينة تظهر كروت قابلة للنقر.
- عند وجود عميل بدون مركبة محددة:
  - عرض المركبات المسجلة بنفس الاسم
  - أو خيار إضافة مركبة جديدة.

**ما تم تنفيذه في `UnifiedBotWidget.jsx`:**
1. إضافة حالة `interactiveDraft`.
2. عند أمر مثل:
   - `انشى عمليه بيع قطعه قلب هاي من قطع راكان على ماجد العنزي`
   - يتم:
     - التحويل تلقائيًا لتبويب `إنشاء`
     - عرض `interactive-draft-cards`
3. محتوى الكروت التفاعلية:
   - كرت النوع
   - كرت الطرف
   - كرت المبلغ
   - شرائح النواقص القابلة للنقر (chips)
4. ربط المركبات:
   - `findVehiclesForPartner` يبحث في المركبات بالاسم المطبع.
   - عرض قائمة مركبات مطابقة أو رسالة عدم وجود.
   - زر `+ إضافة مركبة جديدة`.
5. أزرار إجراءات مباشرة:
   - `تأكيد الآن`
   - `تعديل الحقول`
   - `إلغاء`

**الاختبار:**
- تقرير: `/app/test_reports/iteration_184.json`
- Frontend: **100% (all 6 scenarios passed)**
- تم التحقق من:
  - ظهور كل الكروت التفاعلية المطلوبة
  - استخراج اسم العميل من النص
  - منع ردود "تقرير/كشف"
  - ظهور قسم المركبات وزر الإضافة الجديدة.

### Test Data Cleanup + Full Pages Smoke Test (10 May 2026)

**طلب المستخدم:**
- حذف جميع البيانات الاختبارية/التجريبية، بما يشمل: الحسابات، الخدمات، القطع، وباقي الجداول.
- ثم اختبار كل الصفحات.

**التنظيف المنفذ (Supabase):**
- تم حذف البيانات التي تطابق كلمات تجريبية مثل:
  - test/demo/dummy/sample/qa
  - اختبار/تجريبي
  - BOT_TEMPLATE / BOT_CREATE

**نتيجة التنظيف (counts):**
- `vehicle_visits`: deleted 34
- `operations`: deleted 13
- `journal_entries`: deleted 4
- `customers`: deleted 6
- `services`: 0 matched
- `parts`: 0 matched
- `accounts`: 0 matched
- `vehicles`: 0 matched
- `suppliers`: جدول غير موجود في schema الحالي (PGRST205)

**اختبار شامل بعد التنظيف:**
- تقرير: `/app/test_reports/iteration_185.json`
- Frontend smoke/integration: **100% PASS**
- الصفحات المختبرة: operations, vehicle details, suppliers, debts follow-up, journal entries, inventory, vehicles
- Unified Bot: PASS على كل التبويبات والفتح/الإغلاق.

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
- تنظيف بيانات الاختبار المتبقية بأسماء جداول Supabase الصحيحة (بدون كسر القيود).
- Auto-map لعبارة «من قطع راكان» إلى الحساب `042` داخل بطاقات إنشاء Unified Bot.

### P2
- OCR / التحقق من المستندات المرفوعة في البوت المالي.

### Refactoring
- تفكيك `server.py` و`routes_extended.py` إلى Routers أصغر (vehicle / nlp / suppliers / bot domains).

## Key API Endpoints
- `GET /api/finance/reports/income-statement`
- `GET /api/suppliers`
- `GET /api/accounts/tree`
- `GET /api/inventory/rakan-analytics`
- `POST /api/finance/reports/migrate-legacy-codes`
