from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables FIRST before any other imports
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import httpx
from typing import List, Optional
from datetime import datetime, timedelta, timezone
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
from routes_payroll import router as payroll_router, set_db as set_db_payroll
# Import Fault Knowledge Routes
from routes_fault_knowledge import router as fault_knowledge_router
# Import Templates Routes
from routes_templates import router as templates_router

from supabase_service import SupabaseService
from routes_language import router as language_router
from routes_workshop_bot import router as workshop_bot_router

# Provider mode
DB_PROVIDER = os.environ.get('DB_PROVIDER', 'mongo').lower()
supabase_service = SupabaseService()

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
mongo_url = os.environ.get('MONGO_URL') if DB_PROVIDER == 'mongo' else None
client = AsyncIOMotorClient(mongo_url) if mongo_url else None

# Important: DB name must be provided explicitly via environment in deployment
db_name = os.environ.get('DB_NAME') if client is not None else None
db = client[db_name] if (client is not None and db_name) else None

# Set database for extended and advanced routes (FIXED ORDER)
set_db_users(db)
set_db_import(db)
set_db_injectors(db)
set_db_gemini_chat(db)
set_db_payroll(db)
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

# Runtime guard middleware (مراقبة وحماية خفيفة أثناء التشغيل)
from runtime_guard import runtime_guard_middleware
app.middleware("http")(runtime_guard_middleware)

# Health check endpoint for deployment readiness
@app.get("/health")
async def health_check():
    """Simple health check used by deployment platform."""
    # Optional: check DB connectivity when using Mongo
    if DB_PROVIDER == 'mongo':
        try:
            if client is None or db is None:
                return {"status": "degraded", "db": "not_configured"}
            # Use a lightweight ping command
            await db.command("ping")
            return {"status": "ok", "db": "connected"}
        except Exception as e:
            # Do not crash app on health check failure – just report degraded state
            return {"status": "degraded", "db": "error", "detail": str(e)[:200]}
    # For other providers (supabase/memory), just return ok
    return {"status": "ok"}


# Add validation error handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    import logging
    logging.error(f"Validation Error: {exc.errors()}")
    logging.error(f"Request Body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)[:500]}
    )

# Enable CORS for frontend access (Emergent ingress will handle exact origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Settings: simple JSON-based global settings ============

SETTINGS_FILE = ROOT_DIR / 'uploads' / 'settings.json'

def read_settings() -> dict:
    if not SETTINGS_FILE.exists():
        return {}
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def write_settings(data: dict):
    SETTINGS_FILE.parent.mkdir(exist_ok=True, parents=True)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# Include Routers
app.include_router(users_router)
app.include_router(injectors_router)
app.include_router(import_router)
app.include_router(gemini_chat_router)
app.include_router(fault_knowledge_router)
# Temporarily disable payroll router - needs Supabase implementation
# app.include_router(payroll_router)
app.include_router(language_router)
app.include_router(workshop_bot_router)
app.include_router(extended_router)
app.include_router(advanced_router)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Unified document generation routes (documents/generate, documents/generate-html, documents/types)
# Arabic quotation (quotations/generate, quotations/themes)
create_quotation_routes(api_router)

