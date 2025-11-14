"""
Supabase Service for Workshop Management System
Handles Supabase database interactions
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️ supabase not installed")

class SupabaseService:
    """Service for Supabase database operations"""
    
    def __init__(self):
        """Initialize Supabase client"""
        self.supabase_url = os.environ.get('SUPABASE_URL', '')
        self.supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
        
        if self.supabase_url and self.supabase_key and SUPABASE_AVAILABLE:
            self.client: Client = create_client(self.supabase_url, self.supabase_key)
            self.mock_mode = False
        else:
            self.client = None
            self.mock_mode = True
            print("⚠️ Supabase running in MOCK mode. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable.")
    
    # -------------------- Vehicles (existing) --------------------
    def get_vehicles(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return self._get_mock_vehicles()
        try:
            response = self.client.table('vehicles').select('*').execute()
            return response.data or []
        except Exception as e:
            print(f"Supabase vehicles error: {e}")
            return []
    
    def create_vehicle(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return {"id": f"mock-{datetime.now().timestamp()}", **data, "status": "mocked"}
        try:
            response = self.client.table('vehicles').insert(data).execute()
            return (response.data or [{}])[0]
        except Exception as e:
            print(f"Supabase create_vehicle error: {e}")
            raise
    
    def get_analytics(self) -> Dict[str, Any]:
        if self.mock_mode:
            return {"total_vehicles": 5, "completed_today": 3, "revenue_today": 1500.00, "pending_appointments": 2, "mode": "mock"}
        try:
            # Example: count vehicles
            res = self.client.rpc('count_table', {"tbl": "vehicles"}).execute() if hasattr(self.client, 'rpc') else None
            total = 0
            if res and isinstance(res.data, dict) and 'count' in res.data:
                total = res.data['count']
            return {"total_vehicles": total, "mode": "live"}
        except Exception as e:
            return {"error": str(e)}
    
    # -------------------- Users --------------------
    def users_list(self) -> List[Dict[str, Any]]:
        if self.mock_mode:
            # minimal mock
            return [{"id": "mock-user", "name": "مدير", "phone": "", "email": None, "role": "admin", "permissions": {}, "isActive": True, "createdAt": datetime.utcnow().isoformat()}]
        try:
            res = self.client.table('users').select('*').order('created_at', desc=True).execute()
            rows = res.data or []
            # map fields to backend model naming
            out = []
            for r in rows:
                out.append({
                    'id': r.get('id'),
                    'name': r.get('name'),
                    'email': r.get('email'),
                    'phone': r.get('phone'),
                    'role': r.get('role') or 'employee',
                    'permissions': r.get('permissions') or {},
                    'isActive': r.get('is_active', True),
                    'createdAt': r.get('created_at'),
                    'lastLogin': r.get('last_login'),
                })
            return out
        except Exception as e:
            print(f"Supabase users_list error: {e}")
            raise
    
    def users_create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return {**data, 'id': f"mock-{datetime.utcnow().timestamp()}", 'createdAt': datetime.utcnow().isoformat()}
        try:
            row = {
                'id': data.get('id'),
                'name': data.get('name'),
                'email': data.get('email'),
                'phone': data.get('phone'),
                'role': data.get('role') or 'employee',
                'permissions': data.get('permissions') or {},
                'is_active': data.get('isActive', True),
                'created_at': data.get('createdAt') or datetime.utcnow().isoformat(),
                'last_login': data.get('lastLogin'),
            }
            resp = self.client.table('users').insert(row).execute()
            r = (resp.data or [{}])[0]
            return {
                'id': r.get('id'),
                'name': r.get('name'),
                'email': r.get('email'),
                'phone': r.get('phone'),
                'role': r.get('role'),
                'permissions': r.get('permissions') or {},
                'isActive': r.get('is_active', True),
                'createdAt': r.get('created_at'),
                'lastLogin': r.get('last_login'),
            }
        except Exception as e:
            print(f"Supabase users_create error: {e}")
            raise
    
    def users_update(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock_mode:
            return {**data, 'id': user_id}
        try:
            upd = {}
            if 'name' in data: upd['name'] = data['name']
            if 'email' in data: upd['email'] = data['email']
            if 'phone' in data: upd['phone'] = data['phone']
            if 'role' in data: upd['role'] = data['role']
            if 'permissions' in data: upd['permissions'] = data['permissions']
            if 'isActive' in data: upd['is_active'] = data['isActive']
            if 'lastLogin' in data: upd['last_login'] = data['lastLogin']
            resp = self.client.table('users').update(upd).eq('id', user_id).execute()
            r = (resp.data or [{}])[0]
            return {
                'id': r.get('id'),
                'name': r.get('name'),
                'email': r.get('email'),
                'phone': r.get('phone'),
                'role': r.get('role'),
                'permissions': r.get('permissions') or {},
                'isActive': r.get('is_active', True),
                'createdAt': r.get('created_at'),
                'lastLogin': r.get('last_login'),
            }
        except Exception as e:
            print(f"Supabase users_update error: {e}")
            raise
    
    def users_delete(self, user_id: str) -> bool:
        if self.mock_mode:
            return True
        try:
            self.client.table('users').delete().eq('id', user_id).execute()
            return True
        except Exception as e:
            print(f"Supabase users_delete error: {e}")
            raise

    # -------------------- Mock helpers --------------------
    def _get_mock_vehicles(self) -> List[Dict[str, Any]]:
        return [
            {"id": "mock-v1", "plateNumber": "س ع د 1234", "make": "تويوتا", "model": "كامري", "year": 2020, "customerName": "أحمد محمد"},
            {"id": "mock-v2", "plateNumber": "أ ب ج 5678", "make": "هيونداي", "model": "سوناتا", "year": 2021, "customerName": "فاطمة علي"},
        ]
