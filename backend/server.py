# MongoDB connection (used when DB_PROVIDER is 'mongo')
# In 'memory' or 'supabase' modes, some endpoints will avoid using Mongo.
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url) if mongo_url else None

# Important: DB name must be provided explicitly via environment in deployment
# to avoid accidentally pointing to a wrong or non-existent database.
db_name = os.environ.get('DB_NAME') if client is not None else None
db = client[db_name] if (client is not None and db_name) else None

# Set database for extended and advanced routes
set_db_users(db)
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
app = FastAPI(title="Workshop Management API")

# Include Routers
app.include_router(users_router)
app.include_router(injectors_router)
app.include_router(import_router)