create_unified_document_routes(api_router)

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
    if DB_PROVIDER == 'supabase':
        c = supabase_service.customers_find_by_phone(phone)
        if c: return c['id']
        new_c = supabase_service.customers_create({
            'name': name, 'phone': phone, 'email': email,
            'totalVisits': 1, 'lastVisit': datetime.utcnow().isoformat()
        })
        return new_c['id']

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
            'estimatedCompletion': (datetime.utcnow() + timedelta(days=2)).isoformat(),
            'entryDate': datetime.utcnow().isoformat()
        }

        if DB_PROVIDER == 'supabase':
            # supabase_service expects camelCase dict
            v_res = supabase_service.vehicles_create(vehicle_dict)
            return Vehicle(**v_res)

        if DB_PROVIDER == 'memory':
            rows = _mem_read('vehicles')
            rows.append(vehicle_dict)
            _mem_write('vehicles', rows)
            return Vehicle(**vehicle_dict)

        await db.vehicles.insert_one(vehicle_dict)
        return Vehicle(**vehicle_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles():
    if DB_PROVIDER == 'supabase':
        rows = supabase_service.vehicles_list()
        # Ensure status has a default value if None
        for r in rows:
            if r.get('status') is None:
                r['status'] = 'diagnosis'
        return [Vehicle(**r) for r in rows]

    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        # Ensure status has a default value if None
        for r in rows:
            if r.get('status') is None:
                r['status'] = 'diagnosis'
        return [Vehicle(**r) for r in rows]
    
    # استخدام Projection وحد للحفاظ على الأداء في الإنتاج
    vehicles = await db.vehicles.find({}, {"_id": 0}).sort("entryDate", -1).limit(200).to_list(200)
    # Ensure status has a default value if None
    for v in vehicles:
        if v.get('status') is None:
            v['status'] = 'diagnosis'
    return [Vehicle(**v) for v in vehicles]

@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    if DB_PROVIDER == 'supabase':
        v = supabase_service.vehicles_get(vehicle_id)
        if not v: raise HTTPException(status_code=404, detail="Vehicle not found")
        return Vehicle(**v)

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
    
    if DB_PROVIDER == 'supabase':
        v = supabase_service.vehicles_update(vehicle_id, upd)
        if not v: raise HTTPException(status_code=404, detail="Vehicle not found")
        return Vehicle(**v)

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

# ============ Print & Quote Settings API ============

@api_router.get("/settings")
async def get_settings():
    """إرجاع إعدادات الورشة/الطباعة المخزنة في ملف JSON بسيط.
    ملاحظة: هذا مسار عام يمكن توسيعه لاحقًا لدمج إعدادات أخرى.
    """
    data = read_settings()
    return data


@api_router.post("/settings/print-defaults")
async def save_print_defaults(payload: dict):
    """حفظ الإعدادات الافتراضية للطباعة وعروض الأسعار (theme/style/tax_rate)."""
    data = read_settings()
    data.setdefault('printDefaults', {})
    data['printDefaults']['theme'] = payload.get('theme')
    data['printDefaults']['style'] = payload.get('style')
    data['printDefaults']['tax_rate'] = payload.get('tax_rate')
    write_settings(data)
    return {"success": True, "printDefaults": data['printDefaults']}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle and its related invoices and operations."""
    # Supabase mode
    if DB_PROVIDER == 'supabase':
        try:
            # Delete invoices linked to this vehicle (if invoices table exists)
            if hasattr(supabase_service, 'client') and supabase_service.client and not supabase_service.mock_mode:
                try:
                    supabase_service.client.table('invoices').delete().eq('vehicle_id', vehicle_id).execute()
                except Exception as invoice_error:
                    # Invoices table might not exist - this is acceptable
                    print(f"⚠️ Could not delete invoices for vehicle {vehicle_id}: {invoice_error}")
                
                # Delete operations linked to this vehicle
                try:
                    supabase_service.client.table('operations').delete().eq('vehicleId', vehicle_id).execute()
                except Exception as ops_error:
                    print(f"⚠️ Could not delete operations for vehicle {vehicle_id}: {ops_error}")
            supabase_service.vehicles_delete(vehicle_id)
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # In-memory mode
    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        rows = [r for r in rows if r.get('id') != vehicle_id]
        _mem_write('vehicles', rows)
        
        # Delete operations for this vehicle
        ops = _mem_read('operations')
        ops = [op for op in ops if op.get('vehicleId') != vehicle_id]
        _mem_write('operations', ops)
        
        return {"success": True}

    # MongoDB mode (legacy)
    await db.invoices.delete_many({"vehicleId": vehicle_id})
    await db.operations.delete_many({"vehicleId": vehicle_id})
    await db.vehicles.delete_one({"id": vehicle_id})
    return {"success": True}


@api_router.get("/customers", response_model=List[Customer])
async def get_customers():
    if DB_PROVIDER == 'supabase':
        rows = supabase_service.customers_list()
        return [Customer(**r) for r in rows]

    if DB_PROVIDER == 'memory':
        return [Customer(**r) for r in _mem_read('customers')]
    customers = await db.customers.find().to_list(1000)
    return [Customer(**c) for c in customers]


@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer and cascade delete related vehicles/invoices when possible."""
    # Supabase mode
    if DB_PROVIDER == 'supabase':
        try:
            if hasattr(supabase_service, 'client') and supabase_service.client and not supabase_service.mock_mode:
                # Delete invoices and vehicles linked to this customer
                try:
                    supabase_service.client.table('invoices').delete().eq('customer_id', customer_id).execute()
                except Exception as invoice_error:
                    # Invoices table might not exist - this is acceptable
                    print(f"⚠️ Could not delete invoices for customer {customer_id}: {invoice_error}")
                
                try:
                    supabase_service.client.table('vehicles').delete().eq('customer_id', customer_id).execute()
                except Exception as vehicle_error:
                    # Handle vehicle deletion error
                    print(f"⚠️ Could not delete vehicles for customer {customer_id}: {vehicle_error}")
            supabase_service.customers_delete(customer_id)
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # In-memory mode
    if DB_PROVIDER == 'memory':
        _mem_write('customers', [c for c in _mem_read('customers') if c.get('id') != customer_id])
        _mem_write('vehicles', [v for v in _mem_read('vehicles') if v.get('customerId') != customer_id])
        return {"success": True}

    # MongoDB mode (legacy)
    await db.invoices.delete_many({"customerId": customer_id})
    await db.vehicles.delete_many({"customerId": customer_id})
    await db.customers.delete_one({"id": customer_id})
    return {"success": True}

    if DB_PROVIDER == 'supabase':
        rows = supabase_service.customers_list()
        return [Customer(**r) for r in rows]

    if DB_PROVIDER == 'memory':
        return [Customer(**r) for r in _mem_read('customers')]
    customers = await db.customers.find().to_list(1000)
    return [Customer(**c) for c in customers]

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerBase):
    if DB_PROVIDER == 'supabase':
        c = supabase_service.customers_create(customer.dict())
        return Customer(**c)
    
    if DB_PROVIDER == 'memory':
        rows = _mem_read('customers')
        new_c = {**customer.dict(), 'id': str(uuid.uuid4())}
        rows.append(new_c)
        _mem_write('customers', rows)
        return Customer(**new_c)
    
    customer_dict = customer.dict()
    customer_dict['id'] = str(uuid.uuid4())
    await db.customers.insert_one(customer_dict)
    return Customer(**customer_dict)

