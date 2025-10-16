from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import List, Optional
import uuid

from models_extended import (
    Appointment, AppointmentCreate,
    Employee, EmployeeCreate, SalaryPayment, AdvancePayment,
    LoyaltyPoints, PointsTransaction, Coupon,
    MaintenanceReminder, Warranty, WarrantyClaim,
    Supplier, PurchaseOrder, WorkshopProfile,
    TemplateDoc, DiagnosisReport, ApprovalRequest, AppSettings,
    Account, Budget
)

# Router
router = APIRouter(prefix="/api")

# Database will be injected from server.py
db = None

def set_db(database):
    global db
    db = database

# ============ Appointments APIs ============
@router.post("/appointments", response_model=Appointment)
async def create_appointment(appointment: AppointmentCreate):
    appt = Appointment(**appointment.dict())
    await db.appointments.insert_one(appt.dict())
    return appt

@router.get("/appointments", response_model=List[Appointment])
async def get_appointments(status: Optional[str] = None, date: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if date:
        start = datetime.fromisoformat(date)
        end = start + timedelta(days=1)
        query["appointmentDate"] = {"$gte": start, "$lt": end}
    
    appointments = await db.appointments.find(query).sort("appointmentDate", 1).to_list(1000)
    return [Appointment(**a) for a in appointments]

@router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, status: str):
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": status}}
    )
    return {"message": "updated"}

# ============ Employees APIs ============
@router.post("/employees", response_model=Employee)
async def create_employee(employee: EmployeeCreate):
    emp = Employee(**employee.dict())
    await db.employees.insert_one(emp.dict())
    return emp

@router.get("/employees", response_model=List[Employee])
async def get_employees(active_only: bool = True):
    query = {"isActive": True} if active_only else {}
    employees = await db.employees.find(query).to_list(1000)
    return [Employee(**e) for e in employees]

