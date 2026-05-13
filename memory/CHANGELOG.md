# CHANGELOG

## 13 May 2026 — Smart POS reference operations + journal card clarity
- Smart POS now creates reference operations via `POST /api/operations` for most templates instead of only writing standalone journal entries.
- Journal entries API now exposes `payment_method`, `payment_method_label_ar`, `payment_status`, and `payment_status_label_ar`.
- Journal Entries cards now show clearer payment method/source/status pills in Arabic.
- Bank deposit remains a direct journal-entry flow for now.

## 13 May 2026 — OperationCard payment visibility fix
- Operations page now refetches operation data on mount instead of relying on stale cached status.
- Added explicit payment status pill, paid amount, and remaining balance display to `OperationCard.jsx`.
- Improved journal entry text fallback so service operations show `إيرادات الخدمات` instead of incomplete `الحساب` text.
- Verified on the real case: paid 300 / remaining 2000 is now clearly visible in the UI.

## 13 May 2026 — Live vehicle updates reflected in operations
- `GET /api/operations` and `GET /api/operations/{id}` now enrich vehicle-linked operations with live vehicle/customer fields from the current vehicle record.
- Operations responses now include `customerName`, `customerPhone`, `vehiclePlate`, `vehicleBrand`, and `vehicleModel` for linked vehicle operations.
- `OperationCard.jsx` now prefers live vehicle customer data for customer-linked vehicle operations.

## 13 May 2026 — Supplier/vehicle reference-page linking
- Added supplier journal-token parsing so supplier-linked manual/POS journal entries can be surfaced inside supplier movements.
- Added linked journal entries panel in `VehicleDetails.jsx` so vehicle/customer/visit-related journal entries appear inside the vehicle file.
- Improved suppliers loading state copy for long-running balance/movement fetches.
- Fixed `extractJournalTag` regex parsing in VehicleDetails after test feedback.

## 12 May 2026 — Payments ↔ Operations sync completed
- Linked operation payment fields to live visit payment data in `supabase_service.py`.
- `GET /api/operations` and `GET /api/operations/{id}` now surface `paymentMethod`, `paymentStatus`, `paymentAmount`, `totalPaid`, `advancePaid`, and `balance` from the linked visit when available.
- Verified the visit-linked operation flow without creating new test data.

## 12 May 2026 — Vehicle files + receipt vouchers + account mapping audit
- Fixed vehicle `fileNumber` and `customerFileNumber` save flow across backend and VehicleDetails UI.
- Fixed Smart POS account mapping so salary uses `036 رواتب إدارية` and payment methods map correctly to `003/004/006`.
- Added visit payment journal posting from VehicleDetails using `source=visit_receipt_voucher` and visit/customer/vehicle tokens.
- Improved `GET /api/finance/journal-entries/{entry_id}` to expose top-level fields plus backward-compatible `data`.
- Cleaned recent test data (test vehicles, test journal entries, and extra temporary payment artifacts).

## 11 May 2026 — Smart POS Journal completed
- Completed `SmartPOSJournal.jsx` as a single-screen Smart POS for journal entries.
- Added 8 templates: instant sale, cash sale, bank/card sale, salary, cash expense, collect customer, pay supplier, bank deposit.
- Merged the old cashier cart into the **items section** inside the same Smart POS flow.
- Added customer, vehicle, and items fields with live lookup from customers, suppliers, vehicles, parts, and services APIs.
- Saving now posts balanced journal entries to `POST /api/finance/journal-entries` with `[PARTY]`, `[PARTY_TYPE]`, `[VEHICLE_REF]` description tags.
- Added recent-entry copy flow and kept POS/full view toggle working.
- Hardened `JournalEntries.jsx` fetch lifecycle with `AbortController` during navigation.

## Verification
- `/app/test_reports/iteration_206.json` → PASS
- `/app/test_reports/iteration_205.json` → PASS
- `/app/test_reports/iteration_203.json` → PASS
- `/app/test_reports/iteration_202.json` → PASS
- `/app/test_reports/iteration_201.json` → PASS
- `/app/test_reports/iteration_200.json` → PASS (with low note fixed afterward)
- `/app/test_reports/iteration_199.json` → PASS
- `auto_frontend_testing_agent` → PASS
- `deep_testing_backend_v2` → 7/7 PASS
