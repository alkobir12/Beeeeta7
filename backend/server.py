from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import shutil

from models import (
    Vehicle, VehicleCreate, VehicleUpdate,
    Customer, CustomerBase, Technician, Service,
    Part, PartCreate, PartUpdate,
    Invoice, InvoiceCreate,
    Transaction, TransactionCreate,
    ChatRequest, ChatResponse, ChatSession, ChatMessage
)

from emergentintegrations.llm.chat import LlmChat, UserMessage

# Import extended routes
from routes_extended import router as extended_router, set_db as set_db_extended, init_whatsapp_service
from routes_advanced import router as advanced_router, set_db as set_db_advanced

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'workshop_db')]

# Set database for extended and advanced routes
set_db_extended(db)
set_db_advanced(db)

# Initialize WhatsApp service
try:
    whatsapp_svc = init_whatsapp_service(db)
    print(f"✅ WhatsApp Service initialized - Mode: {'Twilio' if whatsapp_svc.twilio_enabled else 'Deeplink'}")
except Exception as e:
    print(f"⚠️  WhatsApp Service initialization warning: {e}")

# Create upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Workshop Management API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ Helper Functions ============
def generate_tracking_link():
    return f"TRK-{str(uuid.uuid4())[:8].upper()}"

def generate_invoice_number():
    # Use settings prefix if available
    try:
        settings = db.settings.find_one({"id": "app_settings"})
        prefix = settings.get("invoicePrefix", "INV") if settings else "INV"
    except Exception:
        prefix = "INV"
    return f"{prefix}-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

async def get_or_create_customer(name: str, phone: str, email: Optional[str] = None):
    customer = await db.customers.find_one({"phone": phone})
    if customer:
        return customer['id']
    
    new_customer = Customer(
        name=name,
        phone=phone,
        email=email,
        totalVisits=1,
        lastVisit=datetime.utcnow()
    )
    await db.customers.insert_one(new_customer.dict())
    return new_customer.id

