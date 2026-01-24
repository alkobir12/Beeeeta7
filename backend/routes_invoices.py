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
    """إنشاء فاتورة جديدة في Supabase"""
    try:
        if supabase_service.mock_mode:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        payload = {
            "invoiceNumber": invoice.get("invoiceNumber"),
            "customerId": invoice.get("customerId"),
            "vehicleId": invoice.get("vehicleId"),
            "customerName": invoice.get("customerName"),
            "plateNumber": invoice.get("plateNumber"),
            "items": invoice.get("items", []),
            "subtotal": invoice.get("subtotal", 0),
            "discount": invoice.get("discount", 0),
            "tax": invoice.get("tax", 0),
            "total": invoice.get("total", 0),
            "status": invoice.get("status", "pending"),
            "type": invoice.get("type", "sale"),
            "paymentMethod": invoice.get("paymentMethod"),
            "notes": invoice.get("notes"),
        }

        created = supabase_service.invoices_create(payload)
        print(f"✅ تم إنشاء فاتورة في Supabase: {created.get('id')}")

        # توحيد الشكل للواجهة الأمامية
        response_data = {
            "id": created.get("id"),
            "invoice_number": created.get("invoiceNumber") or str(created.get("id"))[:8],
            "customer_id": created.get("customerId"),
            "customer_name": created.get("customerName") or "",
            "vehicle_id": created.get("vehicleId"),
            "plate_number": created.get("plateNumber", ""),
            "items": created.get("items") or [],
            "subtotal": float(created.get("subtotal") or 0),
            "tax": float(created.get("tax") or 0),
            "total": float(created.get("total") or 0),
            "status": created.get("status") or "pending",
            "type": created.get("type") or "sale",
            "date": created.get("date") or created.get("createdAt"),
            "created_at": created.get("createdAt"),
        }

        return {"success": True, "id": response_data["id"], "data": response_data}

    except Exception as e:
        print(f"Error creating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{invoice_id}")
async def update_invoice(invoice_id: str, invoice: dict):
    """تحديث فاتورة في Supabase (المجاميع / الحالة)"""
    try:
        if supabase_service.mock_mode:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # جلب الفاتورة الحالية
        existing = supabase_service.invoices_get(invoice_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # نبني Payload للتحديث (نرسل فقط الحقول المطلوبة)
        update_payload = {
            "id": invoice_id,
            "invoiceNumber": invoice.get("invoiceNumber", existing.get("invoiceNumber")),
            "customerId": invoice.get("customerId", existing.get("customerId")),
            "vehicleId": invoice.get("vehicleId", existing.get("vehicleId")),
            "customerName": invoice.get("customerName", existing.get("customerName")),
            "plateNumber": invoice.get("plateNumber", getattr(existing, "plateNumber", None)),
            "items": invoice.get("items", existing.get("items")),
            "subtotal": invoice.get("subtotal", existing.get("subtotal")),
            "discount": invoice.get("discount", existing.get("discount")),
            "tax": invoice.get("tax", existing.get("tax")),
            "total": invoice.get("total", existing.get("total")),
            "status": invoice.get("status", existing.get("status")),
            "type": invoice.get("type", existing.get("type")),
            "paymentMethod": invoice.get("paymentMethod", existing.get("paymentMethod")),
            "notes": invoice.get("notes", existing.get("notes")),
        }

        # نستخدم invoices_create مع id لتعمل كـ upsert بسيط
        updated = supabase_service.invoices_create(update_payload)

        response_data = {
            "id": updated.get("id"),
            "invoice_number": updated.get("invoiceNumber") or str(updated.get("id"))[:8],
            "customer_id": updated.get("customerId"),
            "customer_name": updated.get("customerName") or "",
            "vehicle_id": updated.get("vehicleId"),
            "plate_number": updated.get("plateNumber", ""),
            "items": updated.get("items") or [],
            "subtotal": float(updated.get("subtotal") or 0),
            "tax": float(updated.get("tax") or 0),
            "total": float(updated.get("total") or 0),
            "status": updated.get("status") or "pending",
            "type": updated.get("type") or "sale",
            "date": updated.get("date") or updated.get("createdAt"),
            "created_at": updated.get("createdAt"),
        }

        return {"success": True, "data": response_data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str):
    """جلب فاتورة واحدة من Supabase"""
    try:
        if supabase_service.mock_mode:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        inv = supabase_service.invoices_get(invoice_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        return {
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
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# DB compatibility (not used)
db = None
def set_db(database):
    global db
    db = database
