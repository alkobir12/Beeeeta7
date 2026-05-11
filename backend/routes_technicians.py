"""
🧑‍🔧 Technicians Router (extracted from server.py)

URL: /api/technicians
Extracted from server.py (lines 2626-2688) on 2026-02-11.
"""

import uuid
from typing import List

from fastapi import APIRouter, HTTPException

import app_state
from models import Technician

router = APIRouter(prefix="/api", tags=["technicians"])


@router.get("/technicians", response_model=List[Technician])
async def get_technicians():
    if app_state.DB_PROVIDER == "supabase":
        rows = app_state.supabase_service.technicians_list()
        return [Technician(**r) for r in rows]

    if app_state.DB_PROVIDER == "memory":
        return [Technician(**r) for r in app_state.mem_read("technicians")]

    technicians = await app_state.db.technicians.find().to_list(1000)
    return [Technician(**t) for t in technicians]


@router.post("/technicians", response_model=Technician)
async def create_technician(technician: Technician):
    """Add a new technician."""
    if app_state.DB_PROVIDER == "supabase":
        if not app_state.supabase_service.client or app_state.supabase_service.mock_mode:
            raise HTTPException(status_code=500, detail="Supabase client not configured")
        data = {
            "name": technician.name,
            "phone": technician.phone,
            "specialty": technician.specialty,
            "active_jobs": technician.activeJobs,
            "completed_jobs": technician.completedJobs,
            "rating": technician.rating,
        }
        res = app_state.supabase_service.client.table("technicians").insert(data).execute()
        row = (res.data or [{}])[0]
        return Technician(
            id=row.get("id"),
            name=row.get("name"),
            phone=row.get("phone", ""),
            specialty=row.get("specialty", ""),
            activeJobs=row.get("active_jobs", 0),
            completedJobs=row.get("completed_jobs", 0),
            rating=row.get("rating", 5.0),
        )

    if app_state.DB_PROVIDER == "memory":
        rows = app_state.mem_read("technicians")
        new_t = {**technician.dict(), "id": str(uuid.uuid4())}
        rows.append(new_t)
        app_state.mem_write("technicians", rows)
        return Technician(**new_t)

    tech_dict = technician.dict()
    tech_dict["id"] = str(uuid.uuid4())
    await app_state.db.technicians.insert_one(tech_dict)
    return Technician(**tech_dict)