@router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    emp = await db.employees.find_one({"id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return Employee(**emp)

@router.post("/employees/{employee_id}/advance")
async def add_advance_payment(employee_id: str, amount: float, reason: str = ""):
    emp = await db.employees.find_one({"id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    advance = AdvancePayment(
        employeeId=employee_id,
        employeeName=emp['name'],
        amount=amount,
        reason=reason
    )
    await db.advances.insert_one(advance.dict())
    await db.employees.update_one(
        {"id": employee_id},
        {"$inc": {"totalAdvances": amount}}
    )
    return advance

@router.post("/salaries", response_model=SalaryPayment)
async def pay_salary(payment: SalaryPayment):
    await db.salary_payments.insert_one(payment.dict())
    
    # Mark advances as deducted
    if payment.advances > 0:
        await db.advances.update_many(
            {"employeeId": payment.employeeId, "deductedFromSalary": False},
            {"$set": {"deductedFromSalary": True}}
        )
    
    return payment

@router.get("/salaries")
async def get_salaries(month: Optional[str] = None, employee_id: Optional[str] = None):
    query = {}
    if month:
        query["month"] = month
    if employee_id:
        query["employeeId"] = employee_id
    
    salaries = await db.salary_payments.find(query).sort("paymentDate", -1).to_list(1000)
    return [SalaryPayment(**s) for s in salaries]

# ============ Loyalty Program APIs ============
@router.get("/loyalty/{customer_id}", response_model=LoyaltyPoints)
async def get_loyalty_points(customer_id: str):
    points = await db.loyalty_points.find_one({"customerId": customer_id})
    if not points:
        # Create new loyalty account
        new_points = LoyaltyPoints(customerId=customer_id)
        await db.loyalty_points.insert_one(new_points.dict())
        return new_points
    return LoyaltyPoints(**points)

@router.post("/loyalty/{customer_id}/add")
async def add_loyalty_points(customer_id: str, points: int, reason: str, invoice_id: str = None):
    transaction = PointsTransaction(
        customerId=customer_id,
        points=points,
        type="earned",
        reason=reason,
        invoiceId=invoice_id
    )
    await db.loyalty_transactions.insert_one(transaction.dict())
    
    # Update customer points
    result = await db.loyalty_points.update_one(
        {"customerId": customer_id},
        {"$inc": {"points": points, "totalEarned": points}}
    )
    
    if result.matched_count == 0:
        new_loyalty = LoyaltyPoints(customerId=customer_id, points=points, totalEarned=points)
        await db.loyalty_points.insert_one(new_loyalty.dict())
    
    # Update tier
    loyalty = await db.loyalty_points.find_one({"customerId": customer_id})
    tier = "bronze"
    if loyalty['totalEarned'] >= 1000:
        tier = "platinum"
    elif loyalty['totalEarned'] >= 500:
        tier = "gold"
    elif loyalty['totalEarned'] >= 200:
        tier = "silver"
    
    await db.loyalty_points.update_one(
        {"customerId": customer_id},
        {"$set": {"tier": tier}}
    )
    
    return {"message": "Points added", "newBalance": loyalty['points'] + points}

@router.post("/loyalty/{customer_id}/redeem")
async def redeem_loyalty_points(customer_id: str, points: int, reason: str):
    loyalty = await db.loyalty_points.find_one({"customerId": customer_id})
    if not loyalty or loyalty['points'] < points:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    transaction = PointsTransaction(
        customerId=customer_id,
        points=points,
        type="redeemed",
        reason=reason
    )
    await db.loyalty_transactions.insert_one(transaction.dict())
    
    await db.loyalty_points.update_one(
        {"customerId": customer_id},
        {"$inc": {"points": -points, "totalRedeemed": points}}
    )
    
    return {"message": "Points redeemed", "newBalance": loyalty['points'] - points}

# ============ Coupons APIs ============
@router.post("/coupons", response_model=Coupon)
async def create_coupon(coupon: Coupon):
    await db.coupons.insert_one(coupon.dict())
    return coupon

@router.get("/coupons", response_model=List[Coupon])
async def get_coupons():
    coupons = await db.coupons.find({"isActive": True}).to_list(1000)
    return [Coupon(**c) for c in coupons]

@router.post("/coupons/validate")
async def validate_coupon(code: str, purchase_amount: float):
    coupon = await db.coupons.find_one({"code": code, "isActive": True})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon")
    
    coupon_obj = Coupon(**coupon)
    now = datetime.utcnow()
    
    if now < coupon_obj.validFrom or now > coupon_obj.validUntil:
        raise HTTPException(status_code=400, detail="Coupon expired")
    
    if coupon_obj.usedCount >= coupon_obj.usageLimit:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    
    if purchase_amount < coupon_obj.minPurchase:
        raise HTTPException(status_code=400, detail=f"Minimum purchase is {coupon_obj.minPurchase}")
    
    discount = 0
    if coupon_obj.discountType == "percentage":
        discount = purchase_amount * (coupon_obj.discountValue / 100)
        if coupon_obj.maxDiscount:
            discount = min(discount, coupon_obj.maxDiscount)
    else:
        discount = coupon_obj.discountValue
    
    return {"valid": True, "discount": discount, "finalAmount": purchase_amount - discount}

# ============ Maintenance Reminders APIs ============
@router.post("/reminders", response_model=MaintenanceReminder)
async def create_reminder(reminder: MaintenanceReminder):
    await db.maintenance_reminders.insert_one(reminder.dict())
    return reminder

@router.get("/reminders/due")
async def get_due_reminders():
    today = datetime.utcnow()
    week_from_now = today + timedelta(days=7)
    
    reminders = await db.maintenance_reminders.find({
        "nextMaintenanceDate": {"$lte": week_from_now},
        "completed": False
    }).to_list(1000)
    
    return [MaintenanceReminder(**r) for r in reminders]

# ============ Warranty APIs ============
@router.post("/warranties", response_model=Warranty)
async def create_warranty(warranty: Warranty):
    await db.warranties.insert_one(warranty.dict())
    return warranty

@router.get("/warranties/vehicle/{vehicle_id}")
async def get_vehicle_warranties(vehicle_id: str):
    warranties = await db.warranties.find({"vehicleId": vehicle_id, "isActive": True}).to_list(1000)
    return [Warranty(**w) for w in warranties]

@router.post("/warranties/{warranty_id}/claim")
async def create_warranty_claim(warranty_id: str, issue: str):
    warranty = await db.warranties.find_one({"id": warranty_id})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    claim = WarrantyClaim(
        warrantyId=warranty_id,
        issue=issue,
        status="pending"
    )
    await db.warranty_claims.insert_one(claim.dict())
    await db.warranties.update_one(
        {"id": warranty_id},
        {"$inc": {"claimCount": 1}}
    )
    
    return claim

# ============ Suppliers APIs ============
@router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier: Supplier):
    await db.suppliers.insert_one(supplier.dict())
    return supplier

@router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers():
    suppliers = await db.suppliers.find({"isActive": True}).to_list(1000)
    return [Supplier(**s) for s in suppliers]

@router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_purchase_order(order: PurchaseOrder):
    await db.purchase_orders.insert_one(order.dict())
    
    # Update supplier total purchases
    await db.suppliers.update_one(
        {"id": order.supplierId},
        {"$inc": {"totalPurchases": order.total}}
    )
    
    return order

@router.get("/purchase-orders")
async def get_purchase_orders(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.purchase_orders.find(query).sort("orderDate", -1).to_list(1000)
    return [PurchaseOrder(**o) for o in orders]

# ============ Workshop Profile APIs ============
@router.get("/profile", response_model=WorkshopProfile)
async def get_workshop_profile():
    profile = await db.workshop_profile.find_one({"id": "workshop_profile"})
    if not profile:
        # Create default profile
        default_profile = WorkshopProfile(
            name="ورشتي",
            phone="0501001220",
            whatsapp="966501001220",
            address="المملكة العربية السعودية",
            city="الرياض"
        )
        await db.workshop_profile.insert_one(default_profile.dict())
        return default_profile
    return WorkshopProfile(**profile)

@router.put("/profile")
async def update_workshop_profile(profile: WorkshopProfile):
    profile.updatedAt = datetime.utcnow()
    await db.workshop_profile.update_one(
        {"id": "workshop_profile"},
        {"$set": profile.dict()},
        upsert=True
    )
    return profile

# ============ Templates APIs ============
@router.get("/templates")
async def get_templates():
    templates = await db.templates.find().to_list(1000)
    # Return both html and content for frontend compatibility
    for t in templates:
        # Remove MongoDB _id field
        if '_id' in t:
            del t['_id']
        # Convert datetime objects
        if 'updatedAt' in t and hasattr(t['updatedAt'], 'isoformat'):
            t['updatedAt'] = t['updatedAt'].isoformat()
        if 'html' in t and 'content' not in t:
            t['content'] = t['html']
    return templates

@router.post("/templates")
async def create_template(payload: dict):
    # payload may contain name, type, content(html), styles, language
    tpl = TemplateDoc(
        name=payload.get('name', 'Template'),
        type=payload.get('type', 'invoice'),
        language=payload.get('language', 'ar'),
        html=payload.get('content') or payload.get('html') or ''
    )
    data = tpl.dict()
    # Keep original fields for compatibility
    data['content'] = data['html']
    data['styles'] = payload.get('styles', '')
    await db.templates.insert_one(data)
    return data

@router.put("/templates/{template_id}")
async def update_template(template_id: str, payload: dict):
    update = {
        "name": payload.get('name'),
        "type": payload.get('type'),
        "language": payload.get('language', 'ar'),
        "html": payload.get('content') or payload.get('html')
    }
    # Clean None
    update = {k: v for k, v in update.items() if v is not None}
    if 'html' in update:
        update['content'] = update['html']
    if 'styles' in payload:
        update['styles'] = payload['styles']
    await db.templates.update_one({"id": template_id}, {"$set": update})
    updated = await db.templates.find_one({"id": template_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Template not found")
    # Remove MongoDB _id field and convert datetime
    if '_id' in updated:
        del updated['_id']
    if 'updatedAt' in updated and hasattr(updated['updatedAt'], 'isoformat'):
        updated['updatedAt'] = updated['updatedAt'].isoformat()
    return updated

@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    res = await db.templates.delete_one({"id": template_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "deleted"}

# ============ Settings APIs ============
@router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "app_settings"})
    if not s:
        # defaults aligned with user: SAR, no tax
        defaults = AppSettings().dict()
        # Also include UI expected fields with sane defaults
        defaults.update({
            "workshopName": "ورشتي",
            "workshopPhone": "",
            "workshopWhatsapp": "",
            "workshopEmail": "",
            "workshopAddress": "",
            "workshopCity": "",
            "taxNumber": "",
            "logoUrl": "",
            "defaultTemplate": "invoice",
            "printHeaderFooter": True,
            "printLogo": True,
            "printWatermark": False,
            "paperSize": "A4",
            "printOrientation": "portrait",
            "smsEnabled": False,
            "whatsappEnabled": True,
            "emailEnabled": False,
            "notifyOnNewVehicle": True,
            "notifyOnStatusChange": True,
            "notifyOnPayment": True,
            "language": "ar",
            "dateFormat": "DD/MM/YYYY",
            "timeFormat": "12",
            "timezone": "Asia/Riyadh",
            "requireLogin": False,
            "sessionTimeout": 60,
            "backupEnabled": True,
            "backupFrequency": "daily"
        })
        await db.settings.insert_one(defaults)
        return defaults
    # Remove MongoDB _id field and convert datetime objects
    if '_id' in s:
        del s['_id']
    if 'updatedAt' in s and hasattr(s['updatedAt'], 'isoformat'):
        s['updatedAt'] = s['updatedAt'].isoformat()
    return s

@router.post("/settings")
async def save_settings(payload: dict):
    payload['updatedAt'] = datetime.utcnow()
    payload['id'] = 'app_settings'
    await db.settings.update_one({"id": "app_settings"}, {"$set": payload}, upsert=True)
    return payload

# ============ Diagnosis Reports & Approvals ============
@router.post("/reports/diagnosis")
async def create_diagnosis_report(payload: dict):
    # payload: vehicleId, customerId, title, summary, items[{name, qty, price, total}], subtotal, total
    token = f"REP-{str(uuid.uuid4())[:8].upper()}"
    report = DiagnosisReport(
        token=token,
        vehicleId=payload.get('vehicleId'),
        customerId=payload.get('customerId'),
        title=payload.get('title', 'تقرير تشخيص'),
        summary=payload.get('summary', ''),
        items=payload.get('items', []),
        subtotal=payload.get('subtotal', 0.0),
        total=payload.get('total', 0.0)
    )
    await db.diagnosis_reports.insert_one(report.dict())
    return report.dict()

@router.get("/reports/public/{token}")
async def get_public_report(token: str):
    rep = await db.diagnosis_reports.find_one({"token": token})
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")
    return rep

@router.post("/approvals")
async def create_approval_request(payload: dict):
    # payload: vehicleId, customerId, title, amount
    token = f"APR-{str(uuid.uuid4())[:8].upper()}"
    req = ApprovalRequest(
        token=token,
        vehicleId=payload.get('vehicleId'),
        customerId=payload.get('customerId'),
        title=payload.get('title', 'طلب اعتماد'),
        amount=float(payload.get('amount', 0))
    )
    await db.approval_requests.insert_one(req.dict())
    return req.dict()

@router.get("/approvals/public/{token}")
async def get_public_approval(token: str):
    req = await db.approval_requests.find_one({"token": token})
    if not req:
        raise HTTPException(status_code=404, detail="Approval not found")
    return req

@router.post("/approvals/public/{token}/respond")
async def respond_public_approval(token: str, status: str, name: Optional[str] = None, notes: Optional[str] = None):
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    update = {
        "status": status,
        "respondedAt": datetime.utcnow(),
        "responderName": name,
        "notes": notes
    }
    res = await db.approval_requests.update_one({"token": token}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Approval not found")
    updated = await db.approval_requests.find_one({"token": token})
    return updated
