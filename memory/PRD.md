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

### نقل أدوات التحكم بالعرض إلى صفحة الإعدادات (11 Mar 2026)
- إزالة dock العائم الخاص بحجم الخط وإظهار/إخفاء القائمة الجانبية لمنع تغطية الأزرار.
- إضافة قسم جديد في الإعدادات للتحكم بحجم الخط ورؤية/حجم القائمة الجانبية مع تحديث فوري للحالة.
- إضافة أزرار تحكم واضحة في الإعدادات مع معرفات اختبار (data-testid) كاملة وموحّدة على مستوى الصفحة لمنع أي تداخل بصري.
- إزالة أزرار التصغير/الإخفاء من رأس القائمة الجانبية لتوحيد التحكم داخل الإعدادات.
- الحفاظ على زر فتح القائمة في الهيدر على الجوال بدون تداخل مع المحتوى (بدون Dock عائم على الشاشة نهائياً).

### إصلاح عاجل لانهيار Frontend Build + Runtime (01 Mar 2026)
- معالجة سبب الانهيار المرتبط بـ `resolveBackendBase` وتوحيد الاستيراد في صفحة المخزون لاستخدام `utils/backendBase` مباشرة.
- التحقق من نجاح البناء الإنتاجي (`yarn build`) بدون أي `SyntaxError` في صفحات الضرائب/دليل الحسابات/القيود.
- التحقق عبر وكيل الاختبار: اختفاء خطأ `resolveBackendBase is not a function` ونجاح تحميل التطبيق وصفحة `/parts`.

### Smart Inventory System + Parts Control Panel (01 Mar 2026)
- إنشاء بنية Backend جديدة للمخزون الذكي عبر ملفات مستقلة: `smart_inventory_models.py` + `smart_inventory_service.py` + `routes_smart_inventory.py`.
- إضافة APIs جديدة: `GET /api/inventory/dashboard` و`GET /api/inventory/alerts` و`GET /api/inventory/control-panel` و`GET/POST/PATCH /api/inventory/backorders`.
- دمج لوحة Snapshot + مركز التنبيهات الذكي داخل `PartsInventory.jsx` عبر مكوّنات منفصلة قابلة لإعادة الاستخدام.
- إعادة بناء `PartsDashboard.jsx` إلى **Parts Control Panel** مع تحليلات الفئات، أعلى المبيعات، تحذير الهوامش، سجل عمليات القطع، وإدارة backorders كاملة.
- التحقق بالاختبار: `/app/test_reports/iteration_13.json` (نجاح backend/frontend بنسبة 100%).

### تحسين الأداء + تقسيم مكونات المخزون (01 Mar 2026)
- تفكيك `PartsInventory.jsx` إلى مكونات مستقلة: `InventoryStatsCards`, `InventoryFiltersPanel`, `PartInventoryGrid`, `PartsOcrPanel`, `PartsTransactionModal`.
- تحسين الأداء عبر `useMemo` و`useDeferredValue` لتقليل إعادة الحسابات أثناء البحث/الفلترة.
- إزالة طلبات الشبكة المكررة عند فتح نافذة العمليات (POS) لتسريع الاستجابة.
- التحقق عبر الاختبار: `/app/test_reports/iteration_14.json` (Frontend 100% بدون regressions).

### تحسين إضافة الحسابات في دليل الحسابات (02 Mar 2026)
- إضافة API جديدة: `POST /api/finance/chart-of-accounts` لدعم إنشاء حسابات جديدة مع جميع الأنواع (`asset`, `liability`, `equity`, `revenue`, `expense`).
- تحديث صفحة `ChartOfAccounts.jsx` لربط مودال الإضافة بالـ API فعلياً بدل الإضافة المحلية فقط.
- حفظ الحساب الآن يتم فعلياً مع منع تكرار `code` ورسائل خطأ واضحة، مع تحديث القائمة فوراً بدون إعادة تحميل الصفحة.
- دعم اختيار النوع لجميع الأنواع الخمسة من الواجهة مع إبقاء النوع اختياري (default = `asset`).
- التحقق عبر الاختبار: `/app/test_reports/iteration_15.json` (Backend/Frontend 100%).

### تنظيف بيانات اختبار دليل الحسابات (02 Mar 2026)
- تنفيذ تنظيف آمن لبيانات الاختبار التي أُنشئت أثناء الاختبارات (`TEST_*` + حسابات الاختبار اليدوية).
- حذف 17 حسابًا تجريبيًا عبر API الحذف `/api/accounts/{id}`.
- التحقق بعد التنظيف: لا توجد حسابات اختبار متبقية في `GET /api/finance/chart-of-accounts`.

### إضافة تعديل الحساب + حفظ تلقائي ذكي (02 Mar 2026)
- إضافة Edit modal كامل في `ChartOfAccounts.jsx` لتعديل **كل الحقول**: `code`, `name`, `type`, `parent`, `balance`.
- ربط التعديل مباشرة بـ `PUT /api/accounts/{id}` مع تحديث القائمة فورًا بعد الحفظ.
- إضافة fallback ذكي عند الخطأ/التكرار: محاولة مطابقة حساب قريب بالاسم+النوع أو بالكود ثم تحديثه تلقائيًا.
- إصلاح مشكلة parsing في استجابة التحديث (Response body used) ومنع إرسال `header-*` كـ `parentId` (تحويله إلى `null`).
- إزالة debug logs التجريبية من backend endpoint وتأكيد نجاح build والاختبار اليدوي (create→edit→verify→cleanup).

