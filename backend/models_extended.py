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
    expiresAt: datetime = Field(
        default_factory=lambda: datetime.utcnow() + timedelta(minutes=5)
    )
    attempts: int = 0
    consumed: bool = False

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# Business Models
class BusinessAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str
    description: Optional[str] = None
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class Budget(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    accountId: str
    period: str  # YYYY-MM format
    allocations: List[dict] = []
    incomeTarget: float = 0.0
    expenseTarget: float = 0.0
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class OperationItem(BaseModel):
    itemId: Optional[str] = None
    itemType: str = "part"  # part, service
    name: str
    quantity: float
    price: float


class Operation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    accountId: str
    type: str  # purchase, sale
    partnerType: str = "supplier"
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
    paymentMethod: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)


class WorkshopProfile(BaseModel):
    id: str = "workshop_profile"
    name: str = "ورشتي"
    phone: str = ""
    whatsapp: str = ""
    address: str = ""
    city: str = ""
    email: Optional[str] = None
    taxNumber: Optional[str] = None
    logoUrl: Optional[str] = None
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class TemplateDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str = "invoice"
    language: str = "ar"
    html: str = ""
    isActive: bool = True
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class DiagnosisReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str
    vehicleId: Optional[str] = None
    customerId: Optional[str] = None
    title: str
    summary: str = ""
    items: List[dict] = []
    subtotal: float = 0.0
    total: float = 0.0
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class ApprovalRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str
    vehicleId: Optional[str] = None
    customerId: Optional[str] = None
    title: str
    amount: float = 0.0
    status: str = "pending"
    expiresAt: datetime = Field(
        default_factory=lambda: datetime.utcnow() + timedelta(days=7)
    )
    respondedAt: Optional[datetime] = None
    responderName: Optional[str] = None
    responderPhone: Optional[str] = None
    notes: Optional[str] = None
    revoked: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class AppSettings(BaseModel):
    id: str = "app_settings"
    currency: str = "SAR"
    taxRate: float = 0.0
    language: str = "ar"
    timezone: str = "Asia/Riyadh"
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


# Document Management Models
class DocumentRef(BaseModel):
    docType: str
    docId: str


class DocumentDependency(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fromDoc: DocumentRef
    toDoc: DocumentRef
    relation: str  # derived_from, fulfills, etc.
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class DocumentActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    docType: str
    docId: str
    action: str
    meta: Optional[dict] = None
    date: datetime = Field(default_factory=datetime.utcnow)


class QuoteItem(BaseModel):
    name: str
    quantity: float
    price: float


class BillItem(BaseModel):
    name: str
    quantity: float
    price: float


class DiagnosisCase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    customerId: str
    status: str = "draft"
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class PricingQuote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: str
    customerId: str
    diagnosisCaseId: Optional[str] = None
    items: List[QuoteItem] = []
    subtotal: float = 0.0
    discount: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    status: str = "draft"
    validityDate: Optional[str] = None
    reference: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class SalesOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicleId: Optional[str] = None
    customerId: Optional[str] = None
    quoteId: Optional[str] = None
    items: List[QuoteItem] = []
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    status: str = "draft"
    notes: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)


class VendorBill(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplierId: str
    purchaseOrderId: Optional[str] = None
    items: List[BillItem] = []
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    currency: str = "SAR"
    dueDate: Optional[str] = None
    status: str = "draft"
    reference: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)


class PurchaseOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplierId: str
    orderTotal: float = 0.0
    status: str = "pending"
    items: List[dict] = []
    orderDate: datetime = Field(default_factory=datetime.utcnow)
