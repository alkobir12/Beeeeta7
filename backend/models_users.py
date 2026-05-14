from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

PermissionsMap = Dict[str, Dict[str, bool]]


class User(BaseModel):
    id: str
    name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: str
    role: str = "employee"  # admin, manager, employee
    permissions: PermissionsMap = Field(default_factory=dict)
    isActive: bool = True
    guidanceEnabled: bool = True
    createdAt: datetime
    lastLogin: Optional[datetime] = None


class UserCreate(BaseModel):
    name: str
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    phone: str
    role: str = "employee"
    permissions: Optional[PermissionsMap] = None
    guidanceEnabled: Optional[bool] = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[PermissionsMap] = None
    isActive: Optional[bool] = None
    guidanceEnabled: Optional[bool] = None
