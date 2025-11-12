# Supabase MCP Integration - Setup Guide

## 🎯 نظرة عامة

تم تثبيت Supabase بنجاح! النظام يعمل حالياً في **MOCK MODE** (بيانات تجريبية).

---

## 🔑 كيفية الحصول على مفاتيح Supabase

### الخطوة 1: إنشاء مشروع Supabase

1. اذهب إلى: https://supabase.com
2. اضغط **"Start your project"** أو **"Sign in"**
3. سجل بـ GitHub account
4. اضغط **"New project"**
5. اختر:
   - **Organization**: أنشئ organization جديدة أو استخدم موجودة
   - **Name**: `Workshop Management`
   - **Database Password**: اختر كلمة سر قوية (احفظها!)
   - **Region**: اختر أقرب منطقة (مثل: Middle East - Mumbai)
6. اضغط **"Create new project"**
7. انتظر 2-3 دقائق حتى ينتهي الإعداد

### الخطوة 2: الحصول على API Keys

بعد إنشاء المشروع:
1. اذهب إلى **Settings** (أيقونة الترس في الأسفل)
2. اختر **API** من القائمة الجانبية
3. ستجد:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public**: مفتاح عام للـ frontend
   - **service_role**: مفتاح سري للـ backend ⚠️ (لا تشاركه!)

### الخطوة 3: الحصول على JWT Secret

1. في نفس صفحة **Settings > API**
2. انزل للأسفل
3. ستجد **JWT Settings**
4. انسخ **JWT Secret**

---

## 🔧 إضافة المفاتيح للنظام

أضف المفاتيح إلى `/app/backend/.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-super-secret-jwt-token...
```

بعد الإضافة:
```bash
sudo supervisorctl restart backend
```

---

## 📊 إنشاء Tables في Supabase

اذهب إلى **Table Editor** في Supabase Dashboard، ثم:

### Table: vehicles
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT UNIQUE NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending',
  services JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: customers
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: analytics
```sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_revenue DECIMAL(10,2),
  vehicles_serviced INTEGER,
  data JSONB
);
```

---

## ✅ التحقق من التثبيت

```bash
# Check status
curl http://localhost:8001/api/supabase/status

# Get vehicles
curl http://localhost:8001/api/supabase/vehicles

# Get analytics
curl http://localhost:8001/api/supabase/analytics
```

---

## 🎁 الميزات المجانية في Supabase

✅ 500MB Database Storage
✅ 1GB File Storage
✅ 50,000 monthly active users
✅ Unlimited API requests
✅ PostgreSQL Database
✅ Authentication built-in
✅ Real-time subscriptions

---

## 🚀 الحالة

**✅ مثبت ويعمل في MOCK MODE**
- لا يحتاج مفاتيح للاختبار
- بيانات تجريبية جاهزة
- جاهز للتفعيل عند إضافة المفاتيح
