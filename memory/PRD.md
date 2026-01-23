# AutoProfit Pro - نظام إدارة ورش السيارات المالي

## نظرة عامة
نظام مالي متكامل لإدارة ورش السيارات، يشمل المحاسبة المتقدمة والفواتير والتقارير المالية والذكاء الاصطناعي.

## البنية التقنية
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Background Tasks**: Celery + Redis
- **Infrastructure**: Docker Compose, Nginx

## الميزات المنجزة (100%)

### المحاسبة
- ✅ دليل الحسابات (Chart of Accounts) - مع دعم الدليل السعودي
- ✅ القيود اليومية (Journal Entries) - مع القيد المزدوج
- ✅ الميزانية العمومية (Balance Sheet)
- ✅ قائمة الدخل (Income Statement)
- ✅ قائمة التدفقات النقدية (Cash Flow Statement)
- ✅ ميزان المراجعة (Trial Balance)

### الفواتير
- ✅ إنشاء فواتير المبيعات والمشتريات
- ✅ إصدار الفواتير وإنشاء القيود تلقائياً
- ✅ تسجيل المدفوعات
- ✅ تتبع حالة الدفع

### الضرائب السعودية
- ✅ حاسبة ضريبة القيمة المضافة (15%)
- ✅ حساب الزكاة على الوعاء الزكوي (2.5%)
- ✅ إعداد إقرار ضريبة القيمة المضافة
- ✅ ضريبة الاستقطاع على المدفوعات للخارج
- ✅ التحقق من صحة الرقم الضريبي

### الذكاء الاصطناعي
- ✅ تحليل الميزانية العمومية
- ✅ تحليل قائمة الدخل
- ✅ توصيات مالية ذكية
- ✅ الإجابة على الأسئلة المالية

### المهام الخلفية (Celery)
- ✅ فحص الفواتير المتأخرة يومياً
- ✅ إرسال تذكيرات الدفع أسبوعياً
- ✅ توليد التقارير اليومية
- ✅ توليد التقارير الشهرية
- ✅ حساب مؤشرات الأداء KPIs

### نظام المصادقة
- ✅ صفحة تسجيل الدخول
- ✅ صفحة إنشاء حساب جديد
- ✅ تخزين التوكن في localStorage

### الواجهة الأمامية (Frontend)
- ✅ صفحة الميزانية العمومية
- ✅ صفحة قائمة الدخل
- ✅ صفحة التدفقات النقدية
- ✅ صفحة ميزان المراجعة
- ✅ صفحة دليل الحسابات
- ✅ صفحة القيود اليومية
- ✅ صفحة الفواتير
- ✅ صفحة إدارة الضرائب
- ✅ صفحة إدارة المخزون
- ✅ صفحة إدارة العملاء
- ✅ Sidebar متكامل

## API Endpoints

### المحاسبة
- `GET /api/v1/accounting/reports/balance-sheet`
- `GET /api/v1/accounting/reports/income-statement`
- `GET /api/v1/accounting/reports/cash-flow`
- `GET /api/v1/accounting/reports/trial-balance`
- `GET /api/v1/accounting/accounts`
- `POST /api/v1/accounting/accounts/seed`
- `GET /api/v1/accounting/journal-entries`
- `POST /api/v1/accounting/journal-entries`

### الفواتير
- `GET /api/v1/accounting/invoices`
- `POST /api/v1/accounting/invoices`
- `POST /api/v1/accounting/invoices/{id}/issue`
- `POST /api/v1/accounting/invoices/{id}/payments`

### الضرائب
- `POST /api/v1/taxes/vat/calculate`
- `POST /api/v1/taxes/vat/invoice`
- `POST /api/v1/taxes/zakat/calculate`
- `POST /api/v1/taxes/withholding/calculate`
- `POST /api/v1/taxes/vat/return`
- `GET /api/v1/taxes/vat/validate-number`
- `GET /api/v1/taxes/rates`

### الذكاء الاصطناعي
- `POST /api/v1/ai/analyze`
- `GET /api/v1/ai/insights`
- `POST /api/v1/ai/ask`
- `POST /api/v1/ai/recommendations`

## هيكل الملفات

```
/app/autoprofit-pro/
├── apps/
│   ├── api/                          # FastAPI Backend
│   │   ├── src/
│   │   │   ├── api/v1/endpoints/
│   │   │   │   ├── accounting/       # APIs المحاسبة
│   │   │   │   ├── ai.py             # API الذكاء الاصطناعي
│   │   │   │   └── taxes.py          # API الضرائب
│   │   │   ├── core/
│   │   │   │   └── celery_app.py     # إعدادات Celery
│   │   │   ├── services/
│   │   │   │   ├── accounting/       # خدمات المحاسبة
│   │   │   │   ├── ai/               # خدمات الذكاء الاصطناعي
│   │   │   │   └── tax/              # خدمات الضرائب
│   │   │   ├── tasks/                # مهام Celery
│   │   │   │   ├── invoice_tasks.py
│   │   │   │   ├── report_tasks.py
│   │   │   │   └── notification_tasks.py
│   │   │   └── main.py
│   │   └── requirements.txt
│   │
│   └── web/                          # Next.js Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/           # صفحات المصادقة
│       │   │   │   ├── login/
│       │   │   │   └── register/
│       │   │   └── (dashboard)/      # صفحات التطبيق
│       │   │       ├── accounting/
│       │   │       │   ├── balance-sheet/
│       │   │       │   ├── income-statement/
│       │   │       │   ├── cash-flow/
│       │   │       │   ├── trial-balance/
│       │   │       │   ├── chart-of-accounts/
│       │   │       │   └── journal-entries/
│       │   │       ├── finance/
│       │   │       │   ├── invoices/
│       │   │       │   └── taxes/
│       │   │       ├── inventory/
│       │   │       └── customers/
│       │   ├── components/
│       │   └── lib/
│       │       └── api.ts            # API Client
│       └── package.json
│
└── infrastructure/
    └── docker-compose.yml
```

## إعدادات التشغيل

```bash
# تشغيل المشروع
cd /app/autoprofit-pro/infrastructure
docker-compose up -d

# تشغيل Celery Worker
celery -A src.core.celery_app worker --loglevel=info

# تشغيل Celery Beat (المهام المجدولة)
celery -A src.core.celery_app beat --loglevel=info
```

## متغيرات البيئة المطلوبة

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/autoprofit_db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
EMERGENT_LLM_KEY=sk-emergent-...
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WORKSHOP_ID=autopro-migrate
```

## المهام المستقبلية (Backlog)
- [ ] إدارة المواعيد
- [ ] تصدير PDF للتقارير
- [ ] إرسال الإشعارات عبر البريد/SMS
- [ ] تكامل مع نظام فاتورة الإلكترونية (ZATCA)
- [ ] محرك الذكاء الاصطناعي Z.ai
- [ ] تطبيق موبايل

---
آخر تحديث: ديسمبر 2025
