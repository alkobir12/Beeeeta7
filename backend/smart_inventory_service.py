import json
import math
import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from supabase_service import SupabaseService

from smart_inventory_models import (
    AlertSeverity,
    BackorderCreateRequest,
    BackorderRecord,
    BackorderStatus,
    InventoryAlert,
    InventoryPart,
)


EXPENSE_CATEGORY_LABELS = {
    "purchases": "مشتريات قطع",
    "operational": "مصروفات تشغيلية",
    "personal": "مصاريف شخصية",
    "fees": "رسوم وعمولات",
    "fuel": "وقود ونقل",
    "other": "مصروفات أخرى",
}


class SmartInventoryService:
    def __init__(self, db):
        self.db = db
        self.provider = (os.environ.get("DB_PROVIDER") or "mongo").lower()
        self.supabase = SupabaseService() if self.provider == "supabase" else None
        self.uploads_dir = Path(__file__).parent / "uploads"
        self.uploads_dir.mkdir(exist_ok=True)

    def _mem_path(self, name: str) -> Path:
        return self.uploads_dir / f"{name}.json"

    def _mem_read(self, name: str) -> List[Dict[str, Any]]:
        try:
            p = self._mem_path(name)
            if not p.exists():
                return []
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _mem_write(self, name: str, items: List[Dict[str, Any]]) -> None:
        try:
            with open(self._mem_path(name), "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except Exception:
            return default

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        try:
            return int(float(value))
        except Exception:
            return default

    @staticmethod
    def _to_iso(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, str):
            return value
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _parse_date(value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str) and value:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except Exception:
                return None
        return None

    @staticmethod
    def _normalize_text(value: Any) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _normalize_account_code(value: Any) -> str:
        raw = str(value or "").strip()
        if not raw:
            return ""
        if raw.startswith("acc-") and raw[4:].isdigit():
            return raw[4:]
        return raw

    def _is_rakan_account_code(self, value: Any) -> bool:
        return self._normalize_account_code(value).startswith("5000")

    def _is_rakan_business_account(self, account: Dict[str, Any]) -> bool:
        text = " ".join(
            [
                self._normalize_text(account.get("name")),
                self._normalize_text(account.get("code")),
            ]
        )
        return (
            "راكان" in text
            or "rakan" in text
            or self._is_rakan_account_code(account.get("code"))
        )

    def _is_rakan_chart_account(self, account: Dict[str, Any]) -> bool:
        if self._is_rakan_account_code(account.get("code")):
            return True
        text = " ".join(
            [
                self._normalize_text(account.get("name_ar")),
                self._normalize_text(account.get("name")),
                self._normalize_text(account.get("code")),
                self._normalize_text(account.get("category")),
            ]
        )
        return "راكان" in text or "rakan" in text

    def _is_rakan_operation(
        self, operation: Dict[str, Any], rakan_biz_ids: set[str]
    ) -> bool:
        scope = self._normalize_text(operation.get("scope"))
        source = self._normalize_text(operation.get("source"))
        business_unit = self._normalize_text(
            operation.get("businessUnit") or operation.get("business_unit")
        )
        notes = self._normalize_text(operation.get("notes"))
        account_id = str(operation.get("accountId") or operation.get("account_id") or "")
        accounting_ref = str(
            operation.get("accountingAccountId")
            or operation.get("accounting_account_id")
            or ""
        )
        account_code_in_notes = ""
        notes_text = str(operation.get("notes") or "")
        if "ACCOUNT_CODE:" in notes_text:
            try:
                account_code_in_notes = notes_text.split("ACCOUNT_CODE:", 1)[1].split()[0].split("|")[0].strip()
            except Exception:
                account_code_in_notes = ""
        return (
            account_id in rakan_biz_ids
            or scope == "rakan_parts"
            or source == "rakan_parts_pos"
            or business_unit == "rakan_parts"
            or "[rakan_parts]" in notes
            or self._is_rakan_account_code(accounting_ref)
            or self._is_rakan_account_code(account_code_in_notes)
        )

    @staticmethod
    def _clean_note_reason(value: Any) -> str:
        text = str(value or "").strip()
        if not text:
            return "بدون توصيف"
        cleaned = text.replace("[RAKAN_PARTS]", "").replace("[rakan_parts]", "").strip()
        cleaned = cleaned.split("ACCOUNTING_TARGET:")[0].strip()
        cleaned = cleaned.split("|")[0].strip(" -|:")
        return cleaned or "بدون توصيف"

    def _categorize_expense(
        self,
        account_name: str,
        reason: str,
        op_type: str,
    ) -> str:
        if op_type == "purchase":
            return "purchases"

        text = self._normalize_text(f"{account_name} {reason}")
        if any(token in text for token in ["بنزين", "وقود", "fuel", "نقل", "توصيل"]):
            return "fuel"
        if any(token in text for token in ["رسوم", "عمولة", "fee", "charge", "service"]):
            return "fees"
        if any(token in text for token in ["شخصي", "سحب", "personal", "owner", "مالك"]):
            return "personal"
        if any(token in text for token in ["ايجار", "إيجار", "كهرباء", "ماء", "رواتب", "salary", "تشغيل"]):
            return "operational"
        return "other"

    @staticmethod
    def _week_start_iso(value: datetime) -> str:
        week_start = value - timedelta(days=value.weekday())
        return week_start.date().isoformat()

    @staticmethod
    def _percent_change(current: float, baseline: float) -> float:
        if baseline == 0:
            return 100.0 if current else 0.0
        return ((current - baseline) / abs(baseline)) * 100

    def _operation_date(self, op: Dict[str, Any]) -> datetime:
        candidates = [
            op.get("date"),
            op.get("op_date"),
            op.get("createdAt"),
            op.get("created_at"),
        ]
        for value in candidates:
            parsed = self._parse_date(value)
            if parsed:
                return parsed
        return datetime.now(timezone.utc)

    def _normalize_part(self, raw: Dict[str, Any]) -> Optional[InventoryPart]:
        part_id = str(raw.get("id") or raw.get("part_id") or "").strip()
        if not part_id:
            return None
        part_number = (
            raw.get("partNumber")
            or raw.get("part_number")
            or raw.get("code")
            or part_id
        )
        name = raw.get("name") or raw.get("title") or part_number
        category = raw.get("category") or "غير مصنف"
        min_quantity = self._safe_int(raw.get("minQuantity") or raw.get("min_quantity") or 0)
        quantity = self._safe_int(raw.get("quantity") or 0)
        purchase_price = self._safe_float(
            raw.get("purchasePrice") or raw.get("purchase_price") or 0
        )
        selling_price = self._safe_float(
            raw.get("sellingPrice") or raw.get("selling_price") or 0
        )
        supplier = raw.get("supplier") or raw.get("supplier_name")
        location_value = raw.get("location")
        location = None
        if isinstance(location_value, dict):
            location = location_value
        elif isinstance(location_value, str) and location_value.strip():
            location = {"code": location_value.strip(), "name": location_value.strip()}

        vehicle_id = raw.get("vehicleId") or raw.get("vehicle_id")
        linked_vehicle = (
            {
                "id": str(vehicle_id),
                "plate_number": raw.get("vehiclePlate") or raw.get("vehicle_plate"),
                "customer_name": raw.get("customerName") or raw.get("customer_name"),
            }
            if vehicle_id
            else None
        )

        return InventoryPart(
            id=part_id,
            part_number=str(part_number),
            name=str(name),
            category=str(category),
            quantity=quantity,
            min_quantity=min_quantity,
            purchase_price=purchase_price,
            selling_price=selling_price,
            supplier=supplier,
            location=location,
            linked_vehicle=linked_vehicle,
        )

    async def list_parts(self) -> List[InventoryPart]:
        raw_parts: List[Dict[str, Any]] = []
        if self.provider == "supabase":
            try:
                raw_parts = self.supabase.parts_list() if self.supabase else []
            except Exception:
                raw_parts = self._mem_read("parts")
        elif self.provider == "memory" or self.db is None:
            raw_parts = self._mem_read("parts")
        else:
            raw_parts = await self.db.parts.find({}, {"_id": 0}).to_list(50000)

        parts: List[InventoryPart] = []
        for row in raw_parts:
            part = self._normalize_part(row)
            if part:
                parts.append(part)
        return parts

    async def list_suppliers(self) -> List[Dict[str, Any]]:
        if self.provider == "supabase":
            try:
                if self.supabase and self.supabase.client and not self.supabase.mock_mode:
                    res = self.supabase.client.table("suppliers").select("*").execute()
                    return res.data or []
                return []
            except Exception:
                return self._mem_read("suppliers")

        if self.provider == "memory" or self.db is None:
            return self._mem_read("suppliers")

        return await self.db.suppliers.find({}, {"_id": 0}).to_list(5000)

    async def list_operations(self) -> List[Dict[str, Any]]:
        if self.provider == "supabase":
            try:
                return self.supabase.operations_list() if self.supabase else []
            except Exception:
                return self._mem_read("operations")
        if self.provider == "memory" or self.db is None:
            return self._mem_read("operations")

        operations = await self.db.operations.find({}, {"_id": 0}).to_list(50000)
        normalized: List[Dict[str, Any]] = []
        for row in operations:
            item = {**row}
            for key in ("date", "op_date", "createdAt", "created_at"):
                if key in item:
                    item[key] = self._to_iso(item.get(key))
            normalized.append(item)
        return normalized

    async def list_business_accounts(self) -> List[Dict[str, Any]]:
        if self.provider == "supabase":
            try:
                return self.supabase.accounts_list() if self.supabase else []
            except Exception:
                return self._mem_read("business_accounts")

        if self.provider == "memory" or self.db is None:
            return self._mem_read("business_accounts")

        rows = await self.db.business_accounts.find(
            {}, {"_id": 0, "id": 1, "name": 1, "code": 1, "currency": 1}
        ).to_list(5000)
        return rows

    async def list_chart_accounts(self) -> List[Dict[str, Any]]:
        if self.provider == "supabase":
            try:
                if self.supabase and self.supabase.client and not self.supabase.mock_mode:
                    res = self.supabase.client.table("chart_of_accounts").select("*").execute()
                    rows = res.data or []
                    return [
                        {
                            "id": str(row.get("id") or row.get("code") or ""),
                            "code": row.get("code"),
                            "name": row.get("name"),
                            "name_ar": row.get("name_ar") or row.get("name"),
                            "type": row.get("type"),
                            "category": row.get("category"),
                        }
                        for row in rows
                    ]
            except Exception:
                pass
            return self._mem_read("chart_of_accounts")

        if self.provider == "memory" or self.db is None:
            return self._mem_read("chart_of_accounts")

        rows = await self.db.chart_of_accounts.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "code": 1,
                "name": 1,
                "name_ar": 1,
                "type": 1,
                "category": 1,
            },
        ).to_list(5000)
        return rows

    async def _list_backorders_raw(
        self, status: Optional[BackorderStatus] = None
    ) -> List[Dict[str, Any]]:
        target_status = status.value if status else None

        if self.provider == "supabase":
            try:
                if self.supabase and self.supabase.client and not self.supabase.mock_mode:
                    q = self.supabase.client.table("inventory_backorders").select("*")
                    if target_status:
                        q = q.eq("status", target_status)
                    res = q.order("created_at", desc=True).execute()
                    rows = res.data or []
                    normalized = []
                    for row in rows:
                        normalized.append(
                            {
                                "id": row.get("id"),
                                "part_id": row.get("part_id"),
                                "part_name": row.get("part_name") or "قطعة غير معروفة",
                                "requested_quantity": self._safe_int(
                                    row.get("requested_quantity"), 1
                                ),
                                "customer_name": row.get("customer_name") or "عميل",
                                "customer_phone": row.get("customer_phone"),
                                "vehicle_reference": row.get("vehicle_reference"),
                                "status": row.get("status") or BackorderStatus.pending.value,
                                "note": row.get("note"),
                                "expected_date": row.get("expected_date"),
                                "created_at": self._to_iso(row.get("created_at")),
                                "updated_at": self._to_iso(row.get("updated_at")),
                            }
                        )
                    return normalized
            except Exception:
                pass
            data = self._mem_read("inventory_backorders")
            if target_status:
                data = [row for row in data if row.get("status") == target_status]
            return data

        if self.provider == "memory" or self.db is None:
            data = self._mem_read("inventory_backorders")
            if target_status:
                data = [row for row in data if row.get("status") == target_status]
            return data

        query: Dict[str, Any] = {}
        if target_status:
            query["status"] = target_status
        rows = await self.db.inventory_backorders.find(query, {"_id": 0}).to_list(5000)
        return rows

    async def list_backorders(
        self, status: Optional[BackorderStatus] = None
    ) -> List[BackorderRecord]:
        rows = await self._list_backorders_raw(status)
        result: List[BackorderRecord] = []
        for row in rows:
            row_status = row.get("status") or BackorderStatus.pending.value
            if row_status not in [s.value for s in BackorderStatus]:
                row_status = BackorderStatus.pending.value
            result.append(
                BackorderRecord(
                    id=str(row.get("id") or uuid.uuid4()),
                    part_id=row.get("part_id"),
                    part_name=row.get("part_name") or "قطعة غير معروفة",
                    requested_quantity=self._safe_int(row.get("requested_quantity"), 1),
                    customer_name=row.get("customer_name") or "عميل",
                    customer_phone=row.get("customer_phone"),
                    vehicle_reference=row.get("vehicle_reference"),
                    status=BackorderStatus(row_status),
                    note=row.get("note"),
                    expected_date=row.get("expected_date"),
                    created_at=self._to_iso(row.get("created_at")),
                    updated_at=self._to_iso(row.get("updated_at")),
                )
            )
        result.sort(key=lambda x: x.created_at, reverse=True)
        return result

    async def create_backorder(
        self, payload: BackorderCreateRequest
    ) -> BackorderRecord:
        now_iso = datetime.now(timezone.utc).isoformat()
        record = BackorderRecord(
            id=str(uuid.uuid4()),
            part_id=payload.part_id,
            part_name=payload.part_name,
            requested_quantity=payload.requested_quantity,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            vehicle_reference=payload.vehicle_reference,
            status=BackorderStatus.pending,
            note=payload.note,
            expected_date=payload.expected_date,
            created_at=now_iso,
            updated_at=now_iso,
        )
        doc = record.dict()
        doc["status"] = record.status.value

        if self.provider == "supabase":
            inserted = False
            try:
                if self.supabase and self.supabase.client and not self.supabase.mock_mode:
                    self.supabase.client.table("inventory_backorders").insert(doc).execute()
                    inserted = True
            except Exception:
                inserted = False
            if not inserted:
                rows = self._mem_read("inventory_backorders")
                rows.append(doc)
                self._mem_write("inventory_backorders", rows)
            return record

        if self.provider == "memory" or self.db is None:
            rows = self._mem_read("inventory_backorders")
            rows.append(doc)
            self._mem_write("inventory_backorders", rows)
            return record

        await self.db.inventory_backorders.insert_one(doc)
        return record

    async def update_backorder_status(
        self,
        backorder_id: str,
        status: BackorderStatus,
        note: Optional[str] = None,
        expected_date: Optional[str] = None,
    ) -> Optional[BackorderRecord]:
        update_doc = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if note is not None:
            update_doc["note"] = note
        if expected_date is not None:
            update_doc["expected_date"] = expected_date

        if self.provider == "supabase":
            try:
                if self.supabase and self.supabase.client and not self.supabase.mock_mode:
                    res = (
                        self.supabase.client.table("inventory_backorders")
                        .update(update_doc)
                        .eq("id", backorder_id)
                        .execute()
                    )
                    row = (res.data or [None])[0]
                    if row:
                        return BackorderRecord(
                            id=row.get("id"),
                            part_id=row.get("part_id"),
                            part_name=row.get("part_name") or "قطعة غير معروفة",
                            requested_quantity=self._safe_int(
                                row.get("requested_quantity"), 1
                            ),
                            customer_name=row.get("customer_name") or "عميل",
                            customer_phone=row.get("customer_phone"),
                            vehicle_reference=row.get("vehicle_reference"),
                            status=BackorderStatus(
                                row.get("status") or BackorderStatus.pending.value
                            ),
                            note=row.get("note"),
                            expected_date=row.get("expected_date"),
                            created_at=self._to_iso(row.get("created_at")),
                            updated_at=self._to_iso(row.get("updated_at")),
                        )
            except Exception:
                pass

            rows = self._mem_read("inventory_backorders")
            for idx, row in enumerate(rows):
                if row.get("id") == backorder_id:
                    rows[idx] = {**row, **update_doc}
                    self._mem_write("inventory_backorders", rows)
                    return BackorderRecord(**rows[idx])
            return None

        if self.provider == "memory" or self.db is None:
            rows = self._mem_read("inventory_backorders")
            for idx, row in enumerate(rows):
                if row.get("id") == backorder_id:
                    rows[idx] = {**row, **update_doc}
                    self._mem_write("inventory_backorders", rows)
                    return BackorderRecord(**rows[idx])
            return None

        await self.db.inventory_backorders.update_one(
            {"id": backorder_id}, {"$set": update_doc}
        )
        row = await self.db.inventory_backorders.find_one({"id": backorder_id}, {"_id": 0})
        if not row:
            return None
        return BackorderRecord(**row)

    @staticmethod
    def _item_part_id(item: Dict[str, Any]) -> Optional[str]:
        value = item.get("itemId") or item.get("partId") or item.get("item_id")
        return str(value) if value else None

    def _item_quantity(self, item: Dict[str, Any]) -> int:
        return max(0, self._safe_int(item.get("quantity", item.get("qty", 1)), 1))

    def _item_total(self, item: Dict[str, Any]) -> float:
        total = self._safe_float(item.get("total"), -1)
        if total >= 0:
            return total
        qty = self._item_quantity(item)
        return qty * self._safe_float(item.get("price"), 0)

    def _build_alerts(
        self,
        parts: List[InventoryPart],
        sold_last_30_days: Dict[str, int],
    ) -> List[InventoryAlert]:
        alerts: List[InventoryAlert] = []

        for part in parts:
            min_qty = max(0, part.min_quantity)
            suggested_qty = max((min_qty * 2) - part.quantity, 1)
            if part.quantity <= 0:
                alerts.append(
                    InventoryAlert(
                        id=f"out-{part.id}",
                        severity=AlertSeverity.critical,
                        alert_type="out_of_stock",
                        title="نفاد مخزون قطعة",
                        message=f"القطعة {part.name} غير متوفرة حالياً.",
                        part_id=part.id,
                        part_name=part.name,
                        current_quantity=part.quantity,
                        min_quantity=min_qty,
                        suggested_order_quantity=suggested_qty,
                        suggested_action="إنشاء طلب شراء/Backorder بشكل فوري",
                    )
                )
            elif part.quantity <= min_qty:
                severity = (
                    AlertSeverity.high
                    if part.quantity <= max(1, int(min_qty * 0.5))
                    else AlertSeverity.medium
                )
                alerts.append(
                    InventoryAlert(
                        id=f"low-{part.id}",
                        severity=severity,
                        alert_type="low_stock",
                        title="انخفاض مخزون",
                        message=f"القطعة {part.name} أقل من الحد الأدنى.",
                        part_id=part.id,
                        part_name=part.name,
                        current_quantity=part.quantity,
                        min_quantity=min_qty,
                        suggested_order_quantity=suggested_qty,
                        suggested_action="رفع طلب تزويد المخزون",
                    )
                )

            sold_30 = sold_last_30_days.get(part.id, 0)
            if sold_30 > 0 and part.quantity > 0:
                daily_usage = sold_30 / 30.0
                days_cover = part.quantity / daily_usage if daily_usage > 0 else 0
                if days_cover <= 15:
                    alerts.append(
                        InventoryAlert(
                            id=f"velocity-{part.id}",
                            severity=AlertSeverity.high,
                            alert_type="fast_moving",
                            title="استهلاك سريع",
                            message=f"القطعة {part.name} تتحرك بسرعة وقد تنفد خلال {int(max(days_cover, 1))} يوم.",
                            part_id=part.id,
                            part_name=part.name,
                            current_quantity=part.quantity,
                            min_quantity=min_qty,
                            suggested_order_quantity=max(sold_30, suggested_qty),
                            suggested_action="زيادة حد إعادة الطلب لهذه القطعة",
                        )
                    )

            if part.selling_price > 0 and part.selling_price <= part.purchase_price:
                alerts.append(
                    InventoryAlert(
                        id=f"margin-{part.id}",
                        severity=AlertSeverity.medium,
                        alert_type="margin_risk",
                        title="هامش ربح منخفض",
                        message=f"القطعة {part.name} تُباع بدون هامش ربح كافٍ.",
                        part_id=part.id,
                        part_name=part.name,
                        current_quantity=part.quantity,
                        min_quantity=min_qty,
                        suggested_order_quantity=0,
                        suggested_action="مراجعة سعر البيع أو تكلفة الشراء",
                    )
                )

        severity_rank = {
            AlertSeverity.critical.value: 0,
            AlertSeverity.high.value: 1,
            AlertSeverity.medium.value: 2,
            AlertSeverity.info.value: 3,
        }
        alerts.sort(key=lambda x: (severity_rank.get(x.severity.value, 9), x.part_name or ""))
        return alerts

    async def get_dashboard(self) -> Dict[str, Any]:
        parts = await self.list_parts()
        operations = await self.list_operations()
        backorders = await self.list_backorders()

        now = datetime.now(timezone.utc)
        last_30 = now - timedelta(days=30)
        sold_last_30_days: Dict[str, int] = defaultdict(int)

        for op in operations:
            op_type = str(op.get("type") or "").lower()
            if op_type != "sale":
                continue
            op_date = self._operation_date(op)
            if op_date.tzinfo is None:
                op_date = op_date.replace(tzinfo=timezone.utc)
            if op_date < last_30:
                continue
            for item in op.get("items") or []:
                part_id = self._item_part_id(item)
                if not part_id:
                    continue
                sold_last_30_days[part_id] += self._item_quantity(item)

        alerts = self._build_alerts(parts, sold_last_30_days)
        low_stock_count = len([p for p in parts if p.quantity <= p.min_quantity and p.quantity > 0])
        out_of_stock_count = len([p for p in parts if p.quantity <= 0])
        inventory_cost_value = sum(p.quantity * p.purchase_price for p in parts)
        inventory_retail_value = sum(p.quantity * p.selling_price for p in parts)

        category_value: Dict[str, float] = defaultdict(float)
        for part in parts:
            category_value[part.category] += part.quantity * part.selling_price
        top_category = "-"
        if category_value:
            top_category = sorted(category_value.items(), key=lambda x: x[1], reverse=True)[0][0]

        movers = []
        for part in parts:
            qty = sold_last_30_days.get(part.id, 0)
            if qty <= 0:
                continue
            movers.append(
                {
                    "part_id": part.id,
                    "part_name": part.name,
                    "category": part.category,
                    "sold_qty_30": qty,
                    "current_qty": part.quantity,
                }
            )
        movers.sort(key=lambda x: x["sold_qty_30"], reverse=True)

        return {
            "summary": {
                "total_parts": len(parts),
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "inventory_cost_value": round(inventory_cost_value, 2),
                "inventory_retail_value": round(inventory_retail_value, 2),
                "potential_profit_value": round(
                    inventory_retail_value - inventory_cost_value, 2
                ),
                "critical_alerts_count": len(
                    [a for a in alerts if a.severity == AlertSeverity.critical]
                ),
                "pending_backorders_count": len(
                    [b for b in backorders if b.status == BackorderStatus.pending]
                ),
                "top_category": top_category,
                "updated_at": now.isoformat(),
            },
            "alerts_preview": [a.dict() for a in alerts[:8]],
            "top_movers": movers[:6],
            "parts_snapshot": [
                {
                    "id": p.id,
                    "part_number": p.part_number,
                    "name": p.name,
                    "category": p.category,
                    "quantity": p.quantity,
                    "min_quantity": p.min_quantity,
                    "selling_price": p.selling_price,
                    "purchase_price": p.purchase_price,
                }
                for p in parts[:200]
            ],
        }

    async def get_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        parts = await self.list_parts()
        operations = await self.list_operations()
        now = datetime.now(timezone.utc)
        last_30 = now - timedelta(days=30)
        sold_last_30_days: Dict[str, int] = defaultdict(int)

        for op in operations:
            if str(op.get("type") or "").lower() != "sale":
                continue
            op_date = self._operation_date(op)
            if op_date.tzinfo is None:
                op_date = op_date.replace(tzinfo=timezone.utc)
            if op_date < last_30:
                continue
            for item in op.get("items") or []:
                part_id = self._item_part_id(item)
                if part_id:
                    sold_last_30_days[part_id] += self._item_quantity(item)

        alerts = self._build_alerts(parts, sold_last_30_days)
        return [a.dict() for a in alerts[: max(1, min(limit, 500))]]

    async def get_control_panel(self, days: int = 30) -> Dict[str, Any]:
        parts = await self.list_parts()
        operations = await self.list_operations()
        backorders = await self.list_backorders()

        days = max(7, min(days, 365))
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        parts_map = {p.id: p for p in parts}

        sale_kpi: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "part_id": "",
                "part_name": "",
                "category": "غير مصنف",
                "sold_quantity": 0,
                "revenue": 0.0,
                "cogs": 0.0,
            }
        )
        purchased_total = 0.0
        sales_total = 0.0
        category_perf: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "category": "",
                "stock_items": 0,
                "stock_value": 0.0,
                "sold_quantity": 0,
                "revenue": 0.0,
                "low_stock_items": 0,
            }
        )

        sold_90: Dict[str, int] = defaultdict(int)
        recent_part_operations: List[Dict[str, Any]] = []

        for part in parts:
            cat = part.category or "غير مصنف"
            category_perf[cat]["category"] = cat
            category_perf[cat]["stock_items"] += 1
            category_perf[cat]["stock_value"] += part.quantity * part.purchase_price
            if part.quantity <= part.min_quantity:
                category_perf[cat]["low_stock_items"] += 1

        for op in operations:
            op_date = self._operation_date(op)
            if op_date.tzinfo is None:
                op_date = op_date.replace(tzinfo=timezone.utc)
            if op_date < start_date:
                continue

            op_type = str(op.get("type") or "").lower()
            items = op.get("items") or []
            has_part_item = False
            item_count = 0

            for item in items:
                part_id = self._item_part_id(item)
                if not part_id:
                    continue
                has_part_item = True
                qty = self._item_quantity(item)
                if qty <= 0:
                    continue
                total = self._item_total(item)
                item_count += 1

                part = parts_map.get(part_id)
                part_name = (
                    item.get("name")
                    or (part.name if part else None)
                    or f"Part-{part_id[:6]}"
                )
                category = (part.category if part else None) or "غير مصنف"

                if op_type == "sale":
                    sales_total += total
                    sold_90[part_id] += qty
                    row = sale_kpi[part_id]
                    row["part_id"] = part_id
                    row["part_name"] = part_name
                    row["category"] = category
                    row["sold_quantity"] += qty
                    row["revenue"] += total
                    row["cogs"] += qty * (part.purchase_price if part else 0)

                    category_perf[category]["sold_quantity"] += qty
                    category_perf[category]["revenue"] += total
                elif op_type == "purchase":
                    purchased_total += total

            if has_part_item:
                recent_part_operations.append(
                    {
                        "id": op.get("id"),
                        "date": self._to_iso(op.get("date") or op.get("op_date") or op.get("createdAt")),
                        "type": op_type,
                        "partner_name": op.get("partnerName") or op.get("partner_name") or "-",
                        "total": self._safe_float(op.get("total"), 0),
                        "payment_method": op.get("paymentMethod") or op.get("payment_method") or "cash",
                        "scope": op.get("scope") or ("vehicle" if op.get("vehicleId") or op.get("vehicle_id") else "workshop"),
                        "item_count": item_count,
                    }
                )

        top_selling = sorted(
            sale_kpi.values(), key=lambda x: x["sold_quantity"], reverse=True
        )[:10]
        top_revenue = sorted(
            sale_kpi.values(), key=lambda x: x["revenue"], reverse=True
        )[:10]

        slow_moving = []
        for part in parts:
            if part.quantity <= 0:
                continue
            sold_qty = sold_90.get(part.id, 0)
            if sold_qty == 0:
                slow_moving.append(
                    {
                        "part_id": part.id,
                        "part_name": part.name,
                        "category": part.category,
                        "quantity": part.quantity,
                        "stock_value": round(part.quantity * part.purchase_price, 2),
                    }
                )
        slow_moving.sort(key=lambda x: x["stock_value"], reverse=True)

        margin_watchlist = []
        for part in parts:
            if part.selling_price <= 0:
                continue
            margin_ratio = (part.selling_price - part.purchase_price) / part.selling_price
            if margin_ratio < 0.2:
                margin_watchlist.append(
                    {
                        "part_id": part.id,
                        "part_name": part.name,
                        "category": part.category,
                        "margin_ratio": round(margin_ratio * 100, 2),
                        "purchase_price": part.purchase_price,
                        "selling_price": part.selling_price,
                    }
                )
        margin_watchlist.sort(key=lambda x: x["margin_ratio"])

        recent_part_operations.sort(key=lambda x: x["date"], reverse=True)

        gross_profit = sum((row["revenue"] - row["cogs"]) for row in sale_kpi.values())
        backorder_summary = {status.value: 0 for status in BackorderStatus}
        for row in backorders:
            backorder_summary[row.status.value] += 1

        return {
            "overview": {
                "period_days": days,
                "total_parts": len(parts),
                "sales_total": round(sales_total, 2),
                "purchases_total": round(purchased_total, 2),
                "gross_profit_estimate": round(gross_profit, 2),
                "inventory_cost_value": round(
                    sum(p.quantity * p.purchase_price for p in parts), 2
                ),
                "inventory_retail_value": round(
                    sum(p.quantity * p.selling_price for p in parts), 2
                ),
                "low_stock_count": len(
                    [p for p in parts if p.quantity <= p.min_quantity and p.quantity > 0]
                ),
                "out_of_stock_count": len([p for p in parts if p.quantity <= 0]),
            },
            "top_selling_parts": top_selling,
            "top_revenue_parts": top_revenue,
            "slow_moving_parts": slow_moving[:10],
            "margin_watchlist": margin_watchlist[:10],
            "category_performance": sorted(
                category_perf.values(), key=lambda x: x["revenue"], reverse=True
            ),
            "recent_part_operations": recent_part_operations[:20],
            "backorder_summary": backorder_summary,
            "backorders": [item.dict() for item in backorders[:20]],
            "parts_snapshot": [
                {
                    "id": p.id,
                    "name": p.name,
                    "part_number": p.part_number,
                    "category": p.category,
                    "quantity": p.quantity,
                    "min_quantity": p.min_quantity,
                }
                for p in parts
            ],
        }

    def _build_replenishment_plan(
        self,
        parts: List[InventoryPart],
        operations: List[Dict[str, Any]],
        backorders: List[BackorderRecord],
        days: int,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=days)
        last_30 = now - timedelta(days=30)

        sold_30: Dict[str, int] = defaultdict(int)
        sold_period: Dict[str, int] = defaultdict(int)
        last_sale_price: Dict[str, float] = {}
        last_purchase_price: Dict[str, float] = {}
        last_sale_seen: Dict[str, datetime] = {}
        last_purchase_seen: Dict[str, datetime] = {}

        for op in operations:
            op_type = self._normalize_text(op.get("type"))
            if op_type not in {"sale", "purchase"}:
                continue
            op_date = self._operation_date(op)
            if op_date.tzinfo is None:
                op_date = op_date.replace(tzinfo=timezone.utc)

            for item in op.get("items") or []:
                part_id = self._item_part_id(item)
                if not part_id:
                    continue
                qty = self._item_quantity(item)
                price = self._safe_float(item.get("price"), 0)

                if op_type == "sale":
                    if op_date >= last_30:
                        sold_30[part_id] += qty
                    if op_date >= period_start:
                        sold_period[part_id] += qty
                    prev_seen = last_sale_seen.get(part_id)
                    if prev_seen is None or op_date >= prev_seen:
                        last_sale_seen[part_id] = op_date
                        last_sale_price[part_id] = price
                elif op_type == "purchase":
                    prev_seen = last_purchase_seen.get(part_id)
                    if prev_seen is None or op_date >= prev_seen:
                        last_purchase_seen[part_id] = op_date
                        last_purchase_price[part_id] = price

        backorder_qty_by_part: Dict[str, int] = defaultdict(int)
        active_backorders = 0
        for order in backorders:
            if order.status in {BackorderStatus.cancelled, BackorderStatus.arrived}:
                continue
            active_backorders += 1
            if order.part_id:
                backorder_qty_by_part[str(order.part_id)] += self._safe_int(
                    order.requested_quantity, 0
                )

        rows: List[Dict[str, Any]] = []
        dormant_stock_value = 0.0
        margin_risk_count = 0
        coverage_values: List[float] = []

        for part in parts:
            sold_window = sold_period.get(part.id, 0)
            sold_last_30 = sold_30.get(part.id, 0)
            avg_daily_demand = sold_window / float(days) if sold_window > 0 else 0.0
            days_of_cover = (
                round(part.quantity / avg_daily_demand, 1)
                if avg_daily_demand > 0
                else None
            )
            if days_of_cover is not None:
                coverage_values.append(days_of_cover)

            backorder_qty = backorder_qty_by_part.get(part.id, 0)
            target_buffer = max(
                max(part.min_quantity, 1) * 2,
                math.ceil(avg_daily_demand * 21),
                backorder_qty,
            )
            if target_buffer <= 0 and (part.quantity <= part.min_quantity or backorder_qty > 0):
                target_buffer = max(part.min_quantity, 1)

            suggested_order_quantity = max(target_buffer - part.quantity, 0)
            shortage_quantity = max(part.min_quantity - part.quantity, 0)
            if backorder_qty > 0:
                suggested_order_quantity = max(
                    suggested_order_quantity,
                    backorder_qty + max(shortage_quantity, 0),
                )

            latest_sale = last_sale_price.get(part.id, part.selling_price)
            latest_purchase = last_purchase_price.get(part.id, part.purchase_price)
            margin_ratio = (
                round(((latest_sale - latest_purchase) / latest_sale) * 100, 2)
                if latest_sale > 0
                else 0.0
            )
            if latest_sale > 0 and latest_sale <= latest_purchase:
                margin_risk_count += 1

            if part.quantity > 0 and sold_window == 0:
                dormant_stock_value += part.quantity * part.purchase_price

            urgency = "on_track"
            if (
                part.quantity <= 0
                or backorder_qty > 0
                or (days_of_cover is not None and days_of_cover <= 7)
            ):
                urgency = "critical"
            elif (
                part.quantity <= part.min_quantity
                or (days_of_cover is not None and days_of_cover <= 14)
            ):
                urgency = "high"
            elif suggested_order_quantity > 0:
                urgency = "planned"
            elif part.quantity > 0 and sold_window == 0:
                urgency = "dormant"

            if urgency == "on_track":
                continue

            rows.append(
                {
                    "part_id": part.id,
                    "part_number": part.part_number,
                    "part_name": part.name,
                    "category": part.category,
                    "supplier": part.supplier or "بدون مورد",
                    "current_quantity": part.quantity,
                    "min_quantity": part.min_quantity,
                    "sold_last_30": sold_last_30,
                    "sold_period": sold_window,
                    "average_daily_demand": round(avg_daily_demand, 2),
                    "days_of_cover": days_of_cover,
                    "backorder_quantity": backorder_qty,
                    "shortage_quantity": shortage_quantity,
                    "suggested_order_quantity": suggested_order_quantity,
                    "estimated_purchase_cost": round(
                        suggested_order_quantity * latest_purchase, 2
                    ),
                    "estimated_lost_revenue": round(backorder_qty * latest_sale, 2),
                    "latest_sale_price": round(latest_sale, 2),
                    "latest_purchase_price": round(latest_purchase, 2),
                    "margin_ratio": margin_ratio,
                    "stock_value": round(part.quantity * part.purchase_price, 2),
                    "urgency": urgency,
                }
            )

        urgency_rank = {"critical": 0, "high": 1, "planned": 2, "dormant": 3}
        rows.sort(
            key=lambda row: (
                urgency_rank.get(row["urgency"], 9),
                -row.get("backorder_quantity", 0),
                -row.get("suggested_order_quantity", 0),
                row.get("part_name") or "",
            )
        )

        urgent_rows = [row for row in rows if row["urgency"] in {"critical", "high"}]
        planned_rows = [row for row in rows if row["urgency"] == "planned"]
        dormant_rows = [row for row in rows if row["urgency"] == "dormant"]

        parts_with_supplier = len([part for part in parts if (part.supplier or "").strip()])
        supplier_coverage_pct = round(
            (parts_with_supplier / len(parts)) * 100, 1
        ) if parts else 0.0

        stock_segments = [
            {
                "key": "critical",
                "label": "توريد فوري",
                "count": len([row for row in rows if row["urgency"] == "critical"]),
                "value": round(
                    sum(row.get("estimated_purchase_cost", 0) for row in rows if row["urgency"] == "critical"),
                    2,
                ),
                "description": "أصناف نافدة أو مرتبطة بطلبات عملاء حالية",
            },
            {
                "key": "watch",
                "label": "مراقبة قريبة",
                "count": len([row for row in rows if row["urgency"] == "high"]),
                "value": round(
                    sum(row.get("estimated_purchase_cost", 0) for row in rows if row["urgency"] == "high"),
                    2,
                ),
                "description": "أصناف اقتربت من الحد الأدنى أو غطاؤها أقل من أسبوعين",
            },
            {
                "key": "planned",
                "label": "تخطيط دوري",
                "count": len(planned_rows),
                "value": round(
                    sum(row.get("estimated_purchase_cost", 0) for row in planned_rows), 2
                ),
                "description": "توصيات إعادة تعبئة مبنية على الطلب خلال الفترة المحددة",
            },
            {
                "key": "dormant",
                "label": "مخزون راكد",
                "count": len(dormant_rows),
                "value": round(dormant_stock_value, 2),
                "description": "أصناف لم تتحرك رغم توفر كمية حالية في المخزون",
            },
        ]

        supplier_health_map: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "supplier_name": "",
                "tracked_parts": 0,
                "urgent_items": 0,
                "planned_items": 0,
                "pending_backorders": 0,
                "stock_value": 0.0,
                "purchase_commitment": 0.0,
            }
        )

        for part in parts:
            supplier_name = part.supplier or "بدون مورد"
            supplier_health_map[supplier_name]["supplier_name"] = supplier_name
            supplier_health_map[supplier_name]["tracked_parts"] += 1
            supplier_health_map[supplier_name]["stock_value"] += (
                part.quantity * part.purchase_price
            )

        for row in rows:
            supplier_name = row.get("supplier") or "بدون مورد"
            supplier_health_map[supplier_name]["supplier_name"] = supplier_name
            supplier_health_map[supplier_name]["purchase_commitment"] += row.get(
                "estimated_purchase_cost", 0
            )
            if row.get("urgency") in {"critical", "high"}:
                supplier_health_map[supplier_name]["urgent_items"] += 1
            elif row.get("urgency") == "planned":
                supplier_health_map[supplier_name]["planned_items"] += 1
            supplier_health_map[supplier_name]["pending_backorders"] += row.get(
                "backorder_quantity", 0
            )

        supplier_health = sorted(
            [
                {
                    **row,
                    "stock_value": round(row["stock_value"], 2),
                    "purchase_commitment": round(row["purchase_commitment"], 2),
                }
                for row in supplier_health_map.values()
            ],
            key=lambda row: (
                -row["urgent_items"],
                -row["pending_backorders"],
                -row["purchase_commitment"],
            ),
        )

        average_days_of_cover = round(
            sum(coverage_values) / len(coverage_values), 1
        ) if coverage_values else None

        execution_budget = {
            "urgent": round(
                sum(
                    row.get("estimated_purchase_cost", 0)
                    for row in rows
                    if row.get("urgency") == "critical"
                ),
                2,
            ),
            "high": round(
                sum(
                    row.get("estimated_purchase_cost", 0)
                    for row in rows
                    if row.get("urgency") == "high"
                ),
                2,
            ),
            "planned": round(
                sum(
                    row.get("estimated_purchase_cost", 0)
                    for row in rows
                    if row.get("urgency") == "planned"
                ),
                2,
            ),
            "total_commitment": round(
                sum(row.get("estimated_purchase_cost", 0) for row in rows),
                2,
            ),
        }

        return {
            "blueprint": {
                "period_days": days,
                "tracked_parts": len(parts),
                "parts_with_supplier": parts_with_supplier,
                "supplier_coverage_pct": supplier_coverage_pct,
                "urgent_reorders_count": len(urgent_rows),
                "planned_reorders_count": len(planned_rows),
                "pending_backorders_count": active_backorders,
                "linked_backorder_quantity": sum(backorder_qty_by_part.values()),
                "dormant_stock_value": round(dormant_stock_value, 2),
                "margin_risk_count": margin_risk_count,
                "average_days_of_cover": average_days_of_cover,
            },
            "execution_budget": execution_budget,
            "stock_segments": stock_segments,
            "replenishment_plan": rows[:20],
            "supplier_health": supplier_health[:12],
        }

    @staticmethod
    def _delta_payload(current: float, previous: float) -> Dict[str, Any]:
        delta = current - previous
        if previous == 0:
            pct = 100.0 if current else 0.0
        else:
            pct = (delta / abs(previous)) * 100
        return {
            "current": round(current, 2),
            "previous": round(previous, 2),
            "delta": round(delta, 2),
            "pct": round(pct, 2),
        }

    def _summarize_rakan_operations(
        self,
        operations: List[Dict[str, Any]],
        parts_map: Dict[str, InventoryPart],
        chart_by_id: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        revenue = 0.0
        purchase_expense = 0.0
        other_expense = 0.0
        sold_qty = 0
        sales_count = 0
        purchases_count = 0
        expense_breakdown_map: Dict[str, float] = defaultdict(float)
        expense_reason_map: Dict[str, float] = defaultdict(float)
        expense_category_map: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"amount": 0.0, "ops_count": 0}
        )
        expense_week_map: Dict[str, float] = defaultdict(float)
        top_expense_operations: List[Dict[str, Any]] = []
        ledger: List[Dict[str, Any]] = []
        price_timeline: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(
            lambda: {"sale": [], "purchase": []}
        )

        sorted_operations = sorted(
            operations,
            key=lambda row: self._operation_date(row),
            reverse=True,
        )

        for op in sorted_operations:
            op_type = self._normalize_text(op.get("type"))
            operation_date = self._operation_date(op)
            if operation_date.tzinfo is None:
                operation_date = operation_date.replace(tzinfo=timezone.utc)

            amount = self._safe_float(op.get("total"), 0)
            account_ref = str(
                op.get("accountingAccountId")
                or op.get("accounting_account_id")
                or op.get("accountId")
                or op.get("account_id")
                or ""
            )
            chart_account = chart_by_id.get(account_ref, {})
            account_type = self._normalize_text(chart_account.get("type") or op_type)
            account_name = (
                chart_account.get("name_ar")
                or chart_account.get("name")
                or chart_account.get("code")
                or account_ref
                or "-"
            )

            is_sale = op_type == "sale"
            is_purchase = op_type == "purchase"
            is_revenue = account_type == "revenue" or is_sale
            is_expense = account_type == "expense" or is_purchase or op_type in {
                "expense",
                "payroll",
                "salary",
            }

            if is_sale:
                sales_count += 1
            if is_purchase:
                purchases_count += 1
            if is_revenue:
                revenue += amount
            if is_expense:
                reason = self._clean_note_reason(op.get("notes"))
                expense_category = self._categorize_expense(account_name, reason, op_type)
                if is_purchase:
                    purchase_expense += amount
                else:
                    other_expense += amount
                expense_breakdown_map[account_name] += amount
                expense_reason_map[reason] += amount
                expense_category_map[expense_category]["amount"] += amount
                expense_category_map[expense_category]["ops_count"] += 1
                expense_week_map[self._week_start_iso(operation_date)] += amount
                top_expense_operations.append(
                    {
                        "id": op.get("id"),
                        "date": operation_date.isoformat(),
                        "amount": round(amount, 2),
                        "account_name": account_name,
                        "reason": reason,
                        "category": expense_category,
                        "category_label": EXPENSE_CATEGORY_LABELS.get(
                            expense_category, EXPENSE_CATEGORY_LABELS["other"]
                        ),
                        "partner_name": op.get("partnerName")
                        or op.get("partner_name")
                        or "-",
                    }
                )

            ledger.append(
                {
                    "id": op.get("id"),
                    "type": op.get("type"),
                    "date": operation_date.isoformat(),
                    "account_name": account_name,
                    "account_type": account_type,
                    "amount": round(amount, 2),
                    "partner_name": op.get("partnerName") or op.get("partner_name") or "-",
                    "reason": self._clean_note_reason(op.get("notes")),
                    "direction": "in"
                    if is_revenue
                    else ("out" if is_expense else "neutral"),
                }
            )

            for item in op.get("items") or []:
                part_id = self._item_part_id(item)
                if not part_id:
                    continue
                qty = self._item_quantity(item)
                price = self._safe_float(item.get("price"), 0)
                if is_sale:
                    sold_qty += qty
                    price_timeline[part_id]["sale"].append(
                        {
                            "price": price,
                            "date": operation_date.isoformat(),
                            "quantity": qty,
                        }
                    )
                elif is_purchase:
                    price_timeline[part_id]["purchase"].append(
                        {
                            "price": price,
                            "date": operation_date.isoformat(),
                            "quantity": qty,
                        }
                    )

        price_trend = []
        detailed_price_timeline = []
        for part_id, bucket in price_timeline.items():
            sale_sorted = sorted(
                bucket.get("sale", []), key=lambda row: row.get("date") or "", reverse=True
            )
            purchase_sorted = sorted(
                bucket.get("purchase", []), key=lambda row: row.get("date") or "", reverse=True
            )
            latest_sale = [round(self._safe_float(row.get("price"), 0), 2) for row in sale_sorted[:3]]
            latest_purchase = [
                round(self._safe_float(row.get("price"), 0), 2)
                for row in purchase_sorted[:3]
            ]
            if not latest_sale and not latest_purchase:
                continue
            sale_change = (
                latest_sale[0] - latest_sale[-1] if len(latest_sale) >= 2 else 0.0
            )
            purchase_change = (
                latest_purchase[0] - latest_purchase[-1]
                if len(latest_purchase) >= 2
                else 0.0
            )
            price_trend.append(
                {
                    "part_id": part_id,
                    "part_name": (
                        parts_map.get(part_id).name
                        if parts_map.get(part_id)
                        else f"قطعة {part_id[:6]}"
                    ),
                    "latest_sale_prices": latest_sale,
                    "latest_purchase_prices": latest_purchase,
                    "sale_change": round(sale_change, 2),
                    "purchase_change": round(purchase_change, 2),
                }
            )

            all_prices = [
                self._safe_float(row.get("price"), 0)
                for row in (sale_sorted[:6] + purchase_sorted[:6])
                if self._safe_float(row.get("price"), 0) > 0
            ]
            max_price = max(all_prices) if all_prices else 0
            min_price = min(all_prices) if all_prices else 0
            volatility = (
                ((max_price - min_price) / max_price) * 100 if max_price > 0 else 0.0
            )

            latest_sale_points = [
                {
                    "date": row.get("date"),
                    "price": round(self._safe_float(row.get("price"), 0), 2),
                }
                for row in sale_sorted[:6]
            ]
            latest_purchase_points = [
                {
                    "date": row.get("date"),
                    "price": round(self._safe_float(row.get("price"), 0), 2),
                }
                for row in purchase_sorted[:6]
            ]

            sale_pct = self._percent_change(
                latest_sale[0], latest_sale[-1]
            ) if len(latest_sale) >= 2 else 0.0
            purchase_pct = self._percent_change(
                latest_purchase[0], latest_purchase[-1]
            ) if len(latest_purchase) >= 2 else 0.0

            detailed_price_timeline.append(
                {
                    "part_id": part_id,
                    "part_name": (
                        parts_map.get(part_id).name
                        if parts_map.get(part_id)
                        else f"قطعة {part_id[:6]}"
                    ),
                    "latest_sale_points": latest_sale_points,
                    "latest_purchase_points": latest_purchase_points,
                    "sale_change": round(sale_change, 2),
                    "purchase_change": round(purchase_change, 2),
                    "sale_change_pct": round(sale_pct, 2),
                    "purchase_change_pct": round(purchase_pct, 2),
                    "volatility_pct": round(volatility, 2),
                }
            )

        price_trend.sort(
            key=lambda row: (
                -(abs(row.get("sale_change", 0)) + abs(row.get("purchase_change", 0))),
                row.get("part_name") or "",
            )
        )

        expense_breakdown = sorted(
            [
                {
                    "account_name": account_name,
                    "amount": round(amount, 2),
                }
                for account_name, amount in expense_breakdown_map.items()
            ],
            key=lambda row: row["amount"],
            reverse=True,
        )
        expense_reasons = sorted(
            [
                {
                    "reason": reason,
                    "amount": round(amount, 2),
                }
                for reason, amount in expense_reason_map.items()
            ],
            key=lambda row: row["amount"],
            reverse=True,
        )
        expense_by_category = sorted(
            [
                {
                    "category": category,
                    "category_label": EXPENSE_CATEGORY_LABELS.get(
                        category, EXPENSE_CATEGORY_LABELS["other"]
                    ),
                    "amount": round(payload["amount"], 2),
                    "ops_count": payload["ops_count"],
                }
                for category, payload in expense_category_map.items()
            ],
            key=lambda row: row["amount"],
            reverse=True,
        )
        expense_weekly = sorted(
            [
                {"week_start": week_key, "amount": round(amount, 2)}
                for week_key, amount in expense_week_map.items()
            ],
            key=lambda row: row["week_start"],
            reverse=True,
        )
        top_expense_operations.sort(key=lambda row: row.get("amount", 0), reverse=True)
        detailed_price_timeline.sort(
            key=lambda row: (
                -(abs(row.get("sale_change", 0)) + abs(row.get("purchase_change", 0))),
                -row.get("volatility_pct", 0),
            )
        )

        def weighted_average(entries):
            total_qty = sum(self._safe_float(e.get("quantity"), 1) for e in entries)
            if total_qty <= 0:
                return 0
            weighted_sum = sum(
                self._safe_float(e.get("price"), 0) * self._safe_float(e.get("quantity"), 1)
                for e in entries
            )
            return weighted_sum / total_qty

        learned_pricing = []
        for part_id, timeline in price_timeline.items():
            part_ref = parts_map.get(part_id)
            sale_entries = timeline.get("sale", [])
            purchase_entries = timeline.get("purchase", [])
            sale_samples = len(sale_entries)
            purchase_samples = len(purchase_entries)

            learned_sale = weighted_average(sale_entries) if sale_samples >= 5 else None
            learned_purchase = (
                weighted_average(purchase_entries) if purchase_samples >= 5 else None
            )
            gap_value = (
                learned_sale - learned_purchase
                if learned_sale is not None and learned_purchase is not None
                else None
            )
            gap_pct = (
                (gap_value / learned_purchase * 100)
                if learned_purchase and gap_value is not None
                else None
            )

            learned_pricing.append(
                {
                    "part_id": part_id,
                    "part_name": (
                        part_ref.name if part_ref else f"قطعة {part_id[:6]}"
                    ),
                    "sale_samples": sale_samples,
                    "purchase_samples": purchase_samples,
                    "learned_sale_price": round(learned_sale, 2)
                    if learned_sale is not None
                    else None,
                    "learned_purchase_price": round(learned_purchase, 2)
                    if learned_purchase is not None
                    else None,
                    "gap_value": round(gap_value, 2) if gap_value is not None else None,
                    "gap_pct": round(gap_pct, 2) if gap_pct is not None else None,
                    "sale_ready": sale_samples >= 5,
                    "purchase_ready": purchase_samples >= 5,
                }
            )

        learned_pricing.sort(
            key=lambda item: (item.get("gap_pct") or 0), reverse=True
        )

        total_expense = purchase_expense + other_expense
        return {
            "operations_count": len(sorted_operations),
            "sales_count": sales_count,
            "purchases_count": purchases_count,
            "expense_ops_count": len(
                [row for row in ledger if row.get("direction") == "out"]
            ),
            "revenue": round(revenue, 2),
            "purchase_expense": round(purchase_expense, 2),
            "other_expense": round(other_expense, 2),
            "expense": round(total_expense, 2),
            "profit": round(revenue - total_expense, 2),
            "sold_qty": sold_qty,
            "sell_rate_per_day": 0,
            "expense_breakdown": expense_breakdown[:12],
            "expense_reasons": expense_reasons[:8],
            "expense_tracking": {
                "by_category": expense_by_category[:8],
                "weekly": expense_weekly[:8],
                "top_operations": top_expense_operations[:15],
            },
            "ledger": ledger[:30],
            "price_trend": price_trend[:12],
            "learned_pricing": learned_pricing[:12],
            "price_timeline": detailed_price_timeline[:12],
            "recent_ops": sorted_operations[:16],
        }

    async def get_inventory_architecture(self, days: int = 30) -> Dict[str, Any]:
        days = max(7, min(days, 365))
        parts = await self.list_parts()
        operations = await self.list_operations()
        backorders = await self.list_backorders()
        return self._build_replenishment_plan(parts, operations, backorders, days)

    async def get_rakan_analytics(self, days: int = 30) -> Dict[str, Any]:
        days = max(7, min(days, 365))
        now = datetime.now(timezone.utc)
        current_start = now - timedelta(days=days)
        previous_start = current_start - timedelta(days=days)

        parts = await self.list_parts()
        operations = await self.list_operations()
        chart_accounts = await self.list_chart_accounts()
        business_accounts = await self.list_business_accounts()

        parts_map = {part.id: part for part in parts}
        chart_by_id = {
            str(account.get("id") or account.get("code") or ""): account
            for account in chart_accounts
        }
        rakan_biz_ids = {
            str(account.get("id") or account.get("code") or "")
            for account in business_accounts
            if self._is_rakan_business_account(account)
        }
        rakan_chart_ids = {
            str(account.get("id") or account.get("code") or "")
            for account in chart_accounts
            if self._is_rakan_chart_account(account)
        }

        current_ops: List[Dict[str, Any]] = []
        previous_ops: List[Dict[str, Any]] = []
        for op in operations:
            op_date = self._operation_date(op)
            if op_date.tzinfo is None:
                op_date = op_date.replace(tzinfo=timezone.utc)

            accounting_ref = str(
                op.get("accountingAccountId")
                or op.get("accounting_account_id")
                or ""
            )
            is_rakan = self._is_rakan_operation(op, rakan_biz_ids) or accounting_ref in rakan_chart_ids
            if not is_rakan:
                continue
            if op_date >= current_start:
                current_ops.append(op)
            elif previous_start <= op_date < current_start:
                previous_ops.append(op)

        current_summary = self._summarize_rakan_operations(current_ops, parts_map, chart_by_id)
        previous_summary = self._summarize_rakan_operations(previous_ops, parts_map, chart_by_id)
        current_summary["sell_rate_per_day"] = round(
            current_summary.get("sold_qty", 0) / float(days), 2
        )

        comparison = {
            "revenue": self._delta_payload(
                current_summary.get("revenue", 0), previous_summary.get("revenue", 0)
            ),
            "expense": self._delta_payload(
                current_summary.get("expense", 0), previous_summary.get("expense", 0)
            ),
            "profit": self._delta_payload(
                current_summary.get("profit", 0), previous_summary.get("profit", 0)
            ),
            "sold_qty": self._delta_payload(
                current_summary.get("sold_qty", 0), previous_summary.get("sold_qty", 0)
            ),
        }

        insights: List[str] = []
        if current_summary.get("profit", 0) < 0:
            insights.append(
                "تنبيه: صافي نتيجة حسابات قطع راكان سالب في الفترة المحددة، راجع المشتريات والمصروفات التشغيلية."
            )
        if comparison["profit"]["delta"] < 0:
            insights.append(
                "الربحية تراجعت مقارنة بالفترة السابقة؛ راقب المصروفات غير المرتبطة بالمخزون وهوامش التسعير."
            )
        if current_summary.get("other_expense", 0) > current_summary.get("purchase_expense", 0) > 0:
            insights.append(
                "المصروفات التشغيلية/الشخصية أعلى من قيمة مشتريات القطع، يوصى بمراجعة أسباب الصرف وربطها بحسابات أدق."
            )
        if current_summary.get("sell_rate_per_day", 0) < 1:
            insights.append(
                "معدل البيع اليومي منخفض نسبيًا؛ قد تحتاج لتجديد التشكيلة أو تفعيل عروض سريعة على الأصناف الراكدة."
            )
        if any(row.get("sale_change", 0) <= -10 for row in current_summary.get("price_trend", [])):
            insights.append(
                "بعض القطع انخفض سعر بيعها في آخر التسعيرات، تحقّق من أثر ذلك على الهامش الربحي."
            )
        if any(row.get("purchase_change", 0) >= 10 for row in current_summary.get("price_trend", [])):
            insights.append(
                "تكلفة شراء بعض القطع ارتفعت بشكل ملحوظ؛ راجع الأسعار النهائية أو تفاوض مع المورد."
            )
        if not insights:
            insights.append(
                "الأداء مستقر حاليًا؛ استمر في متابعة فروقات الأسعار وتوزيع المصروفات أسبوعيًا."
            )

        return {
            **current_summary,
            "period_days": days,
            "period_comparison": comparison,
            "insights": insights,
        }
