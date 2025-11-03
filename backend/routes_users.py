from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List, Optional
import uuid

from models_users import User, UserCreate, UserUpdate, UserPermissions

router = APIRouter(prefix="/api")
db = None

def set_db(database):
    global db
    db = database

# ------------------ USERS MANAGEMENT ------------------
@router.get('/users', response_model=List[User])
async def get_users():
    """Get all users"""
    try:
        users = await db.users.find({}).to_list(length=1000)
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
        # Check if phone already exists
        existing = await db.users.find_one({'phone': user_data.phone})
        if existing:
            raise HTTPException(status_code=400, detail='رقم الهاتف مسجل مسبقاً')
        
        user_dict = user_data.dict()
        user_dict['id'] = str(uuid.uuid4())
        user_dict['createdAt'] = datetime.utcnow()
        user_dict['lastLogin'] = None
        user_dict['isActive'] = True
        
        # Set default permissions if not provided
        if 'permissions' not in user_dict or user_dict['permissions'] is None:
            user_dict['permissions'] = UserPermissions().dict()
        
        await db.users.insert_one(user_dict)
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
        user = await db.users.find_one({'id': user_id})
        if not user:
            raise HTTPException(status_code=404, detail='المستخدم غير موجود')
        
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        
        if update_dict:
            # If permissions is being updated, convert to dict
            if 'permissions' in update_dict and isinstance(update_dict['permissions'], UserPermissions):
                update_dict['permissions'] = update_dict['permissions'].dict()
            
            await db.users.update_one({'id': user_id}, {'$set': update_dict})
            user = await db.users.find_one({'id': user_id})
        
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
        result = await db.users.delete_one({'id': user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='المستخدم غير موجود')
        return {'status': 'ok', 'message': 'تم حذف المستخدم'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