@api_router.get("/services", response_model=List[Service])
async def get_services():
    if DB_PROVIDER == 'supabase':
        rows = supabase_service.services_list()
        return [Service(**r) for r in rows]

    if DB_PROVIDER == 'memory':
        return [Service(**r) for r in _mem_read('services')]
    services = await db.services.find().to_list(1000)
    return [Service(**s) for s in services]

@api_router.post("/services", response_model=Service)
async def create_service(service: Service):
    if DB_PROVIDER == 'supabase':
        s = supabase_service.services_create(service.dict())
        return Service(**s)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        rows.append(service.dict())
        _mem_write('services', rows)
        return service
    await db.services.insert_one(service.dict())


@api_router.post("/vehicles/{vehicle_id}/upload-file")
async def upload_vehicle_file(vehicle_id: str, file: UploadFile = File(...), file_type: str = "diagnostic"):
    """رفع ملف أو صورة أو فاتورة لمركبة (يُخزَّن في نظام الملفات مع سجل ميتاداتا)."""
    try:
        # تحقّق من وجود المركبة في وضع Supabase
        if DB_PROVIDER == 'supabase':
            v = supabase_service.vehicles_get(vehicle_id)
            if not v:
                raise HTTPException(status_code=404, detail="المركبة غير موجودة")

        # مجلد رفع الملفات العام موجود مسبقًا كـ UPLOAD_DIR
        vehicle_dir = UPLOAD_DIR / "vehicles" / vehicle_id
        vehicle_dir.mkdir(parents=True, exist_ok=True)

        # حفظ الملف فعليًا على القرص
        file_path = vehicle_dir / file.filename
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # حفظ سجل الملف في تخزين JSON (ذاكرة)
        rows = _mem_read('vehicle_files')
        record = {
            "id": str(uuid.uuid4()),
            "vehicleId": vehicle_id,
            "filename": file.filename,
            "fileType": file_type,
            "filePath": str(file_path),
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "uploadedBy": "system",
        }
        rows.append(record)
        _mem_write('vehicle_files', rows)
        return record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/vehicles/{vehicle_id}/files")
