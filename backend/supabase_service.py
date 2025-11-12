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
    
    def get_vehicles(self) -> List[Dict[str, Any]]:
        """Get all vehicles"""
        if self.mock_mode:
            return self._get_mock_vehicles()
        
        try:
            response = self.client.table('vehicles').select('*').execute()
            return response.data
        except Exception as e:
            print(f"Error: {e}")
            return []
    
    def create_vehicle(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new vehicle"""
        if self.mock_mode:
            return {
                "id": f"mock-{datetime.now().timestamp()}",
                **data,
                "status": "mocked"
            }
        
        try:
            response = self.client.table('vehicles').insert(data).execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            print(f"Error: {e}")
            raise
    
    def get_analytics(self) -> Dict[str, Any]:
        """Get workshop analytics"""
        if self.mock_mode:
            return {
                "total_vehicles": 5,
                "completed_today": 3,
                "revenue_today": 1500.00,
                "pending_appointments": 2,
                "mode": "mock"
            }
        
        try:
            vehicles = self.client.table('vehicles').select('count').execute()
            return {
                "total_vehicles": vehicles.count or 0,
                "mode": "live"
            }
        except Exception as e:
            return {"error": str(e)}
    
    def _get_mock_vehicles(self) -> List[Dict[str, Any]]:
        """Mock vehicle data"""
        return [
            {
                "id": "mock-v1",
                "plateNumber": "س ع د 1234",
                "make": "تويوتا",
                "model": "كامري",
                "year": 2020,
                "customerName": "أحمد محمد"
            },
            {
                "id": "mock-v2",
                "plateNumber": "أ ب ج 5678",
                "make": "هيونداي",
                "model": "سوناتا",
                "year": 2021,
                "customerName": "فاطمة علي"
            }
        ]