### Next Actions مكتملة: Toast + حذف + تعطيل/تفعيل بصلاحية المدير (08 Mar 2026)
- إضافة إشعارات `toast` لعمليات الإضافة/التعديل/الحذف/التفعيل-التعطيل في صفحة دليل الحسابات.
- إضافة إمكانيتي **تعطيل/تفعيل الحساب** و**حذف الحساب** من نفس الصف مع `data-testid` واضحة.
- تطبيق صلاحيات المدير فقط (`admin/manager`) عبر Header `x-user-role` في Backend لعمليات الحذف والتفعيل/التعطيل.
- إنشاء وتخزين status overrides بشكل مستقل عبر APIs:
  - `GET /api/accounts/status-overrides`
  - `PATCH /api/accounts/{id}/active`
  - تنظيف override تلقائيًا عند حذف الحساب.
- التحقق عبر الاختبار: `/app/test_reports/iteration_17.json` (Backend/Frontend 100%).

### إصلاح ChunkLoadError في صفحة المخزون /parts (08 Mar 2026)
- معالجة خطأ `Loading chunk src_pages_PartsInventory_jsx failed` و`Unexpected token '<'`.
- تحويل `PartsInventory` من lazy import إلى eager import في `App.js` لمنع الاعتماد على chunk ديناميكي لهذه الصفحة الحرجة.
- إضافة auto-recovery في `ErrorBoundary.jsx` لاكتشاف أخطاء chunk وإعادة تحميل الصفحة تلقائياً مرة واحدة (مع حماية من loop عبر `sessionStorage`).
- التحقق عبر الاختبار: `/app/test_reports/iteration_18.json` (Frontend 100%، بدون أخطاء chunk).

### فصل مالي لعمليات «قطع راكان» في نقطة البيع والعمليات (08 Mar 2026)
- تحديث POS في `PartsInventory.jsx` ليعرض حسابات دليل الحسابات الخاصة بـ «راكان» حسب النوع:
  - البيع: حسابات `revenue` لراكان.
  - الشراء: حسابات `expense` لراكان.
- اعتماد ربط محاسبي مزدوج عند حفظ العملية:
  - `accountId` = حساب أعمال مستقل لفرع «قطع راكان» (biz account مستقل).
  - `accountingAccountId` = حساب الإيراد/المصروف من دليل الحسابات.
- إنشاء حساب أعمال «قطع راكان» تلقائيًا إن لم يكن موجودًا ضمن `biz-accounts` لضمان استقلال العمليات.
- وسم عمليات POS بعلامة `[RAKAN_PARTS]` وفصل عرضها داخل صفحة العمليات إلى قسمين واضحين:
  - `عمليات قطع راكان (مستقلة)`
  - `عمليات الورشة`
- إضافة دعم خلفي/قواعد عرض لحقول الفصل (`scope/source/businessUnit`) مع fallback آمن دون كسر مخطط Supabase.
- التحقق عبر الاختبار: `/app/test_reports/iteration_19.json` (Backend/Frontend 100%).

### تبويب مستقل لعمليات راكان + Pagination لكل تبويب (08 Mar 2026)
- تحويل عرض العمليات في `Operations.jsx` إلى تبويبات مستقلة:
  - `عمليات قطع راكان (مستقلة)`
  - `عمليات الورشة`
- إضافة Pagination مستقل لكل تبويب بحد `15` عملية لكل صفحة.
- إضافة أزرار تنقل كاملة (السابق/التالي + جميع أرقام الصفحات) مع حالة فعالة واضحة.
- إضافة صيغة العدّاد المطلوبة: `صفحة X من Y صفحات`.
- التحقق عبر الاختبار: `/app/test_reports/iteration_20.json` (Frontend 100%).

### تحسين كروت العمليات + قيد محاسبي واضح + تحليلات راكان المتقدمة (08 Mar 2026)
- إعادة تصميم `OperationCard.jsx` بنمط مدمج (compact): تصغير الكروت والخطوط والأزرار مع منع قص النصوص الحرجة (`break-words`).
- إضافة نص قيد محاسبي واضح داخل الكرت: `قيد محاسبي: من حساب ... إلى حساب ...` + صندوق قيد موسّع.
- حل مشكلة فتح الكرت المجاور عبر controlled expansion state (`expandedOperationId`) بحيث كرت واحد فقط يكون مفتوحًا.
- إضافة تفاصيل المركبة الكاملة لعمليات scope=vehicle داخل الكرت (اللوحة + النوع/الموديل + العميل + رقم الزيارة).
- تعزيز فصل عمليات راكان ماليًا عبر metadata موحدة (`[RAKAN_PARTS]` + `ACCOUNTING_TARGET`) وربطها بحساب أعمال مستقل.
- تطوير `PartsDashboard.jsx` بإضافة تبويب مستقل `تحليلات قطع راكان` يحوي:
  - KPI: الإيراد/المصروف/الربح-الخسارة/معدل البيع
  - تحليل ذكي
  - جدول تغير أسعار القطع عبر الزمن
  - وفصل تبويب Backorders لتجنب تكرار المحتوى.
- تحسين تحميل بيانات صفحة العمليات عند الدخول الأول عبر fresh query options وإعادة جلب محدثة.
- التحقق عبر الاختبار: `/app/test_reports/iteration_22.json` (Backend 100% + Frontend 100%).

