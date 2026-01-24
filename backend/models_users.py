from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserPermissions(BaseModel):
    canViewDashboard: bool = True
    canManageVehicles: bool = True
    canManageCustomers: bool = True
    canManageParts: bool = False
    canManageServices: bool = False
    canViewReports: bool = True
    canManageFinance: bool = False
    canManageUsers: bool = False
    canAccessCEO: bool = False
    canManageSettings: bool = False


class User(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: str
    role: str = "employee"  # admin, manager, employee
    permissions: UserPermissions = UserPermissions()
    isActive: bool = True
    createdAt: datetime
    lastLogin: Optional[datetime] = None


class UserCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: str
    role: str = "employee"
    permissions: Optional[UserPermissions] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[UserPermissions] = None
    isActive: Optional[bool] = None
