from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any
from sqlalchemy.orm import Session

from ....core.database import SessionLocal
from ....models import Workshop


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class WorkingHours(BaseModel):
    open: str
    close: str


class WorkshopInfo(BaseModel):
    name: str
    address: str
    currency: str = Field(default="SAR")
    phone: str
    email: str
    tax_rate: float
    working_hours: Dict[str, WorkingHours]


class InitialDataConfig(BaseModel):
    add_sample_customers: bool = True
    add_sample_services: bool = True
    add_sample_inventory: bool = True
    generate_test_transactions: int = 0


class WorkshopSetupRequest(BaseModel):
    workshop: WorkshopInfo
    initial_data: InitialDataConfig


@router.post("/workshop/initialize")
def initialize_workshop(payload: WorkshopSetupRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Initialize a workshop with optional sample data.

    This is a bootstrap endpoint meant to be called once after deployment
    using a JSON file like `workshop_setup.json`.
    """
    existing = (
        db.query(Workshop)
        .filter(Workshop.name == payload.workshop.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Workshop already initialized")

    ws = Workshop(
        name=payload.workshop.name,
        owner_name="Admin",
        address=payload.workshop.address,
        currency=payload.workshop.currency,
        phone=payload.workshop.phone,
        email=payload.workshop.email,
        settings={
            "tax_rate": payload.workshop.tax_rate,
            "working_hours": {
                day: wh.model_dump()
                for day, wh in payload.workshop.working_hours.items()
            },
        },
    )

    db.add(ws)
    db.commit()
    db.refresh(ws)

    # NOTE: here we just acknowledge the initial_data flags;
    # actual seeding of customers/services/inventory can be implemented later.
    return {
        "status": "success",
        "workshop_id": str(ws.id),
        "initial_data": payload.initial_data.model_dump(),
    }
