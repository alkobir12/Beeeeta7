# دليل تحديث الترجمة للصفحات

## المشكلة:
اللغة تتغير فقط في Sidebar، باقي الصفحات تحتاج تطبيق useTranslation

## الحل السريع:

### الخطوات لكل صفحة:

1. **أضف import:**
```jsx
import { useTranslation } from 'react-i18next';
```

2. **أضف في Component:**
```jsx
const { t, i18n } = useTranslation();
const isRTL = i18n.language === 'ar';
```

3. **استبدل النصوص:**
```jsx
// قبل:
<h1>لوحة التحكم</h1>

// بعد:
<h1>{t('dashboard.title')}</h1>
```

## الصفحات التي تحتاج تحديث:

### ✅ تعمل بالفعل:
- Sidebar.jsx
- AIAssistant.jsx
- DieselExpertChat.jsx
- DocumentPrint.jsx
- PublicAgent.jsx
- QuotationGenerator.jsx

### ⚠️ تحتاج تحديث (أولوية):
1. Dashboard.jsx - الرئيسية
2. CEODashboard.jsx - لوحة CEO
3. VehicleDetails.jsx - تفاصيل المركبة
4. Operations.jsx - العمليات
5. ApprovalPublic.jsx - صفحة الاعتماد العامة
6. Customers.jsx - العملاء
7. Technicians.jsx - الفنيون
8. Parts.jsx - قطع الغيار
9. Services.jsx - الخدمات

## مفاتيح الترجمة المتوفرة:

انظر إلى:
- `/app/frontend/src/locales/ar.json`
- `/app/frontend/src/locales/en.json`

## ملاحظة:
جميع مفاتيح الترجمة موجودة في الملفات. فقط يحتاج تطبيقها في الصفحات.

## حل بديل سريع:

بما أن التطبيق جاهز للنشر ومعظم المستخدمين يستخدمون العربية، يمكن:
1. إبقاء الوضع الحالي (العربية ثابتة)
2. تحديث الصفحات تدريجياً لاحقاً
3. أو استخدام أداة find & replace لتحديث جميع الصفحات دفعة واحدة
