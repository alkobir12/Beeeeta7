from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class JournalEntryLineCreate(BaseModel):
    account_id: uuid.UUID
    debit_amount: float = Field(0.0, ge=0)
    credit_amount: float = Field(0.0, ge=0)
    description: Optional[str] = None
    reference: Optional[str] = None

    class Config:
        from_attributes = True


class JournalEntryCreate(BaseModel):
    entry_date: Optional[datetime] = None
    description: str
    reference: Optional[str] = None
    lines: List[JournalEntryLineCreate]

    class Config:
        from_attributes = True


class JournalEntryPostRequest(BaseModel):
    user_id: uuid.UUID


class JournalEntryResponse(BaseModel):
    id: uuid.UUID
    entry_number: str
    entry_date: datetime
    description: str
    reference: Optional[str]
    status: str
    total_debit: float
    total_credit: float
    posted_at: Optional[datetime]
    workshop_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
