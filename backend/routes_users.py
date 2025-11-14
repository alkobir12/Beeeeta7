from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List, Optional
import uuid
import os

from models_users import User, UserCreate, UserUpdate, UserPermissions
from supabase_service import SupabaseService

router = APIRouter(prefix="/api")

# Toggle provider via env (supabase/mongo)
DB_PROVIDER = os.environ.get('DB_PROVIDER', 'mongo').lower()

# For Mongo (legacy) set_db remains available, but for Supabase we use service
_db = None
supabase = SupabaseService()

def set_db(database):
    global _db
    _db = database

# ------------------ USERS MANAGEMENT ------------------
@router.get('/users', response_model=List[User])
async def get_users():
    """Get all users"""
    try:
        if DB_PROVIDER == 'supabase' and not supabase.mock_mode:
            rows = supabase.users_list()
            return [User(**r) for r in rows]
        # fallback to Mongo
        users = await _db.users.find({}).to_list(length=1000)
        result = []
        for u in users:
            u.pop('_id', None)
            result.append(User(**u))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/users', response_model=User)
async def create_user(user_data: UserCreate):
    """Create new user"""
    try:
        if DB_PROVIDER == 'supabase' and not supabase.mock_mode:
            payload = user_data.dict()
            payload['id'] = str(uuid.uuid4())
            payload['createdAt'] = datetime.utcnow().isoformat()
            created = supabase.users_create(payload)
            return User(**created)
        # Mongo path
        existing = await _db.users.find_one({'phone': user_data.phone})
        if existing:
            raise HTTPException(status_code=400, detail='رقم الهاتف مسجل مسبقاً')
        user_dict = user_data.dict()
        user_dict['id'] = str(uuid.uuid4())
        user_dict['createdAt'] = datetime.utcnow()
        user_dict['lastLogin'] = None
        user_dict['isActive'] = True
        if 'permissions' not in user_dict or user_dict['permissions'] is None:
            user_dict['permissions'] = UserPermissions().dict()
        await _db.users.insert_one(user_dict)
        user_dict.pop('_id', None)
        return User(**user_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/users/{user_id}', response_model=User)
async def update_user(user_id: str, update_data: UserUpdate):
    """Update user"""
    try:
        if DB_PROVIDER == 'supabase' and not supabase.mock_mode:
            updated = supabase.users_update(user_id, {k: v for k, v in update_data.dict().items() if v is not None})
            return User(**updated)
        # Mongo fallback
        user = await _db.users.find_one({'id': user_id})
        if not user:
            raise HTTPException(status_code=404, detail='المستخدم غير موجود')
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        if update_dict:
            if 'permissions' in update_dict and isinstance(update_dict['permissions'], UserPermissions):
                update_dict['permissions'] = update_dict['permissions'].dict()
            await _db.users.update_one({'id': user_id}, {'$set': update_dict})
            user = await _db.users.find_one({'id': user_id})
        user.pop('_id', None)
        return User(**user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete('/users/{user_id}')
async def delete_user(user_id: str):
    """Delete user"""
    try:
        if DB_PROVIDER == 'supabase' and not supabase.mock_mode:
            supabase.users_delete(user_id)
            return {'status': 'ok', 'message': 'تم حذف المستخدم'}
        result = await _db.users.delete_one({'id': user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='المستخدم غير موجود')
        return {'status': 'ok', 'message': 'تم حذف المستخدم'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