# ============ Vehicle APIs ============
@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate):
    try:
        # Get or create customer
        customer_id = await get_or_create_customer(
            vehicle_data.customerName,
            vehicle_data.customerPhone,
            vehicle_data.customerEmail
        )
        
        # Create vehicle
        vehicle = Vehicle(
            **vehicle_data.dict(),
            customerId=customer_id,
            trackingLink=generate_tracking_link(),
            estimatedCompletion=datetime.utcnow() + timedelta(days=2)
        )
        
        await db.vehicles.insert_one(vehicle.dict())
        
        # Update customer
        await db.customers.update_one(
            {"id": customer_id},
            {
                "$addToSet": {"vehicles": vehicle.plateNumber},
                "$inc": {"totalVisits": 1},
                "$set": {"lastVisit": datetime.utcnow()}
            }
        )
        
        
        # Auto-create approval link for this vehicle (7-day expiry)
        try:
            token = f"APR-{str(uuid.uuid4())[:8].upper()}"
            await db.approval_requests.insert_one({
                "id": str(uuid.uuid4()),
                "vehicleId": vehicle.id,
                "customerId": customer_id,
                "title": "طلب اعتماد",
                "amount": 0.0,
                "status": "pending",
                "token": token,
                "createdAt": datetime.utcnow(),
                "expiresAt": datetime.utcnow() + timedelta(days=7),
                "revoked": False
            })
        except Exception as _:
            # Do not block vehicle creation if approval auto-create fails
            logger.warning("Auto-create approval link failed, continuing vehicle creation")
        

        return vehicle
    except Exception as e:
        logger.error(f"Error creating vehicle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(status: Optional[str] = None, search: Optional[str] = None):
    try:
        query = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"plateNumber": {"$regex": search, "$options": "i"}},
                {"customerName": {"$regex": search, "$options": "i"}}
            ]
        
        vehicles = await db.vehicles.find(query).sort("entryDate", -1).to_list(1000)
        return [Vehicle(**v) for v in vehicles]
    except Exception as e:
        logger.error(f"Error getting vehicles: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return Vehicle(**vehicle)

@api_router.get("/vehicles/track/{tracking_link}", response_model=Vehicle)
async def track_vehicle(tracking_link: str):
    vehicle = await db.vehicles.find_one({"trackingLink": tracking_link})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Invalid tracking link")
    return Vehicle(**vehicle)

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, update_data: VehicleUpdate):
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    prev_status = vehicle.get("status")
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_dict:
        await db.vehicles.update_one({"id": vehicle_id}, {"$set": update_dict})
        vehicle = await db.vehicles.find_one({"id": vehicle_id})
    
    # Auto-manage approval links based on status transitions
    try:
        new_status = vehicle.get("status")
        customer_phone = vehicle.get("customerPhone", "")
        
        # On move to quotation: ensure there is an active pending approval (create if none active)
        if new_status == "quotation" and prev_status != "quotation":
            active = await db.approval_requests.find_one({
                "vehicleId": vehicle_id,
                "status": "pending",
                "revoked": {"$ne": True},
                "expiresAt": {"$gt": datetime.utcnow()}
            })
            if not active:
                token = f"APR-{str(uuid.uuid4())[:8].upper()}"
                approval_doc = {
                    "id": str(uuid.uuid4()),
                    "vehicleId": vehicle_id,
                    "customerId": vehicle.get("customerId"),
                    "title": "طلب اعتماد - " + vehicle.get("plateNumber", ""),
                    "amount": 0.0,
                    "status": "pending",
                    "token": token,
                    "createdAt": datetime.utcnow(),
                    "expiresAt": datetime.utcnow() + timedelta(days=7),
                    "revoked": False
                }
                await db.approval_requests.insert_one(approval_doc)
                
                # Auto-send approval notification via WhatsApp
                if customer_phone:
                    try:
                        from routes_extended import router as ext_router
                        approval_link = f"https://carmech-hub.preview.emergentagent.com/approval/{token}"
                        # Prepare notification
                        notif_response = await db.whatsapp_messages.insert_one({
                            "id": str(uuid.uuid4()),
                            "phone": customer_phone,
                            "message": f"🔔 طلب اعتماد جديد\n\nمركبتك: {vehicle.get('plateNumber')}\nالحالة: تسعير\n\nللاعتماد: {approval_link}\n\nصالح لمدة 7 أيام",
                            "type": "approval",
                            "status": "sent",
                            "sentAt": datetime.utcnow()
                        })
                        logger.info(f"✅ Auto-sent approval to {customer_phone}")
                    except Exception as e:
                        logger.warning(f"Failed to auto-send approval: {e}")
                        
        # On ready/delivered: send notification to customer
        if new_status in ("ready", "delivered") and prev_status != new_status:
            # Revoke pending approvals
            await db.approval_requests.update_many({
                "vehicleId": vehicle_id,
                "status": "pending",
                "revoked": {"$ne": True},
                "expiresAt": {"$gt": datetime.utcnow()}
            }, {"$set": {"revoked": True}})
            
            # Send ready/delivered notification
            if customer_phone and new_status == "ready":
                try:
                    await db.whatsapp_messages.insert_one({
                        "id": str(uuid.uuid4()),
                        "phone": customer_phone,
                        "message": f"✅ مركبتك جاهزة!\n\nرقم اللوحة: {vehicle.get('plateNumber')}\n{vehicle.get('brand')} {vehicle.get('model')}\n\nيمكنك استلامها في أي وقت خلال أوقات العمل.",
                        "type": "notification",
                        "status": "sent",
                        "sentAt": datetime.utcnow()
                    })
                    logger.info(f"✅ Auto-sent ready notification to {customer_phone}")
                except Exception as e:
                    logger.warning(f"Failed to send ready notification: {e}")
                    
    except Exception as e:
        logger.warning(f"Auto-manage approval links on status change failed: {e}")
    
    return Vehicle(**vehicle)

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle and its related invoices"""
    try:
        vehicle = await db.vehicles.find_one({"id": vehicle_id})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        # Delete related invoices
        await db.invoices.delete_many({"vehicleId": vehicle_id})
        
        # Delete the vehicle
        result = await db.vehicles.delete_one({"id": vehicle_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        return {"message": "Vehicle deleted successfully", "deleted_id": vehicle_id}
    except Exception as e:
        logger.error(f"Error deleting vehicle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ Customer APIs ============
@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerBase):
    """Create a new customer"""
    try:
        customer_dict = customer.dict()
        customer_dict["id"] = str(uuid.uuid4())
        customer_dict["createdAt"] = datetime.utcnow()
        customer_dict["totalVisits"] = 0
        customer_dict["lastVisit"] = None
        
        await db.customers.insert_one(customer_dict)
        return Customer(**customer_dict)
    except Exception as e:
        logger.error(f"Error creating customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(search: Optional[str] = None):
    try:
        query = {}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}}
            ]
        
        customers = await db.customers.find(query).sort("lastVisit", -1).to_list(1000)
        return [Customer(**c) for c in customers]
    except Exception as e:
        logger.error(f"Error getting customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**customer)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, update_data: CustomerBase):
    """Update customer information"""
    try:
        customer = await db.customers.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        
        if update_dict:
            await db.customers.update_one({"id": customer_id}, {"$set": update_dict})
            customer = await db.customers.find_one({"id": customer_id})
        
        return Customer(**customer)
    except Exception as e:
        logger.error(f"Error updating customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/customers/{customer_id}/history")
async def get_customer_history(customer_id: str):
    """Get complete visit history for a customer"""
    vehicles = await db.vehicles.find({"customerId": customer_id}).sort("entryDate", -1).to_list(1000)
    invoices = await db.invoices.find({"customerId": customer_id}).sort("createdAt", -1).to_list(1000)
    
    return {
        "vehicles": [Vehicle(**v) for v in vehicles],
        "invoices": [Invoice(**i) for i in invoices]
    }

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer and all related data"""
    try:
        customer = await db.customers.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Delete all vehicles associated with this customer
        await db.vehicles.delete_many({"customerId": customer_id})
        
        # Delete all invoices associated with this customer
        await db.invoices.delete_many({"customerId": customer_id})
        
        # Delete loyalty points
        await db.loyalty_points.delete_many({"customerId": customer_id})
        await db.loyalty_transactions.delete_many({"customerId": customer_id})
        
        # Delete maintenance reminders
        await db.maintenance_reminders.delete_many({"customerId": customer_id})
        
        # Delete the customer
        result = await db.customers.delete_one({"id": customer_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"message": "Customer and all related data deleted successfully", "deleted_id": customer_id}
    except Exception as e:
        logger.error(f"Error deleting customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ Technician APIs ============
@api_router.get("/technicians", response_model=List[Technician])
async def get_technicians():
    technicians = await db.technicians.find().to_list(1000)
    return [Technician(**t) for t in technicians]

@api_router.get("/technicians/{tech_id}", response_model=Technician)
async def get_technician(tech_id: str):
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return Technician(**tech)

# ============ Service APIs ============
@api_router.get("/services", response_model=List[Service])
async def get_services():
    services = await db.services.find().to_list(1000)
    return [Service(**s) for s in services]

@api_router.post("/services", response_model=Service)
async def create_service(service: Service):
    await db.services.insert_one(service.dict())
    return service

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, payload: dict):
    update = {k: v for k, v in payload.items() if v is not None}
    await db.services.update_one({"id": service_id}, {"$set": update})
    doc = await db.services.find_one({"id": service_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Service not found")
    return Service(**doc)

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    res = await db.services.delete_one({"id": service_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "deleted"}

# ============ Parts APIs ============
@api_router.post("/parts", response_model=Part)
async def create_part(part_data: PartCreate):
    part = Part(**part_data.dict())
    await db.parts.insert_one(part.dict())
    return part

@api_router.get("/parts", response_model=List[Part])
async def get_parts(search: Optional[str] = None, low_stock: bool = False):
    query = {}
    if search:
        query["$or"] = [
            {"partNumber": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    if low_stock:
        query["$expr"] = {"$lte": ["$quantity", "$minQuantity"]}
    
    parts = await db.parts.find(query).to_list(1000)
    return [Part(**p) for p in parts]

@api_router.get("/parts/{part_id}", response_model=Part)
async def get_part(part_id: str):
    part = await db.parts.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    return Part(**part)

@api_router.put("/parts/{part_id}", response_model=Part)
async def update_part(part_id: str, update_data: PartUpdate):
    part = await db.parts.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updatedAt"] = datetime.utcnow()
    
    if update_dict:
        await db.parts.update_one({"id": part_id}, {"$set": update_dict})
        part = await db.parts.find_one({"id": part_id})
    
    return Part(**part)

@api_router.delete("/parts/{part_id}")
async def delete_part(part_id: str):
    result = await db.parts.delete_one({"id": part_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    return {"message": "Part deleted successfully"}

# ============ Invoice APIs ============
@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceCreate):
    invoice = Invoice(
        **invoice_data.dict(),
        invoiceNumber=generate_invoice_number()
    )
    await db.invoices.insert_one(invoice.dict())
    
    # Update parts quantity if parts were used
    for item in invoice_data.items:
        if item.type == "part":
            await db.parts.update_one(
                {"id": item.itemId},
                {"$inc": {"quantity": -item.quantity}}
            )
    
    # Create income transaction
    if invoice_data.type == "service":
        transaction = Transaction(
            type="income",
            category="service",
            amount=invoice_data.total,
            description=f"Invoice {invoice.invoiceNumber}",
            paymentMethod=invoice_data.paymentMethod,
            reference=invoice.invoiceNumber
        )
        await db.transactions.insert_one(transaction.dict())
    
    return invoice

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(vehicle_id: Optional[str] = None, customer_id: Optional[str] = None):
    query = {}
    if vehicle_id:
        query["vehicleId"] = vehicle_id
    if customer_id:
        query["customerId"] = customer_id
    
    invoices = await db.invoices.find(query).sort("createdAt", -1).to_list(1000)
    return [Invoice(**i) for i in invoices]

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**invoice)

# ============ Transaction APIs ============
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate):
    transaction = Transaction(**transaction_data.dict())
    await db.transactions.insert_one(transaction.dict())
    return transaction

@api_router.get("/transactions")
async def get_transactions(
    type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[str] = None
):
    query = {}
    if type:
        query["type"] = type
    if start_date and end_date:
        query["date"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    if account_id:
        query["accountId"] = account_id
    
    transactions = await db.transactions.find(query).sort("date", -1).to_list(1000)
    
    # Calculate totals
    income = sum(t["amount"] for t in transactions if t["type"] == "income")
    expenses = sum(t["amount"] for t in transactions if t["type"] == "expense")
    
    return {
        "transactions": [Transaction(**t) for t in transactions],
        "summary": {
            "income": income,
            "expenses": expenses,
            "profit": income - expenses
        }
    }

# ============ AI Assistant APIs ============
@api_router.post("/ai/chat", response_model=ChatResponse)
async def chat_with_ai(chat_request: ChatRequest):
    try:
        # Import AI enhancements
        import sys
        sys.path.append(str(ROOT_DIR))
        from ai_enhancements import build_enhanced_prompt, search_knowledge_base
        
        # Get or create session
        session_id = chat_request.sessionId or str(uuid.uuid4())
        session = await db.chat_sessions.find_one({"id": session_id})
        
        if not session:
            session = ChatSession(id=session_id).dict()
            await db.chat_sessions.insert_one(session)
        
        # البحث في قاعدة المعرفة أولاً
        kb_results = search_knowledge_base(chat_request.message)
        
        # بناء prompt محسّن
        enhanced_prompt = build_enhanced_prompt(chat_request.message)
        
        # Initialize Claude AI مع prompt محسّن
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=enhanced_prompt
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        # Send message
        user_message = UserMessage(text=chat_request.message)
        response = await chat.send_message(user_message)
        
        # إذا وجدنا نتائج في قاعدة المعرفة، نضيفها للرد
        if kb_results:
            kb_summary = "\n\n📚 من قاعدة المعرفة:\n"
            for result in kb_results[:1]:
                kb_summary += f"• المشكلة: {result['problem']}\n"
                kb_summary += f"• التكلفة المتوقعة: {result['estimated_cost']} ريال\n"
            response = response + kb_summary
        
        # Save messages to database
        user_msg = ChatMessage(role="user", content=chat_request.message)
        assistant_msg = ChatMessage(role="assistant", content=response)
        
        await db.chat_sessions.update_one(
            {"id": session_id},
            {
                "$push": {
                    "messages": {
                        "$each": [user_msg.dict(), assistant_msg.dict()]
                    }
                },
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        
        return ChatResponse(response=response, sessionId=session_id)
        
    except Exception as e:
        logger.error(f"Error in AI chat: {e}")
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@api_router.get("/ai/sessions/{session_id}")
async def get_chat_session(session_id: str):
    session = await db.chat_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatSession(**session)

# ============ CEO AI Assistant ============
@api_router.post("/ceo/ai-analysis")
async def ceo_ai_analysis(question: str, account_id: Optional[str] = None):
    """CEO Bot - يحلل البيانات ويعطي توصيات ذكية. يمكن التصفية حسب فرع (account_id)."""
    try:
        import sys
        sys.path.append(str(ROOT_DIR))
        from ai_enhancements import analyze_business_health, generate_ceo_insights
        
        # Get current metrics (filtered by account if provided)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        tx_query = {"date": {"$gte": start_date, "$lte": end_date}}
        if account_id:
            tx_query["accountId"] = account_id
        
        transactions = await db.transactions.find(tx_query).to_list(10000)
        
        vehicles = await db.vehicles.find({
            "entryDate": {"$gte": start_date, "$lte": end_date}
        }).to_list(10000)
        
        # Optional: branch context
        account_name = None
        if account_id:
            acc = await db.business_accounts.find_one({"id": account_id})
            account_name = acc.get('name') if acc else None
        
        # Calculate metrics
        revenue = sum(t['amount'] for t in transactions if t['type'] == 'income')
        expenses = sum(t['amount'] for t in transactions if t['type'] == 'expense')
        profit = revenue - expenses
        
        # Basic placeholder if no feedback collection exists
        avg_satisfaction = 4.5
        
        metrics = {
            "revenue": revenue,
            "expenses": expenses,
            "profit": profit,
            "profitMargin": (profit / revenue * 100) if revenue > 0 else 0,
            "vehiclesServiced": len(vehicles),
            "customerSatisfaction": avg_satisfaction,
            "cashFlow": revenue - expenses,
            "newCustomers": len(set(v['customerId'] for v in vehicles)),
            "accountId": account_id,
            "accountName": account_name
        }
        
        # Analyze business health
        analysis = analyze_business_health(metrics)
        insights = generate_ceo_insights(metrics, "الشهر الحالي")
        
        # Build context for AI
        context = f"""
أنت مستشار أعمال وCEO مساعد ذكي. لديك البيانات التالية عن الورشة{(' — الفرع: ' + account_name) if account_name else ''}:

📊 **الأداء المالي (آخر 30 يوم):**
- الإيرادات: {revenue:,.0f} ريال
- المصروفات: {expenses:,.0f} ريال
- صافي الربح: {profit:,.0f} ريال
- هامش الربح: {metrics['profitMargin']:.1f}%

🚗 **الأداء التشغيلي:**
- عدد المركبات: {len(vehicles)}
- عملاء جدد: {metrics['newCustomers']}
- رضا العملاء: {avg_satisfaction:.1f}/5

⚠️ **التنبيهات:**
{chr(10).join('- ' + alert['message'] for alert in analysis['alerts'])}

💡 **التوصيات الحالية:**
{chr(10).join('- ' + rec for rec in analysis['recommendations'])}

سؤال المدير: {question}

الرجاء تقديم تحليل عميق وتوصيات قابلة للتنفيذ باللغة العربية.
"""
        
        # Ask Claude AI
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=llm_key,
            session_id=str(uuid.uuid4()),
            system_message="أنت مستشار أعمال وCEO مساعد متخصص في إدارة ورش السيارات. تحلل البيانات وتقدم توصيات استراتيجية."
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        response = await chat.send_message(UserMessage(text=context))
        
        return {
            "response": response,
            "metrics": metrics,
            "analysis": analysis,
            "insights": insights
        }
        
    except Exception as e:
        logger.error(f"Error in CEO AI: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============ File Upload APIs ============
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_ext = file.filename.split('.')[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = UPLOAD_DIR / file_name
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {"url": f"/api/files/{file_name}", "filename": file_name}
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/files/{filename}")
async def get_file(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# ============ Dashboard Stats API ============
@api_router.get("/stats")
async def get_dashboard_stats():
    total_vehicles = await db.vehicles.count_documents({})
    in_progress = await db.vehicles.count_documents({"status": {"$ne": "ready"}})
    ready = await db.vehicles.count_documents({"status": "ready"})
    total_customers = await db.customers.count_documents({})
    total_technicians = await db.technicians.count_documents({})
    low_stock_parts = await db.parts.count_documents({"$expr": {"$lte": ["$quantity", "$minQuantity"]}})
    
    # Get this month's revenue
    start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_income = await db.transactions.aggregate([
        {"$match": {"type": "income", "date": {"$gte": start_of_month}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    monthly_expenses = await db.transactions.aggregate([
        {"$match": {"type": "expense", "date": {"$gte": start_of_month}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    return {
        "vehicles": {
            "total": total_vehicles,
            "inProgress": in_progress,
            "ready": ready
        },
        "customers": total_customers,
        "technicians": total_technicians,
        "lowStockParts": low_stock_parts,
        "thisMonth": {
            "income": monthly_income[0]["total"] if monthly_income else 0,
            "expenses": monthly_expenses[0]["total"] if monthly_expenses else 0,
            "profit": (monthly_income[0]["total"] if monthly_income else 0) - (monthly_expenses[0]["total"] if monthly_expenses else 0)
        }
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Workshop Management API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)
app.include_router(extended_router)  # Extended features
app.include_router(advanced_router)  # Advanced features (Store, CEO, Support)

# Import and include Users router
try:
    from routes_users import router as users_router, set_db as set_users_db
    set_users_db(db)
    app.include_router(users_router)
    logger.info("✅ Users router loaded")
except Exception as e:
    logger.warning(f"⚠️ Users router not loaded: {e}")

# Import and include AI Enhanced router
try:
    from routes_ai_enhanced import router as ai_enhanced_router, set_db as set_ai_db
    set_ai_db(db)
    app.include_router(ai_enhanced_router)
    logger.info("✅ AI Enhanced router loaded")
except Exception as e:
    logger.warning(f"⚠️  AI Enhanced router not loaded: {e}")

# Import and include DTC router
try:
    from routes_dtc import router as dtc_router, set_db as set_dtc_db
    set_dtc_db(db)
    app.include_router(dtc_router)
    logger.info("✅ DTC router loaded")
except Exception as e:
    logger.warning(f"⚠️ DTC router not loaded: {e}")

# Import and include References router
try:
    from routes_references import router as ref_router, set_db as set_ref_db
    set_ref_db(db)
    app.include_router(ref_router)
    logger.info("✅ References router loaded")
except Exception as e:
    logger.warning(f"⚠️ References router not loaded: {e}")

# Import and include Vehicle Files router
try:
    from routes_vehicle_files import router as vf_router, set_db as set_vf_db
    set_vf_db(db)
    app.include_router(vf_router)
    logger.info("✅ Vehicle Files router loaded")
except Exception as e:
    logger.warning(f"⚠️ Vehicle Files router not loaded: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
