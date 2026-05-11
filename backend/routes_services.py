"""
🔧 Services Router (extracted from server.py)

URL: /api/services
Extracted from server.py on 2026-02-11.
"""

from typing import List

from fastapi import APIRouter, HTTPException

import app_state
from models import Service

router = APIRouter(prefix="/api", tags=["services"])


@router.get("/services", response_model=List[Service])
async def get_services():
    if app_state.DB_PROVIDER == "supabase":
        rows = app_state.supabase_service.services_list()
        return [Service(**r) for r in rows]

    if app_state.DB_PROVIDER == "memory":
        return [Service(**r) for r in app_state.mem_read("services")]
    services = await app_state.db.services.find().to_list(1000)
    return [Service(**s) for s in services]


@router.post("/services", response_model=Service)
async def create_service(service: Service):
    if app_state.DB_PROVIDER == "supabase":
        s = app_state.supabase_service.services_create(service.dict())
        return Service(**s)

    if app_state.DB_PROVIDER == "memory":
        rows = app_state.mem_read("services")
        rows.append(service.dict())
        app_state.mem_write("services", rows)
        return service
    await app_state.db.services.insert_one(service.dict())
    return service


@router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, service: Service):
    if app_state.DB_PROVIDER == "supabase":
        s = app_state.supabase_service.services_update(service_id, service.dict())
        if not s:
            raise HTTPException(status_code=404, detail="Service not found")
        return Service(**s)

    if app_state.DB_PROVIDER == "memory":
        rows = app_state.mem_read("services")
        for i, s in enumerate(rows):
            if s.get("id") == service_id:
                rows[i] = {**service.dict(), "id": service_id}
                app_state.mem_write("services", rows)
                return Service(**rows[i])
        raise HTTPException(status_code=404, detail="Service not found")

    result = await app_state.db.services.update_one(
        {"id": service_id}, {"$set": service.dict()}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    if app_state.DB_PROVIDER == "supabase":
        success = app_state.supabase_service.services_delete(service_id)
        if not success:
            raise HTTPException(status_code=404, detail="Service not found")
        return {"status": "success", "message": "Service deleted"}

    if app_state.DB_PROVIDER == "memory":
        rows = app_state.mem_read("services")
        filtered = [s for s in rows if s.get("id") != service_id]
        if len(filtered) == len(rows):
            raise HTTPException(status_code=404, detail="Service not found")
        app_state.mem_write("services", filtered)
        return {"status": "success", "message": "Service deleted"}

    result = await app_state.db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"status": "success", "message": "Service deleted"}
