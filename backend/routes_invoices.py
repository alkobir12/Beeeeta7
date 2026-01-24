from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import List, Optional
import uuid
import json
from pathlib import Path

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

# مسار تخزين الفواتير محلياً (مؤقت)
INVOICES_DIR = Path("/app/backend/uploads/invoices")
INVOICES_DIR.mkdir(exist_ok=True, parents=True)

def save_invoice(invoice):
    """حفظ فاتورة في ملف JSON"""
    file_path = INVOICES_DIR / f"{invoice['id']}.json"
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(invoice, f, ensure_ascii=False, indent=2, default=str)
    return invoice

def load_invoices():
    """تحميل جميع الفواتير"""
    invoices = []
    for file_path in INVOICES_DIR.glob("*.json"):
        with open(file_path, 'r', encoding='utf-8') as f:
            invoices.append(json.load(f))
    return invoices


def delete_invoices_by_vehicle_id(vehicle_id: str):
    """حذف جميع الفواتير المرتبطة بمركبة معيّنة (للاستخدام عند حذف المركبة)."""
    try:
      if not vehicle_id:
          return 0
      deleted = 0
      for file_path in list(INVOICES_DIR.glob("*.json")):
          try:
              with open(file_path, 'r', encoding='utf-8') as f:
                  data = json.load(f)
              if data.get('vehicleId') == vehicle_id or data.get('vehicle_id') == vehicle_id:
                  file_path.unlink(missing_ok=True)
                  deleted += 1
          except Exception:
              # نتجاهل أي ملف تالف ولا نمنع بقية العملية
              continue
      print(f"🧹 Deleted {deleted} invoice file(s) for vehicle {vehicle_id}")
      return deleted
    except Exception as e:
      print(f"Error deleting invoices for vehicle {vehicle_id}: {e}")
      return 0

@router.get("")
async def get_invoices(
    vehicleId: Optional[str] = Query(None),
    customerId: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """جلب الفواتير"""
    try:
        invoices = load_invoices()
        
        # فلترة
        if vehicleId:
            invoices = [inv for inv in invoices if inv.get('vehicleId') == vehicleId or inv.get('vehicle_id') == vehicleId]
        if customerId:
            invoices = [inv for inv in invoices if inv.get('customerId') == customerId]
        if status:
            invoices = [inv for inv in invoices if inv.get('status') == status]
        
        return invoices
        
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
