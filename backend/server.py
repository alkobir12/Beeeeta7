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
# Import User Routes
from routes_users import router as users_router, set_db as set_db_users

from routes_import import router as import_router, set_db as set_db_import
# Import Injector Routes
from routes_injectors import router as injectors_router, set_db as set_db_injectors


from supabase_service import SupabaseService
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


# Provider mode
DB_PROVIDER = os.environ.get('DB_PROVIDER', 'mongo').lower()

# Simple file-based storage for memory mode
import json
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
# In 'memory' or 'supabase' modes, some endpoints will avoid using Mongo.
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url) if mongo_url else None

# Important: DB name must be provided explicitly via environment in deployment
# to avoid accidentally pointing to a wrong or non-existent database.
set_db_users(db)
db_name = os.environ.get('DB_NAME') if client is not None else None
db = client[db_name] if (client is not None and db_name) else None

# Set database for extended and advanced routes
set_db_import(db)
set_db_injectors(db)
set_db_extended(db)
set_db_advanced(db)

# Initialize WhatsApp service (optional) — using whatsapp_service.py if configured
try:
    from whatsapp_service import WhatsAppService
    whatsapp_svc = WhatsAppService(db)
    print(f"✅ WhatsApp Service initialized - Mode: {'Twilio' if whatsapp_svc.twilio_enabled else 'Deeplink'}")
except Exception as e:
    print(f"⚠️  WhatsApp Service initialization warning: {e}")

# Create upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app.include_router(injectors_router)
app = FastAPI(title="Workshop Management API")
app.include_router(import_router)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ Invoice Studio Integration ============
try:
    # تحديد مسار مجلد استوديو الفواتير
    static_path = ROOT_DIR.parent / "frontend" / "public" / "invoice-studio"
    
    if static_path.exists():
        # تركيب المجلد كملفات ثابتة على الرابط /invoice-studio
        app.mount("/invoice-studio", StaticFiles(directory=str(static_path), html=True), name="invoice-studio")
        print(f"✅ Invoice Studio mounted successfully at /invoice-studio")
    else:
        print(f"⚠️ Warning: Invoice Studio path not found at {static_path}")
