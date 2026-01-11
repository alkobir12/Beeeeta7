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
**المشكلة**: عند تغيير حالة المركبة من صفحة التفاصيل أو القائمة السريعة، لا تتحدث إحصائيات لوحة التحكم فوراً.

**الحل المطبق**:
1. أضفت مستمع للحدث `vehicleUpdated` في `Dashboard.jsx`
2. أضفت إرسال الحدث في `VehicleQuickActions.jsx` بعد تغيير الحالة
3. `VehicleDetails.jsx` كان يرسل الحدث مسبقاً

**الملفات المعدلة**:
- `/app/frontend/src/pages/Dashboard.jsx`
- `/app/frontend/src/components/VehicleQuickActions.jsx`

**حالة الاختبار**: ✅ تم التحقق يدوياً - الإحصائيات تتحدث فوراً

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
- [ ] التحقق من تغطية الترجمة الكاملة (بعض النصوص قد لا تزال غير مترجمة)
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
│   ├── server.py           # API الرئيسي + cascade delete
│   └── routes_extended.py  # مسارات إضافية
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── VehicleQuickActions.jsx  # معدل - يرسل vehicleUpdated event
    │   │   └── LanguageToggleButton.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx            # معدل - يستمع لـ vehicleUpdated event
    │   │   ├── VehicleDetails.jsx       # يرسل vehicleUpdated event
    │   │   └── Operations.jsx
    │   ├── locales/
    │   │   ├── ar.json
    │   │   └── en.json
    │   ├── i18n.js                      # إعداد react-i18next
    │   └── translations.js              # الترجمات العربية
```

---

## ملاحظات تقنية

### نظام التحديث الفوري (Real-time Updates)
```javascript
// إرسال الحدث (VehicleDetails, VehicleQuickActions)
window.dispatchEvent(new CustomEvent('vehicleUpdated', { 
  detail: { vehicleId, status, timestamp: Date.now() } 
}));

// الاستماع للحدث (Dashboard)
window.addEventListener('vehicleUpdated', () => fetchData());
```

### نظام الترجمة
- المكتبة: `react-i18next`
- الكشف عن اللغة: `i18next-browser-languagedetector`
- الحفظ: `localStorage`
- الملفات: `/src/translations.js` (عربي) + `/src/constants/englishTexts.js` (إنجليزي)
