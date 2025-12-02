from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import shutil
import json

from models import (
    Vehicle, VehicleCreate, VehicleUpdate,
    Customer, CustomerBase, Technician, Service,
    Part, PartCreate, PartUpdate,
    Invoice, InvoiceCreate,
    Transaction, TransactionCreate,
    ChatRequest, ChatResponse, ChatSession, ChatMessage
)

from emergentintegrations.llm.chat import LlmChat, UserMessage

# Import Arabic Quotation Builder
from arabic_quotation import ArabicQuotationBuilder, create_quotation_routes
from unified_document_service import UnifiedDocumentGenerator, create_unified_document_routes

# Import extended routes
from routes_extended import router as extended_router, set_db as set_db_extended
from routes_advanced import router as advanced_router, set_db as set_db_advanced

# Import Import Routes
from routes_import import router as import_router, set_db as set_db_import
# Import Injector Routes
from routes_injectors import router as injectors_router, set_db as set_db_injectors
# Import User Routes
from routes_users import router as users_router, set_db as set_db_users
# Import Gemini Chat Routes
from routes_gemini_chat import router as gemini_chat_router, set_db as set_db_gemini_chat

from supabase_service import SupabaseService
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


# Provider mode
DB_PROVIDER = os.environ.get('DB_PROVIDER', 'mongo').lower()

# Simple file-based storage for memory mode
MEM_DIR = ROOT_DIR / 'uploads'
MEM_DIR.mkdir(exist_ok=True)

def _mem_path(name: str) -> Path:
    return MEM_DIR / f'{name}.json'

def _mem_read(name: str) -> list:
    p = _mem_path(name)
    if not p.exists():
        # seed minimal datasets
        seed = []
        if name == 'services':
            seed = [
                {"id": str(uuid.uuid4()), "name": "تغيير زيت", "category": "زيوت", "price": 120, "duration": 30, "active": True},
                {"id": str(uuid.uuid4()), "name": "فحص كمبيوتر", "category": "تشخيص", "price": 150, "duration": 40, "active": True}
            ]
        elif name == 'technicians':
            seed = [
                {"id": str(uuid.uuid4()), "name": "فني أحمد", "phone": "", "specialty": "ميكانيكا"},
                {"id": str(uuid.uuid4()), "name": "فني علي", "phone": "", "specialty": "كهرباء"}
            ]
        elif name == 'vehicles':
            seed = []
        elif name == 'parts':
            seed = []
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(seed, f, ensure_ascii=False, indent=2)
    try:
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def _mem_write(name: str, items: list):
    p = _mem_path(name)
    # ensure all data is JSON-serializable (e.g., convert datetime to ISO strings)
    serializable_items = []
    for item in items:
        if isinstance(item, dict):
            cleaned = {}
            for k, v in item.items():
                if hasattr(v, "isoformat"):
                    cleaned[k] = v.isoformat()
                else:
                    cleaned[k] = v
            serializable_items.append(cleaned)
        else:
            serializable_items.append(item)

    with open(p, 'w', encoding='utf-8') as f:
        json.dump(serializable_items, f, ensure_ascii=False, indent=2)

# MongoDB connection (used when DB_PROVIDER is 'mongo')
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url) if mongo_url else None

# Important: DB name must be provided explicitly via environment in deployment
db_name = os.environ.get('DB_NAME') if client is not None else None
db = client[db_name] if (client is not None and db_name) else None

# Set database for extended and advanced routes (FIXED ORDER)
set_db_users(db)
set_db_import(db)
set_db_injectors(db)
set_db_extended(db)
set_db_advanced(db)

# Initialize WhatsApp service (optional)
try:
    from whatsapp_service import WhatsAppService
    whatsapp_svc = WhatsAppService(db)
    print(f"✅ WhatsApp Service initialized")
except Exception as e:
    print(f"⚠️  WhatsApp Service initialization warning: {e}")

# Create upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Workshop Management API")

# Include Routers
app.include_router(users_router)
app.include_router(injectors_router)
app.include_router(import_router)
app.include_router(extended_router)
app.include_router(advanced_router)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ Invoice Studio Integration ============
try:
    static_path = ROOT_DIR.parent / "frontend" / "public" / "invoice-studio"
    if static_path.exists():
        app.mount("/invoice-studio", StaticFiles(directory=str(static_path), html=True), name="invoice-studio")
