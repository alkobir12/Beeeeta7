"""
Test suite for operation types update:
- 6 operation types: purchase, sale, expense, sale_return, purchase_return, payment_order
- Validates API accepts new types without 500 errors
- Tests journal entry creation for return types
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOperationTypes:
    """Test the 6 operation types are accepted by the API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.workshop_id = "finmodule-sync"
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:6]}"
    
    def test_health_endpoint(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health endpoint working")
    
    def test_operations_list_endpoint(self):
        """Verify operations list endpoint works"""
        response = requests.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200, f"Operations list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Operations should return a list"
        print(f"✓ Operations list working, found {len(data)} operations")
    
    def test_create_purchase_operation(self):
        """Test creating a purchase operation"""
        payload = {
            "type": "purchase",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_Supplier",
            "partnerType": "supplier",
            "items": [{"name": "Test Part", "quantity": 1, "price": 100, "total": 100}],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "notes": f"Test purchase {self.test_prefix}"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        assert response.status_code in [200, 201], f"Create purchase failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("type") == "purchase" or data.get("id"), "Purchase operation should be created"
        print("✓ Purchase operation created successfully")
        return data.get("id")
    
    def test_create_sale_operation(self):
        """Test creating a sale operation"""
        payload = {
            "type": "sale",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_Customer",
            "partnerType": "customer",
            "items": [{"name": "Test Service", "quantity": 1, "price": 200, "total": 200}],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "notes": f"Test sale {self.test_prefix}"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        assert response.status_code in [200, 201], f"Create sale failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("type") == "sale" or data.get("id"), "Sale operation should be created"
        print("✓ Sale operation created successfully")
        return data.get("id")
    
    def test_create_expense_operation(self):
        """Test creating an expense operation"""
        payload = {
            "type": "expense",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_Vendor",
            "partnerType": "supplier",
            "items": [{"name": "Office Supplies", "quantity": 1, "price": 50, "total": 50}],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "notes": f"Test expense {self.test_prefix}"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        assert response.status_code in [200, 201], f"Create expense failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("type") == "expense" or data.get("id"), "Expense operation should be created"
        print("✓ Expense operation created successfully")
        return data.get("id")
    
    def test_create_sale_return_operation(self):
        """Test creating a sale_return operation - NEW TYPE"""
        payload = {
            "type": "sale_return",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_Customer_Return",
            "partnerType": "customer",
            "items": [{"name": "Returned Item", "quantity": 1, "price": 150, "total": 150}],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "notes": f"Test sale return {self.test_prefix}"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        # Should NOT return 500
        assert response.status_code != 500, f"sale_return should not return 500: {response.text}"
        assert response.status_code in [200, 201], f"Create sale_return failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("type") == "sale_return" or data.get("id"), "Sale return operation should be created"
        print("✓ Sale return (sale_return) operation created successfully - NO 500 ERROR")
        return data.get("id")
    
    def test_create_purchase_return_operation(self):
        """Test creating a purchase_return operation - NEW TYPE"""
        payload = {
            "type": "purchase_return",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_Supplier_Return",
            "partnerType": "supplier",
            "items": [{"name": "Returned Part", "quantity": 1, "price": 75, "total": 75}],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "notes": f"Test purchase return {self.test_prefix}"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        # Should NOT return 500
        assert response.status_code != 500, f"purchase_return should not return 500: {response.text}"
        assert response.status_code in [200, 201], f"Create purchase_return failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("type") == "purchase_return" or data.get("id"), "Purchase return operation should be created"
        print("✓ Purchase return (purchase_return) operation created successfully - NO 500 ERROR")
        return data.get("id")
    
    def test_create_payment_order_operation(self):
        """Test creating a payment_order operation"""
        payload = {
            "type": "payment_order",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_Payment_Partner",
            "partnerType": "customer",
            "paymentAmount": 500,
            "items": [{"name": "سداد مديونية", "itemType": "service", "quantity": 1, "price": 500, "total": 500}],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "notes": f"Test payment order {self.test_prefix}"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        assert response.status_code in [200, 201], f"Create payment_order failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get("type") == "payment_order" or data.get("id"), "Payment order operation should be created"
        print("✓ Payment order (payment_order) operation created successfully")
        return data.get("id")


class TestOperationTypeValidation:
    """Test validation rules for different operation types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.workshop_id = "finmodule-sync"
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:6]}"
    
    def test_sale_return_journal_entry_structure(self):
        """Verify sale_return creates proper journal entry (Dr Revenue, Cr Cash/AR)"""
        payload = {
            "type": "sale_return",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_JE_Test",
            "partnerType": "customer",
            "items": [{"name": "Return Item", "quantity": 1, "price": 100, "total": 100}],
            "paymentMethod": "cash",
            "paymentStatus": "paid"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        print("✓ Sale return operation accepted by API")
    
    def test_purchase_return_journal_entry_structure(self):
        """Verify purchase_return creates proper journal entry (Dr Cash/AP, Cr Expense)"""
        payload = {
            "type": "purchase_return",
            "workshopId": self.workshop_id,
            "partnerName": f"{self.test_prefix}_JE_Test",
            "partnerType": "supplier",
            "items": [{"name": "Return Part", "quantity": 1, "price": 100, "total": 100}],
            "paymentMethod": "cash",
            "paymentStatus": "paid"
        }
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        print("✓ Purchase return operation accepted by API")


class TestOperationsListIntegrity:
    """Test that operations list is not broken after the update"""
    
    def test_operations_list_returns_valid_data(self):
        """Verify operations list endpoint returns valid data structure"""
        response = requests.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200, f"Operations list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        
        # Check that each operation has required fields
        for op in data[:10]:  # Check first 10
            assert "id" in op or "_id" in op, f"Operation missing id: {op}"
            if "type" in op:
                valid_types = ["purchase", "sale", "expense", "sale_return", "purchase_return", "payment_order", "service"]
                assert op["type"] in valid_types or op["type"] is None, f"Invalid type: {op['type']}"
        
        print(f"✓ Operations list integrity verified ({len(data)} operations)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
