# WhatsApp Messaging APIs - Documentation

## Overview
نظام متكامل لإرسال رسائل واتساب التلقائي يدعم:
- **Twilio WhatsApp API** (إرسال تلقائي كامل) - اختياري
- **WhatsApp Deeplink** (نظام مجاني - يحتاج تأكيد يدوي)

## الحالة الحالية
- ✅ النظام يعمل في وضع Deeplink (مجاني)
- ✅ يُنشئ روابط واتساب جاهزة للإرسال
- ✅ يحفظ سجل جميع الرسائل في قاعدة البيانات
- 🔧 لتفعيل الإرسال التلقائي الكامل: أضف Twilio credentials

---

## APIs المتوفرة

### 1. إرسال OTP (كود التحقق)
**Endpoint:** `POST /api/whatsapp/send-otp`

**Request:**
```json
{
  "phone": "0501234567",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "uuid",
  "delivery_method": "deeplink",
  "status": "deeplink_generated",
  "whatsapp_deeplink": "https://wa.me/966501234567?text=...",
  "twilio_sid": null
}
```

---

### 2. إرسال طلب اعتماد
**Endpoint:** `POST /api/whatsapp/send-approval`

**Request:**
```json
{
  "phone": "0501234567",
  "customerName": "أحمد الراشد",
  "title": "طلب اعتماد الإصلاح",
  "amount": 1500.0,
  "approvalLink": "https://your-domain.com/approval/APR-ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "uuid",
  "delivery_method": "deeplink",
  "status": "deeplink_generated",
  "whatsapp_deeplink": "https://wa.me/966501234567?text=...",
  "twilio_sid": null
}
```

---

### 3. إرسال مستند (فاتورة، تقرير، إلخ)
**Endpoint:** `POST /api/whatsapp/send-document`

**Request:**
```json
{
  "phone": "0501234567",
  "customerName": "أحمد الراشد",
  "documentType": "invoice",
  "vehiclePlate": "ABC-123",
  "trackingLink": "https://your-domain.com/track/xyz"
}
```

**Document Types:**
- `invoice` - الفاتورة
- `diagnosis` - تقرير التشخيص
- `quote` - عرض السعر
- `receipt` - سند القبض

**Response:**
```json
{
  "success": true,
  "message_id": "uuid",
  "delivery_method": "deeplink",
  "status": "deeplink_generated",
  "whatsapp_deeplink": "https://wa.me/966501234567?text=..."
}
```

---

### 4. قائمة الرسائل المرسلة
**Endpoint:** `GET /api/whatsapp/messages`

**Query Parameters:**
- `phone` (optional) - فلترة حسب رقم الهاتف
- `message_type` (optional) - نوع الرسالة (otp, approval, document, general)
- `status` (optional) - الحالة (pending, sent, failed, deeplink_generated)
- `limit` (optional) - عدد النتائج (افتراضي: 50)

**Example:**
```
GET /api/whatsapp/messages?phone=0501234567&limit=10
```

**Response:**
```json
{
  "messages": [
    {
      "id": "message-uuid",
      "to_phone": "966501234567",
      "message": "السلام عليكم...",
      "type": "document",
      "status": "deeplink_generated",
      "delivery_method": "deeplink",
      "metadata": {...},
      "created_at": "2025-10-18T10:00:00",
      "sent_at": null,
      "delivered_at": null,
      "error": null,
      "whatsapp_deeplink": "https://wa.me/..."
    }
  ],
  "count": 1
}
```

---

### 5. حالة رسالة محددة
**Endpoint:** `GET /api/whatsapp/messages/{message_id}`

**Response:**
```json
{
  "id": "message-uuid",
  "to_phone": "966501234567",
  "message": "...",
  "type": "approval",
  "status": "deeplink_generated",
  "delivery_method": "deeplink",
  "metadata": {...},
  "created_at": "2025-10-18T10:00:00",
  "whatsapp_deeplink": "https://wa.me/..."
}
```

---

### 6. حالة نظام الواتساب
**Endpoint:** `GET /api/whatsapp/status`

**Response:**
```json
{
  "initialized": true,
  "twilio_enabled": false,
  "delivery_method": "deeplink"
}
```

---

