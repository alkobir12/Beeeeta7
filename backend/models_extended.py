from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
import uuid

# ============ Appointment Models (نظام المواعيد) ============
class AppointmentBase(BaseModel):
    customerId: str
    customerName: str
    customerPhone: str
    vehiclePlateNumber: str
    appointmentDate: datetime
    serviceType: str
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending, confirmed, completed, cancelled
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    reminderSent: bool = False
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Employee Models (إدارة الموظفين) ============
class EmployeeBase(BaseModel):
    name: str
    phone: str
    nationalId: Optional[str] = None
    role: str  # technician, manager, accountant
    salary: float
    joinDate: date
    
class EmployeeCreate(EmployeeBase):
    pass

class Employee(EmployeeBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    isActive: bool = True
    totalAdvances: float = 0  # إجمالي السلف
    totalBonus: float = 0  # إجمالي الحوافز
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

# ============ Salary Payment Models ============
class SalaryPayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employeeId: str
    employeeName: str
    month: str  # YYYY-MM
    basicSalary: float
    bonus: float = 0
    deductions: float = 0
    advances: float = 0
    totalPaid: float
    paymentDate: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Advance Payment Models (السلف) ============
class AdvancePayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employeeId: str
    employeeName: str
    amount: float
    reason: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)
    deductedFromSalary: bool = False
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Loyalty Program Models (نظام الولاء) ============
class LoyaltyPoints(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    points: int = 0
    totalEarned: int = 0
    totalRedeemed: int = 0
    tier: str = "bronze"  # bronze, silver, gold, platinum
    
class PointsTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    points: int
    type: str  # earned, redeemed
    reason: str
    invoiceId: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Coupon Models (الكوبونات) ============
class Coupon(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discountType: str  # percentage, fixed
    discountValue: float
    minPurchase: float = 0
    maxDiscount: Optional[float] = None
    validFrom: datetime
    validUntil: datetime
    usageLimit: int = 1
    usedCount: int = 0
    isActive: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Maintenance Reminder Models (تذكيرات الصيانة) ============
class MaintenanceReminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    vehicleId: str
    vehiclePlateNumber: str
    lastMaintenanceDate: datetime
    nextMaintenanceDate: datetime
    maintenanceType: str  # oil_change, tire_rotation, general_checkup
    reminderSent: bool = False
    completed: bool = False
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Warranty Models (الضمانات) ============
class Warranty(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    invoiceId: str
    itemType: str  # part, service
    itemName: str
    warrantyPeriodDays: int
    startDate: datetime = Field(default_factory=datetime.utcnow)
    endDate: datetime
    isActive: bool = True
    claimCount: int = 0
    notes: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class WarrantyClaim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    warrantyId: str
    claimDate: datetime = Field(default_factory=datetime.utcnow)
    issue: str
    status: str  # pending, approved, rejected, completed
    resolution: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Supplier Models (إدارة الموردين) ============
class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contactPerson: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    taxNumber: Optional[str] = None
    category: str  # parts, tools, services
    rating: float = 5.0
    totalPurchases: float = 0
    isActive: bool = True

class PurchaseOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orderNumber: str
    supplierId: str
    supplierName: str
    items: List[dict]  # [{partId, name, quantity, price}]
    subtotal: float
    tax: float
    total: float
    status: str  # pending, received, cancelled
    orderDate: datetime = Field(default_factory=datetime.utcnow)
    receivedDate: Optional[datetime] = None
    notes: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Workshop Profile Models (بروفايل الورشة) ============
class WorkshopProfile(BaseModel):
    id: str = "workshop_profile"  # Single document
    name: str
    nameEnglish: Optional[str] = None
    logo: Optional[str] = None
    phone: str
    whatsapp: str
    email: Optional[str] = None
    address: str
    city: str
    postalCode: Optional[str] = None
    taxNumber: Optional[str] = None
    commercialRegister: Optional[str] = None
    bankAccount: Optional[str] = None
    iban: Optional[str] = None
    workingHours: Optional[str] = None
    services: List[str] = []
    socialMedia: Optional[dict] = None  # {facebook, twitter, instagram}
    invoiceFooter: Optional[str] = None
    termsAndConditions: Optional[str] = None
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Templates & Reports & Approvals & Finance =========
class TemplateDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # diagnosis, quotation, service_invoice
    language: str = "ar"  # ar, en, ar_en
    name: str
    html: str
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class DiagnosisReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str  # public token to view
    vehicleId: str
    customerId: str
    title: str
    summary: str
    items: List[dict] = []  # [{name, qty, price, total}]
    subtotal: float
    total: float
    status: str = "draft"  # draft, sent, approved, rejected
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class ApprovalRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str
    vehicleId: str
    customerId: str
    title: str
    amount: float
    status: str = "pending"  # pending, approved, rejected

# AppSettings class removed

class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    type: str  # asset, liability, equity, income, expense
    openingBalance: float = 0
    isActive: bool = True

class Budget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    period: str  # YYYY-MM
    allocations: List[dict]  # [{accountCode, amount}]
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}