### تطوير ذكي إضافي لـ Parts Control Panel وفصل راكان المالي الكامل (09 Mar 2026)
- إزالة تكرار كروت البيع/الشراء من النظرة العامة في `PartsDashboard` وجعل تبويب راكان هو مركز التحليل المالي المستقل.
- توسيع تحليلات راكان لتشمل **كل** العمليات المرتبطة بحسابات راكان (مشتريات + مصروفات تشغيل/شخصية + إيرادات) مع تتبع سبب الصرف من `notes`.
- جعل كروت KPI في تبويب راكان قابلة للتوسيع (click-to-expand) لإظهار تفاصيل أعمق:
  - تفاصيل الإيرادات
  - تفصيل المصروفات حسب الحساب + آخر المصروفات والأسباب
  - تحليل الربحية
  - مؤشرات سرعة البيع
- ترقية جدول `متغير الأسعار عبر الزمن` ليعرض **آخر 3 تسعيرات بيع + آخر 3 تسعيرات شراء لكل قطعة** مع فروقات التغير.
- تعزيز فصل العمليات في صفحة العمليات ليشمل أيضًا `accountingAccountId` الخاص بحسابات راكان (ليس فقط حساب الأعمال أو التاج).
- إصلاح الترجمة الناقصة للمفاتيح: `inventory.parts_dashboard` و `common.details` و `common.view` (عربي/إنجليزي).
- التحقق عبر الاختبار: `/app/test_reports/iteration_23.json` (Backend/Frontend 100%) + اختبار ذاتي بعد إصلاح مفاتيح الترجمة.

### معمارية مخزون P1 + Planner ذكي + تحليلات راكان خلفية (09 Mar 2026)
- إضافة APIs خلفية جديدة ضمن `routes_smart_inventory.py`:
  - `GET /api/inventory/architecture`
  - `GET /api/inventory/rakan-analytics`
- نقل تحليل «قطع راكان» من الواجهة إلى Backend داخل `smart_inventory_service.py` لتوحيد المنطق وإرجاع:
  - `period_comparison`
  - `expense_reasons`
  - `price_trend`
  - `insights`
- تطوير معمارية التخطيط للمخزون بإرجاع `blueprint` + `stock_segments` + `replenishment_plan` + `supplier_health` مع توصيات إعادة التزويد بحسب الطلب، الغطاء المخزني، والطلبات المعلقة.
- إنشاء مكوّن واجهة جديد `InventoryPlannerTab.jsx` وإضافة تبويب `معمارية المخزون` داخل `PartsDashboard` لعرض خطة التزويد وصحة الموردين.
- تعزيز تبويب «تحليلات قطع راكان» بإظهار مقارنة الفترة الحالية مقابل السابقة، وأسباب الصرف الأكثر تكرارًا.
- التحقق عبر الاختبار: `/app/test_reports/iteration_29.json` + `pytest /app/backend/tests/test_smart_inventory.py` (12/12 ناجح).

### تحسين القراءة العالمية + تطوير القائمة الجانبية (09 Mar 2026)
- إضافة تحكم عالمي بحجم الخط عبر أزرار `A- / A / A+` على مستوى الموقع بالكامل، مع حفظ الاختيار في `localStorage` داخل `ThemeContext`.
- رفع الحجم الافتراضي للقراءة وتحويل التطبيق لاستخدام المتغير `--app-font-size` بدل قيمة ثابتة، بحيث يشمل العناوين والقوائم والأزرار والجداول والنماذج.
- تحسين `Layout` بإضافة شريط أدوات عرض مكتبي وأدوات مقابلة على الجوال للتحكم بحجم الخط.
- إعادة تصميم `Sidebar` ليتماشى مع الشكل الزجاجي/الداكن للموقع مع دعم:
  - تصغير القائمة إلى أيقونات فقط
  - إخفاء القائمة بالكامل ثم إظهارها بزر مستقل
  - حفظ حالة التصغير/الإخفاء بعد إعادة تحميل الصفحة
- تحديث `LanguageToggleButton` ليدعم وضع القائمة المصغّرة بدون كسر التصميم.
- التحقق عبر الاختبار: smoke test بصري + `auto_frontend_testing_agent` ناجح بالكامل + `testing_agent` frontend pass كامل مع التحقق من persistence بعد reload.

### تثبيت شريط أدوات العرض أعلى اليسار وتخفيف حجمه (10 Mar 2026)
- تحويل بلوك التحكم الكبير إلى `display dock` صغير وثابت أعلى يسار الصفحة على سطح المكتب والجوال.
- إزالة الشريط العريض من داخل المحتوى حتى لا يسبب إزعاجًا بصريًا أو يغيّر ارتفاع الهيدر.
- ضبط تموضع الجوال بحيث لا يحدث تداخل بين الشريط الثابت وعنوان الصفحة، مع ترك مسافة آمنة أسفل الـ dock.
- التحقق عبر `auto_frontend_testing_agent`: تم تأكيد اختفاء التداخل على الجوال وعدم وجود regressions على سطح المكتب.

### بحث أرشيفي سريع داخل بوت الورشة العائم (10 Mar 2026)
- إضافة endpoint جديد: `GET /api/vehicles/archive-search` للبحث عن **آخر زيارة** عبر:
  - رقم اللوحة
  - اسم العميل
  - وصف المركبة
  - أو عبارة طبيعية مثل: `سياره ا ر س 7576 ماهي تفاصيل آخر زياره`
