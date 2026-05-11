"""
🔩 Parts Router — GET, POST, PUT (extracted from server.py)

URL: /api/parts
Extracted from server.py on 2026-02-11.

NOTE: /parts/{id}/sell and /parts/{id}/restock remain in server.py for now
(they are tightly coupled with inventory adjustment & journal-entry flows).
"""

import uuid
from typing import List

from fastapi import APIRouter, HTTPException

import app_state
from models import Part, PartCreate, PartUpdate

router = APIRouter(prefix="/api", tags=["parts"])


@router.get("/parts", response_model=List[Part])
async def get_parts(search: str = "", low_stock: bool = False):
    if app_state.DB_PROVIDER == "supabase":
        try:
            rows = app_state.supabase_service.parts_list()
            result = []
            for r in rows:
                p = Part(**r)
                if search and search.lower() not in str(p.dict()).lower():
                    continue
                if low_stock and p.quantity >= p.minQuantity:
                    continue
                result.append(p)
            return result
        except Exception as e:
            print(f"Supabase parts error: {e}")
            return []

    if app_state.DB_PROVIDER == "memory":
        parts = app_state.mem_read("parts")
        result = []
        for p in parts:
            if search and search.lower() not in str(p).lower():
                continue
            if low_stock and p.get("quantity", 0) >= p.get("minQuantity", 0):
                continue
            result.append(Part(**p))
        return result

    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"partNumber": {"$regex": search, "$options": "i"}},
        ]
    if low_stock:
        query["$expr"] = {"$lt": ["$quantity", "$minQuantity"]}
    parts = await app_state.db.parts.find(query, {"_id": 0}).to_list(1000)
    return [Part(**p) for p in parts]


@router.post("/parts", response_model=Part)
async def create_part(part: PartCreate):
    if app_state.DB_PROVIDER == "supabase":
        p = app_state.supabase_service.parts_create(part.dict())
        return Part(**p)
    if app_state.DB_PROVIDER == "memory":
        parts = app_state.mem_read("parts")
        new_p = {**part.dict(), "id": str(uuid.uuid4())}
        parts.append(new_p)
        app_state.mem_write("parts", parts)
        return Part(**new_p)
    part_dict = part.dict()
    part_dict["id"] = str(uuid.uuid4())
    await app_state.db.parts.insert_one(part_dict)
    return Part(**part_dict)


@router.put("/parts/{part_id}", response_model=Part)
async def update_part(part_id: str, part: PartUpdate):
    upd = {k: v for k, v in part.dict().items() if v is not None}
    if app_state.DB_PROVIDER == "supabase":
        p = app_state.supabase_service.parts_update(part_id, upd)
        return Part(**p)
    if app_state.DB_PROVIDER == "memory":
        parts = app_state.mem_read("parts")
        for i, p in enumerate(parts):
            if p.get("id") == part_id:
                parts[i].update(upd)
                app_state.mem_write("parts", parts)
                return Part(**parts[i])
        raise HTTPException(status_code=404, detail="Part not found")
    await app_state.db.parts.update_one({"id": part_id}, {"$set": upd})
    p = await app_state.db.parts.find_one({"id": part_id})
    if not p:
        raise HTTPException(status_code=404, detail="Part not found")
    return Part(**p)
