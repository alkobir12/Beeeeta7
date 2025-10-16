from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta

import uuid

# Employee Models
class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    salary: float = 0
    hireDate: datetime = Field(default_factory=datetime.utcnow)
    isActive: bool = True

class EmployeeCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    salary: float = 0

class SalaryPayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employeeId: str
    amount: float
    paymentDate: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

class AdvancePayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employeeId: str
    amount: float
    paymentDate: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

# Loyalty and Points Models
class LoyaltyPoints(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    points: int = 0
    totalEarned: int = 0
    totalRedeemed: int = 0

class PointsTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    transactionType: str  # "earned", "redeemed"
    points: int
    description: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)

class Coupon(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discountPercentage: float
    discountAmount: Optional[float] = None
    expirationDate: Optional[datetime] = None
    isActive: bool = True
    usageLimit: Optional[int] = None
    usedCount: int = 0

# Maintenance and Warranty Models
class MaintenanceReminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    customerId: str
    reminderType: str  # "oil_change", "inspection", "service"
    reminderDate: datetime
    description: Optional[str] = None
    isCompleted: bool = False

class Warranty(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    partName: str
    warrantyPeriod: int  # in months
    startDate: datetime = Field(default_factory=datetime.utcnow)
    endDate: datetime
    warrantyType: str = "parts"

class WarrantyClaim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    warrantyId: str
    claimDate: datetime = Field(default_factory=datetime.utcnow)
    claimStatus: str = "pending"  # pending, approved, rejected
    description: Optional[str] = None

# Supplier and Purchase Order Models
class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contactInfo: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    isActive: bool = True

class PurchaseOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplierId: str
    orderDate: datetime = Field(default_factory=datetime.utcnow)
    orderTotal: float
    status: str = "pending"  # pending, completed, cancelled
    items: List[dict] = []

# Workshop Profile Model
class WorkshopProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    services: List[str] = []
    workingHours: Optional[str] = None

# Template and Diagnosis Report Models
class TemplateDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # "invoice", "diagnosis", "report"
    content: Optional[str] = None
    html: Optional[str] = None
    isActive: bool = True

class DiagnosisReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    customerId: str
    diagnosis: str
    treatment: Optional[str] = None
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    createdAt: datetime = Field(default_factory=datetime.utcnow)

# Approval Request Model
class ApprovalRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    customerId: str
    title: str
    amount: float
    status: str = "pending"  # pending, approved, rejected, deferred, requote
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    expiresAt: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=7))
    revoked: bool = False
    respondedAt: Optional[datetime] = None
    responderName: Optional[str] = None
    responderPhone: Optional[str] = None
    notes: Optional[str] = None

# App Settings Model
class AppSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    currency: str = "SAR"
    taxEnabled: bool = False
    taxRate: float = 0.15
    workshopName: Optional[str] = None

# Account and Budget Models
class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    accountType: str
    balance: float = 0
    currency: str = "SAR"

class Budget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    accountId: str
    period: str  # YYYY-MM format
    incomeTarget: float
    expenseTarget: float
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

# Business Account Model
class BusinessAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str
    currency: str = "SAR"
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

# Operation and Operation Item Models
class OperationItem(BaseModel):
    itemType: str  # "part", "service"
    itemId: Optional[str] = None
    name: str
    quantity: int
    price: float
    total: float

class Operation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    accountId: str
    type: str  # "purchase", "sale"
    partnerType: Optional[str] = None
    partnerName: Optional[str] = None
    partnerId: Optional[str] = None
    items: List[OperationItem] = []
    subtotal: float = 0.0
    total: float = 0.0
    paymentMethod: str = "cash"
    notes: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)

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
