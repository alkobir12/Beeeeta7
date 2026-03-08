"""
Supabase Service for Workshop Management System
Handles Supabase database interactions
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables at module level
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    load_dotenv(_env_file)

try:
    from supabase import create_client, Client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️ supabase not installed")

# -------- Mapping helpers --------


def to_snake_vehicle(api: Dict[str, Any]) -> Dict[str, Any]:
    # Helper to convert empty strings to None for UUID fields
    def clean_uuid(value):
        return value if value and value.strip() else None

    return {
        "id": api.get("id"),
        "plate_number": api.get("plateNumber"),
        "brand": api.get("brand"),
        "model": api.get("model"),
        "year": api.get("year"),
        "color": api.get("color"),
        "vin": clean_uuid(api.get("vin")),
        "file_number": api.get("fileNumber"),
        "customer_id": clean_uuid(api.get("customerId")),
        "customer_name": api.get("customerName"),
        "customer_phone": api.get("customerPhone"),
        "customer_email": api.get("customerEmail"),
        "status": api.get("status"),
        "entry_date": api.get("entryDate"),
        "estimated_completion": api.get("estimatedCompletion"),
        "completion_date": api.get("completionDate"),
        "tracking_link": api.get("trackingLink"),
        "images": api.get("images") or [],
        "services": api.get("services") or [],
        "parts": api.get("parts") or [],
        "technician_id": clean_uuid(api.get("technicianId")),
        "technician_name": api.get("technicianName"),
        "notes": api.get("notes"),
    }


def to_camel_vehicle(dbrow: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": dbrow.get("id"),
        "plateNumber": dbrow.get("plate_number"),
        "brand": dbrow.get("brand"),
        "model": dbrow.get("model"),
        "year": dbrow.get("year"),
        "color": dbrow.get("color"),
        "vin": dbrow.get("vin"),
        "fileNumber": dbrow.get("file_number"),
        "customerId": dbrow.get("customer_id"),
        "customerName": dbrow.get("customer_name") or "",
        "customerPhone": dbrow.get("customer_phone") or "",
        "customerEmail": dbrow.get("customer_email") or "",
        "status": dbrow.get("status") or "diagnosis",
        "entryDate": dbrow.get("entry_date"),
        "estimatedCompletion": dbrow.get("estimated_completion"),
        "completionDate": dbrow.get("completion_date"),
        "trackingLink": dbrow.get("tracking_link"),
        "images": dbrow.get("images") or [],
        "services": dbrow.get("services") or [],
        "parts": dbrow.get("parts") or [],
        "technicianId": dbrow.get("technician_id"),
        "technicianName": dbrow.get("technician_name"),
        "notes": dbrow.get("notes"),
    }


class SupabaseService:
    """Service for Supabase database operations"""

    def __init__(self):
        self.supabase_url = os.environ.get("SUPABASE_URL", "")
        self.supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if self.supabase_url and self.supabase_key and SUPABASE_AVAILABLE:
            self.client: Client = create_client(self.supabase_url, self.supabase_key)
            self.mock_mode = False
        else:
            self.client = None
            self.mock_mode = True
            print(
                "⚠️ Supabase running in MOCK mode. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable."
            )

    # -------------------- Vehicles --------------------
    def vehicles_list(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        res = (
            self.client.table("vehicles")
            .select("*")
            .order("entry_date", desc=True)
            .execute()
        )
        return [to_camel_vehicle(r) for r in (res.data or [])]

    def vehicles_create(self, api_doc: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return api_doc
        row = to_snake_vehicle(api_doc)
        res = self.client.table("vehicles").insert(row).execute()
        data = (res.data or [{}])[0]
        return to_camel_vehicle(data)

    def vehicles_get(self, vid: str) -> Optional[Dict[str, Any]]:
        if self.mock_mode:
            return None
        # Use maybe_single() so “0 rows” becomes None instead of raising an exception.
        # This prevents 500s when the frontend navigates to a vehicle id that doesn't exist.
        res = (
            self.client.table("vehicles")
            .select("*")
            .eq("id", vid)
            .maybe_single()
            .execute()
        )
        return to_camel_vehicle(res.data) if res and res.data else None

    def vehicles_update(
        self, vid: str, upd_api: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        if self.mock_mode:
            return None
        upd = to_snake_vehicle(upd_api)
        # remove None to avoid overwriting
        upd = {k: v for k, v in upd.items() if v is not None}
        res = self.client.table("vehicles").update(upd).eq("id", vid).execute()
        data = (res.data or [{}])[0]
        return to_camel_vehicle(data)

    def vehicles_delete(self, vid: str) -> bool:
        if self.mock_mode:
            return True
        self.client.table("vehicles").delete().eq("id", vid).execute()
        return True

    # -------------------- Technicians --------------------
    def technicians_list(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        res = (
            self.client.table("technicians")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
        # Convert snake_case to camelCase
        out = []
        for r in rows:
            out.append(
                {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "phone": r.get("phone", ""),
                    "specialty": r.get("specialty", ""),
                    "activeJobs": r.get("active_jobs", 0),
                    "completedJobs": r.get("completed_jobs", 0),
                    "rating": float(r.get("rating", 5.0)),
                }
            )
        return out

    # -------------------- Services --------------------
    def services_list(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        res = (
            self.client.table("services")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
        out = []
        for r in rows:
            out.append(
                {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "category": r.get("category"),
                    "price": float(r.get("price") or 0),
                    "duration": r.get("duration_minutes") or 0,
                    "active": r.get("active", True),
                }
            )
        return out

    def services_create(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return doc
        row = {
            "id": doc.get("id"),
            "name": doc.get("name"),
            "category": doc.get("category"),
            "price": doc.get("price", 0),
            "duration_minutes": doc.get("duration", 0),
            "vat_percent": 0,
            "active": doc.get("active", True),
            "notes": doc.get("notes"),
        }
        res = self.client.table("services").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "name": r.get("name"),
            "category": r.get("category"),
            "price": float(r.get("price") or 0),
            "duration": r.get("duration_minutes") or 0,
            "active": r.get("active", True),
        }

    def services_update(self, sid: str, upd: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return upd
        row = {}
        if "name" in upd:
            row["name"] = upd["name"]
        if "category" in upd:
            row["category"] = upd["category"]
        if "price" in upd:
            row["price"] = upd["price"]
        if "duration" in upd:
            row["duration_minutes"] = upd["duration"]
        if "active" in upd:
            row["active"] = upd["active"]
        if "notes" in upd:
            row["notes"] = upd["notes"]
        res = self.client.table("services").update(row).eq("id", sid).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "name": r.get("name"),
            "category": r.get("category"),
            "price": float(r.get("price") or 0),
            "duration": r.get("duration_minutes") or 0,
            "active": r.get("active", True),
        }

    def services_delete(self, sid: str) -> bool:
        if self.mock_mode:
            return True
        self.client.table("services").delete().eq("id", sid).execute()
        return True

    # -------------------- Business Accounts --------------------
    def accounts_list(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        res = (
            self.client.table("business_accounts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
        return [
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "code": r.get("code"),
                "currency": r.get("currency") or "SAR",
                "createdAt": r.get("created_at"),
            }
            for r in rows
        ]

    def accounts_create(
        self, name: str, code: Optional[str], currency: str
    ) -> Dict[str, Any]:
        if self.mock_mode:
            return {
                "id": "mock",
                "name": name,
                "code": code or "BR01",
                "currency": currency,
                "createdAt": datetime.utcnow().isoformat(),
            }
        row = {"name": name, "code": code or name[:4].upper(), "currency": currency}
        res = self.client.table("business_accounts").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "name": r.get("name"),
            "code": r.get("code"),
            "currency": r.get("currency") or "SAR",
            "createdAt": r.get("created_at"),
        }

    # -------------------- Budgets --------------------
    def budgets_list(
        self, account_id: Optional[str], period: Optional[str]
    ) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        q = self.client.table("budgets").select("*")
        if account_id:
            q = q.eq("account_id", account_id)
        if period:
            q = q.eq("period", period)
        res = q.order("period", desc=True).execute()
        return res.data or []

    def budgets_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload
        row = {
            "account_id": payload.get("accountId"),
            "period": payload.get("period"),
            "income_target": payload.get("incomeTarget", 0),
            "expense_target": payload.get("expenseTarget", 0),
            "notes": payload.get("notes"),
        }
        res = self.client.table("budgets").insert(row).execute()
        return (res.data or [{}])[0]

    # -------------------- Operations (minimal) --------------------
    def operations_list(
        self,
        account_id: Optional[str] = None,
        type: Optional[str] = None,
        vehicle_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        try:
            q = self.client.table("operations").select("*")
            if account_id:
                q = q.eq("account_id", account_id)
            if type:
                q = q.eq("type", type)
            if vehicle_id:
                q = q.eq("vehicle_id", vehicle_id)
            res = q.order("created_at", desc=True).execute()
            rows = res.data or []
        except Exception as e:
            print(f"Supabase operations list error: {e}")
            return []
        # map snake_case to camelCase if needed, or just return as is if frontend expects it
        # The frontend likely expects camelCase.
        out = []
        for r in rows:
            out.append(
                {
                    "id": r.get("id"),
                    "type": r.get("type"),
                    "accountId": r.get("account_id"),
                    "vehicleId": r.get("vehicle_id"),
                    "visitId": r.get("visit_id"),
                    "partnerType": r.get("partner_type"),
                    "partnerName": r.get("partner_name"),
                    "items": r.get("items"),
                    "subtotal": r.get("subtotal"),
                    "total": r.get("total"),
                    "paymentMethod": r.get("payment_method"),
                    "notes": r.get("notes"),
                    "date": r.get("op_date"),
                    "createdAt": r.get("created_at"),
                    "invoiceNumber": r.get("invoice_number"),
                    "scope": r.get("scope") or ("vehicle" if r.get("vehicle_id") else "workshop"),
                    "source": r.get("source"),
                    "businessUnit": r.get("business_unit"),
                }
            )

        return out

    def operations_get(self, op_id: str) -> Optional[Dict[str, Any]]:
        if self.mock_mode:
            return None
        res = self.client.table("operations").select("*").eq("id", op_id).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        r = rows[0]
        return {
            "id": r.get("id"),
            "type": r.get("type"),
            "accountId": r.get("account_id"),
            "vehicleId": r.get("vehicle_id"),
            "visitId": r.get("visit_id"),
            "partnerType": r.get("partner_type"),
            "partnerName": r.get("partner_name"),
            "items": r.get("items"),
            "subtotal": r.get("subtotal"),
            "total": r.get("total"),
            "paymentMethod": r.get("payment_method"),
            "notes": r.get("notes"),
            "date": r.get("op_date"),
            "createdAt": r.get("created_at"),
            "invoiceNumber": r.get("invoice_number"),
            "scope": "vehicle" if r.get("vehicle_id") else "workshop",
        }

    # -------------------- Customers --------------------
    def customers_list(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        q = self.client.table("customers").select("*")
        if search:
            # simple search on name or phone
            q = q.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%")
        res = q.order("last_visit", desc=True).execute()
        rows = res.data or []
        return [
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "phone": r.get("phone"),
                "email": r.get("email"),
                "address": r.get("address"),
                "vehicleBrand": r.get("vehicle_brand"),
                "vehiclePlate": r.get("vehicle_plate"),
                "vehicleKm": r.get("vehicle_km"),
                "totalVisits": r.get("total_visits", 0),
                "lastVisit": r.get("last_visit"),
                "vehicles": r.get("vehicles") or [],
                "createdAt": r.get("created_at"),
            }
            for r in rows
        ]

    def customers_get(self, cid: str) -> Optional[Dict[str, Any]]:
        if self.mock_mode:
            return None
        res = (
            self.client.table("customers").select("*").eq("id", cid).single().execute()
        )
        r = res.data
        if not r:
            return None
        return {
            "id": r.get("id"),
            "name": r.get("name"),
            "phone": r.get("phone"),
            "email": r.get("email"),
            "address": r.get("address"),
            "vehicleBrand": r.get("vehicle_brand"),
            "vehiclePlate": r.get("vehicle_plate"),
            "vehicleKm": r.get("vehicle_km"),
            "totalVisits": r.get("total_visits", 0),
            "lastVisit": r.get("last_visit"),
            "vehicles": r.get("vehicles") or [],
            "createdAt": r.get("created_at"),
        }

    def customers_find_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        if self.mock_mode or not self.client:
            return None
        try:
            res = (
                self.client.table("customers")
                .select("*")
                .eq("phone", phone)
                .maybe_single()
                .execute()
            )
            r = res.data
            if not r:
                return None
            return {
                "id": r.get("id"),
                "name": r.get("name"),
                "phone": r.get("phone"),
                "email": r.get("email"),
                "address": r.get("address"),
                "vehicleBrand": r.get("vehicle_brand"),
                "vehiclePlate": r.get("vehicle_plate"),
                "vehicleKm": r.get("vehicle_km"),
                "totalVisits": r.get("total_visits", 0),
                "lastVisit": r.get("last_visit"),
                "vehicles": r.get("vehicles") or [],
                "createdAt": r.get("created_at"),
            }
        except Exception as e:
            print(f"Error finding customer by phone: {e}")
            return None

    def customers_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload
        row = {
            "name": payload.get("name"),
            "phone": payload.get("phone"),
            "email": payload.get("email"),
            "address": payload.get("address"),
            "vehicle_brand": payload.get("vehicleBrand"),
            "vehicle_plate": payload.get("vehiclePlate"),
            "vehicle_km": payload.get("vehicleKm"),
            "total_visits": payload.get("totalVisits", 0),
            "last_visit": payload.get("lastVisit"),
        }
        if payload.get("id"):
            row["id"] = payload.get("id")

        res = self.client.table("customers").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "name": r.get("name"),
            "phone": r.get("phone"),
            "email": r.get("email"),
            "address": r.get("address"),
            "vehicleBrand": r.get("vehicle_brand"),
            "vehiclePlate": r.get("vehicle_plate"),
            "vehicleKm": r.get("vehicle_km"),
            "totalVisits": r.get("total_visits", 0),
            "lastVisit": r.get("last_visit"),
            "vehicles": r.get("vehicles") or [],
            "createdAt": r.get("created_at"),
        }

    def customers_update(self, cid: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload
        row = {}
        if "name" in payload:
            row["name"] = payload["name"]
        if "phone" in payload:
            row["phone"] = payload["phone"]
        if "email" in payload:
            row["email"] = payload["email"]
        if "address" in payload:
            row["address"] = payload["address"]
        if "vehicleBrand" in payload:
            row["vehicle_brand"] = payload["vehicleBrand"]
        if "vehiclePlate" in payload:
            row["vehicle_plate"] = payload["vehiclePlate"]
        if "vehicleKm" in payload:
            row["vehicle_km"] = payload["vehicleKm"]
        if "totalVisits" in payload:
            row["total_visits"] = payload["totalVisits"]
        if "lastVisit" in payload:
            row["last_visit"] = payload["lastVisit"]
        if "vehicles" in payload:
            row["vehicles"] = payload["vehicles"]

        res = self.client.table("customers").update(row).eq("id", cid).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "name": r.get("name"),
            "phone": r.get("phone"),
            "email": r.get("email"),
            "address": r.get("address"),
            "vehicleBrand": r.get("vehicle_brand"),
            "vehiclePlate": r.get("vehicle_plate"),
            "vehicleKm": r.get("vehicle_km"),
            "totalVisits": r.get("total_visits", 0),
            "lastVisit": r.get("last_visit"),
            "vehicles": r.get("vehicles") or [],
            "createdAt": r.get("created_at"),
        }

    def customers_delete(self, cid: str) -> bool:
        if self.mock_mode:
            return True
        self.client.table("customers").delete().eq("id", cid).execute()
        return True

    def invoices_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload
        row = {
            "invoice_number": payload.get("invoiceNumber"),
            "workshop_id": payload.get("workshopId"),
            "operation_id": payload.get("operationId"),
            "customer_id": payload.get("customerId"),
            "vehicle_id": payload.get("vehicleId"),
            "partner_name": payload.get("partnerName"),
            "items": payload.get("items"),
            "subtotal": payload.get("subtotal"),
            "discount": payload.get("discount") or 0,
            "tax": 0,
            "total": payload.get("total"),
            "status": payload.get("status"),
            "type": payload.get("type"),
            "payment_method": payload.get("paymentMethod"),
            "notes": payload.get("notes"),
        }
        if payload.get("id"):
            row["id"] = payload.get("id")

        res = self.client.table("invoices").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "invoiceNumber": r.get("invoice_number"),
            "customerId": r.get("customer_id"),
            "vehicleId": r.get("vehicle_id"),
            "items": r.get("items"),
            "subtotal": r.get("subtotal"),
            "discount": r.get("discount"),
            "tax": r.get("tax"),
            "total": r.get("total"),
            "status": r.get("status"),
            "type": r.get("type"),
            "paymentMethod": r.get("payment_method"),
            "notes": r.get("notes"),
            "createdAt": r.get("created_at"),
        }

    def invoices_get(self, iid: str) -> Optional[Dict[str, Any]]:
        if self.mock_mode:
            return None
        res = self.client.table("invoices").select("*").eq("id", iid).single().execute()
        r = res.data
        if not r:
            return None
        return {
            "id": r.get("id"),
            "invoiceNumber": r.get("invoice_number"),
            "customerId": r.get("customer_id"),
            "vehicleId": r.get("vehicle_id"),
            "items": r.get("items"),
            "subtotal": r.get("subtotal"),
            "discount": r.get("discount"),
            "tax": r.get("tax"),
            "total": r.get("total"),
            "status": r.get("status"),
            "type": r.get("type"),
            "paymentMethod": r.get("payment_method"),
            "notes": r.get("notes"),
            "createdAt": r.get("created_at"),
        }

    # NOTE: customers_delete defined earlier in this file

    # -------------------- Invoices --------------------
    def invoices_list(
        self, vehicle_id: Optional[str] = None, customer_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        q = self.client.table("invoices").select("*")
        if vehicle_id:
            q = q.eq("vehicle_id", vehicle_id)
        if customer_id:
            q = q.eq("customer_id", customer_id)
        res = q.order("created_at", desc=True).execute()
        rows = res.data or []
        # Map snake to camel
        return [
            {
                "id": r.get("id"),
                "invoiceNumber": r.get("invoice_number"),
                "customerId": r.get("customer_id"),
                "vehicleId": r.get("vehicle_id"),
                "items": r.get("items"),
                "subtotal": r.get("subtotal"),
                "discount": r.get("discount"),
                "tax": r.get("tax"),
                "total": r.get("total"),
                "status": r.get("status"),
                "type": r.get("type"),
                "createdAt": r.get("created_at"),
            }
            for r in rows
        ]

    def invoices_delete_by_vehicle(self, vid: str) -> bool:
        if self.mock_mode:
            return True
        self.client.table("invoices").delete().eq("vehicle_id", vid).execute()
        return True

    def operations_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload

        items = payload.get("items") or []
        # قبول كلٍّ من quantity و qty لحساب الكميات
        subtotal = 0.0
        for it in items:
            qty = float(it.get("quantity", it.get("qty", 1)))
            price = float(it.get("price", 0))
            it["total"] = qty * price
            subtotal += it["total"]

        # تنظيف الحقول التي يجب أن تكون UUID أو NULL
        account_id = payload.get("accountId") or payload.get("account_id") or None
        accounting_account_id = payload.get("accountingAccountId") or payload.get("accounting_account_id") or None
        vehicle_id = payload.get("vehicleId") or payload.get("vehicle_id") or None

        # بعض الجداول لدينا تستخدم UUID، لكن دليل الحسابات لدينا يستخدم مُعرّفات نصية مثل acc-1201.
        # لذلك:
        # - vehicle_id / visit_id يجب أن تكون UUID
        # - account_id قد تكون UUID أو نص (acc-xxxx أو code) فنتركها كما هي إذا كانت نصاً.
        def _sanitize_uuid(value):
            if not value:
                return None
            if not isinstance(value, str):
                return None
            if len(value) != 36 or "-" not in value:
                return None
            return value

        def _sanitize_account_ref(value):
            # Allow UUID or string IDs/codes
            if not value:
                return None
            if not isinstance(value, str):
                return None
            v = value.strip()
            if not v:
                return None
            return v

        account_id = _sanitize_account_ref(account_id)
        accounting_account_id = _sanitize_account_ref(accounting_account_id)
        vehicle_id = _sanitize_uuid(vehicle_id)

        visit_id = payload.get("visitId") or payload.get("visit_id") or None
        visit_id = _sanitize_uuid(visit_id)

        op_date = payload.get("date") or payload.get("opDate") or payload.get("op_date")
        workshop_id = payload.get("workshopId") or payload.get("workshop_id")

        row = {
            "type": payload.get("type", "service"),
            "workshop_id": workshop_id,
            "account_id": account_id,
            "vehicle_id": vehicle_id,
            "visit_id": visit_id,
            "partner_type": payload.get("partnerType"),
            "partner_name": payload.get("partnerName"),
            "items": items,
            "subtotal": subtotal,
            "total": subtotal,
            "payment_method": payload.get("paymentMethod", "cash"),
            "notes": payload.get("notes"),
            "op_date": op_date or datetime.utcnow().isoformat(),
        }
        try:
            res = self.client.table("operations").insert(row).execute()
        except Exception as insert_error:
            # إذا كان جدول العمليات لا يحتوي على visit_id أو workshop_id، أعد المحاولة بدونها
            error_msg = str(insert_error)
            print(f"Operations insert error, retrying without problematic fields: {insert_error}")
            
            # Remove fields that might not exist in the schema
            if "visit_id" in error_msg:
                row.pop("visit_id", None)
            if "workshop_id" in error_msg:
                row.pop("workshop_id", None)
            res = self.client.table("operations").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "type": r.get("type"),
            "accountId": r.get("account_id"),
            "accountingAccountId": accounting_account_id,  # Preserve the original accountingAccountId
            "vehicleId": r.get("vehicle_id"),
            "visitId": r.get("visit_id"),
            "partnerType": r.get("partner_type"),
            "partnerName": r.get("partner_name"),
            "items": r.get("items"),
            "subtotal": r.get("subtotal"),
            "total": r.get("total"),
            "paymentMethod": r.get("payment_method"),
            "notes": r.get("notes"),
            "date": r.get("op_date"),
            "createdAt": r.get("created_at"),
            "invoiceNumber": r.get("invoice_number"),
            "scope": payload.get("scope") or r.get("scope") or ("vehicle" if r.get("vehicle_id") else "workshop"),
            "source": payload.get("source") or r.get("source"),
            "businessUnit": payload.get("businessUnit") or payload.get("business_unit") or r.get("business_unit"),
        }

    def operations_update(self, op_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload
        items = payload.get("items") or []
        subtotal = sum(
            (float(it.get("price", 0)) * float(it.get("quantity", 1))) for it in items
        )
        workshop_id = payload.get("workshopId") or payload.get("workshop_id")

        row = {
            "type": payload.get("type"),
            "workshop_id": workshop_id,
            "account_id": payload.get("accountId"),
            "vehicle_id": payload.get("vehicleId"),
            "partner_type": payload.get("partnerType"),
            "partner_name": payload.get("partnerName"),
            "items": items,
            "subtotal": subtotal,
            "total": subtotal,
            "payment_method": payload.get("paymentMethod"),
            "notes": payload.get("notes"),
            "updated_at": datetime.utcnow().isoformat(),
        }
        # إزالة القيم الفارغة
        row = {k: v for k, v in row.items() if v is not None}
        
        try:
            res = self.client.table("operations").update(row).eq("id", op_id).execute()
        except Exception as update_error:
            # إذا كان جدول العمليات لا يحتوي على workshop_id، أعد المحاولة بدونها
            error_msg = str(update_error)
            print(f"Operations update error, retrying without problematic fields: {update_error}")
            
            # Remove fields that might not exist in the schema
            if "workshop_id" in error_msg:
                row.pop("workshop_id", None)
                
            res = self.client.table("operations").update(row).eq("id", op_id).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "type": r.get("type"),
            "accountId": r.get("account_id"),
            "vehicleId": r.get("vehicle_id"),
            "partnerType": r.get("partner_type"),
            "partnerName": r.get("partner_name"),
            "items": r.get("items"),
            "subtotal": r.get("subtotal"),
            "total": r.get("total"),
            "paymentMethod": r.get("payment_method"),
            "notes": r.get("notes"),
            "date": r.get("op_date"),
            "createdAt": r.get("created_at"),
            "updatedAt": r.get("updated_at"),
        }

    def operations_delete(self, op_id: str) -> bool:
        """حذف عملية واحدة من جدول operations في Supabase"""
        if self.mock_mode:
            return True
        self.client.table("operations").delete().eq("id", op_id).execute()
        return True


    # -------------------- Transactions --------------------
    def transactions_list(
        self, type: Optional[str] = None, account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        q = self.client.table("transactions").select("*")
        if type:
            q = q.eq("type", type)
        if account_id:
            q = q.eq("account_id", account_id)
        res = q.order("date", desc=True).execute()
        rows = res.data or []
        return [
            {
                "id": r.get("id"),
                "accountId": r.get("account_id"),
                "vehicleId": r.get("vehicle_id"),
                "type": r.get("type"),
                "category": r.get("category"),
                "amount": r.get("amount"),
                "description": r.get("description"),
                "date": r.get("date"),
                "reference": r.get("reference"),
                "createdAt": r.get("created_at"),
            }
            for r in rows
        ]

    def transactions_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return payload
        row = {
            "account_id": payload.get("accountId"),
            "vehicle_id": payload.get("vehicleId"),
            "type": payload.get("type"),
            "category": payload.get("category"),
            "amount": payload.get("amount"),
            "description": payload.get("description"),
            "date": datetime.utcnow().isoformat(),
            "reference": payload.get("reference"),
        }
        res = self.client.table("transactions").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "accountId": r.get("account_id"),
            "vehicleId": r.get("vehicle_id"),
            "type": r.get("type"),
            "category": r.get("category"),
            "amount": r.get("amount"),
            "description": r.get("description"),
            "date": r.get("date"),
            "reference": r.get("reference"),
            "createdAt": r.get("created_at"),
        }

    # -------------------- Parts --------------------
    def parts_list(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return []
        res = (
            self.client.table("parts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
        out = []
        for r in rows:
            out.append(
                {
                    "id": r.get("id"),
                    "partNumber": r.get("part_number"),
                    "name": r.get("name"),
                    "category": r.get("category"),
                    "purchasePrice": float(r.get("purchase_price") or 0),
                    "sellingPrice": float(r.get("selling_price") or 0),
                    "quantity": int(r.get("quantity") or 0),
                    "minQuantity": int(r.get("min_quantity") or 5),
                    "supplier": r.get("supplier"),
                    "image": r.get("image"),
                    "createdAt": r.get("created_at"),
                    "updatedAt": r.get("updated_at"),
                }
            )
        return out

    def parts_create(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return doc
        row = {
            "part_number": doc.get("partNumber"),
            "name": doc.get("name"),
            "category": doc.get("category"),
            "purchase_price": doc.get("purchasePrice", 0),
            "selling_price": doc.get("sellingPrice", 0),
            "quantity": doc.get("quantity", 0),
            "min_quantity": doc.get("minQuantity", 5),
            "supplier": doc.get("supplier"),
            "image": doc.get("image"),
            "created_at": datetime.utcnow().isoformat(),
        }
        if doc.get("id"):
            row["id"] = doc.get("id")

        res = self.client.table("parts").insert(row).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "partNumber": r.get("part_number"),
            "name": r.get("name"),
            "category": r.get("category"),
            "purchasePrice": float(r.get("purchase_price") or 0),
            "sellingPrice": float(r.get("selling_price") or 0),
            "quantity": int(r.get("quantity") or 0),
            "minQuantity": int(r.get("min_quantity") or 5),
            "supplier": r.get("supplier"),
            "image": r.get("image"),
            "createdAt": r.get("created_at"),
            "updatedAt": r.get("updated_at"),
        }

    def parts_update(self, pid: str, upd: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return upd
        row = {}
        if "partNumber" in upd:
            row["part_number"] = upd["partNumber"]
        if "name" in upd:
            row["name"] = upd["name"]
        if "category" in upd:
            row["category"] = upd["category"]
        if "purchasePrice" in upd:
            row["purchase_price"] = upd["purchasePrice"]
        if "sellingPrice" in upd:
            row["selling_price"] = upd["sellingPrice"]
        if "quantity" in upd:
            row["quantity"] = upd["quantity"]
        if "minQuantity" in upd:
            row["min_quantity"] = upd["minQuantity"]
        if "supplier" in upd:
            row["supplier"] = upd["supplier"]
        if "image" in upd:
            row["image"] = upd["image"]

        row["updated_at"] = datetime.utcnow().isoformat()

        res = self.client.table("parts").update(row).eq("id", pid).execute()
        r = (res.data or [{}])[0]
        return {
            "id": r.get("id"),
            "partNumber": r.get("part_number"),
            "name": r.get("name"),
            "category": r.get("category"),
            "purchasePrice": float(r.get("purchase_price") or 0),
            "sellingPrice": float(r.get("selling_price") or 0),
            "quantity": int(r.get("quantity") or 0),
            "minQuantity": int(r.get("min_quantity") or 5),
            "supplier": r.get("supplier"),
            "image": r.get("image"),
            "createdAt": r.get("created_at"),
            "updatedAt": r.get("updated_at"),
        }

    def parts_delete(self, pid: str) -> bool:
        if self.mock_mode:
            return True
        self.client.table("parts").delete().eq("id", pid).execute()
        return True

    # -------------------- Aliases for business_accounts --------------------
    def business_accounts_list(self) -> List[Dict[str, Any]]:
        return self.accounts_list()

    def business_accounts_create(self, account: Dict[str, Any]) -> Dict[str, Any]:
        name = account.get("name", "")
        code = account.get("code")
        currency = account.get("currency", "SAR")
        return self.accounts_create(name, code, currency)