- بناء خوارزمية مطابقة ذكية تعتمد على تطبيع النص العربي/الأرقام، وتقييم النتائج بالأولوية: اللوحة ثم العميل ثم المركبة.
- إرجاع `bestMatch` و`results` مع تفاصيل آخر زيارة: ما تم إصلاحه، القيمة، وطريقة/حالة الدفع.
- إضافة `ArchiveSearchPanel` داخل **تبويب المحادثة** في `ChatWidget` مع:
  - بحث فوري أثناء الكتابة (debounced)
  - زر بحث يدوي
  - معاينة سريعة لآخر زيارة داخل نفس نافذة البوت
- جعل حقل المحادثة نفسه يفهم نية البحث الأرشيفي ويعرض النتيجة مباشرة بدل الرجوع للأرشيف الرئيسي.
- إضافة `sessionId` محفوظ للمحادثة داخل البوت العائم بما يتوافق مع متطلبات multi-turn chat.
- التحقق عبر:
  - `pytest /app/backend/tests/test_workshop_bot_archive_search.py` (2/2 ناجح)
  - `/app/test_reports/iteration_30.json` (Frontend/Backend 100%)

### تصحيح كروت حالات المركبات في لوحة التحكم لتكون لحظية (10 Mar 2026)
- تعديل `Dashboard.jsx` بحيث تعتمد كروت الإحصائيات على **المركبات الحالية داخل لوحة التحكم فقط** (`status != delivered`) بدل العدد التاريخي الكامل.
- أصبح كرت `إجمالي المركبات` يعرض عدد المركبات الحالية داخل اللوحة بغض النظر عن الفلاتر أو البحث.
- فصل منطق `dashboardVehicles` عن `filteredVehicles` بحيث تؤثر الفلاتر والبحث على الشبكة فقط، بينما تبقى الكروت ثابتة على بيانات اللوحة الحالية.
- تحديث كرت الجاهزية ليعرض `ready + delivering` كمرحلة تسليم حالية، مع تفاصيل فرعية لحظية (`ready` و`delivering`).
- إضافة `data-testid` واضحة لقيم الكروت الأساسية لتسهيل الاختبار وضمان عدم رجوع المشكلة.
- التحقق عبر `/app/test_reports/iteration_31.json` (Frontend 100%): القيم بقيت ثابتة بعد الفلترة والبحث.

### Auto WhatsApp Notification (11 Feb 2026 - NEW)
- When a visit is closed (status=completed), backend auto-generates WhatsApp notification
- Returns whatsappNotification object with url, phone, message, customerName
- Frontend shows green banner at page level with "إرسال واتساب" button
- Message includes: customer name, vehicle plate, total amount
- Phone auto-normalized to 966 format
- Uses deeplink mode (wa.me URL) - no Twilio needed
- Banner persists across re-renders with page-level state
- Filter auto-switches to 'all' when visit is closed

### Visit System Fix (11 Feb 2026)
- Fixed critical bug: visits disappearing after save/close
- handleCloseVisit now saves items+notes+mileage alongside status change
- Fixed backend 500 error (removed non-existent updated_at column)
- Added loading state (isSaving) to prevent double-clicks
- Added confirmation dialog before closing visits
- Visit filters show counts (all/open/closed)
- Warning when filter hides visits
- Fixed "Invalid Date" display in dates section
- Added lightweight fetchDataLight for partial refreshes

### MoltBot (10 Feb 2026)
- Multi-agent architecture (Planner, Builder, Reviewer)
- Intelligent code editor with diff patches
- File-by-file patch application with rollback
- Interactive chat interface

### Smart Guidance (10 Feb 2026)
- GuidanceStepper component for VehicleDetails and Operations
- Per-user enable/disable via guidanceEnabled flag

### Financial/Accounting
- Full CRUD for journal entries
- Chart of accounts, balance sheet, income statement, cash flow
- Auto journal entry creation from operations

### Other Completed Features
- Theme system (dark/light/dash-pro)
- Code splitting with React.lazy
- PDF generation (direct fetch, no preview required)
- Customer approval page with OTP
- Customer import from Excel/CSV
- WhatsApp bot integration
- Vehicle files/photos upload

### Vehicle Details Liquid System Unification (14 Feb 2026)
- توحيد صفحة المركبة بالكامل على تصميم Liquid System (إزالة apple-card وتوحيد الكروت، الأزرار، الحالات، النوافذ)
- تحسين حالات الفراغ والفلاتر وإعادة تصميم شريط العنوان والطباعة
- إضافة data-testid فريدة لكل العناصر التفاعلية وأهم البيانات المعروضة
- ملاحظة: يلزم تحقق بصري بعد تسجيل الدخول (لقطة الاختبار وصلت لشاشة تسجيل الدخول فقط)

### موردون + نوع بند المورد (14 Feb 2026)
- إضافة نوع بند جديد "مورد" في بنود الزيارة مع اختيار المورد من قائمة الموردين
- تحسين صفحة الموردين بإضافة نافذة إنشاء/تعديل مورد وحفظه عبر API
- عند وضع Supabase: الموردون يستخدمون تخزينًا محليًا كحل بديل إذا لم يوجد جدول suppliers
- تحديث احتساب ذمم الموردين ليقرأ itemType/billingType ويحسب بنود المورد ضمن الذمم
- إضافة مسار /suppliers/migrate لترحيل الموردين المحليين إلى Supabase بعد إنشاء الجدول
- إصلاح خطأ Supabase عند البحث بالهاتف إذا لم يكن العميل مهيأ (حماية من None)

### مدفوعات الزيارة (14 Feb 2026)
- إضافة قسم مدفوعات داخل بطاقة الزيارة لتسجيل دفعة مقدمة أو تحت الحساب
- حفظ المدفوعات داخل notes JSON لاستخدامها في الملخص المالي

