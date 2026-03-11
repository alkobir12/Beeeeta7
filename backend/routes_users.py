from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List
import uuid
import os
import json

from models_users import User, UserCreate, UserUpdate
from supabase_service import SupabaseService

router = APIRouter(prefix="/api")

DB_PROVIDER = os.environ.get("DB_PROVIDER", "mongo").lower()
USERS_FILE = os.path.join(os.path.dirname(__file__), "uploads", "users.json")

supabase = SupabaseService()
_db = None


def _normalize_permissions(raw_permissions):
    if not isinstance(raw_permissions, dict):
        return {}

    if not any(key.startswith("can") for key in raw_permissions.keys()):
        return raw_permissions

    normalized = {}

    def enable(module_key, actions):
        if module_key not in normalized:
            normalized[module_key] = {}
        for action in actions:
            normalized[module_key][action] = True

    if raw_permissions.get("canViewDashboard"):
        enable("dashboard", ["view"])
    if raw_permissions.get("canManageVehicles"):
        enable("vehicles", ["view", "create", "edit", "delete"])
    if raw_permissions.get("canManageCustomers"):
        enable("customers", ["view", "create", "edit", "delete"])
    if raw_permissions.get("canManageParts"):
        enable("inventory", ["view", "create", "edit", "delete"])
    if raw_permissions.get("canManageServices"):
        enable("work_orders", ["view", "create", "edit", "delete"])
    if raw_permissions.get("canViewReports"):
        enable("reports", ["view"])
    if raw_permissions.get("canManageFinance"):
        enable("debts", ["view", "settle"])
        enable("invoices", ["view", "create", "edit", "delete"])
    if raw_permissions.get("canManageUsers"):
        enable("users", ["view", "create", "edit", "delete"])
    if raw_permissions.get("canManageSettings"):
        enable("settings", ["view", "edit"])

    return normalized


def set_db(database):
    global _db
    _db = database


# ---------- helpers for memory provider ----------
def _ensure_users_file():
    os.makedirs(os.path.join(os.path.dirname(__file__), "uploads"), exist_ok=True)
    if not os.path.exists(USERS_FILE):
        seed = [
            {
                "id": str(uuid.uuid4()),
                "name": "مدير",
                "email": None,
                "phone": "0500000000",
                "role": "admin",
                "permissions": {},
                "isActive": True,
                "guidanceEnabled": True,
                "createdAt": datetime.utcnow().isoformat(),
                "lastLogin": None,
            }
        ]
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(seed, f, ensure_ascii=False, indent=2)


def _read_users() -> List[dict]:
    _ensure_users_file()
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
            for user in users:
                if user.get("guidanceEnabled") is None:
                    user["guidanceEnabled"] = True
            return users
    except Exception:
        return []


def _write_users(users: List[dict]):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


# ------------------ USERS MANAGEMENT ------------------
@router.get("/users", response_model=List[User])
async def get_users():
    try:
        if DB_PROVIDER == "supabase" and not supabase.mock_mode:
            rows = supabase.users_list()
            return [User(**r) for r in rows]
        if DB_PROVIDER == "memory":
            rows = _read_users()
            return [User(**r) for r in rows]
        # Mongo fallback
        users = await _db.users.find({}).to_list(length=1000)
        out = []
        for u in users:
            u.pop("_id", None)
            out.append(User(**u))
        return out
    except Exception:
        # Fallback to memory on any error (e.g., Mongo down)
        rows = _read_users()
        return [User(**r) for r in rows]


@router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    try:
        if DB_PROVIDER == "supabase" and not supabase.mock_mode:
            payload = user_data.dict()
            payload["id"] = str(uuid.uuid4())
            payload["createdAt"] = datetime.utcnow().isoformat()
            created = supabase.users_create(payload)
            return User(**created)
        if DB_PROVIDER == "memory":
            users = _read_users()
            if any(
                (u.get("phone") == user_data.phone and user_data.phone) for u in users
            ):
                raise HTTPException(status_code=400, detail="رقم الهاتف مسجل مسبقاً")
            doc = user_data.dict()
            doc["id"] = str(uuid.uuid4())
            doc["createdAt"] = datetime.utcnow().isoformat()
            doc["lastLogin"] = None
            doc["isActive"] = True
            if not doc.get("permissions"):
                doc["permissions"] = {}
            users.append(doc)
            _write_users(users)
            return User(**doc)
        # Mongo
        existing = await _db.users.find_one({"phone": user_data.phone})
        if existing:
            raise HTTPException(status_code=400, detail="رقم الهاتف مسجل مسبقاً")
        user_dict = user_data.dict()
        user_dict["id"] = str(uuid.uuid4())
        user_dict["createdAt"] = datetime.utcnow()
        user_dict["lastLogin"] = None
        user_dict["isActive"] = True
        if not user_dict.get("permissions"):
            user_dict["permissions"] = {}
        await _db.users.insert_one(user_dict)
        user_dict.pop("_id", None)
        return User(**user_dict)
    except HTTPException:
        raise
    except Exception:
        # fallback to memory
        users = _read_users()
        doc = user_data.dict()
        doc["id"] = str(uuid.uuid4())
        doc["createdAt"] = datetime.utcnow().isoformat()
        doc["lastLogin"] = None
        doc["isActive"] = True
        if not doc.get("permissions"):
            doc["permissions"] = {}
        users.append(doc)
        _write_users(users)
        return User(**doc)


@router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, update_data: UserUpdate):
    try:
        if DB_PROVIDER == "supabase" and not supabase.mock_mode:
            updated = supabase.users_update(
                user_id, {k: v for k, v in update_data.dict().items() if v is not None}
            )
            return User(**updated)
        if DB_PROVIDER == "memory":
            users = _read_users()
            idx = next((i for i, u in enumerate(users) if u.get("id") == user_id), -1)
            if idx == -1:
                raise HTTPException(status_code=404, detail="المستخدم غير موجود")
            upd = {k: v for k, v in update_data.dict().items() if v is not None}
            users[idx].update(upd)
            _write_users(users)
            return User(**users[idx])
        # Mongo fallback
        user = await _db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        if update_dict:
            await _db.users.update_one({"id": user_id}, {"$set": update_dict})
            user = await _db.users.find_one({"id": user_id})
        user.pop("_id", None)
        return User(**user)
    except HTTPException:
        raise
    except Exception:
        # fallback to memory
        users = _read_users()
        idx = next((i for i, u in enumerate(users) if u.get("id") == user_id), -1)
        if idx == -1:
            raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        upd = {k: v for k, v in update_data.dict().items() if v is not None}
        users[idx].update(upd)
        _write_users(users)
        return User(**users[idx])


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    try:
        if DB_PROVIDER == "supabase" and not supabase.mock_mode:
            supabase.users_delete(user_id)
            return {"status": "ok", "message": "تم حذف المستخدم"}
        if DB_PROVIDER == "memory":
            users = _read_users()
            nusers = [u for u in users if u.get("id") != user_id]
            if len(nusers) == len(users):
                raise HTTPException(status_code=404, detail="المستخدم غير موجود")
            _write_users(nusers)
            return {"status": "ok", "message": "تم حذف المستخدم"}
        # Mongo
        result = await _db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        return {"status": "ok", "message": "تم حذف المستخدم"}
    except HTTPException:
        raise
    except Exception:
        # fallback to memory
        users = _read_users()
        nusers = [u for u in users if u.get("id") != user_id]
        if len(nusers) == len(users):
            raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        _write_users(nusers)
        return {"status": "ok", "message": "تم حذف المستخدم"}