async def get_vehicle_files(vehicle_id: str):
    """إرجاع قائمة ملفات المركبة من تخزين JSON."""
    try:
        rows = _mem_read('vehicle_files')
        files = [r for r in rows if r.get("vehicleId") == vehicle_id]
        # أحدث الملفات أولاً
        files.sort(key=lambda x: x.get("uploadedAt") or "", reverse=True)
        return {"files": files, "count": len(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/vehicles/{vehicle_id}/files/{file_id}")
async def download_vehicle_file(vehicle_id: str, file_id: str):
    """تنزيل/عرض ملف معيّن لمركبة."""
    try:
        rows = _mem_read('vehicle_files')
        for r in rows:
            if r.get("id") == file_id and r.get("vehicleId") == vehicle_id:
                path = Path(r.get("filePath", ""))
                if not path.exists():
                    raise HTTPException(status_code=404, detail="الملف غير موجود")
                return FileResponse(str(path), filename=r.get("filename") or path.name)
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, service: Service):
    if DB_PROVIDER == 'supabase':
        s = supabase_service.services_update(service_id, service.dict())
        if not s:
            raise HTTPException(status_code=404, detail="Service not found")
        return Service(**s)
    
    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        for i, s in enumerate(rows):
            if s.get('id') == service_id:
                rows[i] = {**service.dict(), 'id': service_id}
                _mem_write('services', rows)
                return Service(**rows[i])
        raise HTTPException(status_code=404, detail="Service not found")
    
    result = await db.services.update_one(
        {"id": service_id},
        {"$set": service.dict()}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    if DB_PROVIDER == 'supabase':
        success = supabase_service.services_delete(service_id)
        if not success:
            raise HTTPException(status_code=404, detail="Service not found")
        return {"status": "success", "message": "Service deleted"}
    
    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        filtered = [s for s in rows if s.get('id') != service_id]
        if len(filtered) == len(rows):
            raise HTTPException(status_code=404, detail="Service not found")
        _mem_write('services', filtered)
        return {"status": "success", "message": "Service deleted"}
    
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"status": "success", "message": "Service deleted"}

@api_router.get("/technicians", response_model=List[Technician])
async def get_technicians():
    if DB_PROVIDER == 'supabase':
        rows = supabase_service.technicians_list()
        return [Technician(**r) for r in rows]

    if DB_PROVIDER == 'memory':
        return [Technician(**r) for r in _mem_read('technicians')]
    technicians = await db.technicians.find().to_list(1000)
    return [Technician(**t) for t in technicians]


@api_router.post("/technicians", response_model=Technician)
async def create_technician(technician: Technician):
    """Add a new technician"""
    if DB_PROVIDER == 'supabase':
        if not supabase_service.client or supabase_service.mock_mode:
            raise HTTPException(status_code=500, detail="Supabase client not configured")
        # Convert to snake_case for Supabase
        data = {
            'name': technician.name,
            'phone': technician.phone,
            'specialty': technician.specialty,
            'active_jobs': technician.activeJobs,
            'completed_jobs': technician.completedJobs,
            'rating': technician.rating
        }
        res = supabase_service.client.table('technicians').insert(data).execute()
        row = (res.data or [{}])[0]
        # Convert back to camelCase
        return Technician(
            id=row.get('id'),
            name=row.get('name'),
            phone=row.get('phone', ''),
            specialty=row.get('specialty', ''),
            activeJobs=row.get('active_jobs', 0),
            completedJobs=row.get('completed_jobs', 0),
            rating=row.get('rating', 5.0)
        )

    if DB_PROVIDER == 'memory':
        rows = _mem_read('technicians')
        new_t = {**technician.dict(), 'id': str(uuid.uuid4())}
        rows.append(new_t)
        _mem_write('technicians', rows)
        return Technician(**new_t)

    tech_dict = technician.dict()
    tech_dict['id'] = str(uuid.uuid4())
    await db.technicians.insert_one(tech_dict)
    return Technician(**tech_dict)

@api_router.get("/parts", response_model=List[Part])
async def get_parts(search: str = '', low_stock: bool = False):
    if DB_PROVIDER == 'supabase':
        try:
            rows = supabase_service.parts_list()
            result = []
            for r in rows:
                # filter in python since list is small/med
                p = Part(**r)
                if search and search.lower() not in str(p.dict()).lower():
                    continue
                if low_stock and p.quantity >= p.minQuantity:
                    continue
                result.append(p)
            return result
        except Exception as e:
            print(f"Supabase parts error: {e}")
            # Fallback to empty list if table missing or error
            return []

    if DB_PROVIDER == 'memory':
        parts = _mem_read('parts')
        result = []
        for p in parts:
            if search and search.lower() not in str(p).lower():
                continue
            if low_stock and p.get('quantity', 0) >= p.get('minQuantity', 0):
                continue
            result.append(Part(**p))
        return result
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'partNumber': {'$regex': search, '$options': 'i'}}
        ]
    if low_stock:
        query['$expr'] = {'$lt': ['$quantity', '$minQuantity']}
    parts = await db.parts.find(query, {"_id": 0}).to_list(1000)
    return [Part(**p) for p in parts]

