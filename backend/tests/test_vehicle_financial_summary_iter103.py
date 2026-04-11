"""
Test Vehicle Financial Summary API - Iteration 103
Tests the /api/vehicles/{vehicle_id}/financial-summary endpoint
Verifies that total_workshop, total_suppliers, and supplier_archive_total are returned correctly
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVehicleFinancialSummary:
    """Tests for vehicle financial summary endpoint"""
    
    def test_financial_summary_endpoint_exists(self):
        """Test that the financial summary endpoint exists and returns 200"""
        # First get a vehicle ID
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200, f"Failed to get vehicles: {response.text}"
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        vehicle_id = vehicles[0].get('id')
        assert vehicle_id, "Vehicle ID not found"
        
        # Test the financial summary endpoint
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
        assert summary_response.status_code == 200, f"Financial summary endpoint failed: {summary_response.text}"
        print(f"Financial summary endpoint returned 200 for vehicle {vehicle_id}")
    
    def test_financial_summary_response_structure(self):
        """Test that the financial summary response has the correct structure"""
        # Get a vehicle ID
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        vehicle_id = vehicles[0].get('id')
        
        # Get financial summary
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        
        # Check required fields exist
        required_fields = [
            'total_workshop',
            'total_suppliers',
            'supplier_archive_total',
            'total_paid',
            'advance_paid',
            'total_amount',
            'balance'
        ]
        
        for field in required_fields:
            assert field in summary, f"Missing required field: {field}"
            print(f"Field '{field}' present with value: {summary[field]}")
    
    def test_financial_summary_values_are_numeric(self):
        """Test that all financial values are numeric"""
        # Get a vehicle ID
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        vehicle_id = vehicles[0].get('id')
        
        # Get financial summary
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        
        numeric_fields = [
            'total_workshop',
            'total_suppliers',
            'supplier_archive_total',
            'total_paid',
            'advance_paid',
            'total_amount',
            'balance'
        ]
        
        for field in numeric_fields:
            value = summary.get(field)
            assert isinstance(value, (int, float)), f"Field '{field}' is not numeric: {type(value)}"
            print(f"Field '{field}' is numeric: {value}")
    
    def test_supplier_archive_total_equals_total_suppliers(self):
        """Test that supplier_archive_total equals total_suppliers (they should be the same)"""
        # Get a vehicle ID
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        vehicle_id = vehicles[0].get('id')
        
        # Get financial summary
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        
        total_suppliers = summary.get('total_suppliers', 0)
        supplier_archive_total = summary.get('supplier_archive_total', 0)
        
        assert total_suppliers == supplier_archive_total, \
            f"total_suppliers ({total_suppliers}) != supplier_archive_total ({supplier_archive_total})"
        print(f"total_suppliers ({total_suppliers}) == supplier_archive_total ({supplier_archive_total})")
    
    def test_total_amount_calculation(self):
        """Test that total_amount = total_workshop + total_suppliers"""
        # Get a vehicle ID
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        vehicle_id = vehicles[0].get('id')
        
        # Get financial summary
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        
        total_workshop = summary.get('total_workshop', 0)
        total_suppliers = summary.get('total_suppliers', 0)
        total_amount = summary.get('total_amount', 0)
        
        expected_total = total_workshop + total_suppliers
        assert abs(total_amount - expected_total) < 0.01, \
            f"total_amount ({total_amount}) != total_workshop ({total_workshop}) + total_suppliers ({total_suppliers})"
        print(f"total_amount ({total_amount}) = total_workshop ({total_workshop}) + total_suppliers ({total_suppliers})")
    
    def test_balance_calculation(self):
        """Test that balance = total_amount - total_paid"""
        # Get a vehicle ID
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        vehicle_id = vehicles[0].get('id')
        
        # Get financial summary
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        
        total_amount = summary.get('total_amount', 0)
        total_paid = summary.get('total_paid', 0)
        balance = summary.get('balance', 0)
        
        expected_balance = total_amount - total_paid
        assert abs(balance - expected_balance) < 0.01, \
            f"balance ({balance}) != total_amount ({total_amount}) - total_paid ({total_paid})"
        print(f"balance ({balance}) = total_amount ({total_amount}) - total_paid ({total_paid})")
    
    def test_financial_summary_for_nonexistent_vehicle(self):
        """Test that financial summary returns valid response for non-existent vehicle"""
        # Use a random UUID that doesn't exist
        fake_vehicle_id = "00000000-0000-0000-0000-000000000000"
        
        summary_response = requests.get(f"{BASE_URL}/api/vehicles/{fake_vehicle_id}/financial-summary", timeout=30)
        
        # Should return 200 with zero values (no visits found)
        assert summary_response.status_code == 200, f"Expected 200, got {summary_response.status_code}"
        
        summary = summary_response.json()
        
        # All values should be 0 for non-existent vehicle
        assert summary.get('total_workshop', -1) == 0, "total_workshop should be 0"
        assert summary.get('total_suppliers', -1) == 0, "total_suppliers should be 0"
        assert summary.get('total_paid', -1) == 0, "total_paid should be 0"
        print("Non-existent vehicle returns zero values as expected")


class TestVehicleFinancialSummaryIntegration:
    """Integration tests for vehicle financial summary with visits"""
    
    def test_financial_summary_with_specific_vehicle(self):
        """Test financial summary for a specific vehicle with known data"""
        # Get vehicles list
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found to test")
        
        # Find a vehicle with financial data
        for vehicle in vehicles[:5]:  # Check first 5 vehicles
            vehicle_id = vehicle.get('id')
            
            summary_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary", timeout=30)
            assert summary_response.status_code == 200
            
            summary = summary_response.json()
            
            # Print summary for debugging
            print(f"\nVehicle: {vehicle.get('plateNumber', 'Unknown')}")
            print(f"  total_workshop: {summary.get('total_workshop')}")
            print(f"  total_suppliers: {summary.get('total_suppliers')}")
            print(f"  supplier_archive_total: {summary.get('supplier_archive_total')}")
            print(f"  total_paid: {summary.get('total_paid')}")
            print(f"  advance_paid: {summary.get('advance_paid')}")
            print(f"  balance: {summary.get('balance')}")
            
            # If this vehicle has financial data, verify it
            if summary.get('total_amount', 0) > 0:
                print(f"  Found vehicle with financial data!")
                break


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
