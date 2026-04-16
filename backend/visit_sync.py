from datetime import datetime, timezone
import uuid
import re

async def _sync_visit_to_operation(visit_id: str, visit_data: dict, supa_service=None):
    """
    Sync visit items to a financial operation (Invoice).
    If items exist in visit.notes, create/update an operation so it appears in Finance.
    """
    try:
        # 1. Parse items from notes
        notes_raw = visit_data.get("notes")
        items = []
        payments = []
        if notes_raw:
            try:
                if isinstance(notes_raw, str) and notes_raw.strip().startswith("{"):
                    import json
                    parsed = json.loads(notes_raw)
                    items = parsed.get("items", [])
                    payments = parsed.get("payments", []) or []
                elif isinstance(notes_raw, dict):
                    items = notes_raw.get("items", [])
                    payments = notes_raw.get("payments", []) or []
            except Exception:
                pass
        
        if not items:
            return # No items to sync

        # 2. Calculate totals with strict separation
        total_workshop = 0.0
        total_suppliers = 0.0
        for i in items:
            line_total = float(i.get("total", 0) or 0) or (float(i.get("price", 0) or 0) * float(i.get("quantity", 1) or 1))
            item_type = str(i.get("itemType") or i.get("type") or "").strip().lower()
            if item_type == "supplier":
                total_suppliers += line_total
            else:
                total_workshop += line_total

        total = total_workshop
        
        # 3. Prepare Operation Data
        vehicle_id = visit_data.get("vehicleId") or visit_data.get("vehicle_id")
        
        # We need vehicle info for partner name (Customer)
        partner_name = "عميل"
        if supa_service and vehicle_id:
            try:
                # Try to fetch vehicle to get customer name
                v_res = supa_service.client.table("vehicles").select("customer_name").eq("id", vehicle_id).single().execute()
                if v_res.data:
                    partner_name = v_res.data.get("customer_name") or "عميل"
            except Exception:
                pass

        payment_status = visit_data.get("payment_status") or visit_data.get("paymentStatus")

        raw_payment_method = (
            visit_data.get("payment_method")
            or visit_data.get("paymentMethod")
            or ((payments or [])[-1].get("method") if payments else None)
            or ((payments or [])[-1].get("payment_method") if payments else None)
        )

        normalized_method = str(raw_payment_method or "").strip().lower()
        if normalized_method in {"تحويل", "bank_transfer", "transfer", "bank"}:
            payment_method = "transfer"
        elif normalized_method in {"بطاقة", "card", "pos", "mada", "visa", "mastercard"}:
            payment_method = "card"
        elif normalized_method in {"نقد", "نقدي", "cash"}:
            payment_method = "cash"
        else:
            payment_method = "cash" if str(payment_status).lower() == "paid" else "credit"

        op_data = {
            "id": visit_id,
            "type": "service",
            "items": items,
            "total": total,
            "subtotal": total,
            "workshop_total": total_workshop,
            "supplier_archive_total": total_suppliers,
            "total_combined": total_workshop + total_suppliers,
            "vehicle_id": vehicle_id,
            "visit_id": visit_id,
            "partner_name": partner_name,
            "partner_type": "customer",
            "payment_method": payment_method,
            "payment_status": payment_status or ("paid" if payment_method != "credit" else "unpaid"),
            "scope": "vehicle",
            "source": "vehicle_visit_sync",
            "business_unit": "workshop",
            "notes": f"عملية من الزيارة {visit_id[:8]}",
            "op_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # 4. Upsert Operation
        if supa_service:
            # Upsert using visit_id as operation id.
            # Some preview/prod Supabase schemas may miss optional columns.
            # Retry safely by removing unknown columns reported by PostgREST.
            payload = dict(op_data)
            for _ in range(12):
                try:
                    supa_service.client.table("operations").upsert(payload).execute()
                    print(f"✅ Synced Visit {visit_id} -> Upsert Operation {visit_id}")
                    break
                except Exception as sync_error:
                    message = str(sync_error)
                    missing_match = re.search(r"Could not find the '([^']+)' column", message)
                    if not missing_match:
                        raise
                    missing_column = missing_match.group(1)
                    if missing_column not in payload:
                        raise
                    payload.pop(missing_column, None)
                    print(f"⚠️ Sync retry without missing column: {missing_column}")
        
        # MongoDB support (Legacy)
        else:
            global db
            if db:
                existing = await db.operations.find_one({"visitId": visit_id})
                if existing:
                    await db.operations.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {
                            "items": items, 
                            "total": total, 
                            "subtotal": total,
                            "paymentMethod": payment_method,
                            "paymentStatus": payment_status or ("paid" if payment_method != "credit" else "unpaid"),
                            "updatedAt": datetime.utcnow()
                        }}
                    )
                else:
                    op_data["id"] = str(uuid.uuid4())
                    op_data["visitId"] = visit_id
                    op_data["vehicleId"] = vehicle_id
                    op_data["visitId"] = visit_id
                    op_data["partnerName"] = partner_name
                    op_data["partnerType"] = "customer"
                    op_data["paymentMethod"] = payment_method
                    op_data["paymentStatus"] = payment_status or ("paid" if payment_method != "credit" else "unpaid")
                    op_data["scope"] = "vehicle"
                    op_data["source"] = "vehicle_visit_sync"
                    op_data["businessUnit"] = "workshop"
                    op_data["date"] = datetime.utcnow()
                    op_data["createdAt"] = datetime.utcnow()
                    # Remove snake_case keys for Mongo if needed, or keep for compatibility
                    await db.operations.insert_one(op_data)

    except Exception as e:
        print(f"⚠️ Failed to sync visit to operation: {e}")