@api_router.post("/parts", response_model=Part)
async def create_part(part: PartCreate):
    if DB_PROVIDER == 'supabase':
        p = supabase_service.parts_create(part.dict())
        return Part(**p)
    if DB_PROVIDER == 'memory':
        parts = _mem_read('parts')
        new_p = {**part.dict(), 'id': str(uuid.uuid4())}
        parts.append(new_p)
        _mem_write('parts', parts)
        return Part(**new_p)
    part_dict = part.dict()
    part_dict['id'] = str(uuid.uuid4())
    await db.parts.insert_one(part_dict)
    return Part(**part_dict)

@api_router.put("/parts/{part_id}", response_model=Part)
async def update_part(part_id: str, part: PartUpdate):
    upd = {k: v for k, v in part.dict().items() if v is not None}
    if DB_PROVIDER == 'supabase':
        p = supabase_service.parts_update(part_id, upd)
        return Part(**p)
    if DB_PROVIDER == 'memory':
        parts = _mem_read('parts')
        for i, p in enumerate(parts):
            if p.get('id') == part_id:
                parts[i].update(upd)
                _mem_write('parts', parts)
                return Part(**parts[i])
        raise HTTPException(status_code=404, detail="Part not found")
    await db.parts.update_one({"id": part_id}, {"$set": upd})
    p = await db.parts.find_one({"id": part_id})
    if not p: raise HTTPException(status_code=404, detail="Part not found")
    return Part(**p)

@api_router.delete("/parts/{part_id}")
async def delete_part(part_id: str):
    if DB_PROVIDER == 'supabase':
        supabase_service.parts_delete(part_id)
        return {"status": "success"}
    if DB_PROVIDER == 'memory':
        parts = _mem_read('parts')
        parts = [p for p in parts if p.get('id') != part_id]
        _mem_write('parts', parts)
        return {"status": "success"}
    await db.parts.delete_one({"id": part_id})
    return {"status": "success"}

