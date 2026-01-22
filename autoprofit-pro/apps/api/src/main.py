from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
import logging
from contextlib import asynccontextmanager
from redis import asyncio as aioredis
from datetime import datetime

from .core.config import settings
from .core.database import engine, SessionLocal
from .core.security import create_access_token, verify_password
from .models import Base
from .api.v1.endpoints import auth, users, accounts, transactions, customers, inventory, payroll, workshop
from .api.v1.endpoints.accounting import chart_of_accounts, journal_entries, reports
from .services.websocket import ws_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("autoprofit.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting AutoProfit Pro API...")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    
    # Initialize Redis connection
    app.state.redis = await aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )
    
    # Initialize WebSocket manager
    app.state.ws_manager = ws_manager
    
    logger.info("AutoProfit Pro API started successfully")
    
    yield
    
    # Shutdown
    await app.state.redis.close()
    logger.info("AutoProfit Pro API shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="AutoProfit Pro API",
    description="Financial Management System for Car Workshops",
    version="2.0.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["customers"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["inventory"])
app.include_router(payroll.router, prefix="/api/v1/payroll", tags=["payroll"])
app.include_router(workshop.router, prefix="/api/v1", tags=["workshop"])
app.include_router(chart_of_accounts.router, prefix="/api/v1/accounting", tags=["accounting"])
app.include_router(journal_entries.router, prefix="/api/v1/accounting", tags=["accounting-journals"])
app.include_router(reports.router, prefix="/api/v1/accounting", tags=["accounting-reports"])

# Health check endpoint (root-level)
@app.get("/health")
async def health_check_root():
    return {
        "status": "healthy",
        "service": "autoprofit-api",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

# Health check endpoint (API-style)
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "autoprofit-api",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to AutoProfit Pro API",
        "version": "2.0.0",
        "docs": "/api/docs",
        "health": "/health"
    }

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    await ws_manager.connect(websocket, token)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle WebSocket messages
            await ws_manager.broadcast(data)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, token)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
