# دليل التصميم المتجاوب (Liquid Design Guide)

## نظرة عامة
تم إنشاء مجموعة من المكونات المتجاوبة الموحدة لضمان تجربة مستخدم مثالية على جميع الأجهزة (Desktop, Tablet, Mobile).

## المكونات المتاحة

### 1. ResponsiveContainer
حاوية رئيسية مع padding و max-width تلقائي

```jsx
import { ResponsiveContainer } from '../components/ResponsiveGrid';

<ResponsiveContainer maxWidth="4xl">
  {/* المحتوى */}
</ResponsiveContainer>
```

**الخصائص:**
- `maxWidth`: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
- `className`: صفوف CSS إضافية

---

### 2. ResponsiveGrid
شبكة متجاوبة تلقائياً

```jsx
import { ResponsiveGrid } from '../components/ResponsiveGrid';

<ResponsiveGrid cols="3" gap="md">
  <div>عنصر 1</div>
  <div>عنصر 2</div>
  <div>عنصر 3</div>
</ResponsiveGrid>
```

**الخصائص:**
- `cols`: '1' | '2' | '3' | '4' | '5' | '6'
- `gap`: 'sm' | 'md' | 'lg' | 'xl'
- `className`: صفوف CSS إضافية

**السلوك:**
- cols="2": عمود واحد على الموبايل، عمودين على التابلت فما فوق
- cols="3": عمود على الموبايل، 2 على التابلت، 3 على الديسكتوب
- cols="4": عمود على الموبايل، 2 على التابلت، 4 على الديسكتوب

---

### 3. ResponsiveCard
بطاقة متجاوبة مع header اختياري

```jsx
import { ResponsiveCard } from '../components/ResponsiveGrid';
import { Car } from 'lucide-react';

<ResponsiveCard title="بيانات المركبة" icon={Car}>
  {/* المحتوى */}
</ResponsiveCard>
```

**الخصائص:**
- `title`: عنوان البطاقة (اختياري)
- `icon`: أيقونة من lucide-react (اختياري)
- `className`: صفوف CSS إضافية
- `headerClassName`: صفوف CSS للـ header

---

### 4. ResponsiveStack
مجموعة عمودية مع مسافات موحدة

```jsx
import { ResponsiveStack } from '../components/ResponsiveGrid';

<ResponsiveStack spacing="md">
  <div>عنصر 1</div>
  <div>عنصر 2</div>
  <div>عنصر 3</div>
</ResponsiveStack>
```

**الخصائص:**
- `spacing`: 'sm' | 'md' | 'lg' | 'xl'
- `className`: صفوف CSS إضافية

---

### 5. ResponsiveFormField
حقل نموذج متجاوب مع label و error

```jsx
import { ResponsiveFormField } from '../components/ResponsiveGrid';

<ResponsiveFormField 
  label="رقم اللوحة" 
  required 
  error={errors.plateNumber}
>
  <input className="apple-input" {...register('plateNumber')} />
</ResponsiveFormField>
```

**الخصائص:**
- `label`: نص التسمية
- `required`: إظهار علامة * (boolean)
- `error`: رسالة خطأ (string)
- `className`: صفوف CSS إضافية

---

### 6. ResponsiveButton
زر متجاوب مع أحجام مختلفة

```jsx
import { ResponsiveButton } from '../components/ResponsiveGrid';

<ResponsiveButton size="md" fullWidth onClick={handleSubmit}>
  حفظ
</ResponsiveButton>
```

**الخصائص:**
- `size`: 'sm' | 'md' | 'lg'
- `fullWidth`: عرض كامل على الموبايل، تلقائي على الديسكتوب (boolean)

---

### 7. ResponsiveHeader
عنوان صفحة متجاوب مع زر رجوع وإجراءات

```jsx
import { ResponsiveHeader } from '../components/ResponsiveGrid';

<ResponsiveHeader
  title="استقبال مركبة جديدة"
  subtitle="تسجيل بيانات المركبة والعميل"
  onBack={() => navigate('/')}
  actions={
    <>
      <button>إجراء 1</button>
      <button>إجراء 2</button>
    </>
  }
/>
```

**الخصائص:**
- `title`: العنوان الرئيسي
- `subtitle`: العنوان الفرعي (اختياري)
- `onBack`: دالة الرجوع (اختياري)
- `actions`: مكونات الإجراءات (اختياري)
- `className`: صفوف CSS إضافية

---