### Blackbox AI لمساعد الورشة (14 Feb 2026)
- إضافة اختيار نموذج (متعدد النماذج/Claude/Blackbox Pro/GPT-5 Codex) داخل بوت الورشة
- ربط البوت بواجهة Blackbox Tasks API عبر Backend مع رسائل ثنائية اللغة
- إضافة وضع المطوّر داخل مولت بوت مع برومبت قابل للتعديل ومعاينة تلقائية
- إضافة نموذج GPT-5.1 عبر Emergent LLM Key مع حفظ المحادثات حسب session_id

### OCR قطع الغيار (14 Feb 2026)
- إضافة واجهة OCR في صفحة قطع الغيار لاستيراد بنود الفاتورة عبر OpenAI Vision
- إنشاء مسار /api/parts/ocr لاستخراج البنود (اسم/كمية/سعر) وإرجاع JSON
- Document AI مؤجل حسب طلب المستخدم
- دعم الالتقاط المباشر بالكاميرا أو رفع ملف للقراءة
- استخراج رقم القطعة والوصف وإرجاع النتائج كجدول للاستيراد المباشر للمخزون
- اعتماد خطوتين (OCR نصي ثم تحليل) لتقليل الهلوسة وتحسين العربية
- إضافة درجات ثقة للصفوف واستيراد البنود عالية الثقة فقط

### OCR لفواتير القيود والعمليات (14 Feb 2026)
- إضافة ماسح فواتير في إنشاء القيد لتعبئة الوصف وخطّي القيد تلقائيًا
- إضافة ماسح فواتير في العملية اليدوية لتعبئة البنود والمورد تلقائيًا
- إصلاح إدراج بنود OCR في المخزون عبر توليد partNumber وتصنيف افتراضي
- إضافة اختيار نوع الفاتورة (بيع/شراء) عند مسح العمليات لإدراج البنود بالتصنيف الصحيح

### تحديث صفحة المخزون (14 Feb 2026)
- إعادة تصميم صفحة المخزون بواجهة زجاجية موحدة مع فلاتر وتصنيف شجري
- إزالة تكرار صفحة المخزون عبر توجيه مسار الكتالوج إلى صفحة المخزون الرئيسية
- إزالة تكرار روابط المخزون في القائمة الجانبية
- إضافة عمليات بيع/شراء مباشرة على القطع عبر API (/sell و /restock)
- إضافة نقطة بيع/شراء متعددة البنود مع خيار ربط العملية بمركبة
- دعم تحديد العميل/المورد والحساب المحاسبي عند إنشاء عملية بيع/شراء
- فلترة المركبات المعروضة في البيع لعرض المركبات النشطة فقط (غير المسلّمة)
- إصلاح ربط الحساب المحاسبي في نقطة البيع لتجنب خطأ 22P02 عبر تمرير accountingAccountId وترك accountId فارغًا
- تقليل أخطاء Supabase الخاصة بجدول الموردين عبر تعطيل الاستعلامات المتكررة عند غياب الجدول والاعتماد على التخزين المحلي
- ربط إضافة حسابات دليل الحسابات بمحاولة حفظ تلقائية في جدول chart_of_accounts في Supabase مع fallback محلي عند غياب الجدول
- معالجة خطأ الاتصال بـ Supabase في جلب العمليات (GET /api/operations) مع fallback لقائمة فارغة بدلاً من 500
- توحيد بناء روابط الـ API على الواجهة عبر resolveBackendBase لمنع أخطاء الدومين عند ضبط REACT_APP_BACKEND_URL بدون https
- إصلاح خطأ (resolveBackendBase is not a function) عبر إعادة تصدير الدالة من api.js ليعمل PartsInventory بدون انهيار
- إصلاح أخطاء build في Taxes/ChartOfAccounts/JournalEntries بسبب استيرادات مكسورة بعد إضافة resolveBackendBase
### لوحة تحكم القطع (14 Feb 2026)
- صفحة جديدة تجمع تحليلات المبيعات والمشتريات وحالة الفواتير
- جدول عمليات القطع مع فلترة حسب النوع والنطاق
- السماح باستيراد كل البنود حتى منخفضة الثقة مع أسماء افتراضية عند الحاجة
- تحديث الاستيراد لزيادة الكميات إن كانت القطعة موجودة وإظهار خطأ واضح عند الفشل

### تحسين صفحة التحليل المالي (14 Feb 2026)
- إعادة تصميم الكروت لتكون قابلة للتوسيع مع تفاصيل واضحة
- اختصار تحليل أبو فهد عبر تقليل طول المخرجات في Finance Bot
- تحسين بلوكات التدقيق بإظهار التصحيحات وسجل التدقيق داخل أقسام قابلة للتوسيع
- دعم fallback إلى جدول business_accounts عند غياب chart_of_accounts
- توسيع بلوكات التدقيق وإظهار التفاصيل في كروت قابلة للتمدد

### تحسين بوت أبو فهد المالي (14 Feb 2026)
- إضافة ملخص مالي مختصر داخل سياق المحادثة لرفع دقة الإجابات
- إضافة حساب افتراضي "حساب العملاء (ذمم)" في دليل الحسابات حتى لو لم تظهر قيود
- إضافة حساب العملاء (ذمم) افتراضيًا في واجهة الدليل عند عدم وجوده في البيانات
- عند تسليم المركبة يتم تحصيل العمليات الآجلة تلقائيًا وتسجيل قيد دفع على حساب 1103
- إصلاح صفحة دليل الحسابات لتستخدم /accounts-chart وإتاحة الإضافة/الحذف اليدوي
- مزامنة زيارات المركبة إلى العمليات مع إنشاء عملية خدمة آجل (payment_method=credit)
- إصلاح مزامنة الزيارات لتستخدم حقول جدول operations الصحيح وتضمن ظهور العمليات

