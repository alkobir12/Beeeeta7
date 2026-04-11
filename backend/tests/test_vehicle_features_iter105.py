"""
Iteration 105 - Final verification tests for:
1. Supplier archive block in VehicleDetails
2. Source buttons on financial summary cards
3. Collapse toggles for vehicle/customer info blocks
4. Backend 404 for non-existent vehicle financial-summary
5. Backend returns supplier_archive_total
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVehicleFinancialSummaryAPI:
    """Test vehicle financial summary endpoint"""
    
    def test_nonexistent_vehicle_returns_404(self):
        """Non-existent vehicle ID should return 404, not 500"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/vehicles/{fake_id}/financial-summary")
        assert response.status_code == 404, f"Expected 404 for non-existent vehicle, got {response.status_code}: {response.text}"
        print(f"PASS: Non-existent vehicle returns 404")
    
    def test_invalid_uuid_returns_404(self):
        """Invalid UUID format should return 404"""
        response = requests.get(f"{BASE_URL}/api/vehicles/invalid-not-uuid/financial-summary")
        assert response.status_code == 404, f"Expected 404 for invalid UUID, got {response.status_code}: {response.text}"
        print(f"PASS: Invalid UUID returns 404")
    
    def test_valid_vehicle_returns_supplier_archive_total(self):
        """Valid vehicle should return supplier_archive_total field"""
        # First get a valid vehicle
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles?limit=1")
        if vehicles_response.status_code != 200:
            pytest.skip("No vehicles endpoint available")
        
        vehicles = vehicles_response.json()
        if not vehicles or not isinstance(vehicles, list) or len(vehicles) == 0:
            pytest.skip("No vehicles in database to test")
        
        vehicle_id = vehicles[0].get('id')
        if not vehicle_id:
            pytest.skip("Vehicle has no ID")
        
        response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary")
        assert response.status_code == 200, f"Expected 200 for valid vehicle, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'supplier_archive_total' in data, f"Response missing supplier_archive_total: {data}"
        assert 'total_workshop' in data, f"Response missing total_workshop: {data}"
        assert 'total_suppliers' in data, f"Response missing total_suppliers: {data}"
        assert 'total_paid' in data, f"Response missing total_paid: {data}"
        assert 'balance' in data, f"Response missing balance: {data}"
        
        # supplier_archive_total should equal total_suppliers
        assert data['supplier_archive_total'] == data['total_suppliers'], \
            f"supplier_archive_total ({data['supplier_archive_total']}) != total_suppliers ({data['total_suppliers']})"
        
        print(f"PASS: Valid vehicle returns supplier_archive_total = {data['supplier_archive_total']}")


class TestVehiclesEndpoint:
    """Test vehicles list endpoint"""
    
    def test_vehicles_list(self):
        """Vehicles list should return 200"""
        response = requests.get(f"{BASE_URL}/api/vehicles?limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"PASS: Vehicles list returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
