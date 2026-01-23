from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import List, Optional
import uuid

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

# DB will be set from server.py
db = None

def set_db(database):
    global db
    db = database

@router.get("")
async def get_invoices(
    vehicleId: Optional[str] = Query(None),
    customerId: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """
    جلب الفواتير مع فلترة اختيارية
    """
    try:
        # استخدام Supabase
        from supabase import create_client
        import os
        
        supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        )
        
        query = supabase.table("invoices").select("*")
        
        if vehicleId:
            query = query.eq("vehicle_id", vehicleId)
        if customerId:
            query = query.eq("customer_id", customerId)
        if status:
            query = query.eq("status", status)
        
        response = query.order("created_at", desc=True).execute()
        
        return response.data
        
    except Exception as e:
        print(f"Error fetching invoices: {e}")
        return []

@router.post("")
async def create_invoice(invoice: dict):
    """
    إنشاء فاتورة جديدة
    """
    try:
        from supabase import create_client
        import os
        
        supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        )
        
        invoice_data = {
            "id": str(uuid.uuid4()),
            "vehicle_id": invoice.get("vehicleId"),
            "customer_id": invoice.get("customerId"),
            "customer_name": invoice.get("customerName"),
            "plate_number": invoice.get("plateNumber"),
            "items": invoice.get("items", []),
            "subtotal": invoice.get("subtotal", 0),
            "tax": invoice.get("tax", 0),
            "total": invoice.get("total", 0),
            "status": invoice.get("status", "pending"),
            "date": invoice.get("date", datetime.now().isoformat()),
            "created_at": datetime.now().isoformat()
        }
        
        response = supabase.table("invoices").insert(invoice_data).execute()
        
        return {"success": True, "id": invoice_data["id"], "data": response.data}
        
    except Exception as e:
        print(f"Error creating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{invoice_id}")
async def update_invoice(invoice_id: str, invoice: dict):
    """
    تحديث فاتورة موجودة
    """
    try:
        from supabase import create_client
        import os
        
        supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        )
        
        invoice_data = {
            "items": invoice.get("items", []),
            "subtotal": invoice.get("subtotal", 0),
            "tax": invoice.get("tax", 0),
            "total": invoice.get("total", 0),
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase.table("invoices") \
            .update(invoice_data) \
            .eq("id", invoice_id) \
            .execute()
        
        return {"success": True, "data": response.data}
        
    except Exception as e:
        print(f"Error updating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str):
    """
    جلب فاتورة واحدة
    """
    try:
        from supabase import create_client
        import os
        
        supabase = create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        )
        
        response = supabase.table("invoices").select("*").eq("id", invoice_id).single().execute()
        
        return response.data
        
    except Exception as e:
        print(f"Error fetching invoice: {e}")
        raise HTTPException(status_code=404, detail="Invoice not found")