@api_router.get("/stats")
async def get_stats():
    """Get dashboard statistics"""
    try:
        # Get current month data
        now = datetime.utcnow()
        first_day = datetime(now.year, now.month, 1)
        
        if DB_PROVIDER == 'supabase':
            # Get transactions for current month
            transactions = supabase_service.transactions_list()
            
            # Calculate monthly stats
            monthly_income = sum(t.get('amount', 0) for t in transactions 
                               if t.get('type') == 'income' and t.get('date', '').startswith(f"{now.year}-{now.month:02d}"))
            monthly_expenses = sum(t.get('amount', 0) for t in transactions 
                                 if t.get('type') == 'expense' and t.get('date', '').startswith(f"{now.year}-{now.month:02d}"))
            
            # Get vehicle stats
            vehicles = supabase_service.vehicles_list()
            active_vehicles = len([v for v in vehicles if v.get('status') not in ['delivered', 'cancelled']])
            
            # Get customer count
            customers = supabase_service.customers_list()
            
            return {
                "totalCustomers": len(customers),
                "activeVehicles": active_vehicles,
                "thisMonth": {
                    "income": monthly_income,
                    "expenses": monthly_expenses,
                    "profit": monthly_income - monthly_expenses
                },
                "lastMonth": {
                    "income": 0,
                    "expenses": 0,
                    "profit": 0
                }
            }
        
        if DB_PROVIDER == 'memory':
            vehicles = _mem_read('vehicles')
            customers = _mem_read('customers')
            
            return {
                "totalCustomers": len(customers),
                "activeVehicles": len([v for v in vehicles if v.get('status') not in ['delivered', 'cancelled']]),
                "thisMonth": {
                    "income": 0,
                    "expenses": 0,
                    "profit": 0
                },
                "lastMonth": {
                    "income": 0,
                    "expenses": 0,
                    "profit": 0
                }
            }
        
        # MongoDB implementation
        vehicles = await db.vehicles.count_documents({"status": {"$nin": ["delivered", "cancelled"]}})
        customers = await db.customers.count_documents({})
        
        # Get transactions for this month
        transactions = await db.transactions.find({
            "date": {"$gte": first_day}
        }).to_list(10000)
        
        monthly_income = sum(t.get('amount', 0) for t in transactions if t.get('type') == 'income')
        monthly_expenses = sum(t.get('amount', 0) for t in transactions if t.get('type') == 'expense')
        
        return {
            "totalCustomers": customers,
            "activeVehicles": vehicles,
            "thisMonth": {
                "income": monthly_income,
                "expenses": monthly_expenses,
                "profit": monthly_income - monthly_expenses
            },
            "lastMonth": {
                "income": 0,
                "expenses": 0,
                "profit": 0
            }
        }
    except Exception as e:
        print(f"Stats error: {e}")
        # Return default stats on error
        return {
            "totalCustomers": 0,
            "activeVehicles": 0,
            "thisMonth": {
                "income": 0,
                "expenses": 0,
                "profit": 0
            },
            "lastMonth": {
                "income": 0,
                "expenses": 0,
                "profit": 0
            }
        }

@api_router.get("/business-accounts")
async def get_business_accounts():
    if DB_PROVIDER == 'supabase':
        rows = supabase_service.business_accounts_list()
        return rows
    if DB_PROVIDER == 'memory':
        return _mem_read('business_accounts')
    accounts = await db.business_accounts.find({}, {"_id": 0}).to_list(1000)
    return accounts

@api_router.post("/business-accounts")
async def create_business_account(account: dict):
    if DB_PROVIDER == 'supabase':
        acc = supabase_service.business_accounts_create(account)
        return acc
    if DB_PROVIDER == 'memory':
        accounts = _mem_read('business_accounts')
        new_acc = {**account, 'id': str(uuid.uuid4())}
        accounts.append(new_acc)
        _mem_write('business_accounts', accounts)
        return new_acc
    account['id'] = str(uuid.uuid4())
    await db.business_accounts.insert_one(account)
    return account

@api_router.get("/salaries")
async def get_salaries():
    """Get all salaries"""
    if DB_PROVIDER == 'supabase':
        # Return empty list for now - payroll feature needs completion
        try:
            res = supabase_service.client.table('salaries').select('*').execute()
            return res.data or []
        except:
            return []
    
    if DB_PROVIDER == 'memory':
        return []
    
    # MongoDB
    try:
        salaries = await db.salaries.find({}, {"_id": 0}).to_list(1000)
        return salaries
    except Exception as e:
        print(f"Salaries error: {e}")
        return []

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
