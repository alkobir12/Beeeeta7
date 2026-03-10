from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from smart_inventory_models import (
    BackorderCreateRequest,
    BackorderStatus,
    BackorderStatusUpdateRequest,
)
from smart_inventory_service import SmartInventoryService


router = APIRouter(prefix="/api/inventory", tags=["smart-inventory"])
db = None


def set_db(database):
    global db
    db = database


@router.get("/dashboard")
async def get_inventory_dashboard():
    service = SmartInventoryService(db)
    return await service.get_dashboard()


@router.get("/alerts")
async def get_inventory_alerts(limit: int = Query(default=50, ge=1, le=500)):
    service = SmartInventoryService(db)
    return await service.get_alerts(limit=limit)


@router.get("/control-panel")
async def get_inventory_control_panel(days: int = Query(default=30, ge=7, le=365)):
    service = SmartInventoryService(db)
    return await service.get_control_panel(days=days)


@router.get("/architecture")
async def get_inventory_architecture(days: int = Query(default=30, ge=7, le=365)):
    service = SmartInventoryService(db)
    return await service.get_inventory_architecture(days=days)


@router.get("/rakan-analytics")
async def get_rakan_inventory_analytics(days: int = Query(default=30, ge=7, le=365)):
    service = SmartInventoryService(db)
    return await service.get_rakan_analytics(days=days)


@router.get("/backorders")
async def list_backorders(status: Optional[BackorderStatus] = None):
    service = SmartInventoryService(db)
    records = await service.list_backorders(status=status)
    return [item.dict() for item in records]


@router.post("/backorders")
async def create_backorder(payload: BackorderCreateRequest):
    service = SmartInventoryService(db)
    record = await service.create_backorder(payload)
    return record.dict()


@router.patch("/backorders/{backorder_id}/status")
async def update_backorder_status(backorder_id: str, payload: BackorderStatusUpdateRequest):
    service = SmartInventoryService(db)
    updated = await service.update_backorder_status(
        backorder_id,
        status=payload.status,
        note=payload.note,
        expected_date=payload.expected_date,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Backorder not found")
    return updated.dict()
