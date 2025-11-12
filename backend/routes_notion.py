"""
Notion API Routes for Workshop Management
Exposes Notion knowledge base through FastAPI
"""

from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, EmailStr
from notion_service import NotionService

router = APIRouter(prefix='/notion', tags=['notion'])

# Initialize Notion service
notion_service = NotionService()

# Pydantic models
class CustomerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    company: str = ""
    notes: str = ""

class CustomerResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    company: str = ""
    notes: str = ""

# Endpoints
@router.get('/customers')
async def get_customers():
    """Get all customers from Notion"""
    try:
        customers = notion_service.get_customers()
        return {
            "customers": customers,
            "count": len(customers),
            "mode": "mock" if notion_service.mock_mode else "live"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/customers')
async def create_customer(customer: CustomerCreate):
    """Create new customer in Notion"""
    try:
        result = notion_service.create_customer(
            name=customer.name,
            email=customer.email,
            phone=customer.phone,
            company=customer.company,
            notes=customer.notes
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/procedures')
async def get_procedures(category: Optional[str] = None):
    """Get workshop procedures from Notion"""
    try:
        procedures = notion_service.get_procedures(category)
        return {
            "procedures": procedures,
            "count": len(procedures),
            "category": category,
            "mode": "mock" if notion_service.mock_mode else "live"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/status')
async def get_notion_status():
    """Get Notion integration status"""
    return {
        "connected": not notion_service.mock_mode,
        "mode": "mock" if notion_service.mock_mode else "live",
        "databases": {
            "customers": bool(notion_service.customers_db),
            "procedures": bool(notion_service.procedures_db),
            "appointments": bool(notion_service.appointments_db)
        }
    }

@router.get('/mcp/status')
async def get_mcp_status():
    """Get MCP server status"""
    return {
        "mcp_server": "available",
        "tools": [
            "get_customers",
            "search_customer",
            "get_procedures",
            "create_customer",
            "get_workshop_stats"
        ],
        "description": "Workshop MCP Server exposes workshop knowledge to AI agents",
        "command": "python workshop_mcp_server.py"
    }