## مثال كامل: صفحة إضافة مركبة

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, User, Save } from 'lucide-react';
import {
  ResponsiveContainer,
  ResponsiveHeader,
  ResponsiveStack,
  ResponsiveCard,
  ResponsiveGrid,
  ResponsiveFormField,
  ResponsiveButton
} from '../components/ResponsiveGrid';

const NewVehicle = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});

  return (
    <ResponsiveContainer maxWidth="4xl">
      <ResponsiveHeader
        title="استقبال مركبة جديدة"
        subtitle="تسجيل بيانات المركبة والعميل"
        onBack={() => navigate('/')}
      />

      <form onSubmit={handleSubmit}>
        <ResponsiveStack spacing="lg">
          {/* بيانات المركبة */}
          <ResponsiveCard title="بيانات المركبة" icon={Car}>
            <ResponsiveGrid cols="2" gap="md">
              <ResponsiveFormField label="رقم اللوحة" required>
                <input className="apple-input" />
              </ResponsiveFormField>
              
              <ResponsiveFormField label="الماركة" required>
                <input className="apple-input" />
              </ResponsiveFormField>
            </ResponsiveGrid>
          </ResponsiveCard>

          {/* بيانات العميل */}
          <ResponsiveCard title="بيانات العميل" icon={User}>
            <ResponsiveGrid cols="2" gap="md">
              <ResponsiveFormField label="الاسم" required>
                <input className="apple-input" />
              </ResponsiveFormField>
              
              <ResponsiveFormField label="رقم الجوال" required>
                <input className="apple-input" />
              </ResponsiveFormField>
            </ResponsiveGrid>
          </ResponsiveCard>

          {/* أزرار الإجراءات */}
          <div className="flex justify-end">
            <ResponsiveButton size="lg">
              <Save className="ml-2" size={20} />
              حفظ
            </ResponsiveButton>
          </div>
        </ResponsiveStack>
      </form>
    </ResponsiveContainer>
  );
};

export default NewVehicle;
```

---

## نقاط التوقف (Breakpoints)

يستخدم التطبيق نقاط توقف Tailwind CSS الافتراضية:

- `sm`: ≥ 640px (Phones في landscape)
- `md`: ≥ 768px (Tablets)
- `lg`: ≥ 1024px (Small Desktops)
- `xl`: ≥ 1280px (Large Desktops)
- `2xl`: ≥ 1536px (Extra Large Desktops)

---

## إرشادات التصميم

### 1. المسافات (Spacing)
- استخدم `gap-4` (md) كقيمة افتراضية
- على الموبايل: قلل المسافات إلى `gap-2` إذا لزم الأمر
- على الديسكتوب: يمكن زيادتها إلى `gap-6` للمساحات الكبيرة

### 2. النصوص (Typography)
- العناوين: `text-2xl sm:text-3xl`
- النصوص العادية: `text-sm sm:text-base`
- النصوص الصغيرة: `text-xs sm:text-sm`

### 3. الأزرار (Buttons)
- على الموبايل: عرض كامل `w-full`
- على الديسكتوب: عرض تلقائي `sm:w-auto`

### 4. البطاقات (Cards)
- Padding على الموبايل: `p-4`
- Padding على الديسكتوب: `sm:p-6`

---

## الملفات المحدّثة

تم تطبيق التصميم المتجاوب على:
- ✅ Login.jsx
- ✅ Dashboard.jsx
- ✅ VehicleDetails.jsx (جزئياً)
- ✅ Operations.jsx
- ✅ Customers.jsx

### الملفات التي تحتاج تحديث:
- 🔄 NewVehicle.jsx
- 🔄 CustomerDetails.jsx
- 🔄 DocumentPrint.jsx
- 🔄 ServicesManagement.jsx
- 🔄 PartsCatalog.jsx

---

## اختبار التصميم المتجاوب

استخدم Chrome DevTools للاختبار:
1. افتح Developer Tools (F12)
2. اضغط على Toggle Device Toolbar (Ctrl+Shift+M)
3. اختبر على:
   - iPhone SE (375×667)
   - iPad (768×1024)
   - Desktop (1920×1080)

---

## نصائح مهمة

1. **دائماً ابدأ من الموبايل أولاً** (Mobile-First)
2. **استخدم المكونات الجاهزة** بدلاً من كتابة CSS مخصص
3. **اختبر على أجهزة حقيقية** إن أمكن
4. **تجنب الأحجام الثابتة** (fixed widths)
5. **استخدم Flexbox و Grid** للتخطيط
