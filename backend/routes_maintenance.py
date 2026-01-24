from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import datetime
import uuid

router = APIRouter(prefix="/api")
db = None


def set_db(database):
    global db
    db = database


@router.post("/maintenance-orders")
async def create_maintenance_order(payload: Dict[str, Any]):
    """إنشاء طلب صيانة جديد"""
    try:
        order = {
            "id": str(uuid.uuid4()),
            "vehicleId": payload.get("vehicleId"),
            "customerId": payload.get("customerId"),
            "technicianId": payload.get("technicianId"),
            "services": payload.get("services", []),
            "technicianStatus": "pending",
            "managerApproval": "pending",
            "clientApproval": "pending",
            "completionDate": None,
            "approvalNotes": "",
            "workDetails": "",
            "estimatedCost": float(payload.get("estimatedCost", 0)),
            "actualCost": 0.0,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        await db.maintenance_orders.insert_one(order)
        order.pop("_id", None)
        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/maintenance-orders/{order_id}/technician-complete")
async def technician_complete_work(order_id: str, payload: Dict[str, Any]):
    """الفني ينهي العمل ويطلب اعتماد المدير"""
    try:
        work_details = payload.get("workDetails", "")
        actual_cost = float(payload.get("actualCost", 0))
        payload.get("images", [])

        update = {
            "technicianStatus": "completed",
            "workDetails": work_details,
            "actualCost": actual_cost,
            "completionDate": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        await db.maintenance_orders.update_one({"id": order_id}, {"$set": update})

        # Get order
        order = await db.maintenance_orders.find_one({"id": order_id})
        order.pop("_id", None)

        return {
            "status": "ok",
            "message": "تم إنهاء العمل. في انتظار اعتماد المدير.",
            "order": order,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/maintenance-orders/{order_id}/manager-approve")
async def manager_approve(order_id: str, payload: Dict[str, Any]):
    """المدير يعتمد أو يرفض"""
    try:
        approval = payload.get("approval", "approved")  # approved, rejected
        notes = payload.get("notes", "")

        update = {
            "managerApproval": approval,
            "approvalNotes": notes,
            "updatedAt": datetime.utcnow(),
        }

        await db.maintenance_orders.update_one({"id": order_id}, {"$set": update})

        order = await db.maintenance_orders.find_one({"id": order_id})
        order.pop("_id", None)

        return {
            "status": "ok",
            "message": f"تم {approval}. سيتم إرسال للعميل للاعتماد النهائي.",
            "order": order,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/maintenance-orders/{order_id}/client-approve")
async def client_approve(order_id: str, payload: Dict[str, Any]):
    """العميل يعتمد نهائياً"""
    try:
        approval = payload.get("approval", "approved")

        update = {"clientApproval": approval, "updatedAt": datetime.utcnow()}

        await db.maintenance_orders.update_one({"id": order_id}, {"$set": update})

        order = await db.maintenance_orders.find_one({"id": order_id})
        order.pop("_id", None)

        return {
            "status": "ok",
            "message": f"تم الاعتماد النهائي من العميل: {approval}",
            "order": order,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maintenance-orders")
async def get_maintenance_orders(technician_id: str = None, status: str = None):
    """الحصول على طلبات الصيانة"""
    try:
        query = {}
        if technician_id:
            query["technicianId"] = technician_id
        if status:
            query["technicianStatus"] = status

        orders = (
            await db.maintenance_orders.find(query)
            .sort("createdAt", -1)
            .to_list(length=100)
        )

        for order in orders:
            order.pop("_id", None)
            if order.get("createdAt"):
                order["createdAt"] = order["createdAt"].isoformat()
            if order.get("updatedAt"):
                order["updatedAt"] = order["updatedAt"].isoformat()
            if order.get("completionDate") and order["completionDate"]:
                order["completionDate"] = order["completionDate"].isoformat()

        return {"orders": orders, "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
