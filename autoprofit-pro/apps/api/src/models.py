from sqlalchemy import (
    Column, Integer, String, Float, DateTime, 
    Boolean, ForeignKey, Text, JSON, Enum
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

Base = declarative_base()

class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"

class TransactionType(str, enum.Enum):
    SALE = "sale"
    PURCHASE = "purchase"
    EXPENSE = "expense"
    SALARY = "salary"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"

class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CREDIT_CARD = "credit_card"
    BANK_TRANSFER = "bank_transfer"
    CREDIT = "credit"
    OTHER = "other"

class Workshop(Base):
    __tablename__ = "workshops"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    owner_name = Column(String(255), nullable=False)
    address = Column(Text)
    phone = Column(String(20))
    email = Column(String(255))
    tax_number = Column(String(50))
    currency = Column(String(3), default="SAR")
    language = Column(String(10), default="ar")
    timezone = Column(String(50), default="Asia/Riyadh")
    settings = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="workshop")
    accounts = relationship("Account", back_populates="workshop")
    transactions = relationship("Transaction", back_populates="workshop")
    customers = relationship("Customer", back_populates="workshop")
    inventory = relationship("Inventory", back_populates="workshop")
    employees = relationship("Employee", back_populates="workshop")

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255))
    phone = Column(String(20))
    role = Column(String(50), default="user")  # owner, manager, accountant, technician
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    hashed_password = Column(String(255), nullable=False)
    last_login = Column(DateTime)
    preferences = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop", back_populates="users")
    created_transactions = relationship("Transaction", back_populates="created_by_user")

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    account_code = Column(String(20), nullable=False)
    account_name = Column(String(255), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    parent_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    balance = Column(Float, default=0.0)
    currency = Column(String(3), default="SAR")
    is_active = Column(Boolean, default=True)
    description = Column(Text)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop", back_populates="accounts")
    parent = relationship("Account", remote_side=[id], backref="sub_accounts")
    debit_transactions = relationship("Transaction", foreign_keys="Transaction.debit_account_id", back_populates="debit_account")
    credit_transactions = relationship("Transaction", foreign_keys="Transaction.credit_account_id", back_populates="credit_account")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    transaction_number = Column(String(50), unique=True, nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    date = Column(DateTime, nullable=False, default=datetime.utcnow)
    amount = Column(Float, nullable=False)
    description = Column(Text)
    
    # Double-entry accounting
    debit_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    credit_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    
    # Linked entities
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory.id"), nullable=True)
    
    # Payment info
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    reference_number = Column(String(100))
    status = Column(String(50), default="completed")  # pending, completed, cancelled
    
    # Metadata
    metadata = Column(JSON, default=dict)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop", back_populates="transactions")
    debit_account = relationship("Account", foreign_keys=[debit_account_id], back_populates="debit_transactions")
    credit_account = relationship("Account", foreign_keys=[credit_account_id], back_populates="credit_transactions")
    customer = relationship("Customer", back_populates="transactions")
    employee = relationship("Employee", back_populates="transactions")
    inventory_item = relationship("Inventory", back_populates="transactions")
    created_by_user = relationship("User", foreign_keys=[created_by], back_populates="created_transactions")
    verified_by_user = relationship("User", foreign_keys=[verified_by])

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    customer_code = Column(String(20), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(255))
    address = Column(Text)
    tax_number = Column(String(50))
    
    # Financial info
    credit_limit = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    total_spent = Column(Float, default=0.0)
    
    # Customer metrics
    first_purchase_date = Column(DateTime)
    last_purchase_date = Column(DateTime)
    purchase_count = Column(Integer, default=0)
    average_purchase_value = Column(Float, default=0.0)
    
    # Segmentation
    customer_segment = Column(String(50))  # vip, regular, new, at_risk
    lifetime_value = Column(Float, default=0.0)
    
    # Preferences
    preferred_payment_method = Column(String(50))
    notes = Column(Text)
    metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop", back_populates="customers")
    vehicles = relationship("Vehicle", back_populates="customer")
    transactions = relationship("Transaction", back_populates="customer")

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    plate_number = Column(String(20), nullable=False)
    vin = Column(String(50))
    brand = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    color = Column(String(50))
    engine_size = Column(String(50))
    
    # Service history
    last_service_date = Column(DateTime)
    next_service_date = Column(DateTime)
    last_service_mileage = Column(Integer)
    next_service_mileage = Column(Integer)
    service_count = Column(Integer, default=0)
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    customer = relationship("Customer", back_populates="vehicles")

class Inventory(Base):
    __tablename__ = "inventory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    sku = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    brand = Column(String(100))
    
    # Stock management
    current_stock = Column(Integer, default=0)
    minimum_stock = Column(Integer, default=5)
    maximum_stock = Column(Integer, default=100)
    reorder_point = Column(Integer)
    
    # Pricing
    cost_price = Column(Float, nullable=False)
    selling_price = Column(Float, nullable=False)
    wholesale_price = Column(Float)
    
    # Supplier info
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    supplier_code = Column(String(50))
    
    # Metrics
    total_purchased = Column(Integer, default=0)
    total_sold = Column(Integer, default=0)
    last_purchase_date = Column(DateTime)
    last_sale_date = Column(DateTime)
    
    # AI predictions
    predicted_demand = Column(Integer)
    safety_stock_level = Column(Integer)
    reorder_quantity = Column(Integer)
    
    metadata = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop", back_populates="inventory")
    supplier = relationship("Supplier", back_populates="inventory_items")
    transactions = relationship("Transaction", back_populates="inventory_item")

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    employee_code = Column(String(20), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    position = Column(String(100))
    department = Column(String(100))
    
    # Employment details
    hire_date = Column(DateTime)
    employment_type = Column(String(50))  # full_time, part_time, contract
    base_salary = Column(Float)
    commission_rate = Column(Float, default=0.0)
    
    # Bank details
    bank_name = Column(String(100))
    bank_account_number = Column(String(50))
    iban = Column(String(50))
    
    # Performance metrics
    total_services_completed = Column(Integer, default=0)
    average_service_rating = Column(Float, default=0.0)
    revenue_generated = Column(Float, default=0.0)
    
    metadata = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop", back_populates="employees")
    transactions = relationship("Transaction", back_populates="employee")
    payroll_records = relationship("Payroll", back_populates="employee")

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    supplier_code = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    contact_person = Column(String(255))
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(Text)
    
    # Financial info
    credit_limit = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    payment_terms = Column(String(50))  # net_30, net_60
    
    # Performance metrics
    total_purchases = Column(Float, default=0.0)
    average_delivery_time = Column(Integer)  # in days
    reliability_score = Column(Float)
    
    metadata = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    inventory_items = relationship("Inventory", back_populates="supplier")

class Payroll(Base):
    __tablename__ = "payroll"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    payroll_period = Column(String(50), nullable=False)  # 2024-03, 2024-Q1
    payroll_date = Column(DateTime, nullable=False)
    
    # Earnings
    base_salary = Column(Float, default=0.0)
    overtime_hours = Column(Float, default=0.0)
    overtime_rate = Column(Float, default=0.0)
    overtime_amount = Column(Float, default=0.0)
    commission_amount = Column(Float, default=0.0)
    bonuses = Column(Float, default=0.0)
    allowances = Column(Float, default=0.0)
    total_earnings = Column(Float, default=0.0)
    
    # Deductions
    tax_deductions = Column(Float, default=0.0)
    social_security = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    
    # Net pay
    net_pay = Column(Float, default=0.0)
    
    # Payment info
    payment_method = Column(String(50))
    payment_date = Column(DateTime)
    payment_reference = Column(String(100))
    
    # Status
    status = Column(String(50), default="pending")  # pending, processed, paid
    processed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    processed_at = Column(DateTime)
    
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    employee = relationship("Employee", back_populates="payroll_records")

class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    recommendation_id = Column(String(50), nullable=False)
    
    # Content
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50))  # pricing, inventory, customer, operation
    priority = Column(String(20))  # high, medium, low
    
    # Values
    current_value = Column(Float)
    recommended_value = Column(Float)
    expected_impact = Column(String(255))
    confidence_score = Column(Float)
    
    # Status
    status = Column(String(50), default="pending")  # pending, in_progress, implemented, rejected
    implemented_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    implemented_at = Column(DateTime, nullable=True)
    implementation_notes = Column(Text)
    
    # Metadata
    ai_model_version = Column(String(50))
    generated_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"))
    
    # Action details
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    
    # Changes
    old_values = Column(JSON)
    new_values = Column(JSON)
    
    # Context
    ip_address = Column(String(50))
    user_agent = Column(Text)
    endpoint = Column(String(255))
    request_method = Column(String(10))
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    workshop = relationship("Workshop")
    user = relationship("User")