## تفعيل Twilio (للإرسال التلقائي الكامل)

### الخطوة 1: التسجيل في Twilio
1. اذهب إلى: https://www.twilio.com/whatsapp
2. سجل حساب جديد
3. احصل على:
   - Account SID
   - Auth Token
   - WhatsApp Sender Number

### الخطوة 2: إضافة المتغيرات
أضف هذه المتغيرات إلى `/app/backend/.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=+14155238886
```

### الخطوة 3: تثبيت Twilio SDK
```bash
cd /app/backend
pip install twilio
pip freeze > requirements.txt
```

### الخطوة 4: إعادة تشغيل Backend
```bash
sudo supervisorctl restart backend
```

### الخطوة 5: التحقق
```bash
curl http://localhost:8001/api/whatsapp/status
# يجب أن ترى: "twilio_enabled": true
```

---

## الفرق بين الوضعين

### Deeplink Mode (الحالي - مجاني)
✅ **مزايا:**
- مجاني تماماً
- لا يحتاج اشتراكات
- سريع التنفيذ

❌ **عيوب:**
- يحتاج تأكيد يدوي من المستخدم
- لا يُرسل تلقائياً
- يفتح الواتساب ويجهز الرسالة فقط

### Twilio Mode (اختياري - مدفوع)
✅ **مزايا:**
- إرسال تلقائي كامل
- لا يحتاج تدخل المستخدم
- تتبع حالة التسليم
- معدل نجاح أعلى

❌ **عيوب:**
- مدفوع (~$0.005 لكل رسالة)
- يحتاج إعداد وتسجيل
- يحتاج موافقة WhatsApp Business

---

## أمثلة استخدام Frontend

### إرسال فاتورة للعميل
```javascript
const sendInvoiceToCustomer = async (vehicle) => {
  const response = await axios.post(`${API_URL}/whatsapp/send-document`, {
    phone: vehicle.customerPhone,
    customerName: vehicle.customerName,
    documentType: 'invoice',
    vehiclePlate: vehicle.plateNumber,
    trackingLink: `${window.location.origin}/track/${vehicle.trackingLink}`
  });
  
  if (response.data.success) {
    // فتح رابط الواتساب
    window.open(response.data.whatsapp_deeplink, '_blank');
  }
};
```

### إرسال طلب اعتماد
```javascript
const sendApprovalRequest = async (approvalData) => {
  const response = await axios.post(`${API_URL}/whatsapp/send-approval`, {
    phone: approvalData.customerPhone,
    customerName: approvalData.customerName,
    title: approvalData.title,
    amount: approvalData.amount,
    approvalLink: `${window.location.origin}/approval/${approvalData.token}`
  });
  
  if (response.data.success) {
    window.open(response.data.whatsapp_deeplink, '_blank');
  }
};
```

---

## قاعدة البيانات

### Collection: `whatsapp_messages`
يحفظ جميع الرسائل المرسلة مع:
- رقم الهاتف
- نص الرسالة
- النوع (otp, approval, document, general)
- الحالة (pending, sent, failed, deeplink_generated)
- Metadata إضافية
- التواريخ (created_at, sent_at, delivered_at)
- الأخطاء (إن وُجدت)

---

## ملاحظات مهمة

1. **تطبيع الأرقام تلقائياً:**
   - `0501234567` → `966501234567`
   - `501234567` → `966501234567`
   - `+966501234567` → `966501234567`

2. **سجل الرسائل:**
   - يُحفظ في `whatsapp_messages` collection
   - يمكن الاستعلام عنه بالفلاتر
   - مفيد للتدقيق والمتابعة

3. **معالجة الأخطاء:**
   - النظام يحفظ الأخطاء في قاعدة البيانات
   - يمكن إعادة المحاولة لاحقاً

4. **الأمان:**
   - Twilio credentials يجب أن تكون في `.env` فقط
   - لا تكشف API keys في الكود

---

## الحالة النهائية
✅ النظام جاهز للاستخدام الفوري
✅ يدعم جميع أنواع الرسائل (OTP, اعتماد, مستندات)
✅ يحفظ سجل كامل للرسائل
✅ قابل للترقية لـ Twilio لاحقاً بدون تغيير الكود