# AutoPro Workshop Management System PRD

## Original Problem Statement
نظام إدارة ورشة سيارات متكامل يدعم اللغة العربية، مع وحدات محاسبية ومالية شاملة، وبوت واتساب ذكي، ووحدة MoltBot للذكاء الاصطناعي.

---

## Core Requirements
1. **Workshop Management**: Vehicle/customer management, visit tracking, service/parts catalog
2. **Financial Module**: Operations, journal entries, chart of accounts, financial reports
3. **MoltBot AI**: Intelligent code editor for FastAPI project analysis and modification
4. **Smart Guidance**: Step-by-step instructions for elderly users
5. **PDF/Document**: Invoice, quotation, diagnosis report generation
6. **WhatsApp Bot**: Customer communication via Infobip API + Auto notifications

---

## What's Been Implemented

### Auto WhatsApp Notification (11 Feb 2026 - NEW)
- When a visit is closed (status=completed), backend auto-generates WhatsApp notification
- Returns whatsappNotification object with url, phone, message, customerName
- Frontend shows green banner at page level with "إرسال واتساب" button
- Message includes: customer name, vehicle plate, total amount
- Phone auto-normalized to 966 format
- Uses deeplink mode (wa.me URL) - no Twilio needed
- Banner persists across re-renders with page-level state
- Filter auto-switches to 'all' when visit is closed

### Visit System Fix (11 Feb 2026)
- Fixed critical bug: visits disappearing after save/close
- handleCloseVisit now saves items+notes+mileage alongside status change
- Fixed backend 500 error (removed non-existent updated_at column)
- Added loading state (isSaving) to prevent double-clicks
- Added confirmation dialog before closing visits
- Visit filters show counts (all/open/closed)
- Warning when filter hides visits
- Fixed "Invalid Date" display in dates section
- Added lightweight fetchDataLight for partial refreshes

### MoltBot (10 Feb 2026)
- Multi-agent architecture (Planner, Builder, Reviewer)
- Intelligent code editor with diff patches
- File-by-file patch application with rollback
- Interactive chat interface

### Smart Guidance (10 Feb 2026)
- GuidanceStepper component for VehicleDetails and Operations
- Per-user enable/disable via guidanceEnabled flag

### Financial/Accounting
- Full CRUD for journal entries
- Chart of accounts, balance sheet, income statement, cash flow
- Auto journal entry creation from operations

### Other Completed Features
- Theme system (dark/light/dash-pro)
- Code splitting with React.lazy
- PDF generation (direct fetch, no preview required)
- Customer approval page with OTP
- Customer import from Excel/CSV
- WhatsApp bot integration
- Vehicle files/photos upload

### Vehicle Details Liquid System Unification (14 Feb 2026)
- توحيد صفحة المركبة بالكامل على تصميم Liquid System (إزالة apple-card وتوحيد الكروت، الأزرار، الحالات، النوافذ)
- تحسين حالات الفراغ والفلاتر وإعادة تصميم شريط العنوان والطباعة
- إضافة data-testid فريدة لكل العناصر التفاعلية وأهم البيانات المعروضة
- ملاحظة: يلزم تحقق بصري بعد تسجيل الدخول (لقطة الاختبار وصلت لشاشة تسجيل الدخول فقط)

### موردون + نوع بند المورد (14 Feb 2026)
- إضافة نوع بند جديد "مورد" في بنود الزيارة مع اختيار المورد من قائمة الموردين
- تحسين صفحة الموردين بإضافة نافذة إنشاء/تعديل مورد وحفظه عبر API

---

## Architecture

### Frontend: React 18 + TailwindCSS + Shadcn/UI
### Backend: FastAPI + Supabase (PostgreSQL) + MongoDB fallback
### Key Routes
- `/vehicle/:id` - Vehicle details with visits
- `/operations` - Financial operations
- `/moltbot` - AI code editor
- `/print` - Document generation

### Key API Endpoints
- `GET/POST /api/vehicles/{id}/visits` - Visit CRUD
- `PUT /api/visits/{id}` - Visit update (returns whatsappNotification on completion)
- `DELETE /api/visits/{id}` - Visit delete
- `POST /api/notifications/prepare` - WhatsApp deeplink generator
- `GET/POST /api/operations` - Financial operations
- `POST /api/moltbot/chat` - AI chat

---

## Current Status

### P0 - Critical (COMPLETED)
- [x] Fix visits disappearing after save/close
- [x] Auto WhatsApp notification on visit close

### P1 - High Priority
- [ ] Integrate Llama 4 (Scout & Maverick) into MoltBot
- [ ] Production site fixsa.online sync (blocked on user redeployment)

### P2 - Medium Priority
- [ ] Enhance MoltBot with emergent.sh-like capabilities
- [ ] Add filter/search to service/part selection in visits
- [ ] General performance improvements

### P3 - Low Priority
- [ ] quick_actions.subtitle translation visibility
- [ ] Add "Reset Guidance" button in profile
- [ ] Streaming responses for MoltBot/AbuFahd
- [ ] Auto dark/light mode detection
- [ ] Excel export for reports

---

## Test Credentials
- Username: مدير
- Workshop ID: finmodule-sync
- API URL: https://liquid-fleet.preview.emergentagent.com
- Groq API Key: configured in backend/.env

## Key Files
- `frontend/src/pages/VehicleDetails.jsx` - Visit management + WhatsApp notification
- `backend/routes_extended.py` - Visit CRUD + WhatsApp notification logic
- `backend/visit_sync.py` - Visit-to-operation sync
- `backend/whatsapp_service.py` - WhatsApp service (Twilio + deeplink)
- `frontend/src/pages/MoltBot.jsx` - AI code editor
- `backend/routes_moltbot.py` - MoltBot backend

## Update History
| Date | Description |
|------|-------------|
| 11 Feb 2026 | Auto WhatsApp notification on visit close + page-level banner |
| 11 Feb 2026 | Fix visits disappearing + filter counts + Invalid Date fix |
| 10 Feb 2026 | MoltBot, Smart Guidance, PDF fixes, Visit UI improvements |
| 11 Feb 2026 | Operations page UI/UX refresh: dashboard-style cards + expandable details + inline edit items/prices |
| 14 Feb 2026 | Vehicle Details Liquid System UI unification + unique test IDs |
