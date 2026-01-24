from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional
import uuid

from supabase_service import SupabaseService

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

# نعتمد الآن على جدول Supabase للفواتير بدلاً من نظام الملفات
supabase_service = SupabaseService()

def delete_invoices_by_vehicle_id(vehicle_id: str):
    """حذف جميع الفواتير المرتبطة بمركبة معيّنة من جدول Supabase (يُستخدم عند حذف المركبة)."""
    try:
        if not vehicle_id:
            return 0
        if supabase_service.mock_mode:
            return 0
        supabase_service.invoices_delete_by_vehicle(vehicle_id)
        print(f"🧹 Deleted invoices in Supabase for vehicle {vehicle_id}")
        return 1
    except Exception as e:
        print(f"Error deleting invoices for vehicle {vehicle_id}: {e}")
        return 0

@router.get("")
async def get_invoices(
    vehicleId: Optional[str] = Query(None),
    customerId: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """جلب الفواتير من جدول Supabase"""
    try:
        if supabase_service.mock_mode:
            return []

        invoices = supabase_service.invoices_list(vehicle_id=vehicleId, customer_id=customerId)

        # فلترة بالحالة على مستوى التطبيق
        if status:
            invoices = [inv for inv in invoices if inv.get('status') == status]

        # توحيد الحقول لتناسب الواجهة الأمامية
        normalized = []
        for inv in invoices:
            normalized.append({
                "id": inv.get("id"),
                "invoice_number": inv.get("invoiceNumber") or str(inv.get("id"))[:8],
                "customer_id": inv.get("customerId"),
                "customer_name": inv.get("customerName") or "",
                "vehicle_id": inv.get("vehicleId"),
                "plate_number": inv.get("plateNumber", ""),
                "items": inv.get("items") or [],
                "subtotal": float(inv.get("subtotal") or 0),
                "tax": float(inv.get("tax") or 0),
                "total": float(inv.get("total") or 0),
                "status": inv.get("status") or "pending",
                "type": inv.get("type") or "sale",
                "date": inv.get("date") or inv.get("createdAt"),
                "created_at": inv.get("createdAt"),
            })
        return normalized
    except Exception as e:
        print(f"Error fetching invoices: {e}")
        return []

@router.post("")
async def create_invoice(invoice: dict):
    """إنشاء فاتورة جديدة"""
    try:
        invoice_data = {
            "id": str(uuid.uuid4()),
            "vehicleId": invoice.get("vehicleId"),
            "vehicle_id": invoice.get("vehicleId"),
            "customerId": invoice.get("customerId"),
            "customerName": invoice.get("customerName"),
            "plateNumber": invoice.get("plateNumber"),
            "items": invoice.get("items", []),
            "subtotal": invoice.get("subtotal", 0),
            "tax": invoice.get("tax", 0),
            "total": invoice.get("total", 0),
            "status": invoice.get("status", "pending"),
            "date": invoice.get("date", datetime.now().isoformat()),
            "created_at": datetime.now().isoformat()
        }
        
        save_invoice(invoice_data)
        
        print(f"✅ تم إنشاء فاتورة: {invoice_data['id']}")
        
        return {"success": True, "id": invoice_data["id"], "data": invoice_data}
        
    except Exception as e:
        print(f"Error creating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{invoice_id}")
async def update_invoice(invoice_id: str, invoice: dict):
    """تحديث فاتورة (تقبل تحديث الحالة أيضًا)"""
    try:
        invoices = load_invoices()
        
        for inv in invoices:
            if inv['id'] == invoice_id:
                inv.update({
                    "items": invoice.get("items", inv.get("items")),
                    "subtotal": invoice.get("subtotal", inv.get("subtotal")),
                    "tax": invoice.get("tax", inv.get("tax")),
                    "total": invoice.get("total", inv.get("total")),
                    # تحديث حالة الفاتورة إذا أُرسلت (مثلاً عند التسليم أو الدفع)
                    "status": invoice.get("status", inv.get("status", "pending")),
                    "updated_at": datetime.now().isoformat()
                })
                save_invoice(inv)
                return {"success": True, "data": inv}
        
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    except Exception as e:
        print(f"Error updating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str):
    """جلب فاتورة واحدة"""
    try:
        invoices = load_invoices()
        
        for inv in invoices:
            if inv['id'] == invoice_id:
                return inv
        
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    except Exception as e:
        print(f"Error fetching invoice: {e}")
        raise HTTPException(status_code=404, detail="Invoice not found")

# DB compatibility (not used)
db = None
def set_db(database):
    global db
    db = database