### تحسين كروت الملفات (14 Feb 2026)
- إظهار نوع الخدمة المقدمة داخل كرت المركبة
- تحديث المبلغ التقديري ليكون مجموع البنود الحالية عند توسيع الكرت

---

## Architecture

### Frontend: React 18 + TailwindCSS + Shadcn/UI
### Backend: FastAPI + Supabase (PostgreSQL) + MongoDB fallback
### Key Routes
- `/vehicle/:id` - Vehicle details with visits
- `/operations` - Financial operations
- `/moltbot` - AI code editor
- `/print` - Document generation

### Key API Endpoints
- `GET/POST /api/vehicles/{id}/visits` - Visit CRUD
- `PUT /api/visits/{id}` - Visit update (returns whatsappNotification on completion)
- `DELETE /api/visits/{id}` - Visit delete
- `POST /api/notifications/prepare` - WhatsApp deeplink generator
- `GET/POST /api/operations` - Financial operations
- `GET /api/inventory/dashboard` - Smart inventory KPI snapshot
- `GET /api/inventory/alerts` - Smart low/out-of-stock + margin alerts
- `GET /api/inventory/control-panel` - Advanced parts analytics and category performance
- `GET /api/inventory/architecture` - Inventory architecture blueprint + replenishment plan + execution budget
- `GET /api/inventory/rakan-analytics` - Dedicated Rakan financial analytics (price timeline + expense tracking)
- `GET/POST/PATCH /api/inventory/backorders` - Backorder management lifecycle
- `POST /api/moltbot/chat` - AI chat

---

## Current Status

### P0 - Critical (COMPLETED)
- [x] Fix visits disappearing after save/close
- [x] Auto WhatsApp notification on visit close

### P1 - High Priority
- [ ] Integrate Llama 4 (Scout & Maverick) into MoltBot
- [x] تنفيذ Smart Inventory architecture (backend classes + APIs + UI)
- [x] تنفيذ Planner ذكي للمخزون + نقل تحليلات راكان إلى Backend API مخصص
- [x] تتبع متغير الأسعار زمنيًا داخل لوحة القطع مع نسب تغير وتذبذب
- [x] تتبع مصروفات راكان التفصيلي (حسب الفئة + أسبوعيًا + أعلى العمليات)
- [x] نقل أدوات التحكم بالعرض (حجم الخط/القائمة) إلى صفحة الإعدادات

### P2 - Medium Priority
- [ ] Enhance MoltBot with emergent.sh-like capabilities
- [ ] Add filter/search to service/part selection in visits
- [ ] General performance improvements
- [x] إنشاء Parts Control Panel مع backorders + تحليلات متقدمة

### P3 - Low Priority
- [ ] quick_actions.subtitle translation visibility
- [ ] Add "Reset Guidance" button in profile
- [ ] Streaming responses for MoltBot/AbuFahd
- [ ] Auto dark/light mode detection
- [ ] Excel export for reports

---

## Test Credentials
- Username: مدير
- Workshop ID: finmodule-sync
- API URL: https://dual-ledger-app.preview.emergentagent.com
- Groq API Key: configured in backend/.env

