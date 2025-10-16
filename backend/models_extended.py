from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta

# Existing models are above ... (file truncated in this view)

class UserAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    name: Optional[str] = None
    role: str = "user"  # admin, manager, technician, user
    permissions: List[str] = []
    active: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class OTPRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    code: str
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purpose: str = "login"  # login, register
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    expiresAt: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(minutes=5))
    attempts: int = 0
    consumed: bool = False

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
