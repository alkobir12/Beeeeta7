"""
النماذج المالية المتقدمة
Advanced Financial Models
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

# ============ Account Models (دليل الحسابات) ============
class AccountBase(BaseModel):
    code: str  # رمز الحساب مثل 1001
    name: str  # اسم الحساب
    type: str  # asset, liability, revenue, expense, equity
    parentAccount: Optional[str] = None  # الحساب الأب

class Account(AccountBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    balance: float = 0  # الرصيد الحالي
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Journal Entry (القيد المحاسبي) ============
class JournalEntryLine(BaseModel):
    accountId: str
    accountName: str
    accountCode: str
    debit: float = 0  # مدين
    credit: float = 0  # دائن
    description: Optional[str] = None

class JournalEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime = Field(default_factory=datetime.utcnow)
    description: str
    referenceType: str  # sale, purchase, expense, collection, payment
    referenceId: Optional[str] = None  # ID العملية المرتبطة
    lines: List[JournalEntryLine] = []  # سطور القيد
    totalDebit: float = 0
    totalCredit: float = 0
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    createdBy: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Financial Analytics ============
class FinancialRatios(BaseModel):
    currentRatio: Optional[float] = 0  # نسبة التداول
    quickRatio: Optional[float] = 0  # النسبة السريعة
    grossMargin: Optional[float] = 0  # هامش الربح الإجمالي
    netMargin: Optional[float] = 0  # هامش الربح الصافي
    inventoryTurnover: Optional[float] = 0  # معدل دوران المخزون
    debtRatio: Optional[float] = 0  # نسبة الدين

class AnalyticsReport(BaseModel):
    dateRange: str
    totalRevenue: float = 0
    totalExpenses: float = 0
    netProfit: float = 0
    cashBalance: float = 0
    customerReceivables: float = 0  # المستحقات من العملاء
    supplierPayables: float = 0  # المستحقات للموردين
    inventoryValue: float = 0
    topServices: List[dict] = []
    topParts: List[dict] = []
    financialRatios: Optional[FinancialRatios] = None

# ============ AI Recommendation ============
class AIRecommendation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # pricing, inventory, customer, service
    title: str
    description: str
    priority: str  # high, medium, low
    currentValue: Optional[float] = None
    recommendedValue: Optional[float] = None
    expectedImpact: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"  # pending, accepted, rejected
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ Enhanced Operation Model ============
class OperationItem(BaseModel):
    itemType: str  # "part" or "service"
    itemId: Optional[str] = None
    itemName: str
    quantity: float
    unitPrice: float
    total: float

class LinkedAccount(BaseModel):
    accountId: str
    accountName: str
    accountCode: Optional[str] = None
    debit: float = 0
    credit: float = 0

class EnhancedOperation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime = Field(default_factory=datetime.utcnow)
    type: str  # sale, purchase, expense, collection, payment
    description: str
    customerId: Optional[str] = None
    vehicleId: Optional[str] = None
    supplierId: Optional[str] = None
    items: List[OperationItem] = []
    subtotal: float
    discount: float = 0
    tax: float = 0
    total: float
    paymentMethod: str  # cash, credit, bank_transfer, card
    paymentStatus: str = "paid"  # paid, unpaid, pending
    linkedAccounts: List[LinkedAccount] = []  # القيود المحاسبية
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    createdBy: Optional[str] = None
    notes: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
