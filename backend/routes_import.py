from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/import")

db = None


def set_db(database):
    global db
    db = database


@router.post("/parts")
async def import_parts(file: UploadFile = File(...)):
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
            p_num = row.get(find_col(df.columns, column_map["partNumber"]))
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
                "updatedAt": datetime.utcnow(),
            }

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
            await db.parts.insert_many(parts_to_insert)

        return {
            "status": "success",
            "imported": len(parts_to_insert),
            "updated": updated_count,
            "total": len(parts_to_insert) + updated_count,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
