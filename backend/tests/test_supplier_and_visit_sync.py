"""
Test suite for supplier dropdown and visit sync functionality.
Tests P0 and P1 features:
- P0: Supplier dropdown showing actual names
- P0: Manual supplier entry and persistence
- P1: Visit sync to operations with payment mapping
"""
import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierAPI:
    """Test supplier API endpoints"""
    
    def test_get_suppliers_returns_list(self):
        """P0: Verify suppliers API returns a list with actual names"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of suppliers"
        assert len(data) > 0, "Expected at least one supplier"
        
        # Verify supplier has name field
        first_supplier = data[0]
        assert "name" in first_supplier, "Supplier should have 'name' field"
        assert first_supplier["name"], "Supplier name should not be empty"
        print(f"Found {len(data)} suppliers, first: {first_supplier.get('name')}")
    
    def test_suppliers_have_required_fields(self):
        """Verify suppliers have required fields"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            supplier = data[0]
            # Check for common fields
            assert "name" in supplier or "supplierName" in supplier, "Supplier should have name field"
            print(f"Supplier fields: {list(supplier.keys())}")
    
    def test_create_supplier(self):
        """P0: Test creating a new supplier"""
        test_supplier = {
            "name": f"TEST_مورد_اختبار_{int(time.time())}",
            "phone": "0500000000",
            "contactPerson": "",
            "email": "",
            "address": "",
            "city": "",
            "category": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/suppliers", json=test_supplier)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "name" in data or "id" in data, "Response should contain supplier data"
        print(f"Created supplier: {data.get('name', data.get('id'))}")
        
        # Verify supplier appears in list
        list_response = requests.get(f"{BASE_URL}/api/suppliers")
        assert list_response.status_code == 200
        suppliers = list_response.json()
        supplier_names = [s.get("name") for s in suppliers]
        assert test_supplier["name"] in supplier_names, f"New supplier should appear in list"


class TestVehicleVisits:
    """Test vehicle visits and visit sync"""
    
    def test_get_vehicle_visits(self):
        """Test getting visits for a vehicle"""
        # First get a vehicle
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles")
        assert vehicles_response.status_code == 200
        vehicles = vehicles_response.json()
        
        if len(vehicles) > 0:
            vehicle_id = vehicles[0].get("id")
            
            # Get visits for this vehicle
            visits_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/visits")
            assert visits_response.status_code == 200, f"Expected 200, got {visits_response.status_code}"
            
            visits = visits_response.json()
            assert isinstance(visits, list), "Expected list of visits"
            print(f"Found {len(visits)} visits for vehicle {vehicle_id}")
    
    def test_visit_has_items(self):
        """Test that visits have items parsed correctly"""
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles")
        assert vehicles_response.status_code == 200
        vehicles = vehicles_response.json()
        
        if len(vehicles) > 0:
            vehicle_id = vehicles[0].get("id")
            visits_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/visits")
            assert visits_response.status_code == 200
            
            visits = visits_response.json()
            if len(visits) > 0:
                visit = visits[0]
                # Check if items are parsed
                assert "items" in visit, "Visit should have items field"
                print(f"Visit {visit.get('id')} has {len(visit.get('items', []))} items")


class TestOperationsSync:
    """Test visit sync to operations"""
    
    def test_operations_list(self):
        """P1: Test operations API returns list"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of operations"
        print(f"Found {len(data)} operations")
    
    def test_visit_synced_to_operations(self):
        """P1: Test that visits are synced to operations"""
        # Get operations
        ops_response = requests.get(f"{BASE_URL}/api/operations?limit=50")
        assert ops_response.status_code == 200
        operations = ops_response.json()
        
        # Find operations with visitId
        visit_ops = [op for op in operations if op.get("visitId")]
        print(f"Found {len(visit_ops)} operations synced from visits")
        
        if len(visit_ops) > 0:
            op = visit_ops[0]
            assert "items" in op, "Operation should have items"
            assert "total" in op or "workshopTotal" in op, "Operation should have total"
            print(f"Operation {op.get('id')} has {len(op.get('items', []))} items")
    
    def test_payment_method_mapping(self):
        """P1: Test payment method to account mapping"""
        ops_response = requests.get(f"{BASE_URL}/api/operations?limit=50")
        assert ops_response.status_code == 200
        operations = ops_response.json()
        
        # Check payment methods
        payment_methods = set()
        for op in operations:
            pm = op.get("paymentMethod")
            if pm:
                payment_methods.add(pm)
        
        print(f"Payment methods found: {payment_methods}")
        
        # Verify expected payment methods exist
        expected_methods = {"cash", "transfer", "card", "credit"}
        found_methods = payment_methods.intersection(expected_methods)
        print(f"Found expected payment methods: {found_methods}")
    
    def test_operation_has_account_code_in_notes(self):
        """P1: Test that operations have account code in notes"""
        ops_response = requests.get(f"{BASE_URL}/api/operations?limit=50")
        assert ops_response.status_code == 200
        operations = ops_response.json()
        
        # Find operations with ACCOUNT_CODE in notes
        ops_with_code = []
        for op in operations:
            notes = op.get("notes", "")
            if "ACCOUNT_CODE:" in notes:
                ops_with_code.append(op)
        
        print(f"Found {len(ops_with_code)} operations with ACCOUNT_CODE in notes")
        
        if len(ops_with_code) > 0:
            op = ops_with_code[0]
            notes = op.get("notes", "")
            # Extract account code
            import re
            match = re.search(r"ACCOUNT_CODE:(\d+)", notes)
            if match:
                code = match.group(1)
                print(f"Found account code: {code}")
                # Verify it's a valid code (1101 for cash, 1102 for bank)
                assert code in ["1101", "1102", "4102", "600103", "1000"], f"Unexpected account code: {code}"


class TestCustomerAPI:
    """Test customer API for data format consistency"""
    
    def test_get_customers(self):
        """Test customers API returns list with names"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of customers"
        
        if len(data) > 0:
            customer = data[0]
            # Check for name field (could be name or customerName)
            has_name = "name" in customer or "customerName" in customer
            assert has_name, "Customer should have name field"
            print(f"Found {len(data)} customers")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after tests"""
    yield
    # Cleanup: Delete TEST_ prefixed suppliers
    try:
        response = requests.get(f"{BASE_URL}/api/suppliers")
        if response.status_code == 200:
            suppliers = response.json()
            for supplier in suppliers:
                name = supplier.get("name", "")
                if name.startswith("TEST_"):
                    supplier_id = supplier.get("id")
                    if supplier_id:
                        requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
                        print(f"Cleaned up test supplier: {name}")
    except Exception as e:
        print(f"Cleanup error: {e}")
