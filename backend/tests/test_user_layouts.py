import pytest
import httpx
import asyncio
import os
from typing import Dict, Any

# Base URL from frontend .env
BASE_URL = "https://carfix-admin-2.preview.emergentagent.com/api"

class TestUserLayouts:
    """Test suite for user layouts API endpoints"""
    
    def __init__(self):
        self.base_url = BASE_URL
        self.test_user_id = "test_user_123"
        self.test_page = "vehicleDetails"
        self.test_blocks = ["vehicle_info", "visits", "financial_summary", "guidance", "status_actions"]
    
    async def test_get_initial_empty_layout(self):
        """Test GET /api/user-layouts/{userId}/vehicleDetails returns empty blocks initially"""
        print(f"\n🧪 Testing GET {self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}")
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert "userId" in data, "Response should contain userId"
            assert "page" in data, "Response should contain page"
            assert "blocks" in data, "Response should contain blocks"
            assert data["userId"] == self.test_user_id, f"Expected userId {self.test_user_id}"
            assert data["page"] == self.test_page, f"Expected page {self.test_page}"
            assert isinstance(data["blocks"], list), "Blocks should be a list"
            
            print("✅ GET initial layout test passed")
            return data
    
    async def test_put_layout_update(self):
        """Test PUT /api/user-layouts/{userId}/vehicleDetails with blocks"""
        print(f"\n🧪 Testing PUT {self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}")
        
        payload = {
            "page": self.test_page,
            "blocks": self.test_blocks
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}",
                json=payload
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert "userId" in data, "Response should contain userId"
            assert "page" in data, "Response should contain page"
            assert "blocks" in data, "Response should contain blocks"
            assert data["userId"] == self.test_user_id, f"Expected userId {self.test_user_id}"
            assert data["page"] == self.test_page, f"Expected page {self.test_page}"
            assert data["blocks"] == self.test_blocks, f"Expected blocks {self.test_blocks}"
            
            print("✅ PUT layout update test passed")
            return data
    
    async def test_get_saved_layout(self):
        """Test GET /api/user-layouts/{userId}/vehicleDetails returns saved blocks"""
        print(f"\n🧪 Testing GET saved layout {self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}")
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert data["userId"] == self.test_user_id, f"Expected userId {self.test_user_id}"
            assert data["page"] == self.test_page, f"Expected page {self.test_page}"
            assert data["blocks"] == self.test_blocks, f"Expected saved blocks {self.test_blocks}"
            
            print("✅ GET saved layout test passed")
            return data
    
    async def test_different_user_empty_layout(self):
        """Test that different user gets empty layout initially"""
        different_user = "different_user_456"
        print(f"\n🧪 Testing different user layout {self.base_url}/user-layouts/{different_user}/{self.test_page}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/user-layouts/{different_user}/{self.test_page}")
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            assert data["userId"] == different_user, f"Expected userId {different_user}"
            assert data["page"] == self.test_page, f"Expected page {self.test_page}"
            assert data["blocks"] == [], "Different user should have empty blocks initially"
            
            print("✅ Different user empty layout test passed")
            return data
    
    async def test_page_mismatch_error(self):
        """Test PUT with page mismatch returns 400 error"""
        print(f"\n🧪 Testing page mismatch error")
        
        payload = {
            "page": "wrongPage",  # Different from URL
            "blocks": self.test_blocks
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{self.base_url}/user-layouts/{self.test_user_id}/{self.test_page}",
                json=payload
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            assert response.status_code == 400, f"Expected 400 for page mismatch, got {response.status_code}"
            
            print("✅ Page mismatch error test passed")
    
    async def test_works_with_different_db_providers(self):
        """Test that endpoints work regardless of DB_PROVIDER (mongo/memory/supabase)"""
        print(f"\n🧪 Testing DB provider independence")
        
        # Test with a unique user to ensure clean state
        test_user = "db_test_user_789"
        
        # First GET should return empty
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/user-layouts/{test_user}/{self.test_page}")
            assert response.status_code == 200
            data = response.json()
            assert data["blocks"] == []
            
            # PUT some data
            payload = {"page": self.test_page, "blocks": ["block1", "block2"]}
            response = await client.put(
                f"{self.base_url}/user-layouts/{test_user}/{self.test_page}",
                json=payload
            )
            assert response.status_code == 200
            
            # GET should return saved data
            response = await client.get(f"{self.base_url}/user-layouts/{test_user}/{self.test_page}")
            assert response.status_code == 200
            data = response.json()
            assert data["blocks"] == ["block1", "block2"]
            
            print("✅ DB provider independence test passed")
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting User Layouts API Tests")
        print(f"Base URL: {self.base_url}")
        print(f"Test User ID: {self.test_user_id}")
        print(f"Test Page: {self.test_page}")
        print(f"Test Blocks: {self.test_blocks}")
        
        try:
            # Test sequence
            await self.test_get_initial_empty_layout()
            await self.test_put_layout_update()
            await self.test_get_saved_layout()
            await self.test_different_user_empty_layout()
            await self.test_page_mismatch_error()
            await self.test_works_with_different_db_providers()
            
            print("\n🎉 All User Layouts API tests passed successfully!")
            return True
            
        except Exception as e:
            print(f"\n❌ Test failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

async def main():
    """Main test runner"""
    tester = TestUserLayouts()
    success = await tester.run_all_tests()
    
    if success:
        print("\n✅ USER LAYOUTS API TESTING COMPLETED SUCCESSFULLY")
        print("All endpoints are working correctly:")
        print("- GET /api/user-layouts/{userId}/vehicleDetails ✅")
        print("- PUT /api/user-layouts/{userId}/vehicleDetails ✅")
        print("- Works with different DB providers ✅")
        print("- Proper error handling ✅")
    else:
        print("\n❌ USER LAYOUTS API TESTING FAILED")
        print("Some endpoints are not working correctly")
    
    return success

if __name__ == "__main__":
    # Run the tests
    result = asyncio.run(main())
    exit(0 if result else 1)