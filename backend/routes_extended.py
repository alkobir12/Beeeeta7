from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import List, Optional
import uuid

from models_extended import (
    Employee, EmployeeCreate, SalaryPayment, AdvancePayment,
    LoyaltyPoints, PointsTransaction, Coupon,
    MaintenanceReminder, Warranty, WarrantyClaim,
    Supplier, PurchaseOrder, WorkshopProfile,
    TemplateDoc, DiagnosisReport, ApprovalRequest, AppSettings,
    Account, Budget, BusinessAccount, Operation, OperationItem, CustomerReceipt
)

# Router
router = APIRouter(prefix="/api")

# Database will be injected from server.py
db = None

def set_db(database):
    global db
    db = database

# ============ Budgets (ميزانيات متعددة لكل فرع) ============
@router.post("/budgets", response_model=Budget)
async def create_budget(payload: dict):
    try:
        budget = Budget(
            accountId=payload['accountId'],
            period=payload['period'],
            allocations=payload.get('allocations', []),
            incomeTarget=float(payload.get('incomeTarget', 0)),
            expenseTarget=float(payload.get('expenseTarget', 0)),
            notes=payload.get('notes')
        )
        await db.budgets.insert_one(budget.dict())
        return budget
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/budgets", response_model=List[Budget])
async def list_budgets(account_id: Optional[str] = None, period: Optional[str] = None):
    query = {}
    if account_id:
        query['accountId'] = account_id
    if period:
        query['period'] = period
    rows = await db.budgets.find(query).sort("period", -1).to_list(1000)
    return [Budget(**{k: v for k, v in r.items() if k != '_id'}) for r in rows]

@router.get("/budgets/{budget_id}/report")
async def budget_report(budget_id: str, format: Optional[str] = None):
    b = await db.budgets.find_one({"id": budget_id})
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    account_id = b.get('accountId')
    period = b.get('period')  # 'YYYY-MM'
    try:
        start = datetime.fromisoformat(period + "-01")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid budget period")
    # Compute month end by next month - 1 second
    if start.month == 12:
        next_month = datetime(start.year + 1, 1, 1)
    else:
        next_month = datetime(start.year, start.month + 1, 1)
    end = next_month

    tx_query = {"date": {"$gte": start, "$lt": end}}
    if account_id:
        tx_query['accountId'] = account_id

    transactions = await db.transactions.find(tx_query).to_list(10000)
    for t in transactions:
        t.pop('_id', None)

    income_actual = sum(t['amount'] for t in transactions if t.get('type') == 'income')
    expense_actual = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
    profit_actual = income_actual - expense_actual

    income_target = float(b.get('incomeTarget', 0) or 0)
    expense_target = float(b.get('expenseTarget', 0) or 0)

    income_pct = (income_actual / income_target * 100) if income_target > 0 else None
    expense_pct = (expense_actual / expense_target * 100) if expense_target > 0 else None

    # Breakdown by category
    by_category = {}
    for t in transactions:
        cat = t.get('category') or 'other'
        by_category.setdefault(cat, {"income": 0.0, "expense": 0.0})
        if t.get('type') == 'income':
            by_category[cat]['income'] += t.get('amount', 0)
        else:
            by_category[cat]['expense'] += t.get('amount', 0)

    payload = {
        "budget": {k: v for k, v in b.items() if k != '_id'},
        "period": period,
        "accountId": account_id,
        "summary": {
            "incomeActual": income_actual,
            "expenseActual": expense_actual,
            "profitActual": profit_actual,
            "incomeTarget": income_target,
            "expenseTarget": expense_target,
            "incomeAchievedPct": income_pct,
            "expenseAchievedPct": expense_pct
        },
        "breakdown": by_category,
        "transactions": transactions
    }

    if format == 'html':
        html = f"""
<!DOCTYPE html><html dir='rtl'><head><meta charset='UTF-8'><title>تقرير الميزانية - {period}</title>
<style>body{{font-family:Tahoma,Arial;}} .box{{border:1px solid #ddd;padding:12px;margin:8px 0;border-radius:8px}} .row{{display:flex;gap:16px}} .col{{flex:1}} table{{width:100%;border-collapse:collapse}} td,th{{border:1px solid #ddd;padding:6px;text-align:right}}</style>
</head><body>
<h2>تقرير الميزانية ({period})</h2>
<div class='row'>
  <div class='col box'><b>الإيرادات الفعلية:</b> {income_actual:,.2f} ر.س<br/><b>الهدف:</b> {income_target:,.2f} ر.س<br/>{('تحقق: ' + str(round(income_pct,1)) + '%') if income_pct is not None else ''}</div>
  <div class='col box'><b>المصروفات الفعلية:</b> {expense_actual:,.2f} ر.س<br/><b>الهدف:</b> {expense_target:,.2f} ر.س<br/>{('تحقق: ' + str(round(expense_pct,1)) + '%') if expense_pct is not None else ''}</div>
  <div class='col box'><b>الربح الفعلي:</b> {profit_actual:,.2f} ر.س</div>
</div>
<h3>تفصيل حسب التصنيف</h3>
<table><thead><tr><th>التصنيف</th><th>إيرادات</th><th>مصروفات</th></tr></thead><tbody>
{''.join(f"<tr><td>{cat}</td><td>{vals['income']:,.2f}</td><td>{vals['expense']:,.2f}</td></tr>" for cat, vals in by_category.items())}
</tbody></table>
</body></html>
"""
        return html

    return payload

