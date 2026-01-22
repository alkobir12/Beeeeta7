# AutoProfit Pro - نظام إدارة ورش السيارات المالي

## نظرة عامة
نظام مالي متكامل لإدارة ورش السيارات، يشمل المحاسبة المتقدمة والفواتير والتقارير المالية والذكاء الاصطناعي.

## البنية التقنية
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Infrastructure**: Docker Compose, Redis, Celery, Nginx

## الميزات المنجزة

### المحاسبة (100% مكتمل)
- ✅ دليل الحسابات (Chart of Accounts) - مع دعم الدليل السعودي
- ✅ القيود اليومية (Journal Entries) - مع القيد المزدوج
- ✅ الميزانية العمومية (Balance Sheet)
- ✅ قائمة الدخل (Income Statement)
- ✅ قائمة التدفقات النقدية (Cash Flow Statement)
- ✅ ميزان المراجعة (Trial Balance)

### الفواتير (100% مكتمل)
- ✅ إنشاء فواتير المبيعات والمشتريات
- ✅ إصدار الفواتير وإنشاء القيود تلقائياً
- ✅ تسجيل المدفوعات
- ✅ تتبع حالة الدفع

### الذكاء الاصطناعي (100% مكتمل)
- ✅ تحليل الميزانية العمومية
- ✅ تحليل قائمة الدخل
- ✅ توصيات مالية ذكية
- ✅ الإجابة على الأسئلة المالية

### الواجهة الأمامية (90% مكتمل)
- ✅ صفحة الميزانية العمومية - مربوطة بالـ API
- ✅ صفحة قائمة الدخل - مربوطة بالـ API
- ✅ صفحة التدفقات النقدية - مربوطة بالـ API
- ✅ صفحة ميزان المراجعة - مربوطة بالـ API
- ✅ صفحة دليل الحسابات - مربوطة بالـ API
- ✅ صفحة الفواتير - مع نماذج الإنشاء والدفع
- ✅ Sidebar متكامل مع كل الصفحات
- ⏳ صفحة القيود اليومية (قيد التطوير)

## الملفات الرئيسية

### Backend
- `/app/autoprofit-pro/apps/api/src/main.py` - نقطة الدخول الرئيسية
- `/app/autoprofit-pro/apps/api/src/models.py` - نماذج قاعدة البيانات
- `/app/autoprofit-pro/apps/api/src/services/accounting/` - خدمات المحاسبة
- `/app/autoprofit-pro/apps/api/src/services/ai/` - خدمات الذكاء الاصطناعي
- `/app/autoprofit-pro/apps/api/src/api/v1/endpoints/` - نقاط API

### Frontend
- `/app/autoprofit-pro/apps/web/src/lib/api.ts` - عميل API المركزي
- `/app/autoprofit-pro/apps/web/src/app/(dashboard)/` - صفحات التطبيق
- `/app/autoprofit-pro/apps/web/src/components/layout/Sidebar.tsx` - الشريط الجانبي

## API Endpoints

### المحاسبة
- `GET /api/v1/accounting/reports/balance-sheet` - الميزانية العمومية
- `GET /api/v1/accounting/reports/income-statement` - قائمة الدخل
- `GET /api/v1/accounting/reports/cash-flow` - التدفقات النقدية
- `GET /api/v1/accounting/reports/trial-balance` - ميزان المراجعة
- `GET /api/v1/accounting/accounts` - دليل الحسابات
- `POST /api/v1/accounting/accounts/seed` - تهيئة الدليل السعودي

### الفواتير
- `GET /api/v1/accounting/invoices` - قائمة الفواتير
- `POST /api/v1/accounting/invoices` - إنشاء فاتورة
- `POST /api/v1/accounting/invoices/{id}/issue` - إصدار فاتورة
- `POST /api/v1/accounting/invoices/{id}/payments` - تسجيل دفعة

### الذكاء الاصطناعي
- `POST /api/v1/ai/analyze` - تحليل تقرير مالي
- `GET /api/v1/ai/insights` - رؤى مالية
- `POST /api/v1/ai/ask` - سؤال مالي
- `POST /api/v1/ai/recommendations` - توصيات مالية

## المهام القادمة (P1)
1. صفحة القيود اليومية في الواجهة الأمامية
2. نظام المصادقة (Login/Register)
3. تفعيل Celery للمهام الخلفية
4. إرسال إشعارات الفواتير

## المهام المستقبلية (P2-P3)
- وحدة الضرائب السعودية
- المخزون
- إدارة العملاء
- المواعيد
- تقارير متقدمة
- تصدير PDF

## إعدادات التشغيل
```bash
# تشغيل المشروع
cd /app/autoprofit-pro/infrastructure
docker-compose up -d

# أو تشغيل كل خدمة منفصلة
docker-compose up -d postgres redis
cd apps/api && uvicorn src.main:app --reload --port 8000
cd apps/web && yarn dev
```

## متغيرات البيئة المطلوبة
- `DATABASE_URL` - اتصال PostgreSQL
- `REDIS_URL` - اتصال Redis
- `SECRET_KEY` - مفتاح التشفير
- `EMERGENT_LLM_KEY` - مفتاح OpenAI/Emergent

---
آخر تحديث: ديسمبر 2025
