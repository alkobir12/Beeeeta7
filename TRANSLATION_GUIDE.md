# دليل نظام الترجمة - Translation System Guide

## نظرة عامة
تم تطبيق نظام ترجمة مخصص يدعم العربية والإنجليزية مع الكشف التلقائي عن لغة الجهاز.

## البنية الأساسية

### 1. LanguageContext (`/app/frontend/src/contexts/LanguageContext.jsx`)
- يوفر دالة `t()` للترجمة
- يكتشف لغة الجهاز تلقائياً
- يدير اتجاه الصفحة (RTL/LTR)

### 2. ملفات الترجمة
- **العربية**: `/app/frontend/src/translations.js`
- **الإنجليزية**: `/app/frontend/src/constants/englishTexts.js`

### 3. Hooks المساعدة
- `useLanguage()`: من LanguageContext مباشرة
- `useTranslation()`: في `/app/frontend/src/hooks/useTranslation.js` (اختياري)

## كيفية تطبيق الترجمة على صفحة جديدة

### الخطوة 1: استيراد Hook
```javascript
import { useLanguage } from '../contexts/LanguageContext';

const MyComponent = () => {
  const { t, isRTL } = useLanguage();
  // ...
}
```

### الخطوة 2: تطبيق الاتجاه (RTL/LTR)
```javascript
return (
  <div className={`container ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
    {/* محتوى الصفحة */}
  </div>
);
```

### الخطوة 3: ترجمة النصوص
```javascript
// بدلاً من النص الثابت:
<h1>Dashboard</h1>

// استخدم:
<h1>{t('dashboard.title')}</h1>
```

### الخطوة 4: إضافة ترجمات جديدة

#### في translations.js (العربية):
```javascript
const translations = {
  // ...
  mySection: {
    title: "العنوان",
    subtitle: "عنوان فرعي",
    button: "زر"
  }
};
```

#### في englishTexts.js (الإنجليزية):
```javascript
export const englishTexts = {
  // ...
  'mySection.title': 'Title',
  'mySection.subtitle': 'Subtitle',
  'mySection.button': 'Button'
};
```

## الترجمات المتاحة حالياً

### الأقسام الرئيسية:
- `app.*` - عناصر التطبيق العامة
- `buttons.*` - الأزرار
- `customers.*` - إدارة العملاء
- `vehicles.*` - المركبات
- `status.*` - حالات العمل
- `staff.*` - الموظفين والفنيين
- `inventory.*` - المخزون
- `invoices.*` - الفواتير
- `payments.*` - المدفوعات
- `nav.*` - عناصر القائمة
- `dashboard.*` - لوحة التحكم
- `common.*` - عناصر مشتركة
- `messages.*` - رسائل النظام
- `forms.*` - نماذج الإدخال

## الصفحات المطبقة

### ✅ مكتمل:
1. `/pages/Dashboard.jsx` - لوحة التحكم
2. `/pages/Login.jsx` - تسجيل الدخول
3. `/components/Sidebar.jsx` - القائمة الجانبية
4. `/pages/Customers.jsx` - العملاء (جزئي)
5. `/pages/Technicians.jsx` - الفنيون (جزئي)
6. `/pages/Operations.jsx` - العمليات (بدأ)

### ⏳ قيد العمل:
- VehicleDetails.jsx
- Settings.jsx
- PartsInventory.jsx

### 📝 متبقي (47 صفحة إجمالاً):
يمكن تطبيق نفس النمط على باقي الصفحات عند الحاجة.

## أمثلة عملية

### مثال 1: صفحة بسيطة
```javascript
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const SimplePage = () => {
  const { t, isRTL } = useLanguage();

  return (
    <div className={`page ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <h1>{t('common.title')}</h1>
      <button>{t('buttons.save')}</button>
    </div>
  );
};
```

### مثال 2: مع Toast Notifications
```javascript
const { toast } = useToast();
const { t } = useLanguage();

// عند النجاح:
toast({
  title: t('common.success'),
  description: t('messages.success_saved')
});

// عند الخطأ:
toast({
  title: t('common.error'),
  description: t('messages.error_occurred'),
  variant: 'destructive'
});
```

### مثال 3: تأكيد الحذف
```javascript
const handleDelete = () => {
  if (!window.confirm(t('common.confirm_delete'))) return;
  // ... منطق الحذف
};
```

## زر تبديل اللغة

### مكون جاهز:
`/components/LanguageToggleButton.jsx`

### الاستخدام:
```javascript
import LanguageToggleButton from '../components/LanguageToggleButton';

// في أي مكان في الصفحة:
<LanguageToggleButton />
```

حالياً موجود في Sidebar في أسفل القائمة.

## اختبار الترجمة

### 1. الكشف التلقائي:
- افتح التطبيق على جهاز بإعدادات عربية → سيظهر بالعربية
- افتح على جهاز بإعدادات إنجليزية → سيظهر بالإنجليزية

### 2. التبديل اليدوي:
- اضغط على زر اللغة في Sidebar
- ستتغير جميع النصوص واتجاه الصفحة فوراً

## ملاحظات مهمة

1. **لا تستخدم نصوص ثابتة**: استبدل جميع النصوص الثابتة بـ `t('key')`

2. **إضافة ترجمات جديدة**: أضف المفتاح في كلا الملفين (translations.js و englishTexts.js)

3. **الاتجاه**: تأكد من إضافة `dir` و `className` للـ RTL/LTR support

4. **التوافق**: النظام يعمل مع جميع المتصفحات الحديثة

5. **الأداء**: الترجمات محملة مرة واحدة عند بدء التطبيق (سريع جداً)

## الدعم والمساعدة

للأسئلة أو المشاكل، راجع:
- `/test_result.md` - نتائج الاختبار
- `/app/frontend/src/contexts/LanguageContext.jsx` - الكود المصدري
