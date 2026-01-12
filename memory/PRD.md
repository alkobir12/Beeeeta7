# Workshop Management System - PRD

## المتطلبات الأصلية
نظام إدارة ورشة سيارات متكامل يدعم:
- إدارة المركبات والعملاء
- تتبع حالة الإصلاح
- نظام ثنائي اللغة (عربي/إنجليزي)
- إدارة الفنيين والعمليات
- المستندات والفواتير
- **خبير ديزل ذكي مع قاعدة معرفة ذاتية التعلم**

## المستخدمين المستهدفين
- مدراء الورش
- الفنيين
- موظفي الاستقبال

## التقنيات المستخدمة
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL) + In-Memory (Fault Knowledge)
- **i18n**: react-i18next
- **AI**: OpenAI GPT-4o-mini (via Emergent LLM Key)

---

## ما تم إنجازه

### الجلسة الحالية (12 يناير 2025)

#### ✅ نظام خبير الديزل المتكامل مع قاعدة المعرفة
**الميزات الجديدة:**

1. **قاعدة معرفة الأعطال (التطوير الذاتي)**
   - إضافة أعطال جديدة مع: العنوان، نوع المركبة، الأعراض، أكواد DTC، خطوات التشخيص، الحل، القطع المطلوبة، التكلفة
   - رفع ملفات صوت/فيديو للأعطال
   - البحث في الأعطال المحفوظة
   - إحصائيات قاعدة المعرفة

2. **خبير الديزل المتكامل**
   - ربط مع قاعدة المعرفة (يقتبس من الحلول السابقة)
   - **بحث سريع أثناء الكتابة** - يعرض نتائج من قاعدة المعرفة
   - كشف أكواد الأعطال تلقائياً من النص
   - عرض مصادر المعرفة في الرد
   - نموذج GPT-4o-mini للسرعة

3. **أزرار سريعة**: P0087, P0234, Turbo, Fuel Pressure, Knowledge Base

4. **واجهة محسنة للجوال**
   - القائمة الجانبية تعرض جميع العناصر
   - صفحات محسنة للشاشات الصغيرة

**الملفات الجديدة:**
- `/app/backend/routes_fault_knowledge.py` - API قاعدة المعرفة
- `/app/backend/routes_diesel_expert.py` - خبير الديزل المتكامل
- `/app/frontend/src/pages/FaultKnowledge.jsx` - واجهة قاعدة المعرفة
- `/app/frontend/src/pages/DieselExpertChat.jsx` - واجهة خبير الديزل المحسنة

**الملفات المعدلة:**
- `/app/frontend/src/App.js` - إضافة مسار /fault-knowledge
- `/app/frontend/src/components/Sidebar.jsx` - إضافة رابط قاعدة المعرفة

### الجلسات السابقة
- ✅ ترحيل نظام الترجمة إلى `react-i18next`
- ✅ إصلاح التحديث الفوري للوحة التحكم
- ✅ إصلاح مشكلة حفظ فني جديد
- ✅ حذف العمليات المرتبطة عند حذف مركبة

---

## البنية المعمارية

```
/app
├── backend/
│   ├── server.py                    # API الرئيسي
│   ├── routes_diesel_expert.py      # NEW: خبير الديزل المتكامل
│   ├── routes_fault_knowledge.py    # NEW: قاعدة المعرفة
│   └── routes_diesel_chat.py        # المحادثة الأساسية
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── DieselExpertChat.jsx # محسن: مع بحث سريع
    │   │   ├── FaultKnowledge.jsx   # NEW: إدارة الأعطال
    │   │   └── Dashboard.jsx
    │   ├── components/
    │   │   └── Sidebar.jsx          # محسن: روابط جديدة
    │   └── App.js                   # مسارات جديدة
```

---

## API Endpoints

### قاعدة المعرفة
- `GET /api/faults/list` - قائمة الأعطال
- `POST /api/faults/add` - إضافة عطل (FormData)
- `POST /api/faults/search` - بحث في الأعطال
- `GET /api/faults/{id}` - تفاصيل عطل
- `DELETE /api/faults/{id}` - حذف عطل
- `GET /api/faults/stats/summary` - إحصائيات

### خبير الديزل المتكامل
- `POST /api/diesel-expert` - محادثة مع قاعدة المعرفة
- `GET /api/diesel-expert/quick-search?q=` - بحث سريع
- `POST /api/diesel-expert/analyze` - تحليل عطل شامل
- `GET /api/diesel-expert/health` - حالة الخدمة

---

## المهام المعلقة

### P1 - أولوية عالية
- [ ] التحقق من تغطية الترجمة الكاملة
- [ ] اختبار نظام الزيارات

### P2 - أولوية متوسطة
- [ ] ربط Google Drive
- [ ] حفظ قاعدة المعرفة في Supabase (حالياً في الذاكرة)

### P3 - أولوية منخفضة
- [ ] إضافة بحث الإنترنت الفعلي
- [ ] تحليل الفيديو/الصوت بالذكاء الاصطناعي
