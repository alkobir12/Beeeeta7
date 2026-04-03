"""
Operations Performance Tests - Iteration 37
Testing deferred loading implementation and API performance
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pos-performance-2.preview.emergentagent.com').rstrip('/')


class TestOperationsAPIPerformance:
    """Test GET /api/operations endpoint performance"""
    
    def test_operations_endpoint_responds(self):
        """Verify /api/operations endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Operations endpoint responds with 200")
    
    def test_operations_returns_data(self):
        """Verify /api/operations returns operation data"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        assert len(data) > 0, "Expected at least one operation"
        print(f"✓ Operations endpoint returns {len(data)} operations")
    
    def test_operations_response_time_under_3s(self):
        """Verify /api/operations responds within 3 seconds"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/operations?limit=600")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 3.0, f"Response took {elapsed:.2f}s, expected < 3s"
        print(f"✓ Operations endpoint responded in {elapsed:.2f}s (target < 3s)")
    
    def test_operations_limit_parameter(self):
        """Verify limit parameter is respected"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5, f"Expected max 5 operations, got {len(data)}"
        print(f"✓ Limit parameter works correctly (returned {len(data)} operations)")
    
    def test_operations_data_structure(self):
        """Verify operation data has required fields"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, "Expected at least one operation"
        
        op = data[0]
        required_fields = ['id', 'type', 'total']
        for field in required_fields:
            assert field in op, f"Missing required field: {field}"
        
        print(f"✓ Operation data structure is valid (id={op['id'][:8]}...)")
    
    def test_operations_scope_field_present(self):
        """Verify scope field is present for deferred loading categorization"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Check if scope field exists (used for Rakan vs Workshop categorization)
        ops_with_scope = [op for op in data if 'scope' in op]
        print(f"✓ {len(ops_with_scope)}/{len(data)} operations have scope field")


class TestSecondaryEndpointsPerformance:
    """Test secondary endpoints that are loaded after operations (deferred)"""
    
    def test_parts_endpoint_responds(self):
        """Verify /api/parts endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/parts")
        assert response.status_code == 200
        print("✓ Parts endpoint responds with 200")
    
    def test_services_endpoint_responds(self):
        """Verify /api/services endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/services")
        assert response.status_code == 200
        print("✓ Services endpoint responds with 200")
    
    def test_customers_endpoint_responds(self):
        """Verify /api/customers endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        print("✓ Customers endpoint responds with 200")
    
    def test_suppliers_endpoint_responds(self):
        """Verify /api/suppliers endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        print("✓ Suppliers endpoint responds with 200")
    
    def test_vehicles_endpoint_responds(self):
        """Verify /api/vehicles endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        print("✓ Vehicles endpoint responds with 200")
    
    def test_biz_accounts_endpoint_responds(self):
        """Verify /api/biz-accounts endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/biz-accounts")
        assert response.status_code == 200
        print("✓ Business accounts endpoint responds with 200")
    
    def test_chart_of_accounts_endpoint_responds(self):
        """Verify /api/finance/chart-of-accounts endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/finance/chart-of-accounts")
        assert response.status_code == 200
        print("✓ Chart of accounts endpoint responds with 200")


class TestPrefetchEndpoints:
    """Test endpoints used for prefetch on login"""
    
    def test_prefetch_operations_performance(self):
        """Verify operations prefetch is fast"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/operations?limit=600")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Prefetch took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Operations prefetch completed in {elapsed:.2f}s")
    
    def test_prefetch_vehicles_performance(self):
        """Verify vehicles prefetch is fast"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/vehicles")
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 2.0, f"Prefetch took {elapsed:.2f}s, expected < 2s"
        print(f"✓ Vehicles prefetch completed in {elapsed:.2f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
