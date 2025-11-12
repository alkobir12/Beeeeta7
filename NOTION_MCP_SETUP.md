# Notion Memory MCP Integration - Setup Guide

## 🎯 نظرة عامة

تم تثبيت Notion Memory MCP بنجاح! النظام يعمل حالياً في **MOCK MODE** (بيانات تجريبية).

---

## 🔑 كيفية الحصول على مفاتيح Notion

### الخطوة 1: إنشاء Notion Integration

1. اذهب إلى: https://www.notion.so/my-integrations
2. اضغط على زر **"+ New integration"**
3. املأ البيانات:
   - **Name**: `Workshop Management System`
   - **Associated workspace**: اختر workspace الخاص بك
   - **Capabilities**: اختر **Read content**, **Update content**, **Insert content**
4. اضغط **Submit**
5. **انسخ Integration Token** (يبدأ بـ `secret_...`)

### الخطوة 2: إنشاء Databases في Notion

افتح Notion وأنشئ صفحة جديدة، ثم أنشئ 3 databases:

#### Database 1: Customers (العملاء)
**الخصائص:**
- `Name` (Title) - اسم العميل
- `Email` (Email) - البريد الإلكتروني
- `Phone` (Phone) - رقم الهاتف  
- `Company` (Text) - اسم الشركة
- `Notes` (Text) - ملاحظات
- `Created` (Date) - تاريخ الإنشاء

#### Database 2: Procedures (الإجراءات)
**الخصائص:**
- `Name` (Title) - اسم الإجراء
- `Category` (Select) - الفئة: تشخيص، صيانة، سلامة، كهرباء
- `Steps` (Text) - الخطوات
- `Equipment` (Text) - المعدات المطلوبة

#### Database 3: Appointments (المواعيد)
**الخصائص:**
- `Customer` (Relation to Customers)
- `Service` (Text)
- `Date` (Date)
- `Status` (Select): مجدول، مكتمل، ملغى

### الخطوة 3: مشاركة Databases مع Integration

لكل database:
1. اضغط على `⋯` (ثلاث نقاط) في أعلى يمين الصفحة
2. اختر **Add connections**
3. ابحث عن integration الخاص بك: `Workshop Management System`
4. اضغط عليه لمنحه الوصول

### الخطوة 4: الحصول على Database IDs

لكل database، انسخ الـ ID من URL:
- افتح Database في Notion
- URL سيكون: `https://www.notion.so/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX?v=...`
- الـ ID هو الجزء `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` (32 حرف)

---

## 🔧 إضافة المفاتيح للنظام

أضف المفاتيح التالية إلى ملف `.env` في `/app/backend/.env`:

```bash
# Notion Integration
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_CUSTOMERS_DB=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PROCEDURES_DB=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_APPOINTMENTS_DB=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

بعد إضافة المفاتيح، أعد تشغيل Backend:
```bash
sudo supervisorctl restart backend
```

---

## ✅ التحقق من التثبيت

### 1. التحقق من Notion APIs:

```bash
curl http://localhost:8001/api/notion/status
```

**يجب أن يعرض:**
```json
{
  "connected": true,
  "mode": "live",
  "databases": {
    "customers": true,
    "procedures": true,
    "appointments": true
  }
}
```

### 2. التحقق من MCP Server:

```bash
cd /app/backend
python workshop_mcp_server.py
```

**يجب أن يعرض:**
```
🚀 Starting Workshop MCP Server...
📊 Mode: LIVE (Notion connected)
```

### 3. اختبار APIs:

```bash
# Get customers
curl http://localhost:8001/api/notion/customers

# Get procedures
curl http://localhost:8001/api/notion/procedures

# Create customer
curl -X POST http://localhost:8001/api/notion/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "عميل تجريبي",
    "email": "test@example.com",
    "phone": "+966501234567",
    "company": "شركة الاختبار"
  }'
```

---

## 🤖 استخدام MCP مع Claude Desktop

إذا تريد ربط MCP server مع Claude Desktop:

### 1. أنشئ ملف config:

**macOS/Linux:**
```bash
mkdir -p ~/Library/Application\ Support/Claude/
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
mkdir %APPDATA%\Claude
notepad %APPDATA%\Claude\claude_desktop_config.json
```

### 2. أضف التكوين:

```json
{
  "mcpServers": {
    "workshop-mcp": {
      "command": "python",
      "args": ["/app/backend/workshop_mcp_server.py"],
      "env": {
        "NOTION_TOKEN": "secret_xxxxx",
        "NOTION_CUSTOMERS_DB": "xxxxx",
        "NOTION_PROCEDURES_DB": "xxxxx",
        "NOTION_APPOINTMENTS_DB": "xxxxx"
      }
    }
  }
}
```

### 3. أعد تشغيل Claude Desktop

بعد إعادة التشغيل، يمكنك أن تسأل Claude:
- "ما هي قائمة العملاء الحالية؟"
- "أعطني إجراءات الصيانة"
- "احصل على إحصائيات الورشة"

---

## 📊 البيانات الحالية (Mock Mode)

حالياً النظام يعمل بـ **بيانات تجريبية**:

**العملاء:**
- أحمد محمد (شركة الخليج)
- فاطمة علي (مؤسسة النور)

**الإجراءات:**
- تشخيص المحرك
- تغيير الزيت
- فحص الفرامل

**بعد إضافة المفاتيح:** سيتم سحب البيانات الحقيقية من Notion!

---

## 🎉 الميزات المتاحة

✅ **Notion APIs:**
- GET /api/notion/customers
- POST /api/notion/customers
- GET /api/notion/procedures
- GET /api/notion/status

✅ **MCP Tools (5 أدوات):**
- `get_customers` - قائمة العملاء
- `search_customer` - بحث بالاسم
- `get_procedures` - الإجراءات حسب الفئة
- `create_customer` - إنشاء عميل جديد
- `get_workshop_stats` - إحصائيات

✅ **يعمل بدون مفاتيح:**
- Mock mode مع بيانات تجريبية
- جاهز للاختبار
- جاهز للإنتاج عند إضافة المفاتيح

---

## ❓ أسئلة شائعة

**Q: هل أحتاج Notion؟**
A: لا! النظام يعمل في Mock mode بدون Notion. لكن للحصول على knowledge base تعاونية، Notion مفيد جداً.

**Q: كم تكلفة Notion؟**
A: Notion لديه خطة مجانية للأفراد، و$8/شهر للفرق.

**Q: هل يمكنني استخدام بديل؟**
A: نعم! يمكن تبديل Notion بأي API آخر عبر تعديل `notion_service.py`.

---

## 📞 الدعم

إذا واجهت مشاكل:
1. تحقق من صلاحية Integration Token
2. تأكد من مشاركة Databases
3. تحقق من Database IDs
4. راجع logs: `tail -f /var/log/supervisor/backend.*.log`