# ============ Business Accounts (فروع منفصلة) ============
@router.post("/biz-accounts", response_model=BusinessAccount)
async def create_business_account(acc: BusinessAccount):
    await db.business_accounts.insert_one(acc.dict())
    return acc

@router.get("/biz-accounts", response_model=List[BusinessAccount])
async def list_business_accounts(active_only: bool = True):
    query = {"isActive": True} if active_only else {}
    rows = await db.business_accounts.find(query).to_list(1000)
    # Normalize
    return [BusinessAccount(**{k: v for k, v in r.items() if k != '_id'}) for r in rows]

@router.put("/biz-accounts/{acc_id}")
async def update_business_account(acc_id: str, payload: dict):
    update = {k: v for k, v in payload.items() if v is not None}
    await db.business_accounts.update_one({"id": acc_id}, {"$set": update})
    doc = await db.business_accounts.find_one({"id": acc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Account not found")
    doc.pop('_id', None)
    return BusinessAccount(**doc)

# ============ Operations (Purchase/Sale) ============
@router.post("/operations", response_model=Operation)
async def create_operation(payload: dict):
    # payload: {accountId, type, partnerType, partnerName, items[], paymentMethod, notes}
    try:
        items = [OperationItem(**i) for i in payload.get('items', [])]
        subtotal = sum(i.quantity * i.price for i in items)
        total = subtotal  # no tax per current settings
        op = Operation(
            accountId=payload['accountId'],
            type=payload['type'],
            partnerType=payload.get('partnerType', 'supplier' if payload['type']=='purchase' else 'customer'),
            partnerName=payload.get('partnerName'),
            partnerId=payload.get('partnerId'),
            items=items,
            subtotal=subtotal,
            total=total,
            paymentMethod=payload.get('paymentMethod', 'cash'),
            notes=payload.get('notes')
        )
        await db.operations.insert_one(op.dict())

        # Inventory adjust
        for i in items:
            if i.itemType == 'part' and i.itemId:
                if op.type == 'purchase':
                    await db.parts.update_one({"id": i.itemId}, {"$inc": {"quantity": i.quantity}})
                elif op.type == 'sale':
                    await db.parts.update_one({"id": i.itemId}, {"$inc": {"quantity": -i.quantity}})

        # Accounting transaction with accountId
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "type": 'income' if op.type == 'sale' else 'expense',
            "category": 'parts' if any(i.itemType=='part' for i in items) else 'service',
            "amount": total,
            "description": f"{op.type} operation for account {op.accountId}",
            "paymentMethod": op.paymentMethod,
            "reference": op.id,
            "date": datetime.utcnow(),
            "accountId": op.accountId
        })

        return op
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/operations", response_model=List[Operation])
async def list_operations(account_id: Optional[str] = None, type: Optional[str] = None):
    query = {}
    if account_id:
        query['accountId'] = account_id
    if type:
        query['type'] = type
    rows = await db.operations.find(query).sort("date", -1).to_list(1000)
    # Normalize
    return [Operation(**{k: v for k, v in r.items() if k != '_id'}) for r in rows]

