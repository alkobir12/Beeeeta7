from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid


# ============ Store/Shop Models (المتجر المصغر) ============
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str  # accessories, tools, fluids, care_products
    price: float
    costPrice: float
    stock: int
    images: List[str] = []
    specifications: Optional[dict] = None
    featured: bool = False
    discount: float = 0  # Percentage
    soldCount: int = 0
    rating: float = 5.0
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ShopOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orderNumber: str
    customerId: str
    customerName: str
    customerPhone: str
    items: List[dict]  # [{productId, name, quantity, price}]
    subtotal: float
    discount: float = 0
    tax: float
    deliveryFee: float = 0
    total: float
    status: str = (
        "pending"  # pending, confirmed, preparing, ready, delivered, cancelled
    )
    paymentMethod: str  # cash, card, online
    paymentStatus: str = "pending"  # pending, paid, refunded
    deliveryType: str  # pickup, delivery
    deliveryAddress: Optional[str] = None
    orderDate: datetime = Field(default_factory=datetime.utcnow)
    deliveryDate: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ============ AI Bots Models (بوتات AI متخصصة) ============
class AIBot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    nameArabic: str
    specialty: str  # diagnostics, parts_advisor, service_advisor, sales
    description: str
    icon: str
    systemPrompt: str
    isActive: bool = True
    usageCount: int = 0
    rating: float = 5.0


class BotConversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    botId: str
    userId: Optional[str] = None  # customer or employee
    sessionId: str
    messages: List[dict] = []
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    lastActivity: datetime = Field(default_factory=datetime.utcnow)
    rating: Optional[int] = None
    feedback: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ============ CEO Dashboard Models (لوحة المدير التنفيذي) ============
class CEOAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # financial, operational, customer, employee
    severity: str  # low, medium, high, critical
    title: str
    message: str
    action: Optional[str] = None
    resolved: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class BusinessMetrics(BaseModel):
    date: str
    revenue: float
    expenses: float
    profit: float
    vehiclesServiced: int
    newCustomers: int
    customerSatisfaction: float
    employeeProductivity: float
    inventoryValue: float
    cashFlow: float


# ============ Workshop Services Models (خدمات الورشة) ============
class WorkshopService(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    nameEnglish: Optional[str] = None
    category: str  # maintenance, repair, inspection, custom
    description: str
    price: float
    estimatedDuration: int  # minutes
    requiredParts: List[str] = []
    requiredTools: List[str] = []
    skillLevel: str  # basic, intermediate, advanced, expert
    isActive: bool = True
    featured: bool = False
    image: Optional[str] = None
    disclaimer: Optional[str] = None


class ServicePackage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    services: List[str]  # Service IDs
    originalPrice: float
    packagePrice: float
    discount: float
    isActive: bool = True
    featured: bool = False


# ============ Customer Service & Complaints (خدمة العملاء والشكاوى) ============
class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticketNumber: str
    customerId: str
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    type: str  # complaint, inquiry, suggestion, feedback
    category: str  # service_quality, pricing, waiting_time, staff_behavior, other
    priority: str = "medium"  # low, medium, high, urgent
    subject: str
    description: str
    vehicleId: Optional[str] = None
    invoiceId: Optional[str] = None
    status: str = "open"  # open, in_progress, resolved, closed
    assignedTo: Optional[str] = None  # Employee ID
    attachments: List[str] = []
    internalNotes: Optional[str] = None
    resolution: Optional[str] = None
    satisfactionRating: Optional[int] = None  # 1-5
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    resolvedAt: Optional[datetime] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class TicketResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticketId: str
    responderId: str
    responderName: str
    responderType: str  # employee, system, customer
    message: str
    attachments: List[str] = []
    isInternal: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class CustomerFeedback(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customerId: str
    vehicleId: Optional[str] = None
    invoiceId: Optional[str] = None
    overallRating: int  # 1-5
    serviceQuality: int
    staffBehavior: int
    pricing: int
    cleanliness: int
    waitingTime: int
    comments: Optional[str] = None
    wouldRecommend: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ============ FAQ Models ============
class FAQ(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    category: str
    order: int = 0
    isActive: bool = True
    viewCount: int = 0
