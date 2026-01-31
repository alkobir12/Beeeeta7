from fastapi import APIRouter, UploadFile, File, HTTPException
import os

import pandas as pd
import io
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/import")

db = None


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
            df = pd.read_excel(io.BytesIO(contents))

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

        for _, row in df.iterrows():
            # Extract values
            # دعم ملفات الجرد العربية مثل الملف المرفق (رمز/المادة/المجموعة/السعر/الكمية)
            p_num = row.get(find_col(df.columns, column_map["partNumber"]))
            if pd.isna(p_num) or not str(p_num).strip():
                p_num = row.get(find_col(df.columns, ["الرمز"]))

            if pd.isna(p_num) or not str(p_num).strip():
                continue  # Skip empty part numbers

            part_data = {
                "partNumber": str(p_num).strip(),
                "name": str(
                    row.get(find_col(df.columns, column_map["name"]), "")
                ).strip(),
                "category": str(
                    row.get(find_col(df.columns, column_map["category"]), "عام")
                ).strip(),
                "purchasePrice": float(
                    row.get(find_col(df.columns, column_map["purchasePrice"]), 0)
                ),
                "sellingPrice": float(
                    row.get(find_col(df.columns, column_map["sellingPrice"]), 0)
                ),
                "quantity": int(
                    float(row.get(find_col(df.columns, column_map["quantity"]), 0))
                ),
                "minQuantity": int(
                    float(row.get(find_col(df.columns, column_map["minQuantity"]), 5))
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

                existing = (
                    supa.client.table("parts")
                    .select("id")
                    .eq("part_number", row_db["part_number"])
                    .maybe_single()
                    .execute()
                    .data
                )
                if existing and existing.get("id"):
                    supa.client.table("parts").update(row_db).eq(
                        "id", existing["id"]
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
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
