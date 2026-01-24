from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MaintenanceOrder(BaseModel):
    id: str
    vehicleId: str
    customerId: str
    technicianId: str
    services: list
    technicianStatus: str = "pending"  # pending, completed
    managerApproval: str = "pending"  # pending, approved, rejected
    clientApproval: str = "pending"  # pending, approved, rejected
    completionDate: Optional[datetime] = None
    approvalNotes: str = ""
    workDetails: str = ""
    estimatedCost: float = 0.0
    actualCost: float = 0.0
    createdAt: datetime
    updatedAt: datetime


class MaintenanceOrderCreate(BaseModel):
    vehicleId: str
    customerId: str
    technicianId: str
    services: list
    estimatedCost: float = 0.0


class MaintenanceOrderUpdate(BaseModel):
    technicianStatus: Optional[str] = None
    managerApproval: Optional[str] = None
    clientApproval: Optional[str] = None
    workDetails: Optional[str] = None
    actualCost: Optional[float] = None
    approvalNotes: Optional[str] = None