# ============ Customer Receipts (توريد العملاء) ============
@router.post("/customer-receipts", response_model=CustomerReceipt)
async def create_customer_receipt(payload: dict):
    try:
        receipt = CustomerReceipt(
            customerId=payload['customerId'],
            accountId=payload.get('accountId'),
            amount=float(payload['amount']),
            paymentMethod=payload.get('paymentMethod', 'cash'),
            reference=payload.get('reference'),
            notes=payload.get('notes')
        )
        await db.customer_receipts.insert_one(receipt.dict())
        # Post as income transaction tagged optional accountId
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "type": "income",
            "category": "customer_receipt",
            "amount": receipt.amount,
            "description": f"Customer receipt {receipt.id}",
            "paymentMethod": receipt.paymentMethod,
            "reference": receipt.reference,
            "date": receipt.date,
            "accountId": receipt.accountId
        })
        return receipt
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/customer-receipts")
async def list_customer_receipts(customer_id: Optional[str] = None, account_id: Optional[str] = None):
    query = {}
    if customer_id:
        query['customerId'] = customer_id
    if account_id:
        query['accountId'] = account_id
    rows = await db.customer_receipts.find(query).sort("date", -1).to_list(1000)
    # Normalize
    for r in rows:
        r.pop('_id', None)
    return rows

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
    # Convert datetime objects for JSON serialization
    if 'updatedAt' in data and hasattr(data['updatedAt'], 'isoformat'):
        data['updatedAt'] = data['updatedAt'].isoformat()
    
    # Create a copy for database insertion (with original datetime)
    db_data = tpl.dict()
    db_data['content'] = db_data['html']
    db_data['styles'] = payload.get('styles', '')
    
    await db.templates.insert_one(db_data)
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

# ============ New Business Documents CRUD ============
from fastapi import Body
from models_extended import (
    DiagnosisCase, PricingQuote, SalesOrder, VendorBill,
    DocumentDependency, DocumentRef, DocumentActivity, QuoteItem, BillItem
)

@router.post("/diagnosis-cases", response_model=DiagnosisCase)
async def create_diagnosis_case(payload: dict = Body(...)):
    case = DiagnosisCase(**payload)
    await db.diagnosis_cases.insert_one(case.dict())
    await db.document_activities.insert_one(DocumentActivity(docType='diagnosis_case', docId=case.id, action='created').dict())
    return case

