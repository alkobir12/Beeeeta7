from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class InventoryLocation(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    zone: Optional[str] = None


class InventoryVehicleReference(BaseModel):
    id: Optional[str] = None
    plate_number: Optional[str] = None
    customer_name: Optional[str] = None


class InventoryPart(BaseModel):
    id: str
    part_number: str
    name: str
    category: str
    quantity: int = 0
    min_quantity: int = 0
    purchase_price: float = 0
    selling_price: float = 0
    supplier: Optional[str] = None
    location: Optional[InventoryLocation] = None
    linked_vehicle: Optional[InventoryVehicleReference] = None


class AlertSeverity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    info = "info"


class InventoryAlert(BaseModel):
    id: str
    severity: AlertSeverity
    alert_type: str
    title: str
    message: str
    part_id: Optional[str] = None
    part_name: Optional[str] = None
    current_quantity: int = 0
    min_quantity: int = 0
    suggested_order_quantity: int = 0
    suggested_action: Optional[str] = None


class BackorderStatus(str, Enum):
    pending = "pending"
    ordered = "ordered"
    arrived = "arrived"
    cancelled = "cancelled"


class BackorderCreateRequest(BaseModel):
    part_id: Optional[str] = None
    part_name: str
    requested_quantity: int = Field(default=1, ge=1)
    customer_name: str
    customer_phone: Optional[str] = None
    vehicle_reference: Optional[str] = None
    note: Optional[str] = None
    expected_date: Optional[str] = None


class BackorderStatusUpdateRequest(BaseModel):
    status: BackorderStatus
    note: Optional[str] = None
    expected_date: Optional[str] = None


class BackorderRecord(BaseModel):
    id: str
    part_id: Optional[str] = None
    part_name: str
    requested_quantity: int
    customer_name: str
    customer_phone: Optional[str] = None
    vehicle_reference: Optional[str] = None
    status: BackorderStatus = BackorderStatus.pending
    note: Optional[str] = None
    expected_date: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
