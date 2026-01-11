# Workshop Management System - PRD

## المتطلبات الأصلية
نظام إدارة ورشة سيارات متكامل يدعم:
- إدارة المركبات والعملاء
- تتبع حالة الإصلاح
- نظام ثنائي اللغة (عربي/إنجليزي)
- إدارة الفنيين والعمليات
- المستندات والفواتير

## المستخدمين المستهدفين
- مدراء الورش
- الفنيين
- موظفي الاستقبال

## التقنيات المستخدمة
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **i18n**: react-i18next
- **AI**: Groq API (خبير الديزل)

---

## ما تم إنجازه

### الجلسة الحالية (11 يناير 2025)

#### ✅ إصلاح التحديث الفوري للوحة التحكم (P0)
**المشكلة**: عند تغيير حالة المركبة، لا تتحدث إحصائيات لوحة التحكم فوراً.

**الحل المطبق**:
1. أضفت مستمع للحدث `vehicleUpdated` في `Dashboard.jsx`
2. أضفت إرسال الحدث في `VehicleQuickActions.jsx` بعد تغيير الحالة
3. أضفت الحالات المفقودة (`repair`, `approved`, `quotation`) في `STATUS_CONFIG`

#### ✅ إصلاح مشكلة حفظ فني جديد
**المشكلة**: خطأ 500 عند محاولة إضافة فني جديد.

**السبب**: عدم تطابق أسماء الحقول بين الكود (camelCase) وقاعدة بيانات Supabase (snake_case).

**الحل**:
1. تحديث دالة `create_technician` في `server.py` لتحويل الأسماء
2. تحديث دالة `technicians_list` في `supabase_service.py` لتحويل الأسماء

#### ✅ تحسين دعم الجوال (Responsive Design)
- تحسين الشريط الجانبي (Sidebar) ليظهر بشكل صحيح على الجوال
- تحسين صفحة الفنيين لتعمل بشكل أفضل على الشاشات الصغيرة
- تحسين صفحة العملاء والنوافذ المنبثقة
- جعل أزرار التحرير والحذف مرئية دائماً على الجوال

**الملفات المعدلة**:
- `/app/frontend/src/pages/Dashboard.jsx` - إضافة STATUS_CONFIG للحالات المفقودة
- `/app/frontend/src/components/VehicleQuickActions.jsx` - إرسال حدث التحديث
- `/app/frontend/src/components/Sidebar.jsx` - تحسين العرض على الجوال
- `/app/frontend/src/pages/Technicians.jsx` - تحسين responsive
- `/app/frontend/src/pages/Customers.jsx` - تحسين responsive
- `/app/backend/server.py` - إصلاح إضافة الفنيين
- `/app/backend/supabase_service.py` - تحويل أسماء الحقول

### الجلسات السابقة
- ✅ ترحيل كامل لنظام الترجمة إلى `react-i18next`
- ✅ إصلاح زر تبديل اللغة (مشكلة z-index)
- ✅ حفظ اختيار اللغة في localStorage
- ✅ حذف العمليات المرتبطة عند حذف مركبة (cascade delete)
- ✅ تحسين صفحة العمليات (التنقل والحذف)
- ✅ توحيد مصطلحات الحالة

---

## المهام المعلقة

### P1 - أولوية عالية
- [ ] التحقق من تغطية الترجمة الكاملة
- [ ] اختبار نظام الزيارات بشكل كامل

### P2 - أولوية متوسطة
- [ ] ربط Google Drive
- [ ] ميزة المرفقات في محادثة الديزل

### P3 - أولوية منخفضة
- [ ] مشكلة "Save to GitHub" (تحتاج دعم المنصة)

---

## البنية المعمارية

```
/app
├── backend/
│   ├── server.py           # API الرئيسي + cascade delete + إضافة الفنيين
│   ├── supabase_service.py # تحويل أسماء الحقول
│   └── models.py           # نماذج البيانات
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx             # محسن للجوال
    │   │   ├── VehicleQuickActions.jsx # يرسل vehicleUpdated event
    │   │   └── Layout.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx           # STATUS_CONFIG محدث
    │   │   ├── VehicleDetails.jsx
    │   │   ├── Technicians.jsx         # محسن للجوال
    │   │   ├── Customers.jsx           # محسن للجوال
    │   │   └── Operations.jsx
    │   ├── i18n.js
    │   └── translations.js
```

---

## ملاحظات تقنية

### تحويل أسماء الحقول (Supabase)
```python
# Backend -> Supabase (camelCase -> snake_case)
data = {
    'active_jobs': technician.activeJobs,
    'completed_jobs': technician.completedJobs
}

# Supabase -> Backend (snake_case -> camelCase)
return {
    'activeJobs': row.get('active_jobs', 0),
    'completedJobs': row.get('completed_jobs', 0)
}
```

### نظام التحديث الفوري (Real-time Updates)
```javascript
// إرسال الحدث
window.dispatchEvent(new CustomEvent('vehicleUpdated', { 
  detail: { vehicleId, status, timestamp: Date.now() } 
}));

// الاستماع للحدث
window.addEventListener('vehicleUpdated', () => fetchData());
```