## Key Files
- `frontend/src/pages/VehicleDetails.jsx` - Visit management + WhatsApp notification
- `backend/routes_extended.py` - Visit CRUD + WhatsApp notification logic
- `frontend/src/pages/PartsInventory.jsx` - Inventory UI + Smart Snapshot + Alerts rail
- `frontend/src/components/inventory/InventoryStatsCards.jsx` - Inventory KPIs cards
- `frontend/src/components/inventory/InventoryFiltersPanel.jsx` - Search/filters/category quick filters
- `frontend/src/components/inventory/PartInventoryGrid.jsx` - Parts cards grid (memoized cards)
- `frontend/src/components/inventory/PartsOcrPanel.jsx` - OCR UI section
- `frontend/src/components/inventory/PartsTransactionModal.jsx` - POS sale/purchase modal
- `frontend/src/pages/PartsDashboard.jsx` - Parts Control Panel (analytics + backorders)
- `frontend/src/components/parts-dashboard/RakanExpenseTrackingPanel.jsx` - Expense categories/weekly trend/top expense operations
- `frontend/src/components/parts-dashboard/RakanPriceTimelinePanel.jsx` - Part price timeline with sale/purchase change percentages
- `frontend/src/components/parts-dashboard/InventoryPlannerTab.jsx` - Execution budget strip (urgent/high/planned/total commitment)
- `frontend/src/pages/ChartOfAccounts.jsx` - Account add modal connected to backend save flow
- `frontend/src/pages/ChartOfAccounts.jsx` - Add/Edit account full save flow + smart auto-resolve + parent normalization
- `frontend/src/pages/ChartOfAccounts.jsx` - Manager-only delete/enable-disable + toast notifications
- `backend/routes_smart_inventory.py` - Smart inventory APIs
- `backend/smart_inventory_service.py` - Analytics engine + alerts + backorders logic
- `backend/tests/test_smart_inventory.py` - Regression tests for architecture execution_budget + Rakan expense/price structures
- `backend/routes_finance.py` - Chart-of-accounts account creation endpoint
- `backend/routes_extended.py` - Account status override APIs + manager authorization for delete/toggle
- `frontend/src/App.js` - Eager loading for PartsInventory to avoid chunk failures
- `frontend/src/components/ErrorBoundary.jsx` - Auto-recovery for chunk loading/runtime script mismatches
- `frontend/src/pages/PartsInventory.jsx` - Rakan POS account routing + independent business account mapping
- `frontend/src/pages/Operations.jsx` - Separate sections: Rakan Parts operations vs Workshop operations
- `frontend/src/pages/Operations.jsx` - Tabbed operations view + independent pagination per tab (15/page)
- `frontend/src/components/OperationCard.jsx` - Compact operation card + accounting journal line + vehicle details + controlled expand
- `frontend/src/pages/Operations.jsx` - Expanded-state control + fresh queries + single-card-open behavior
- `frontend/src/pages/Operations.jsx` - 3 operation kinds (Workshop/Vehicle/Rakan) with strict validation and smart linking UX
- `frontend/src/pages/PartsDashboard.jsx` - Dedicated Rakan analytics tab + smart insights + price trend + non-duplicated tabs
- `frontend/src/pages/PartsDashboard.jsx` - Expandable smart KPI cards + full Rakan spend tracking + 3x sell/3x purchase price trend
- `frontend/src/pages/PartsDashboard.jsx` - Added Inventory Architecture tab + period comparison + expense reasons for Rakan analytics
- `frontend/src/components/parts-dashboard/InventoryPlannerTab.jsx` - Inventory planner UI (blueprint cards + replenishment plan + supplier health)
- `backend/routes_smart_inventory.py` - Added `/api/inventory/architecture` + `/api/inventory/rakan-analytics`
- `backend/smart_inventory_service.py` - Added replenishment blueprint engine + supplier health + backend Rakan analytics summary
- `backend/tests/test_smart_inventory.py` - Added regression coverage for architecture + Rakan analytics endpoints
- `frontend/src/components/Layout.jsx` - Added desktop/mobile display controls for font size and sidebar state
- `frontend/src/components/Sidebar.jsx` - Redesigned sidebar shell + collapse/hide/show behavior with persistence
- `frontend/src/components/FontSizeControls.jsx` - New reusable global A-/A/A+ controls
- `frontend/src/contexts/ThemeContext.jsx` - Global font presets and persisted app-wide font size state
- `frontend/src/index.css` - Converted root font sizing and content/sidebar layout offsets to CSS variables
- `backend/routes_extended.py` - Added `/api/vehicles/archive-search` with Arabic-aware normalization and latest visit summary building
- `backend/tests/test_workshop_bot_archive_search.py` - Added regression tests for archive search and natural-language lookup
- `frontend/src/components/ChatWidget.jsx` - Added archive search flow inside chat tab + persisted session id for bot conversation
- `frontend/src/components/workshop-bot/ArchiveSearchPanel.jsx` - New quick archive search field with live suggestions and preview
- `frontend/src/components/workshop-bot/ArchiveVisitResultCard.jsx` - New visit summary card for quick last-visit details
- `frontend/src/services/api.js` - Added `vehicleAPI.archiveSearch()`
- `frontend/src/pages/Dashboard.jsx` - Stats cards now compute from current dashboard vehicles only (exclude delivered) and remain stable across filters/search
- `backend/supabase_service.py` - Safe operation mapping + compatibility fallbacks
- `backend/routes_extended.py` - Operations payload/list support for business unit metadata
- `backend/routes_extended.py` - Auto-resolve business account_id to prevent FK failures when saving operations
- `frontend/src/translations.js` - Added missing Arabic keys for parts dashboard + common details/view
- `frontend/src/constants/englishTexts.js` - Added missing English keys for parts dashboard + common details/view
- `frontend/src/index.css` - Global default font set to Parastoo across app
- `frontend/public/index.html` - Parastoo font preconnect + stylesheet loading
- `frontend/src/godaddy-theme.css` - Parastoo fallback for GoDaddy theme pages
- `frontend/src/index.css` - Typography tuning (heading/body/button weights & line-heights) with Parastoo
- `frontend/src/index.css` - Global font-size scale-up (html 20px + larger body/control text)
- `backend/visit_sync.py` - Visit-to-operation sync
- `backend/whatsapp_service.py` - WhatsApp service (Twilio + deeplink)
- `frontend/src/pages/MoltBot.jsx` - AI code editor
- `backend/routes_moltbot.py` - MoltBot backend
- `backend/routes_extended.py` - Enforced account-code routing: any `5000*` accounting account forces Rakan flow + journal source tagging + safer business account selection
- `backend/routes_finance.py` - Workshop reports now exclude Rakan journal entries by default, support `include_rakan=true`, and normalize legacy UUID account refs back to true account codes
- `backend/routes_accounts_chart.py` - Added `DELETE /api/accounts-chart/reset` with stable fallback reset and noisy-account cleanup logic
- `backend/smart_inventory_service.py` - Rakan detection upgraded to account-code prefix (`5000`) + note/account-ref fallback detection
- `frontend/src/pages/Operations.jsx` - Account-based routing UI improvements, direct/open operation type, and automatic operation-kind/type inference from selected chart account
- `frontend/src/pages/PartsInventory.jsx` - POS supports direct/open accounting operations and routes flow by selected account code (5000 => Rakan, otherwise default workshop)
- `frontend/src/components/inventory/PartsTransactionModal.jsx` - Added direct operation mode inputs (amount/description) and account-driven guidance
- `backend/tests/test_rakan_5000_routing.py` - Added backend regression tests for 5000 routing, journal filtering, and reset endpoint stability