except Exception as e:
    print(f"❌ Error mounting Invoice Studio: {e}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ Helper Functions ============
def generate_tracking_link():
    return f"TRK-{str(uuid.uuid4())[:8].upper()}"

def generate_invoice_number():
    prefix = "INV"
    return f"{prefix}-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

async def get_or_create_customer(name: str, phone: str, email: Optional[str] = None):
    if DB_PROVIDER == 'memory':
        rows = _mem_read('customers')
        for r in rows:
            if r.get('phone') == phone:
                return r['id']
        new_c = {
            'id': str(uuid.uuid4()),
            'name': name, 'phone': phone, 'email': email,
            'totalVisits': 1, 'lastVisit': datetime.utcnow().isoformat(),
            'createdAt': datetime.utcnow().isoformat(), 'vehicles': []
        }
        rows.append(new_c)
        _mem_write('customers', rows)
        return new_c['id']

    customer = await db.customers.find_one({"phone": phone})
    if customer:
        return customer['id']
    
    new_customer = Customer(name=name, phone=phone, email=email, totalVisits=1, lastVisit=datetime.utcnow())
    await db.customers.insert_one(new_customer.dict())
    return new_customer.id

# ============ Base API Routes (Vehicles, Customers, etc) ============

@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate):
    try:
        customer_id = await get_or_create_customer(
            vehicle_data.customerName, vehicle_data.customerPhone, vehicle_data.customerEmail
        )
        
        vehicle_dict = {
            **vehicle_data.dict(),
            'id': str(uuid.uuid4()),
            'customerId': customer_id,
            'trackingLink': generate_tracking_link(),
            'estimatedCompletion': datetime.utcnow() + timedelta(days=2),
            'entryDate': datetime.utcnow()
        }

        if DB_PROVIDER == 'memory':
            rows = _mem_read('vehicles')
            # ISO format for json
            v_json = vehicle_dict.copy()
            v_json['estimatedCompletion'] = v_json['estimatedCompletion'].isoformat()
            v_json['entryDate'] = v_json['entryDate'].isoformat()
            rows.append(v_json)
            _mem_write('vehicles', rows)
            return Vehicle(**vehicle_dict)

        await db.vehicles.insert_one(vehicle_dict)
        return Vehicle(**vehicle_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles():
    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        return [Vehicle(**r) for r in rows]
    
    vehicles = await db.vehicles.find().sort("entryDate", -1).to_list(1000)
    return [Vehicle(**v) for v in vehicles]

@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        for r in rows:
            if r.get('id') == vehicle_id: return Vehicle(**r)
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle: raise HTTPException(status_code=404, detail="Vehicle not found")
    return Vehicle(**vehicle)

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, update_data: VehicleUpdate):
    upd = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        for i, r in enumerate(rows):
            if r.get('id') == vehicle_id:
                # handle dates
                if 'estimatedCompletion' in upd and isinstance(upd['estimatedCompletion'], datetime):
                    upd['estimatedCompletion'] = upd['estimatedCompletion'].isoformat()
                if 'completionDate' in upd and isinstance(upd['completionDate'], datetime):
                    upd['completionDate'] = upd['completionDate'].isoformat()
                
                rows[i] = {**r, **upd}
                _mem_write('vehicles', rows)
                return Vehicle(**rows[i])
        raise HTTPException(status_code=404, detail="Vehicle not found")

    await db.vehicles.update_one({"id": vehicle_id}, {"$set": upd})
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    return Vehicle(**vehicle)

@api_router.get("/customers", response_model=List[Customer])
async def get_customers():
    if DB_PROVIDER == 'memory':
        return [Customer(**r) for r in _mem_read('customers')]
    customers = await db.customers.find().to_list(1000)
    return [Customer(**c) for c in customers]

@api_router.get("/services", response_model=List[Service])
async def get_services():
    if DB_PROVIDER == 'memory':
        return [Service(**r) for r in _mem_read('services')]
    services = await db.services.find().to_list(1000)
    return [Service(**s) for s in services]

@api_router.post("/services", response_model=Service)
async def create_service(service: Service):
    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        rows.append(service.dict())
        _mem_write('services', rows)
        return service
    await db.services.insert_one(service.dict())
    return service

# Include the api_router
app.include_router(api_router)

# Add AI Chat route
@app.post("/api/ai/chat", response_model=ChatResponse)
async def chat_with_ai(chat_request: ChatRequest):
    try:
        session_id = chat_request.sessionId or str(uuid.uuid4())
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        
        if not llm_key:
            return ChatResponse(response="مفتاح الذكاء الاصطناعي غير متوفر.", sessionId=session_id)

        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message="أنت مساعد ذكي لورشة سيارات."
        ).with_model("anthropic", "claude-sonnet-4.5-20250929")
        
        response = await chat.send_message(UserMessage(text=chat_request.message))
        return ChatResponse(response=response, sessionId=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