except Exception as e:
    print(f"❌ Error mounting Invoice Studio: {e}")

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        cust = supa.customers_find_by_phone(phone)
        if cust:
            return cust['id']
        new_cust = supa.customers_create({
            'name': name,
            'phone': phone,
            'email': email,
            'totalVisits': 1,
            'lastVisit': datetime.utcnow().isoformat()
        })
        return new_cust['id']

    if DB_PROVIDER == 'memory':
        rows = _mem_read('customers')
        for r in rows:
            if r.get('phone') == phone:
                return r['id']
        
        new_c = {
            'id': str(uuid.uuid4()),
            'name': name,
            'phone': phone,
            'email': email,
            'totalVisits': 1,
            'lastVisit': datetime.utcnow().isoformat(),
            'createdAt': datetime.utcnow().isoformat(),
            'vehicles': []
        }
        rows.append(new_c)
        _mem_write('customers', rows)
        return new_c['id']

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
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            customer_id = await get_or_create_customer(
                vehicle_data.customerName,
                vehicle_data.customerPhone,
                vehicle_data.customerEmail
            )
            
            v_dict = vehicle_data.dict()
            v_dict['customerId'] = customer_id
            v_dict['trackingLink'] = generate_tracking_link()
            v_dict['estimatedCompletion'] = (datetime.utcnow() + timedelta(days=2)).isoformat()
            v_dict['entryDate'] = datetime.utcnow().isoformat()
            
            new_vehicle = supa.vehicles_create(v_dict)
            
            # Update customer visits
            cust = supa.customers_get(customer_id)
            if cust:
                vehicles = cust.get('vehicles', [])
                if new_vehicle['plateNumber'] not in vehicles:
                    vehicles.append(new_vehicle['plateNumber'])
                supa.customers_update(customer_id, {
                    'totalVisits': (cust.get('totalVisits', 0) + 1),
                    'lastVisit': datetime.utcnow().isoformat(),
                    'vehicles': vehicles
                })
            return Vehicle(**new_vehicle)

        if DB_PROVIDER == 'memory':
            customer_id = await get_or_create_customer(
                vehicle_data.customerName,
                vehicle_data.customerPhone,
                vehicle_data.customerEmail
            )
            
            rows = _mem_read('vehicles')
            doc = Vehicle(**{
                **vehicle_data.dict(),
                'id': str(uuid.uuid4()),
                'customerId': customer_id,
                'trackingLink': f"TRK-{str(uuid.uuid4())[:8].upper()}",
                'estimatedCompletion': datetime.utcnow() + timedelta(days=2),
                'entryDate': datetime.utcnow()
            }).dict()
            
            # Convert datetime objects to ISO strings for JSON serialization
            if 'estimatedCompletion' in doc and isinstance(doc['estimatedCompletion'], datetime):
                doc['estimatedCompletion'] = doc['estimatedCompletion'].isoformat()
            if 'entryDate' in doc and isinstance(doc['entryDate'], datetime):
                doc['entryDate'] = doc['entryDate'].isoformat()
            rows.append(doc)
            _mem_write('vehicles', rows)
            
            # Update customer visits (memory)
            crows = _mem_read('customers')
            for i, c in enumerate(crows):
                if c.get('id') == customer_id:
                    c['totalVisits'] = c.get('totalVisits', 0) + 1
                    c['lastVisit'] = datetime.utcnow().isoformat()
                    vehs = c.get('vehicles', [])
                    if doc['plateNumber'] not in vehs:
                        vehs.append(doc['plateNumber'])
                    c['vehicles'] = vehs
                    crows[i] = c
                    _mem_write('customers', crows)
                    break
            
            return Vehicle(**doc)

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
        
        # ✅ AUTO-SYNC to Notion/Supabase
        try:
            from auto_sync_service import AutoSyncService
            sync = AutoSyncService(db)
            sync_result = await sync.save_vehicle(vehicle.dict())
            logger.info(f"✅ Auto-sync result: {sync_result}")
        except Exception as sync_err:
            logger.warning(f"⚠️ Auto-sync failed (non-critical): {sync_err}")
        
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
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            vehs = supa.vehicles_list()
            if status:
                vehs = [v for v in vehs if v.get('status') == status]
            if search:
                s = search.lower()
                vehs = [v for v in vehs if (s in (v.get('plateNumber') or '').lower() or s in (v.get('customerName') or '').lower())]
            return [Vehicle(**v) for v in vehs]

        if DB_PROVIDER == 'memory':
            rows = _mem_read('vehicles')
            if status:
                rows = [r for r in rows if r.get('status') == status]
            if search:
                s = search.lower()
                rows = [r for r in rows if (s in (r.get('plateNumber') or '').lower() or s in (r.get('customerName') or '').lower())]
            return [Vehicle(**r) for r in rows]

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        v = supa.vehicles_get(vehicle_id)
        if not v:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return Vehicle(**v)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        for r in rows:
            if r.get('id') == vehicle_id:
                return Vehicle(**r)
        raise HTTPException(status_code=404, detail="Vehicle not found")

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        upd = update_data.dict(exclude_unset=True)
        v = supa.vehicles_update(vehicle_id, upd)
        if not v:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return Vehicle(**v)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('vehicles')
        for i, r in enumerate(rows):
            if r.get('id') == vehicle_id:
                upd = {k: v for k, v in update_data.dict().items() if v is not None}
                # handle date serialization
                if 'estimatedCompletion' in upd and isinstance(upd['estimatedCompletion'], datetime):
                    upd['estimatedCompletion'] = upd['estimatedCompletion'].isoformat()
                if 'completionDate' in upd and isinstance(upd['completionDate'], datetime):
                    upd['completionDate'] = upd['completionDate'].isoformat()
                
                rows[i] = {**r, **upd}
                _mem_write('vehicles', rows)
                return Vehicle(**rows[i])
        raise HTTPException(status_code=404, detail="Vehicle not found")

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
                        # Get app URL from environment or use backend URL
                        app_url = os.getenv('APP_URL') or os.getenv('REACT_APP_BACKEND_URL')
                        app_url = app_url.replace('/api', '')  # Remove /api if present
                        approval_link = f"{app_url}/approval/{token}"
                        # Prepare notification
                        await db.whatsapp_messages.insert_one({
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
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            supa.invoices_delete_by_vehicle(vehicle_id)
            res = supa.vehicles_delete(vehicle_id)
            if not res:
                raise HTTPException(status_code=404, detail="Vehicle not found")
            return {"message": "Vehicle deleted successfully", "deleted_id": vehicle_id}

        if DB_PROVIDER == 'memory':
            rows = _mem_read('vehicles')
            nrows = [r for r in rows if r.get('id') != vehicle_id]
            if len(nrows) == len(rows):
                raise HTTPException(status_code=404, detail="Vehicle not found")
            _mem_write('vehicles', nrows)
            # delete invoices too
            irows = _mem_read('invoices')
            nirows = [r for r in irows if r.get('vehicleId') != vehicle_id]
            _mem_write('invoices', nirows)
            return {"message": "Vehicle deleted successfully", "deleted_id": vehicle_id}

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
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            c_dict = customer.dict()
            c_dict['id'] = str(uuid.uuid4())
            c_dict['createdAt'] = datetime.utcnow().isoformat()
            c_dict['totalVisits'] = 0
            c_dict['lastVisit'] = None
            new_c = supa.customers_create(c_dict)
            return Customer(**new_c)

        if DB_PROVIDER == 'memory':
            rows = _mem_read('customers')
            doc = customer.dict()
            doc['id'] = str(uuid.uuid4())
            doc['createdAt'] = datetime.utcnow().isoformat()
            doc['totalVisits'] = 0
            doc['lastVisit'] = None
            rows.append(doc)
            _mem_write('customers', rows)
            return Customer(**doc)

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
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            custs = supa.customers_list(search=search)
            return [Customer(**c) for c in custs]

        if DB_PROVIDER == 'memory':
            rows = _mem_read('customers')
            if search:
                s = search.lower()
                rows = [r for r in rows if (s in (r.get('name') or '').lower() or s in (r.get('phone') or '').lower())]
            return [Customer(**r) for r in rows]

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        c = supa.customers_get(customer_id)
        if not c:
            raise HTTPException(status_code=404, detail="Customer not found")
        return Customer(**c)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('customers')
        for r in rows:
            if r.get('id') == customer_id:
                return Customer(**r)
        raise HTTPException(status_code=404, detail="Customer not found")

    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**customer)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, update_data: CustomerBase):
    """Update customer information"""
    try:
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            upd = update_data.dict(exclude_unset=True)
            c = supa.customers_update(customer_id, upd)
            if not c:
                raise HTTPException(status_code=404, detail="Customer not found")
            return Customer(**c)

        if DB_PROVIDER == 'memory':
            rows = _mem_read('customers')
            for i, r in enumerate(rows):
                if r.get('id') == customer_id:
                    upd = {k: v for k, v in update_data.dict().items() if v is not None}
                    rows[i] = {**r, **upd}
                    _mem_write('customers', rows)
                    return Customer(**rows[i])
            raise HTTPException(status_code=404, detail="Customer not found")

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        # Need to implement history fetch in SupabaseService or do multiple calls
        # For now, just return empty or basic
        cust = supa.customers_get(customer_id)
        if not cust: raise HTTPException(status_code=404, detail="Customer not found")
        # vehicles
        vehs = supa.vehicles_list()
        vehs = [v for v in vehs if v.get('customerId') == customer_id]
        # invoices
        invs = supa.invoices_list(customer_id=customer_id)
        return {
            "vehicles": [Vehicle(**v) for v in vehs],
            "invoices": [Invoice(**i) for i in invs]
        }

    if DB_PROVIDER == 'memory':
        vrows = _mem_read('vehicles')
        irows = _mem_read('invoices')
        vehs = [v for v in vrows if v.get('customerId') == customer_id]
        invs = [i for i in irows if i.get('customerId') == customer_id]
        return {
            "vehicles": [Vehicle(**v) for v in vehs],
            "invoices": [Invoice(**i) for i in invs]
        }

    vehicles = await db.vehicles.find({"customerId": customer_id}).sort("entryDate", -1).to_list(1000)
    invoices = await db.invoices.find({"customerId": customer_id}).sort("createdAt", -1).to_list(1000)
    
    return {
        "vehicles": [Vehicle(**v) for v in vehicles],
        "invoices": [Invoice(**i) for i in invoices]
    }

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    try:
        if DB_PROVIDER == 'supabase':
            supa = SupabaseService()
            res = supa.customers_delete(customer_id)
            if not res:
                raise HTTPException(status_code=404, detail="Customer not found")
            return {"message": "Customer deleted successfully"}

        if DB_PROVIDER == 'memory':
            rows = _mem_read('customers')
            nrows = [r for r in rows if r.get('id') != customer_id]
            if len(nrows) == len(rows):
                raise HTTPException(status_code=404, detail="Customer not found")
            _mem_write('customers', nrows)
            # delete related vehicles, invoices
            vrows = _mem_read('vehicles')
            nvrows = [r for r in vrows if r.get('customerId') != customer_id]
            _mem_write('vehicles', nvrows)
            irows = _mem_read('invoices')
            nirows = [r for r in irows if r.get('customerId') != customer_id]
            _mem_write('invoices', nirows)
            return {"message": "Customer deleted successfully"}

        result = await db.customers.delete_one({"id": customer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {"message": "Customer deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if DB_PROVIDER == 'memory':
    # ============ Service APIs (Memory) ============
    @api_router.get("/services", response_model=List[Service])
    async def get_services_mem():
        rows = _mem_read('services')
        return [Service(**{
            'id': r.get('id'),
            'name': r.get('name'),
            'category': r.get('category'),
            'price': r.get('price', 0),
            'duration': r.get('duration', 0),
            'active': r.get('active', True)
        }) for r in rows]

    @api_router.post("/services", response_model=Service)
    async def create_service_mem(service: Service):
        rows = _mem_read('services')
        doc = service.dict()
        rows.append(doc)
        _mem_write('services', rows)
        return service

    @api_router.put("/services/{service_id}", response_model=Service)
    async def update_service_mem(service_id: str, payload: dict):
        rows = _mem_read('services')
        for i, r in enumerate(rows):
            if r.get('id') == service_id:
                rows[i] = {**r, **payload}
                _mem_write('services', rows)
                return Service(**rows[i])
        raise HTTPException(status_code=404, detail="Service not found")

    @api_router.delete("/services/{service_id}")
    async def delete_service_mem(service_id: str):
        rows = _mem_read('services')
        nrows = [r for r in rows if r.get('id') != service_id]
        if len(nrows) == len(rows):
            raise HTTPException(status_code=404, detail="Service not found")
        _mem_write('services', nrows)
        return {"message": "deleted"}

    # ============ Parts APIs (Memory) ============
    @api_router.get("/parts", response_model=List[Part])
    async def get_parts_mem():
        rows = _mem_read('parts')
        return [Part(**r) for r in rows]

    @api_router.post("/parts", response_model=Part)
    async def create_part_mem(part_data: PartCreate):
        rows = _mem_read('parts')
        doc = Part(**part_data.dict()).dict()
        rows.append(doc)
        _mem_write('parts', rows)
        return Part(**doc)

    @api_router.put("/parts/{part_id}", response_model=Part)
    async def update_part_mem(part_id: str, update_data: PartUpdate):
        rows = _mem_read('parts')
        for i, r in enumerate(rows):
            if r.get('id') == part_id:
                upd = {k: v for k, v in update_data.dict().items() if v is not None}
                rows[i] = {**r, **upd}
                _mem_write('parts', rows)
                return Part(**rows[i])
        raise HTTPException(status_code=404, detail="Part not found")

    @api_router.delete("/parts/{part_id}")
    async def delete_part_mem(part_id: str):
        rows = _mem_read('parts')
        nrows = [r for r in rows if r.get('id') != part_id]
        if len(nrows) == len(rows):
            raise HTTPException(status_code=404, detail="Part not found")
        _mem_write('parts', nrows)
        return {"message": "Part deleted successfully"}

    # ============ Vehicles APIs (Memory) ============
    @api_router.get("/vehicles", response_model=List[Vehicle])
    async def get_vehicles_mem():
        rows = _mem_read('vehicles')
        return [Vehicle(**r) for r in rows]

    @api_router.post("/vehicles", response_model=Vehicle)
    async def create_vehicle_mem(vehicle_data: VehicleCreate):
        rows = _mem_read('vehicles')
        doc = Vehicle(**{
            **vehicle_data.dict(),
            'id': str(uuid.uuid4()),
            'trackingLink': f"TRK-{str(uuid.uuid4())[:8].upper()}",
            'estimatedCompletion': datetime.utcnow() + timedelta(days=2)
        }).dict()
        rows.append(doc)
        _mem_write('vehicles', rows)
        return Vehicle(**doc)

    @api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
    async def update_vehicle_mem(vehicle_id: str, update_data: VehicleUpdate):
        rows = _mem_read('vehicles')
        for i, r in enumerate(rows):
            if r.get('id') == vehicle_id:
                upd = {k: v for k, v in update_data.dict().items() if v is not None}
                rows[i] = {**r, **upd}
                _mem_write('vehicles', rows)
                return Vehicle(**rows[i])
        raise HTTPException(status_code=404, detail="Vehicle not found")

    @api_router.delete("/vehicles/{vehicle_id}")
    async def delete_vehicle_mem(vehicle_id: str):
        rows = _mem_read('vehicles')
        nrows = [r for r in rows if r.get('id') != vehicle_id]
        if len(nrows) == len(rows):
            raise HTTPException(status_code=404, detail="Vehicle not found")
        _mem_write('vehicles', nrows)
        return {"message": "Vehicle deleted"}

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        techs = supa.technicians_list()
        return [Technician(**t) for t in techs]

    if DB_PROVIDER == 'memory':
        rows = _mem_read('technicians')
        return [Technician(**r) for r in rows]
    technicians = await db.technicians.find().to_list(1000)
    return [Technician(**t) for t in technicians]

@api_router.get("/technicians/{tech_id}", response_model=Technician)
async def get_technician(tech_id: str):
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        techs = supa.technicians_list()
        for t in techs:
            if t.get('id') == tech_id: return Technician(**t)
        raise HTTPException(status_code=404, detail="Technician not found")

    if DB_PROVIDER == 'memory':
        rows = _mem_read('technicians')
        for r in rows:
            if r.get('id') == tech_id:
                return Technician(**r)
        raise HTTPException(status_code=404, detail="Technician not found")
    tech = await db.technicians.find_one({"id": tech_id})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return Technician(**tech)

# ============ Service APIs ============

# ============ Memory Provider: Business Accounts, Budgets, Operations ============
if DB_PROVIDER == 'memory':
    # Business Accounts
    @api_router.get('/biz-accounts')
    async def mem_biz_accounts_list():
        rows = _mem_read('accounts')
        return rows

    @api_router.post('/biz-accounts')
    async def mem_biz_accounts_create(payload: dict):
        rows = _mem_read('accounts')
        doc = {
            'id': str(uuid.uuid4()),
            'name': payload.get('name') or f'فرع {len(rows)+1}',
            'code': payload.get('code') or f'BR{len(rows)+1:02d}',
            'currency': payload.get('currency') or 'SAR',
            'createdAt': datetime.utcnow().isoformat()
        }
        rows.append(doc)
        _mem_write('accounts', rows)
        return doc

    @api_router.post('/biz-accounts/cleanup')
    async def mem_biz_accounts_cleanup(keep: int = 2, mode: str = 'hard'):
        rows = sorted(_mem_read('accounts'), key=lambda r: r.get('createdAt',''), reverse=True)
        kept = rows[:keep]
        _mem_write('accounts', kept)
        return {'status':'ok','final': kept}

    # Budgets
    @api_router.get('/budgets')
    async def mem_budgets_list(account_id: str | None = None, period: str | None = None):
        rows = _mem_read('budgets')
        out = [r for r in rows if (not account_id or r.get('accountId')==account_id) and (not period or r.get('period')==period)]
        return out

    @api_router.post('/budgets')
    async def mem_budgets_create(payload: dict):
        rows = _mem_read('budgets')
        doc = {
            'id': str(uuid.uuid4()),
            'accountId': payload.get('accountId'),
            'period': payload.get('period'),
            'incomeTarget': payload.get('incomeTarget', 0),
            'expenseTarget': payload.get('expenseTarget', 0),
            'notes': payload.get('notes')
        }
        rows.append(doc)
        _mem_write('budgets', rows)
        return doc

    # Operations
    @api_router.get('/operations')
    async def mem_operations_list():
        rows = _mem_read('operations')
        return rows

    @api_router.post('/operations')
    async def mem_operations_create(payload: dict):
        rows = _mem_read('operations')
        items = payload.get('items') or []
        subtotal = sum((it.get('price',0)*it.get('qty',1)) for it in items)
        total = subtotal
        doc = {
            'id': str(uuid.uuid4()),
            'type': payload.get('type','service'),
            'accountId': payload.get('accountId'),
            'vehicleId': payload.get('vehicleId'),
            'partnerType': payload.get('partnerType'),
            'partnerName': payload.get('partnerName'),
            'items': items,
            'subtotal': subtotal,
            'total': total,
            'paymentMethod': payload.get('paymentMethod','cash'),
            'notes': payload.get('notes'),
            'opDate': datetime.utcnow().isoformat()
        }
        rows.append(doc)
        _mem_write('operations', rows)
        return doc

    @api_router.get('/operations/pending')
    async def mem_operations_pending():
        vrows = _mem_read('vehicles')
        pending = [v for v in vrows if v.get('status') in ['diagnosis','quotation','repair']]
        return {'count': len(pending), 'items': pending}

    @api_router.get('/operations/analytics/pending')
    async def mem_operations_pending_analytics():
        vrows = _mem_read('vehicles')
        by = {'diagnosis':0,'quotation':0,'repair':0}
        for v in vrows:
            st = v.get('status')
            if st in by:
                by[st]+=1
        total = sum(by.values())
        return {'total': total, 'byStatus': by, 'overdue': 0}

async def get_services():
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        srvs = supa.services_list()
        return [Service(**s) for s in srvs]

    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        return [Service(**{
            'id': r.get('id'),
            'name': r.get('name'),
            'category': r.get('category'),
            'price': r.get('price', 0),
            'duration': r.get('duration', 0),
            'active': r.get('active', True)
        }) for r in rows]
    services = await db.services.find().to_list(1000)
    return [Service(**s) for s in services]

@api_router.post("/services", response_model=Service)
async def create_service(service: Service):
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        new_s = supa.services_create(service.dict())
        return Service(**new_s)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        doc = service.dict()
        rows.append(doc)
        _mem_write('services', rows)
        return service
    await db.services.insert_one(service.dict())
    return service

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, payload: dict):
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        upd_s = supa.services_update(service_id, payload)
        return Service(**upd_s)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        for i, r in enumerate(rows):
            if r.get('id') == service_id:
                rows[i] = {**r, **payload}
                _mem_write('services', rows)
                return Service(**rows[i])
        raise HTTPException(status_code=404, detail="Service not found")
    update = {k: v for k, v in payload.items() if v is not None}
    await db.services.update_one({"id": service_id}, {"$set": update})
    doc = await db.services.find_one({"id": service_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Service not found")
    return Service(**doc)

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        supa.services_delete(service_id)
        return {"message": "deleted"}

    if DB_PROVIDER == 'memory':
        rows = _mem_read('services')
        nrows = [r for r in rows if r.get('id') != service_id]
        if len(nrows) == len(rows):
            raise HTTPException(status_code=404, detail="Service not found")
        _mem_write('services', nrows)
        return {"message": "deleted"}
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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        inv_dict = invoice_data.dict()
        inv_dict['invoiceNumber'] = generate_invoice_number()
        
        # Create transaction
        if invoice_data.type == "service":
            supa.transactions_create({
                'type': "income",
                'category': "service",
                'amount': invoice_data.total,
                'description': f"Invoice {inv_dict['invoiceNumber']}",
                'paymentMethod': invoice_data.paymentMethod,
                'reference': inv_dict['invoiceNumber']
            })
        
        new_inv = supa.invoices_create(inv_dict)
        return Invoice(**new_inv)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('invoices')
        doc = invoice_data.dict()
        doc['invoiceNumber'] = generate_invoice_number()
        rows.append(doc)
        _mem_write('invoices', rows)
        
        # update parts (memory)
        prows = _mem_read('parts')
        for item in invoice_data.items:
            if item.type == "part":
                for i, p in enumerate(prows):
                    if p.get('id') == item.itemId:
                        p['quantity'] = p.get('quantity', 0) - item.quantity
                        prows[i] = p
                        break
        _mem_write('parts', prows)
        
        # create transaction (memory)
        if invoice_data.type == "service":
            trows = _mem_read('transactions')
            tx = {
                'id': str(uuid.uuid4()),
                'type': "income",
                'category': "service",
                'amount': invoice_data.total,
                'description': f"Invoice {doc['invoiceNumber']}",
                'paymentMethod': invoice_data.paymentMethod,
                'reference': doc['invoiceNumber'],
                'date': datetime.utcnow().isoformat(),
                'createdAt': datetime.utcnow().isoformat()
            }
            trows.append(tx)
            _mem_write('transactions', trows)
            
        return Invoice(**doc)

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        invs = supa.invoices_list(vehicle_id=vehicle_id, customer_id=customer_id)
        return [Invoice(**i) for i in invs]

    if DB_PROVIDER == 'memory':
        rows = _mem_read('invoices')
        if vehicle_id:
            rows = [r for r in rows if r.get('vehicleId') == vehicle_id]
        if customer_id:
            rows = [r for r in rows if r.get('customerId') == customer_id]
        return [Invoice(**r) for r in rows]

    query = {}
    if vehicle_id:
        query["vehicleId"] = vehicle_id
    if customer_id:
        query["customerId"] = customer_id
    
    invoices = await db.invoices.find(query).sort("createdAt", -1).to_list(1000)
    return [Invoice(**i) for i in invoices]

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        inv = supa.invoices_get(invoice_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return Invoice(**inv)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('invoices')
        for r in rows:
            if r.get('id') == invoice_id:
                return Invoice(**r)
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**invoice)

# ============ Transaction APIs ============
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate):
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        new_t = supa.transactions_create(transaction_data.dict())
        return Transaction(**new_t)

    if DB_PROVIDER == 'memory':
        rows = _mem_read('transactions')
        doc = transaction_data.dict()
        doc['id'] = str(uuid.uuid4())
        doc['createdAt'] = datetime.utcnow().isoformat()
        rows.append(doc)
        _mem_write('transactions', rows)
        return Transaction(**doc)

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
    if DB_PROVIDER == 'supabase':
        supa = SupabaseService()
        txs = supa.transactions_list(type=type, account_id=account_id)
        # filter by date in python
        if start_date and end_date:
            try:
                sd = datetime.fromisoformat(start_date)
                ed = datetime.fromisoformat(end_date)
                txs = [t for t in txs if t.get('date') and sd <= datetime.fromisoformat(t['date'].replace('Z','+00:00').split('+')[0].replace('T',' ')) <= ed]
            except: pass
        
        income = sum(t["amount"] for t in txs if t["type"] == "income")
        expenses = sum(t["amount"] for t in txs if t["type"] == "expense")
        return {
            "transactions": [Transaction(**t) for t in txs],
            "summary": {"income": income, "expenses": expenses, "profit": income - expenses}
        }

    if DB_PROVIDER == 'memory':
        rows = _mem_read('transactions')
        if type:
            rows = [r for r in rows if r.get('type') == type]
        if account_id:
            rows = [r for r in rows if r.get('accountId') == account_id]
        if start_date and end_date:
            try:
                sd = datetime.fromisoformat(start_date)
                ed = datetime.fromisoformat(end_date)
                rows = [r for r in rows if r.get('date') and sd <= datetime.fromisoformat(r['date'].replace('Z','+00:00').split('+')[0].replace('T',' ')) <= ed]
            except: pass
        
        income = sum(r["amount"] for r in rows if r["type"] == "income")
        expenses = sum(r["amount"] for r in rows if r["type"] == "expense")
        return {
            "transactions": [Transaction(**r) for r in rows],
            "summary": {"income": income, "expenses": expenses, "profit": income - expenses}
        }

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

# ============ Groq AI Chat (Global Assistant) ============
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
GROQ_API_BASE_URL = os.environ.get('GROQ_API_BASE_URL', 'https://api.groq.com/openai/v1')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'llama-3.3-70b-versatile')

async def call_groq_chat(message: str, system_prompt: Optional[str] = None) -> dict:
    """Call Groq chat completion API and return basic response dict.

    This is used by the floating assistant that appears on all pages.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured on the server")

    url = f"{GROQ_API_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    messages_payload = []
    if system_prompt:
        messages_payload.append({"role": "system", "content": system_prompt})
    messages_payload.append({"role": "user", "content": message})

    payload = {
        "model": GROQ_MODEL,
        "messages": messages_payload,
        "temperature": 0.6,
        "max_tokens": 512,
        "top_p": 1.0,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.error(f"Groq API error: {e}")
        raise HTTPException(status_code=502, detail="Groq API request failed")

    try:
        choice = (data.get("choices") or [{}])[0]
        content = choice.get("message", {}).get("content") or ""
        usage = data.get("usage") or {}
        return {
            "content": content,
            "model": data.get("model", GROQ_MODEL),
            "tokens": usage.get("total_tokens", 0),
        }
    except Exception as e:
        logger.error(f"Groq API response parse error: {e} | raw={data}")
        raise HTTPException(status_code=500, detail="Failed to parse Groq API response")


async def build_workshop_context() -> str:
    """Build a small textual snapshot from workshop data (vehicles, customers, etc.).

    This links the Groq assistant to live workshop data so it can answer
    questions about current status (counts, ready vehicles, etc.).
    """
    try:
        total_vehicles = await db.vehicles.count_documents({})
        ready = await db.vehicles.count_documents({"status": "ready"})
        in_progress = await db.vehicles.count_documents({"status": {"$ne": "ready"}})
        total_customers = await db.customers.count_documents({})

        recent = await db.vehicles.find().sort("entryDate", -1).to_list(5)
        lines = [
            "Current workshop snapshot:",
            f"- Total vehicles: {total_vehicles}",
            f"- Ready vehicles: {ready}",
            f"- In-progress vehicles: {in_progress}",
            f"- Total customers: {total_customers}",
        ]
        if recent:
            lines.append("- Recent vehicles:")
            for v in recent:
                plate = v.get("plateNumber", "?")
                status = v.get("status", "unknown")
                brand = v.get("brand", "")
                model = v.get("model", "")
                lines.append(f"  • {plate} | {brand} {model} | status: {status}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"Failed to build workshop context for Groq assistant: {e}")
        return ""

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.error(f"Groq API error: {e}")
        raise HTTPException(status_code=502, detail="Groq API request failed")

    try:
        choice = (data.get("choices") or [{}])[0]
        content = choice.get("message", {}).get("content") or ""
        usage = data.get("usage") or {}
        return {
            "content": content,
            "model": data.get("model", GROQ_MODEL),
            "tokens": usage.get("total_tokens", 0),
        }
    except Exception as e:
        logger.error(f"Groq API response parse error: {e} | raw={data}")
        raise HTTPException(status_code=500, detail="Failed to parse Groq API response")


@api_router.post("/ai/groq-chat", response_model=ChatResponse)
async def groq_chat_endpoint(chat_request: ChatRequest):
    """Groq-backed assistant endpoint linked to workshop data.

    Uses a small live snapshot from MongoDB (vehicles/customers) as context
    so the model can answer questions about the workshop status.
    """
    context = await build_workshop_context()
    user_text = chat_request.message or ""

    # Build a multi-lingual system prompt with workshop snapshot
    system_prompt = (
        "You are an intelligent assistant for an auto workshop management system. "
        "Answer succinctly and professionally. If the user writes in Arabic, respond in Arabic; "
        "if in English, respond in English. Use the workshop snapshot below whenever helpful.\n\n"
        f"Workshop snapshot (for your reference):\n{context}"
    )

    result = await call_groq_chat(
        user_text,
        system_prompt=system_prompt,
    )
    return ChatResponse(response=result["content"], sessionId=chat_request.sessionId or None)

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
        
        # Ensure we have a key
        if not llm_key:
             # Fallback mock response if no key
             return ChatResponse(response="عذراً، لم يتم تكوين مفتاح الذكاء الاصطناعي. يرجى التحقق من الإعدادات.", sessionId=session_id)

        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=enhanced_prompt
        ).with_model("anthropic", "claude-sonnet-4.5-20250929")
        
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
        ).with_model("anthropic", "claude-sonnet-4.5-20250929")
        
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

# ============ i18n (Language Resources) APIs ============
@api_router.get("/i18n/resources")
async def get_i18n_resources(lang: Optional[str] = None):
    try:
        if lang:
            doc = await db.i18n.find_one({"lang": lang})
            return {"lang": lang, "resources": (doc.get("resources") if doc else {})}
        # return all languages
        docs = await db.i18n.find().to_list(100)
        return {d.get("lang"): d.get("resources", {}) for d in docs}
    except Exception as e:
        logger.error(f"Error fetching i18n resources: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/i18n/resources")
async def save_i18n_resources(payload: dict):
    try:
        lang = payload.get("lang")
        resources = payload.get("resources")
        if not lang or resources is None:
            raise HTTPException(status_code=400, detail="lang and resources required")
        await db.i18n.update_one({"lang": lang}, {"$set": {"resources": resources}}, upsert=True)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving i18n resources: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

# Import and include Maintenance router
try:
    from routes_maintenance import router as maint_router, set_db as set_maint_db
    set_maint_db(db)
    app.include_router(maint_router)
    logger.info("✅ Maintenance router loaded")
except Exception as e:
    logger.warning(f"⚠️ Maintenance router not loaded: {e}")

# Import and include Payroll router
try:
    from routes_payroll import router as payroll_router, set_db as set_payroll_db
    set_payroll_db(db)
    app.include_router(payroll_router)
    logger.info("✅ Payroll router loaded")
except Exception as e:
    logger.warning(f"⚠️ Payroll router not loaded: {e}")

# Import and include Notion MCP router
try:
    from routes_notion import router as notion_router
    app.include_router(notion_router, prefix='/api')
    logger.info("✅ Notion MCP router loaded")
except Exception as e:
    logger.warning(f"⚠️ Notion MCP router not loaded: {e}")

# Import and include Supabase router
try:
    from routes_supabase import router as supabase_router
    app.include_router(supabase_router, prefix='/api')
    logger.info("✅ Supabase router loaded")
except Exception as e:
    logger.warning(f"⚠️ Supabase router not loaded: {e}")

# Import and include Arabic Quotation router
try:
    quotation_router = APIRouter(prefix="/api")
    create_quotation_routes(quotation_router)
    app.include_router(quotation_router)
    logger.info("✅ Arabic Quotation router loaded")
except Exception as e:
    logger.warning(f"⚠️ Arabic Quotation router not loaded: {e}")

# Import and include Unified Document router
try:
    document_router = APIRouter(prefix="/api")
    create_unified_document_routes(document_router)
    app.include_router(document_router)
    logger.info("✅ Unified Document router loaded")
except Exception as e:
    logger.warning(f"⚠️ Unified Document router not loaded: {e}")

# Import and include Workshop AI (CarWorkshopAI) router
try:
    from routes_workshop_ai import router as workshop_ai_router
    app.include_router(workshop_ai_router)
    logger.info("✅ Workshop AI router loaded")
except Exception as e:
    logger.warning(f"⚠️ Workshop AI router not loaded: {e}")

# Auto-Sync Status endpoint
@app.get('/api/sync/status')
async def get_sync_status():
    """الحصول على حالة المزامنة التلقائية"""
    try:
        from auto_sync_service import AutoSyncService
        sync = AutoSyncService(db)
        return sync.get_sync_status()
    except Exception as e:
        return {"error": str(e), "mongodb": "active"}

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
