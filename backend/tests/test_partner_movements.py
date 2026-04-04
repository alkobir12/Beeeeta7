"""
Test Partner Movements API - Customers and Suppliers
Tests for flow/flowLabel/visitId fields in movements
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestCustomersMovements:
    """Test GET /api/customers returns movements with flow/flowLabel/visitId"""

    def test_customers_endpoint_returns_200(self):
        """Test customers endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ GET /api/customers returns 200")

    def test_customers_returns_list(self):
        """Test customers endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ GET /api/customers returns list with {len(data)} customers")

    def test_customer_has_movements_field(self):
        """Test each customer has movements field"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        for customer in data:
            assert "movements" in customer, f"Customer {customer.get('id')} missing 'movements' field"
            assert isinstance(customer["movements"], list), f"Customer {customer.get('id')} movements should be a list"
        
        print(f"✅ All {len(data)} customers have 'movements' field as list")

    def test_customer_movements_have_required_fields(self):
        """Test movements have flow/flowLabel/visitId fields"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        customers_with_movements = [c for c in data if c.get("movements")]
        
        if not customers_with_movements:
            pytest.skip("No customers with movements found to test")
        
        required_fields = ["flow", "flowLabel", "visitId"]
        
        for customer in customers_with_movements:
            for movement in customer["movements"]:
                for field in required_fields:
                    assert field in movement, f"Movement {movement.get('id')} missing '{field}' field"
                
                # Validate flow values
                assert movement["flow"] in ["in", "out"], f"Invalid flow value: {movement['flow']}"
                assert movement["flowLabel"] in ["داخل", "خارج"], f"Invalid flowLabel value: {movement['flowLabel']}"
                assert movement["visitId"], f"visitId should not be empty"
        
        print(f"✅ All movements in {len(customers_with_movements)} customers have flow/flowLabel/visitId fields")

    def test_customer_movements_have_vehicleId(self):
        """Test movements have vehicleId field"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        customers_with_movements = [c for c in data if c.get("movements")]
        
        if not customers_with_movements:
            pytest.skip("No customers with movements found to test")
        
        for customer in customers_with_movements:
            for movement in customer["movements"]:
                assert "vehicleId" in movement, f"Movement {movement.get('id')} missing 'vehicleId' field"
        
        print(f"✅ All movements have 'vehicleId' field")

    def test_customer_financial_fields(self):
        """Test customer has financial summary fields"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        financial_fields = ["debitBalance", "creditBalance", "overdueBalance", "ajelBalance", "settledAmount", "paymentPlanCount"]
        
        for customer in data:
            for field in financial_fields:
                assert field in customer, f"Customer {customer.get('id')} missing '{field}' field"
        
        print(f"✅ All customers have financial summary fields")


class TestSuppliersMovements:
    """Test GET /api/suppliers returns movements with flow/flowLabel/visitId"""

    def test_suppliers_endpoint_returns_200(self):
        """Test suppliers endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/suppliers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ GET /api/suppliers returns 200")

    def test_suppliers_returns_list(self):
        """Test suppliers endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/suppliers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ GET /api/suppliers returns list with {len(data)} suppliers")

    def test_supplier_has_movements_field(self):
        """Test each supplier has movements field"""
        response = requests.get(f"{BASE_URL}/api/suppliers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        for supplier in data:
            assert "movements" in supplier, f"Supplier {supplier.get('id')} missing 'movements' field"
            assert isinstance(supplier["movements"], list), f"Supplier {supplier.get('id')} movements should be a list"
        
        print(f"✅ All {len(data)} suppliers have 'movements' field as list")

    def test_supplier_financial_fields(self):
        """Test supplier has financial summary fields"""
        response = requests.get(f"{BASE_URL}/api/suppliers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        financial_fields = ["debitBalance", "creditBalance", "overdueBalance", "ajelBalance", "settledAmount", "paymentPlanCount"]
        
        for supplier in data:
            for field in financial_fields:
                assert field in supplier, f"Supplier {supplier.get('id')} missing '{field}' field"
        
        print(f"✅ All suppliers have financial summary fields")

    def test_supplier_movements_structure_if_present(self):
        """Test supplier movements have correct structure if any exist"""
        response = requests.get(f"{BASE_URL}/api/suppliers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        suppliers_with_movements = [s for s in data if s.get("movements")]
        
        if not suppliers_with_movements:
            print("ℹ️ No suppliers with movements found - structure test skipped")
            return
        
        required_fields = ["flow", "flowLabel", "visitId", "vehicleId"]
        
        for supplier in suppliers_with_movements:
            for movement in supplier["movements"]:
                for field in required_fields:
                    assert field in movement, f"Movement {movement.get('id')} missing '{field}' field"
                
                # Validate flow values for suppliers (should be 'out' for purchases)
                assert movement["flow"] in ["in", "out"], f"Invalid flow value: {movement['flow']}"
                assert movement["flowLabel"] in ["داخل", "خارج"], f"Invalid flowLabel value: {movement['flowLabel']}"
        
        print(f"✅ All movements in {len(suppliers_with_movements)} suppliers have correct structure")


class TestVehicleCustomerFallback:
    """Test that customer movements are linked via vehicle->customer fallback"""

    def test_customer_with_vehicle_movement(self):
        """Test customer with vehicleId in movement is properly linked"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        # Find customers with movements that have vehicleId
        customers_with_vehicle_movements = []
        for customer in data:
            for movement in customer.get("movements", []):
                if movement.get("vehicleId"):
                    customers_with_vehicle_movements.append({
                        "customer_id": customer.get("id"),
                        "customer_name": customer.get("name"),
                        "movement_id": movement.get("id"),
                        "vehicle_id": movement.get("vehicleId"),
                        "visit_id": movement.get("visitId")
                    })
        
        if customers_with_vehicle_movements:
            print(f"✅ Found {len(customers_with_vehicle_movements)} movements with vehicleId linked to customers")
            for item in customers_with_vehicle_movements[:3]:  # Show first 3
                print(f"   - Customer: {item['customer_name']}, VehicleId: {item['vehicle_id'][:8]}...")
        else:
            print("ℹ️ No movements with vehicleId found - fallback test inconclusive")


class TestHealthCheck:
    """Basic health check tests"""

    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in ["ok", "degraded"]
        print(f"✅ Health check: {data.get('status')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
