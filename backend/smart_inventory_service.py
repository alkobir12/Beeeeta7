import json
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

    async def get_control_panel(self, days: int = 90) -> Dict[str, Any]:
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