@router.get("/diagnosis-cases")
async def list_diagnosis_cases(vehicle_id: Optional[str] = None, customer_id: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if vehicle_id:
        q['vehicleId'] = vehicle_id
    if customer_id:
        q['customerId'] = customer_id
    if status:
        q['status'] = status
    rows = await db.diagnosis_cases.find(q).sort("createdAt", -1).to_list(1000)
    for r in rows:
        r.pop('_id', None)
    return rows

@router.post("/quotes", response_model=PricingQuote)
async def create_quote(payload: dict = Body(...)):
    items = [QuoteItem(**i) for i in payload.get('items', [])]
    subtotal = sum(i.quantity * i.price for i in items)
    total = subtotal - float(payload.get('discount', 0 or 0)) + float(payload.get('tax', 0 or 0))
    quote = PricingQuote(
        vehicleId=payload['vehicleId'],
        customerId=payload['customerId'],
        diagnosisCaseId=payload.get('diagnosisCaseId'),
        items=items, subtotal=subtotal, discount=float(payload.get('discount', 0)),
        tax=float(payload.get('tax', 0)), total=total, status=payload.get('status','draft'),
        validityDate=payload.get('validityDate'), reference=payload.get('reference')
    )
    await db.quotes.insert_one(quote.dict())
    await db.document_activities.insert_one(DocumentActivity(docType='quote', docId=quote.id, action='created').dict())
    # Link to diagnosis if provided
    if quote.diagnosisCaseId:
        dep = DocumentDependency(
            fromDoc=DocumentRef(docType='diagnosis_case', docId=quote.diagnosisCaseId),
            toDoc=DocumentRef(docType='quote', docId=quote.id),
            relation='derived_from'
        )
        await db.document_dependencies.insert_one(dep.dict())
    return quote

@router.get("/quotes")
async def list_quotes(customer_id: Optional[str] = None, vehicle_id: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if customer_id:
        q['customerId'] = customer_id
    if vehicle_id:
        q['vehicleId'] = vehicle_id
    if status:
        q['status'] = status
    rows = await db.quotes.find(q).sort("createdAt", -1).to_list(1000)
    for r in rows:
        r.pop('_id', None)
    return rows

@router.post("/sales", response_model=SalesOrder)
async def create_sales_order(payload: dict = Body(...)):
    items = [QuoteItem(**i) for i in payload.get('items', [])]
    subtotal = sum(i.quantity * i.price for i in items)
    total = subtotal + float(payload.get('tax', 0))
    so = SalesOrder(
        vehicleId=payload.get('vehicleId'), customerId=payload.get('customerId'),
        quoteId=payload.get('quoteId'), items=items, subtotal=subtotal, tax=float(payload.get('tax', 0)),
        total=total, status=payload.get('status', 'draft'), notes=payload.get('notes')
    )
    await db.sales_orders.insert_one(so.dict())
    await db.document_activities.insert_one(DocumentActivity(docType='sales_order', docId=so.id, action='created').dict())
    # Link if from quote
    if so.quoteId:
        dep = DocumentDependency(
            fromDoc=DocumentRef(docType='quote', docId=so.quoteId),
            toDoc=DocumentRef(docType='sales_order', docId=so.id),
            relation='derived_from'
        )
        await db.document_dependencies.insert_one(dep.dict())
    return so

@router.get("/sales")
async def list_sales(customer_id: Optional[str] = None, vehicle_id: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if customer_id: q['customerId'] = customer_id
    if vehicle_id: q['vehicleId'] = vehicle_id
    if status: q['status'] = status
    rows = await db.sales_orders.find(q).sort("date", -1).to_list(1000)
    for r in rows: r.pop('_id', None)
    return rows

@router.post("/vendor-bills", response_model=VendorBill)
async def create_vendor_bill(payload: dict = Body(...)):
    items = [BillItem(**i) for i in payload.get('items', [])]
    subtotal = sum(i.quantity * i.price for i in items)
    total = subtotal + float(payload.get('tax', 0))
    bill = VendorBill(
        supplierId=payload['supplierId'], purchaseOrderId=payload.get('purchaseOrderId'),
        items=items, subtotal=subtotal, tax=float(payload.get('tax', 0)), total=total,
        currency=payload.get('currency','SAR'), dueDate=payload.get('dueDate'),
        status=payload.get('status','draft'), reference=payload.get('reference')
    )
    await db.vendor_bills.insert_one(bill.dict())
    await db.document_activities.insert_one(DocumentActivity(docType='vendor_bill', docId=bill.id, action='created').dict())
    return bill

@router.get("/vendor-bills")
async def list_vendor_bills(supplier_id: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if supplier_id: q['supplierId'] = supplier_id
    if status: q['status'] = status
    rows = await db.vendor_bills.find(q).sort("date", -1).to_list(1000)
    for r in rows: r.pop('_id', None)
    return rows

@router.post("/dependencies", response_model=DocumentDependency)
async def create_dependency(payload: dict = Body(...)):
    dep = DocumentDependency(
        fromDoc=DocumentRef(**payload['fromDoc']),
        toDoc=DocumentRef(**payload['toDoc']),
        relation=payload['relation']
    )
    await db.document_dependencies.insert_one(dep.dict())
    return dep

@router.get("/dependencies")
async def list_dependencies(doc_type: Optional[str] = None, doc_id: Optional[str] = None):
    q = {}
    if doc_type and doc_id:
        q = {"$or": [
            {"fromDoc.docType": doc_type, "fromDoc.docId": doc_id},
            {"toDoc.docType": doc_type, "toDoc.docId": doc_id}
        ]}
    rows = await db.document_dependencies.find(q).sort("createdAt", -1).to_list(1000)
    for r in rows: r.pop('_id', None)
    return rows

@router.get("/activities")
async def list_activities(doc_type: Optional[str] = None, doc_id: Optional[str] = None):
    q = {}
    if doc_type: q['docType'] = doc_type
    if doc_id: q['docId'] = doc_id
    rows = await db.document_activities.find(q).sort("date", -1).to_list(1000)
    for r in rows: r.pop('_id', None)
    return rows


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
    # Remove MongoDB _id field and convert datetime
    if '_id' in rep:
        del rep['_id']
    if 'createdAt' in rep and hasattr(rep['createdAt'], 'isoformat'):
        rep['createdAt'] = rep['createdAt'].isoformat()
    return rep

@router.post("/approvals")
async def create_approval_request(payload: dict):
    # payload: vehicleId, customerId, title, amount, expiresInDays(optional)
    token = f"APR-{str(uuid.uuid4())[:8].upper()}"
    expires_in = int(payload.get('expiresInDays', 7))
    req = ApprovalRequest(
        token=token,
        vehicleId=payload.get('vehicleId'),
        customerId=payload.get('customerId'),
        title=payload.get('title', 'طلب اعتماد'),
        amount=float(payload.get('amount', 0))
    )
    # Override default expiry if provided
    req.expiresAt = datetime.utcnow() + timedelta(days=expires_in)
    await db.approval_requests.insert_one(req.dict())
    out = req.dict()
    out.pop('_id', None)
    if 'expiresAt' in out and hasattr(out['expiresAt'], 'isoformat'):
        out['expiresAt'] = out['expiresAt'].isoformat()
    return out

@router.get("/approvals/public/{token}")
async def get_public_approval(token: str):
    req = await db.approval_requests.find_one({"token": token})
    if not req:
        raise HTTPException(status_code=404, detail="Approval not found")
    now = datetime.utcnow()
    # Check expiry/revocation
    if req.get('revoked'):
        raise HTTPException(status_code=410, detail="Link revoked")
    if req.get('expiresAt') and req['expiresAt'] < now:
        raise HTTPException(status_code=410, detail="Link expired")
    # Remove MongoDB _id field and convert datetime
    if '_id' in req:
        del req['_id']
    if 'respondedAt' in req and hasattr(req['respondedAt'], 'isoformat'):
        req['respondedAt'] = req['respondedAt'].isoformat()
    if 'expiresAt' in req and hasattr(req['expiresAt'], 'isoformat'):
        req['expiresAt'] = req['expiresAt'].isoformat()
    return req

@router.post("/approvals/public/{token}/respond")
async def respond_public_approval(token: str, status: str, name: Optional[str] = None, phone: Optional[str] = None, notes: Optional[str] = None):
    valid_status = ("approved", "rejected", "deferred", "requote")
    if status not in valid_status:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Find the approval request
    req = await db.approval_requests.find_one({"token": token})
    if not req:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    now = datetime.utcnow()
    # Check expiry/revocation
    if req.get('revoked'):
        raise HTTPException(status_code=410, detail="Link revoked")
    if req.get('expiresAt') and req['expiresAt'] < now:
        raise HTTPException(status_code=410, detail="Link expired")
    
    # Update the approval with response
    update_data = {
        "status": status,
        "respondedAt": now,
        "responderName": name,
        "responderPhone": phone,
        "notes": notes
    }
    
    await db.approval_requests.update_one({"token": token}, {"$set": update_data})
    
    # Get updated document
    updated_req = await db.approval_requests.find_one({"token": token})
    if not updated_req:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    # Remove MongoDB _id field and convert datetime
    if '_id' in updated_req:
        del updated_req['_id']
    if 'respondedAt' in updated_req and hasattr(updated_req['respondedAt'], 'isoformat'):
        updated_req['respondedAt'] = updated_req['respondedAt'].isoformat()
    if 'expiresAt' in updated_req and hasattr(updated_req['expiresAt'], 'isoformat'):
        updated_req['expiresAt'] = updated_req['expiresAt'].isoformat()
    
    return updated_req

# ============ Approval Admin Utilities (revoke/regenerate/list) ============
@router.put("/approvals/{approval_id}/revoke")
async def revoke_approval_link(approval_id: str):
    res = await db.approval_requests.update_one({"id": approval_id}, {"$set": {"revoked": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Approval not found")
    doc = await db.approval_requests.find_one({"id": approval_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval not found")
    doc.pop('_id', None)
    if 'respondedAt' in doc and hasattr(doc['respondedAt'], 'isoformat'):
        doc['respondedAt'] = doc['respondedAt'].isoformat()
    if 'expiresAt' in doc and hasattr(doc['expiresAt'], 'isoformat'):
        doc['expiresAt'] = doc['expiresAt'].isoformat()
    return doc

@router.get("/approvals")
async def list_approvals(vehicle_id: Optional[str] = None, customer_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if vehicle_id:
        query['vehicleId'] = vehicle_id
    if customer_id:
        query['customerId'] = customer_id
    if status:
        query['status'] = status
    rows = await db.approval_requests.find(query).sort("createdAt", -1).to_list(1000)
    for r in rows:
        r.pop('_id', None)
        if 'createdAt' in r and hasattr(r['createdAt'], 'isoformat'):
            r['createdAt'] = r['createdAt'].isoformat()
        if 'respondedAt' in r and hasattr(r['respondedAt'], 'isoformat'):
            r['respondedAt'] = r['respondedAt'].isoformat()
        if 'expiresAt' in r and hasattr(r['expiresAt'], 'isoformat'):
            r['expiresAt'] = r['expiresAt'].isoformat()
    return rows
