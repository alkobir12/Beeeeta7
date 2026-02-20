from datetime import datetime, timezone
import uuid

async def _sync_visit_to_operation(visit_id: str, visit_data: dict, supa_service=None):
    """
    Sync visit items to a financial operation (Invoice).
    If items exist in visit.notes, create/update an operation so it appears in Finance.
    """
    try:
        # 1. Parse items from notes
        notes_raw = visit_data.get("notes")
        items = []
        if notes_raw:
            try:
                if isinstance(notes_raw, str) and notes_raw.strip().startswith("{"):
                    import json
                    parsed = json.loads(notes_raw)
                    items = parsed.get("items", [])
                elif isinstance(notes_raw, dict):
                    items = notes_raw.get("items", [])
            except:
                pass
        
        if not items:
            return # No items to sync

        # 2. Calculate Total
        total = sum(float(i.get("price", 0)) * float(i.get("quantity", 1)) for i in items)
        
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
            except:
                pass

        op_data = {
            "id": visit_id,
            "type": "service",
            "items": items,
            "total": total,
            "subtotal": total,
            "vehicle_id": vehicle_id,
            "partner_name": partner_name,
            "partner_type": "customer",
            "payment_method": "credit",  # Default to credit so it appears as unpaid
            "notes": f"عملية من الزيارة {visit_id[:8]}",
            "op_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # 4. Upsert Operation
        if supa_service:
            # Upsert using visit_id as operation id
            supa_service.client.table("operations").upsert(op_data).execute()
            print(f"✅ Synced Visit {visit_id} -> Upsert Operation {visit_id}")
        
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
                            "updatedAt": datetime.utcnow()
                        }}
                    )
                else:
                    op_data["id"] = str(uuid.uuid4())
                    op_data["visitId"] = visit_id
                    op_data["vehicleId"] = vehicle_id
                    op_data["partnerName"] = partner_name
                    op_data["partnerType"] = "customer"
                    op_data["paymentMethod"] = "credit"
                    op_data["date"] = datetime.utcnow()
                    op_data["createdAt"] = datetime.utcnow()
                    # Remove snake_case keys for Mongo if needed, or keep for compatibility
                    await db.operations.insert_one(op_data)

    except Exception as e:
        print(f"⚠️ Failed to sync visit to operation: {e}")

