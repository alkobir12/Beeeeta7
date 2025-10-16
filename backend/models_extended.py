from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
import uuid

# ... existing content remains above (omitted for brevity) ...

class CustomerReceipt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    accountId: Optional[str] = None
    amount: float
    paymentMethod: str = "cash"  # cash, card, credit
    reference: Optional[str] = None
    notes: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
