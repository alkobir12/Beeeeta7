"""
Test Customer fileNumber field functionality
- POST /api/customers accepts fileNumber and returns it
- GET /api/customers shows fileNumber for customers
- PUT /api/customers/{id} updates fileNumber without breaking other data
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerFileNumber:
    """Tests for customer fileNumber field CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_prefix = f"TEST_FN_{uuid.uuid4().hex[:6]}"
        self.created_customer_ids = []
        yield
        # Cleanup: delete test customers
        for cid in self.created_customer_ids:
            try:
                requests.delete(f"{BASE_URL}/api/customers/{cid}")
            except Exception:
                pass
    
    def test_create_customer_with_file_number(self):
        """POST /api/customers should accept fileNumber and return it"""
        file_number = f"FN-{uuid.uuid4().hex[:8]}"
        payload = {
            "name": f"{self.test_prefix}_Customer1",
            "phone": f"05{uuid.uuid4().hex[:8]}",
            "fileNumber": file_number,
            "email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify fileNumber is returned
        assert "id" in data, "Response should contain id"
        assert data.get("name") == payload["name"], "Name should match"
        assert data.get("phone") == payload["phone"], "Phone should match"
        assert data.get("fileNumber") == file_number, f"fileNumber should be {file_number}, got {data.get('fileNumber')}"
        
        self.created_customer_ids.append(data["id"])
        print(f"✅ Created customer with fileNumber: {file_number}")
    
    def test_create_customer_without_file_number(self):
        """POST /api/customers should work without fileNumber"""
        payload = {
            "name": f"{self.test_prefix}_Customer2",
            "phone": f"05{uuid.uuid4().hex[:8]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should contain id"
        # fileNumber should be None or not present
        assert data.get("fileNumber") is None or data.get("fileNumber") == "", "fileNumber should be None or empty"
        
        self.created_customer_ids.append(data["id"])
        print(f"✅ Created customer without fileNumber")
    
    def test_get_customers_shows_file_number(self):
        """GET /api/customers should show fileNumber for customers"""
        # First create a customer with fileNumber
        file_number = f"FN-GET-{uuid.uuid4().hex[:6]}"
        payload = {
            "name": f"{self.test_prefix}_CustomerGet",
            "phone": f"05{uuid.uuid4().hex[:8]}",
            "fileNumber": file_number
        }
        
        create_response = requests.post(f"{BASE_URL}/api/customers", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        customer_id = created["id"]
        self.created_customer_ids.append(customer_id)
        
        # Now get all customers and verify fileNumber is present
        response = requests.get(f"{BASE_URL}/api/customers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        customers = response.json()
        
        # Find our created customer
        found_customer = None
        for c in customers:
            if c.get("id") == customer_id:
                found_customer = c
                break
        
        assert found_customer is not None, f"Customer {customer_id} not found in list"
        assert found_customer.get("fileNumber") == file_number, f"fileNumber should be {file_number}, got {found_customer.get('fileNumber')}"
        
        print(f"✅ GET /api/customers shows fileNumber: {file_number}")
    
    def test_update_customer_file_number(self):
        """PUT /api/customers/{id} should update fileNumber without breaking other data"""
        # Create customer first
        original_file_number = f"FN-ORIG-{uuid.uuid4().hex[:6]}"
        payload = {
            "name": f"{self.test_prefix}_CustomerUpdate",
            "phone": f"05{uuid.uuid4().hex[:8]}",
            "fileNumber": original_file_number,
            "email": "original@example.com",
            "address": "Original Address"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/customers", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        customer_id = created["id"]
        self.created_customer_ids.append(customer_id)
        
        # Update only fileNumber
        new_file_number = f"FN-NEW-{uuid.uuid4().hex[:6]}"
        update_payload = {"fileNumber": new_file_number}
        
        update_response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", json=update_payload)
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        updated = update_response.json()
        
        # Verify fileNumber is updated
        assert updated.get("fileNumber") == new_file_number, f"fileNumber should be {new_file_number}, got {updated.get('fileNumber')}"
        
        # Verify other fields are NOT broken
        assert updated.get("name") == payload["name"], f"Name should remain {payload['name']}, got {updated.get('name')}"
        assert updated.get("phone") == payload["phone"], f"Phone should remain {payload['phone']}, got {updated.get('phone')}"
        assert updated.get("email") == payload["email"], f"Email should remain {payload['email']}, got {updated.get('email')}"
        
        print(f"✅ Updated fileNumber from {original_file_number} to {new_file_number}")
    
    def test_update_other_fields_preserves_file_number(self):
        """PUT /api/customers/{id} updating other fields should preserve fileNumber"""
        # Create customer with fileNumber
        file_number = f"FN-PRESERVE-{uuid.uuid4().hex[:6]}"
        payload = {
            "name": f"{self.test_prefix}_CustomerPreserve",
            "phone": f"05{uuid.uuid4().hex[:8]}",
            "fileNumber": file_number
        }
        
        create_response = requests.post(f"{BASE_URL}/api/customers", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        customer_id = created["id"]
        self.created_customer_ids.append(customer_id)
        
        # Update only name (not fileNumber)
        new_name = f"{self.test_prefix}_UpdatedName"
        update_payload = {"name": new_name}
        
        update_response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", json=update_payload)
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        updated = update_response.json()
        
        # Verify name is updated
        assert updated.get("name") == new_name, f"Name should be {new_name}"
        
        # Verify fileNumber is preserved
        assert updated.get("fileNumber") == file_number, f"fileNumber should be preserved as {file_number}, got {updated.get('fileNumber')}"
        
        print(f"✅ fileNumber preserved after updating other fields")
    
    def test_clear_file_number(self):
        """PUT /api/customers/{id} should allow clearing fileNumber"""
        # Create customer with fileNumber
        file_number = f"FN-CLEAR-{uuid.uuid4().hex[:6]}"
        payload = {
            "name": f"{self.test_prefix}_CustomerClear",
            "phone": f"05{uuid.uuid4().hex[:8]}",
            "fileNumber": file_number
        }
        
        create_response = requests.post(f"{BASE_URL}/api/customers", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        customer_id = created["id"]
        self.created_customer_ids.append(customer_id)
        
        # Clear fileNumber by setting to null/empty
        update_payload = {"fileNumber": None}
        
        update_response = requests.put(f"{BASE_URL}/api/customers/{customer_id}", json=update_payload)
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        updated = update_response.json()
        
        # Verify fileNumber is cleared
        assert updated.get("fileNumber") is None or updated.get("fileNumber") == "", f"fileNumber should be cleared, got {updated.get('fileNumber')}"
        
        print(f"✅ fileNumber cleared successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
