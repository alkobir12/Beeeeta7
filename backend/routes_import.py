from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import json

import pandas as pd
import io
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/import")

db = None


def _mem_read(name: str) -> list:
    try:
        base_dir = os.path.join(os.path.dirname(__file__), "uploads")
        path = os.path.join(base_dir, f"{name}.json")
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _mem_write(name: str, items: list):
    try:
        base_dir = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(base_dir, exist_ok=True)
        path = os.path.join(base_dir, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def set_db(database):
    global db
    db = database


def _get_supa():
    # Import locally to avoid circular imports
    try:
        from supabase_service import SupabaseService

        return SupabaseService()
    except Exception:
        return None



def _is_service(name: str, category: str) -> bool:
    name = (name or "").strip()
    category = (category or "").strip()

    prefixes = (
        "فك وتركيب",
        "تركيب",
        "توضيب",
        "صيانة",
        "صيانه",
    )

    if name.startswith(prefixes):
        return True

    # بعض الملفات قد تضع الخدمة في خانة المجموعة
    if category.startswith(("توضيب",)):
        return True

    return False


@router.post("/parts")
async def import_parts(file: UploadFile = File(...)):
    provider = os.environ.get("DB_PROVIDER", "mongo").lower()

    supa = None
    if provider == "supabase":
        supa = _get_supa()
        if not supa or not getattr(supa, "client", None):
            raise HTTPException(status_code=500, detail="Supabase not initialized")
    else:
        if not db:
            raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        contents = await file.read()
        filename = file.filename.lower()

        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            # بعض ملفات الجرد تحتوي على عناوين متعددة الصفوف، نقرأ بدون header ثم نحدد صف الأعمدة
            df = pd.read_excel(io.BytesIO(contents), header=None)

        # إذا كان الملف Excel: تحديد صف العناوين (header row) تلقائياً لملفات الجرد متعددة الصفوف
        if not filename.endswith('.csv'):
            header_idx = None
            for i in range(min(20, len(df))):
                row_vals = [str(x).strip() for x in df.iloc[i].tolist() if str(x) != 'nan']
                # ملفات الجرد العربية غالباً تحتوي "الرمز" و"المادة" في صف العناوين
                if {'الرمز', 'المادة'}.issubset(set(row_vals)):
                    header_idx = i
                    break

            # fallback: أول صف غير فارغ
            if header_idx is None:
                for i in range(min(10, len(df))):
                    row_vals = [str(x).strip() for x in df.iloc[i].tolist() if str(x) != 'nan']
                    if len(row_vals) >= 3:
                        header_idx = i
                        break

            if header_idx is not None:
                df.columns = [str(x).strip() if str(x) != 'nan' else '' for x in df.iloc[header_idx].tolist()]
                df = df.iloc[header_idx + 1 :].copy()

            # تنظيف الأعمدة الفارغة
            df = df.loc[:, [c for c in df.columns if str(c).strip() != '']]


        # Normalize column names
        # Map Arabic/English to standard keys
        column_map = {
            "partNumber": [
                "partnumber",
                "part no",
                "part #",
                "رقم القطعة",
                "رقم",
                "code",
            ],
            "name": ["name", "description", "اسم القطعة", "الاسم", "الوصف"],
            "category": ["category", "type", "التصنيف", "الفئة", "النوع"],
            "purchasePrice": [
                "purchaseprice",
                "cost",
                "buy price",
                "سعر الشراء",
                "التكلفة",
            ],
            "sellingPrice": [
                "sellingprice",
                "price",
                "sell price",
                "سعر البيع",
                "السعر",
            ],
            "quantity": [
                "quantity",
                "qty",
                "stock",
                "count",
                "الكمية",
                "العدد",
                "المخزون",
            ],
            "minQuantity": [
                "minquantity",
                "min",
                "minimum",
                "low stock",
                "الحد الأدنى",
                "حد الطلب",
            ],
            "supplier": ["supplier", "vendor", "المورد", "مورد"],
            "location": ["location", "bin", "shelf", "الموقع", "الرف"],
            "image": ["image", "img", "photo", "url", "الصورة", "رابط الصورة"],
        }

        # Helper to find col
        def find_col(df_cols, keys):
            for col in df_cols:
                if str(col).lower().strip() in keys:
                    return col
            return None

        parts_to_insert = []
        updated_count = 0
        processed_count = 0

        # ملاحظة أداء: في وضع Supabase نعمل upsert دفعات لتجنب وقت طويل
        if provider == "supabase":
            parts_rows = []
            services_rows = []

            for _, row in df.iterrows():
                # Extract values
                p_num = row.get(find_col(df.columns, column_map["partNumber"]))
                if pd.isna(p_num) or not str(p_num).strip():
                    p_num = row.get(find_col(df.columns, ["الرمز"]))

                if pd.isna(p_num) or not str(p_num).strip():
                    continue

                processed_count += 1

                name_val = row.get(find_col(df.columns, column_map["name"]))
                if pd.isna(name_val) or not str(name_val).strip():
                    name_val = row.get(find_col(df.columns, ["المادة"]))

                cat_val = row.get(find_col(df.columns, column_map["category"]))
                if pd.isna(cat_val) or not str(cat_val).strip():
                    cat_val = row.get(find_col(df.columns, ["المجموعة"]))

                qty_val = row.get(find_col(df.columns, column_map["quantity"]))
                if pd.isna(qty_val) or str(qty_val).strip() == "":
                    qty_val = row.get(find_col(df.columns, ["الكمية"]))

                price_val = row.get(find_col(df.columns, column_map["sellingPrice"]))
                if pd.isna(price_val) or str(price_val).strip() == "":
                    price_val = row.get(find_col(df.columns, ["السعر الإفرادي"]))

                def _num(val, default=0.0):
                    try:
                        if val is None or (isinstance(val, float) and pd.isna(val)):
                            return default
                        s = str(val).strip().replace(',', '')
                        if s == '':
                            return default
                        return float(s)
                    except Exception:
                        return default

                part_number = str(p_num).strip()
                name_str = str(name_val or part_number).strip()
                cat_str = str(cat_val or "عام").strip()

                if _is_service(name_str, cat_str):
                    services_rows.append(
                        {
                            "name": name_str,
                            "category": cat_str,
                            "price": float(_num(price_val, 0)),
                            "duration_minutes": 30,
                            "active": True,
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    )
                else:
                    parts_rows.append(
                        {
                            "part_number": part_number,
                            "name": name_str,
                            "category": cat_str,
                            "purchase_price": float(
                                row.get(find_col(df.columns, column_map["purchasePrice"]), 0)
                                or 0
                            ),
                            "selling_price": float(_num(price_val, 0)),
                            "quantity": int(abs(_num(qty_val, 0))),
                            "min_quantity": int(
                                float(
                                    row.get(
                                        find_col(df.columns, column_map["minQuantity"]), 5
                                    )
                                    or 5
                                )
                            ),
                            "supplier": str(
                                row.get(find_col(df.columns, column_map["supplier"]), "")
                            ).strip(),
                            "image": str(
                                row.get(find_col(df.columns, column_map["image"]), "")
                            ).strip(),
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    )

            if parts_rows:
                supa.client.table("parts").upsert(parts_rows, on_conflict="part_number").execute()

            if services_rows:
                # لا يوجد code للخدمات حسب طلبك، فنستخدم upsert على (name)
                supa.client.table("services").upsert(services_rows, on_conflict="name").execute()

            return {
                "status": "success",
                "imported_parts": len(parts_rows),
                "imported_services": len(services_rows),
                "updated": 0,
                "total": len(parts_rows) + len(services_rows),
                "processed": processed_count,
            }

        for _, row in df.iterrows():
            # Extract values
            # دعم ملفات الجرد العربية مثل الملف المرفق (رمز/المادة/المجموعة/السعر/الكمية)
            p_num = row.get(find_col(df.columns, column_map["partNumber"]))
            if pd.isna(p_num) or not str(p_num).strip():
                p_num = row.get(find_col(df.columns, ["الرمز"]))

            if pd.isna(p_num) or not str(p_num).strip():
                continue  # Skip empty part numbers

            processed_count += 1

            name_val = row.get(find_col(df.columns, column_map["name"]))
            if pd.isna(name_val) or not str(name_val).strip():
                name_val = row.get(find_col(df.columns, ["المادة"]))

            cat_val = row.get(find_col(df.columns, column_map["category"]))
            if pd.isna(cat_val) or not str(cat_val).strip():
                cat_val = row.get(find_col(df.columns, ["المجموعة"]))

            qty_val = row.get(find_col(df.columns, column_map["quantity"]))
            if pd.isna(qty_val) or str(qty_val).strip() == "":
                qty_val = row.get(find_col(df.columns, ["الكمية"]))

            price_val = row.get(find_col(df.columns, column_map["sellingPrice"]))
            if pd.isna(price_val) or str(price_val).strip() == "":
                price_val = row.get(find_col(df.columns, ["السعر الإفرادي"]))

            # في ملف الجرد المرفق: الكمية والسعر قد يكونان نصوص/قيم سالبة
            def _num(val, default=0.0):
                try:
                    if val is None or (isinstance(val, float) and pd.isna(val)):
                        return default
                    s = str(val).strip().replace(',', '')
                    if s == '':
                        return default
                    return float(s)
                except Exception:
                    return default

            part_data = {
                "partNumber": str(p_num).strip(),
                "name": str(name_val or "").strip(),
                "category": str(cat_val or "عام").strip(),
                "purchasePrice": float(
                    row.get(find_col(df.columns, column_map["purchasePrice"]), 0) or 0
                ),
                "sellingPrice": _num(price_val, 0),
                "quantity": int(abs(_num(qty_val, 0))),
                "minQuantity": int(
                    float(row.get(find_col(df.columns, column_map["minQuantity"]), 5) or 5)
                ),
                "supplier": str(
                    row.get(find_col(df.columns, column_map["supplier"]), "")
                ).strip(),
                "location": str(
                    row.get(find_col(df.columns, column_map["location"]), "")
                ).strip(),
                "image": str(
                    row.get(find_col(df.columns, column_map["image"]), "")
                ).strip(),
            }

            if provider == "supabase":
                # map to supabase schema
                row_db = {
                    "part_number": part_data["partNumber"],
                    "name": part_data["name"] or part_data["partNumber"],
                    "category": part_data["category"],
                    "purchase_price": float(part_data["purchasePrice"] or 0),
                    "selling_price": float(part_data["sellingPrice"] or 0),
                    "quantity": int(part_data["quantity"] or 0),
                    "min_quantity": int(part_data["minQuantity"] or 5),
                    "supplier": part_data["supplier"],
                    "image": part_data["image"],
                    "updated_at": datetime.utcnow().isoformat(),
                }

                res = (
                    supa.client.table("parts")
                    .select("id")
                    .eq("part_number", row_db["part_number"])
                    .limit(1)
                    .execute()
                )
                existing = getattr(res, "data", None) or []
                existing_id = (existing or [{}])[0].get("id") if isinstance(existing, list) else None

                if existing_id:
                    supa.client.table("parts").update(row_db).eq(
                        "id", existing_id
                    ).execute()
                    updated_count += 1
                else:
                    row_db["created_at"] = datetime.utcnow().isoformat()
                    parts_to_insert.append(row_db)
            else:
                part_data["updatedAt"] = datetime.utcnow()

                # Check if exists
                existing = await db.parts.find_one({"partNumber": part_data["partNumber"]})
                if existing:
                    await db.parts.update_one({"_id": existing["_id"]}, {"$set": part_data})
                    updated_count += 1
                else:
                    part_data["id"] = str(uuid.uuid4())
                    part_data["createdAt"] = datetime.utcnow()
                    parts_to_insert.append(part_data)

        if parts_to_insert:
            if provider == "supabase":
                supa.client.table("parts").insert(parts_to_insert).execute()
            else:
                await db.parts.insert_many(parts_to_insert)

        return {
            "status": "success",
            "imported": len(parts_to_insert),
            "updated": updated_count,
            "total": len(parts_to_insert) + updated_count,
            "processed": processed_count,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/customers")
async def import_customers(file: UploadFile = File(...)):
    provider = os.environ.get("DB_PROVIDER", "mongo").lower()

    supa = None
    if provider == "supabase":
        supa = _get_supa()
        if not supa or not getattr(supa, "client", None):
            raise HTTPException(status_code=500, detail="Supabase not initialized")
    else:
        if not db:
            raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        contents = await file.read()
        filename = (file.filename or "").lower()

        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents), header=None)

        if not filename.endswith(".csv"):
            header_idx = None
            header_keywords = {
                "name",
                "customer name",
                "اسم",
                "اسم العميل",
                "phone",
                "mobile",
                "الجوال",
                "الهاتف",
            }

            for i in range(min(15, len(df))):
                row_vals = [str(x).strip().lower() for x in df.iloc[i].tolist() if str(x) != "nan"]
                if any(key in row_vals for key in header_keywords):
                    header_idx = i
                    break

            if header_idx is not None:
                df.columns = [str(x).strip() if str(x) != "nan" else "" for x in df.iloc[header_idx].tolist()]
                df = df.iloc[header_idx + 1 :].copy()

            df = df.loc[:, [c for c in df.columns if str(c).strip() != ""]]

        column_map = {
            "name": ["name", "customer name", "اسم", "اسم العميل"],
            "phone": ["phone", "mobile", "الجوال", "الهاتف", "رقم الجوال"],
            "email": ["email", "e-mail", "البريد", "البريد الإلكتروني"],
            "address": ["address", "العنوان"],
            "vehicle_brand": ["vehicle brand", "brand", "نوع المركبة", "الماركة"],
            "vehicle_plate": ["plate", "plate number", "رقم اللوحة", "اللوحة"],
            "vehicle_km": ["km", "kilometers", "عداد", "الكيلومترات", "km"],
        }

        def find_col(df_cols, keys):
            for col in df_cols:
                if str(col).lower().strip() in keys:
                    return col
            return None

        def clean_text(val) -> str:
            if val is None:
                return ""
            if isinstance(val, float) and pd.isna(val):
                return ""
            if isinstance(val, float) and val.is_integer():
                return str(int(val))
            text = str(val).strip()
            if text.lower() == "nan":
                return ""
            return text

        def clean_int(val):
            try:
                if val is None or (isinstance(val, float) and pd.isna(val)):
                    return None
                text = str(val).strip().replace(",", "")
                if text == "":
                    return None
                return int(float(text))
            except Exception:
                return None

        imported_count = 0
        updated_count = 0
        processed_count = 0
        skipped_count = 0

        for _, row in df.iterrows():
            name_val = clean_text(row.get(find_col(df.columns, column_map["name"])))
            phone_val = clean_text(row.get(find_col(df.columns, column_map["phone"])))
            email_val = clean_text(row.get(find_col(df.columns, column_map["email"])))
            address_val = clean_text(row.get(find_col(df.columns, column_map["address"])))
            vehicle_brand_val = clean_text(row.get(find_col(df.columns, column_map["vehicle_brand"])))
            vehicle_plate_val = clean_text(row.get(find_col(df.columns, column_map["vehicle_plate"])))
            vehicle_km_val = clean_int(row.get(find_col(df.columns, column_map["vehicle_km"])))

            if not name_val or not phone_val:
                skipped_count += 1
                continue

            processed_count += 1

            payload = {
                "name": name_val,
                "phone": phone_val,
                "email": email_val or None,
                "address": address_val or None,
                "vehicle_brand": vehicle_brand_val or None,
                "vehicle_plate": vehicle_plate_val or None,
                "vehicle_km": vehicle_km_val,
                "updated_at": datetime.utcnow().isoformat(),
            }

            if provider == "supabase":
                existing = (
                    supa.client.table("customers")
                    .select("id")
                    .eq("phone", phone_val)
                    .limit(1)
                    .execute()
                )
                existing_row = None
                if isinstance(existing.data, list) and existing.data:
                    existing_row = existing.data[0]
                elif isinstance(existing.data, dict):
                    existing_row = existing.data
                existing_id = existing_row.get("id") if existing_row else None

                if existing_id:
                    supa.client.table("customers").update(payload).eq("id", existing_id).execute()
                    updated_count += 1
                else:
                    payload["created_at"] = datetime.utcnow().isoformat()
                    supa.client.table("customers").insert(payload).execute()
                    imported_count += 1
            else:
                if provider == "memory":
                    rows = _mem_read("customers")
                    existing_idx = next((i for i, c in enumerate(rows) if c.get("phone") == phone_val), None)
                    if existing_idx is not None:
                        rows[existing_idx] = {
                            **rows[existing_idx],
                            "name": name_val,
                            "phone": phone_val,
                            "email": email_val or None,
                            "address": address_val or None,
                            "vehicleBrand": vehicle_brand_val or None,
                            "vehiclePlate": vehicle_plate_val or None,
                            "vehicleKm": vehicle_km_val,
                            "updatedAt": datetime.utcnow().isoformat(),
                        }
                        updated_count += 1
                    else:
                        rows.append(
                            {
                                "id": str(uuid.uuid4()),
                                "name": name_val,
                                "phone": phone_val,
                                "email": email_val or None,
                                "address": address_val or None,
                                "vehicleBrand": vehicle_brand_val or None,
                                "vehiclePlate": vehicle_plate_val or None,
                                "vehicleKm": vehicle_km_val,
                                "totalVisits": 0,
                                "createdAt": datetime.utcnow().isoformat(),
                            }
                        )
                        imported_count += 1
                    _mem_write("customers", rows)
                else:
                    existing = await db.customers.find_one({"phone": phone_val})
                    if existing:
                        await db.customers.update_one(
                            {"_id": existing["_id"]},
                            {
                                "$set": {
                                    "name": name_val,
                                    "phone": phone_val,
                                    "email": email_val or None,
                                    "address": address_val or None,
                                    "vehicleBrand": vehicle_brand_val or None,
                                    "vehiclePlate": vehicle_plate_val or None,
                                    "vehicleKm": vehicle_km_val,
                                    "updatedAt": datetime.utcnow(),
                                }
                            },
                        )
                        updated_count += 1
                    else:
                        await db.customers.insert_one(
                            {
                                "id": str(uuid.uuid4()),
                                "name": name_val,
                                "phone": phone_val,
                                "email": email_val or None,
                                "address": address_val or None,
                                "vehicleBrand": vehicle_brand_val or None,
                                "vehiclePlate": vehicle_plate_val or None,
                                "vehicleKm": vehicle_km_val,
                                "totalVisits": 0,
                                "createdAt": datetime.utcnow(),
                            }
                        )
                        imported_count += 1

        return {
            "status": "success",
            "imported": imported_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "processed": processed_count,
            "total": imported_count + updated_count,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