## Update History
| Date | Description |
|------|-------------|
| 11 Feb 2026 | Auto WhatsApp notification on visit close + page-level banner |
| 11 Feb 2026 | Fix visits disappearing + filter counts + Invalid Date fix |
| 10 Feb 2026 | MoltBot, Smart Guidance, PDF fixes, Visit UI improvements |
| 11 Feb 2026 | Operations page UI/UX refresh: dashboard-style cards + expandable details + inline edit items/prices |
| 14 Feb 2026 | Vehicle Details Liquid System UI unification + unique test IDs |
| 14 Feb 2026 | Supplier item type + suppliers add/edit modal + suppliers CRUD API |
| 14 Feb 2026 | Visit payments section (advance/under account) added |
| 14 Feb 2026 | Workshop bot multi-model (Blackbox) integration |
| 14 Feb 2026 | Deployment fix: CORS_ORIGINS set to * for production domain |
| 14 Feb 2026 | Suppliers migration endpoint for Supabase |
| 14 Feb 2026 | Parts OCR (OpenAI Vision) integration + UI |
| 14 Feb 2026 | Molt bot developer mode prompt builder |
| 14 Feb 2026 | GPT-5.1 workshop bot responses + session storage |
| 14 Feb 2026 | Supabase suppliers insert + customers_find_by_phone guard |
| 14 Feb 2026 | AI Financial page cards redesign + shorter Abu Fahad analysis |
| 14 Feb 2026 | Audit blocks expanded + account lookup fix (business_accounts fallback) |
| 14 Feb 2026 | Finance bot context enrichment + expandable audit cards |
| 14 Feb 2026 | Default Accounts Receivable (1103) seeded in chart response |
| 14 Feb 2026 | Frontend fallback for accounts receivable in accounts list |
| 14 Feb 2026 | Auto-settle credit ops on vehicle delivery (A/R 1103) |
| 14 Feb 2026 | Accounts manual add fixes (accounts-chart) + defaults |
| 14 Feb 2026 | OCR scanner for journal entries + manual operations |
| 01 Mar 2026 | Hotfix: resolved frontend build/runtime crash (resolveBackendBase) + verified /parts load |
| 01 Mar 2026 | Smart Inventory APIs + Parts Control Panel + Backorder workflow |
| 01 Mar 2026 | PartsInventory performance refactor + component decomposition |
| 02 Mar 2026 | Chart of Accounts: real account creation/save flow with all account types |
| 02 Mar 2026 | Chart of Accounts test data cleanup completed |
| 02 Mar 2026 | Chart of Accounts: edit account capability + smart auto-update fallback |
| 08 Mar 2026 | Chart of Accounts: manager-only delete/toggle + toast notifications + status overrides |
| 08 Mar 2026 | Fixed /parts ChunkLoadError via eager import + ErrorBoundary auto-recovery |
| 08 Mar 2026 | Rakan Parts financial separation in POS and Operations sections |
| 08 Mar 2026 | Operations page: Rakan tab + independent 15-item pagination with full page numbers |
| 08 Mar 2026 | Operation cards UX fix + accounting entry clarity + Rakan analytics tab with smart price insights |
| 09 Mar 2026 | Parts Control Panel advanced Rakan analytics (expandable KPI cards + full spend trace + last 3 buy/sell prices) |
| 09 Mar 2026 | Fixed save-operation FK blocker + implemented 3 operation kinds with strict validation and automatic customer/vehicle linking |
| 09 Mar 2026 | Global font migration: switched full frontend typography to Parastoo |
| 09 Mar 2026 | Parastoo typography refinement (weights/line-height tuning) validated frontend 100% |
| 09 Mar 2026 | Global font size increase completed (html root 20px) with no layout regressions |
| 09 Mar 2026 | Added P1 inventory architecture planner + backend Rakan analytics APIs + dashboard enhancements |
| 09 Mar 2026 | Added global A-/A/A+ font controls and redesigned sidebar with collapse/hide/show + saved preferences |
| 10 Mar 2026 | Reworked display controls into a compact fixed top-left dock and fixed mobile header overlap |
| 11 Mar 2026 | Moved font size + sidebar visibility controls to Settings only, removed floating dock, and kept mobile menu in header (no overlay on buttons). (UI fix ✅) |
| 10 Mar 2026 | Added quick archive last-visit search inside floating workshop bot chat with natural-language lookup |
| 10 Mar 2026 | Fixed dashboard vehicle status cards to use live current dashboard counts instead of historical totals |
| 10 Mar 2026 | P0 accounting fix: enforced `5000*` => Rakan-only routing (Operations + POS) and blocked workshop contamination |
| 10 Mar 2026 | Finance reports hardened: default workshop journal/chart views exclude Rakan entries unless `include_rakan=true` |
| 10 Mar 2026 | Added stable `DELETE /api/accounts-chart/reset` endpoint and validated no-crash reset behavior |
| 10 Mar 2026 | P1 enhancement: default analytics period switched to 30 days for control panel / architecture / Rakan views |
| 10 Mar 2026 | Added advanced Rakan expense tracking (category buckets + weekly trend + top expense operations) |
| 10 Mar 2026 | Added detailed part price timeline (sale/purchase points + % change + volatility) |
| 10 Mar 2026 | Inventory architecture now includes execution budget strip (urgent/high/planned/total commitment) |
