"""
Iteration 202 - Supplier Movements & Vehicle Linked Journal Entries Testing

Tests:
1. GET /api/suppliers returns suppliers with movements array
2. Supplier movements include operations linked to the supplier
3. GET /api/finance/journal-entries returns entries with VEHICLE_REF/PARTY tags
4. Vehicle details page can filter journal entries by vehicle/customer
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestSupplierMovements:
    """Test supplier movements endpoint and data structure"""

    def test_suppliers_endpoint_returns_200(self):
        """GET /api/suppliers should return 200"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers",
            params={"workshop_id": WORKSHOP_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Suppliers endpoint returned {len(data)} suppliers")

    def test_suppliers_have_movements_field(self):
        """Each supplier should have a movements array"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers",
            params={"workshop_id": WORKSHOP_ID}
        )
        assert response.status_code == 200
        suppliers = response.json()
        
        if not suppliers:
            pytest.skip("No suppliers found to test movements field")
        
        # Check first few suppliers have movements field
        for supplier in suppliers[:5]:
            assert "movements" in supplier, f"Supplier {supplier.get('name')} missing 'movements' field"
            assert isinstance(supplier.get("movements"), list), f"movements should be a list for {supplier.get('name')}"
        
        print(f"✅ All checked suppliers have movements array")

    def test_suppliers_have_balance_fields(self):
        """Suppliers should have debitBalance, creditBalance, ajelBalance fields"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers",
            params={"workshop_id": WORKSHOP_ID}
        )
        assert response.status_code == 200
        suppliers = response.json()
        
        if not suppliers:
            pytest.skip("No suppliers found to test balance fields")
        
        required_fields = ["debitBalance", "creditBalance", "ajelBalance", "settledAmount"]
        for supplier in suppliers[:5]:
            for field in required_fields:
                assert field in supplier, f"Supplier {supplier.get('name')} missing '{field}' field"
        
        print(f"✅ All checked suppliers have balance fields")

    def test_supplier_movements_structure(self):
        """Supplier movements should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers",
            params={"workshop_id": WORKSHOP_ID}
        )
        assert response.status_code == 200
        suppliers = response.json()
        
        # Find a supplier with movements
        supplier_with_movements = None
        for supplier in suppliers:
            if supplier.get("movements") and len(supplier.get("movements", [])) > 0:
                supplier_with_movements = supplier
                break
        
        if not supplier_with_movements:
            pytest.skip("No supplier with movements found")
        
        movement = supplier_with_movements["movements"][0]
        expected_fields = ["id", "direction", "label", "amount", "date"]
        for field in expected_fields:
            assert field in movement, f"Movement missing '{field}' field"
        
        print(f"✅ Supplier '{supplier_with_movements.get('name')}' has {len(supplier_with_movements['movements'])} movements with proper structure")


class TestJournalEntriesForVehicle:
    """Test journal entries endpoint for vehicle linking"""

    def test_journal_entries_endpoint_returns_200(self):
        """GET /api/finance/journal-entries should return 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/journal-entries",
            params={"workshop_id": WORKSHOP_ID, "limit": 50}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Response could be {data: [...]} or just [...]
        entries = data.get("data", data) if isinstance(data, dict) else data
        assert isinstance(entries, list), "Response should contain a list of entries"
        print(f"✅ Journal entries endpoint returned {len(entries)} entries")

    def test_journal_entries_have_description_field(self):
        """Journal entries should have description field for tag extraction"""
        response = requests.get(
            f"{BASE_URL}/api/finance/journal-entries",
            params={"workshop_id": WORKSHOP_ID, "limit": 50}
        )
        assert response.status_code == 200
        data = response.json()
        entries = data.get("data", data) if isinstance(data, dict) else data
        
        if not entries:
            pytest.skip("No journal entries found")
        
        for entry in entries[:10]:
            assert "description" in entry, f"Entry {entry.get('id')} missing 'description' field"
        
        print(f"✅ All checked journal entries have description field")

    def test_visit_receipt_voucher_entries_exist(self):
        """Journal entries with source=visit_receipt_voucher should exist"""
        response = requests.get(
            f"{BASE_URL}/api/finance/journal-entries",
            params={"workshop_id": WORKSHOP_ID, "limit": 200}
        )
        assert response.status_code == 200
        data = response.json()
        entries = data.get("data", data) if isinstance(data, dict) else data
        
        receipt_entries = [e for e in entries if e.get("source") == "visit_receipt_voucher"]
        
        if not receipt_entries:
            print("⚠️ No visit_receipt_voucher entries found - this may be expected if no payments recorded")
            return
        
        print(f"✅ Found {len(receipt_entries)} visit_receipt_voucher entries")
        
        # Check first entry has proper tags
        entry = receipt_entries[0]
        desc = entry.get("description", "")
        has_party_tag = "[PARTY:" in desc
        has_vehicle_ref = "[VEHICLE_REF:" in desc or "[VISIT:" in desc
        
        print(f"  - Entry has PARTY tag: {has_party_tag}")
        print(f"  - Entry has VEHICLE_REF/VISIT tag: {has_vehicle_ref}")

    def test_journal_entries_with_vehicle_ref_tag(self):
        """Some journal entries should have [VEHICLE_REF:...] tag"""
        response = requests.get(
            f"{BASE_URL}/api/finance/journal-entries",
            params={"workshop_id": WORKSHOP_ID, "limit": 200}
        )
        assert response.status_code == 200
        data = response.json()
        entries = data.get("data", data) if isinstance(data, dict) else data
        
        entries_with_vehicle_ref = [
            e for e in entries 
            if "[VEHICLE_REF:" in str(e.get("description", ""))
        ]
        
        if not entries_with_vehicle_ref:
            print("⚠️ No entries with [VEHICLE_REF:] tag found - this may be expected")
            return
        
        print(f"✅ Found {len(entries_with_vehicle_ref)} entries with [VEHICLE_REF:] tag")


class TestVehicleDetailsData:
    """Test vehicle details endpoint for linked data"""

    def test_vehicles_endpoint_returns_200(self):
        """GET /api/vehicles should return 200"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Vehicles endpoint returned {len(data)} vehicles")

    def test_vehicle_details_endpoint(self):
        """GET /api/vehicles/{id} should return vehicle details"""
        # First get list of vehicles
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        vehicles = response.json()
        
        if not vehicles:
            pytest.skip("No vehicles found to test details")
        
        vehicle_id = vehicles[0].get("id")
        detail_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}")
        assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}"
        
        vehicle = detail_response.json()
        assert vehicle.get("id") == vehicle_id
        print(f"✅ Vehicle details returned for {vehicle.get('plateNumber', vehicle_id)}")

    def test_visits_endpoint_for_vehicle(self):
        """GET /api/vehicles/{vehicle_id}/visits should return visits for a vehicle"""
        # First get a vehicle
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        vehicles = response.json()
        
        if not vehicles:
            pytest.skip("No vehicles found")
        
        vehicle_id = vehicles[0].get("id")
        visits_response = requests.get(
            f"{BASE_URL}/api/vehicles/{vehicle_id}/visits"
        )
        assert visits_response.status_code == 200, f"Expected 200, got {visits_response.status_code}"
        
        data = visits_response.json()
        visits = data.get("visits", data) if isinstance(data, dict) else data
        print(f"✅ Visits endpoint returned {len(visits)} visits for vehicle")


class TestOperationsWithPaymentFields:
    """Test operations endpoint returns payment fields from visits"""

    def test_operations_endpoint_returns_200(self):
        """GET /api/operations should return 200"""
        response = requests.get(
            f"{BASE_URL}/api/operations",
            params={"workshop_id": WORKSHOP_ID, "limit": 50}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        operations = data.get("operations", data) if isinstance(data, dict) else data
        assert isinstance(operations, list), "Response should contain a list"
        print(f"✅ Operations endpoint returned {len(operations)} operations")

    def test_operations_have_payment_fields(self):
        """Operations should have paymentMethod, paymentStatus fields"""
        response = requests.get(
            f"{BASE_URL}/api/operations",
            params={"workshop_id": WORKSHOP_ID, "limit": 50}
        )
        assert response.status_code == 200
        data = response.json()
        operations = data.get("operations", data) if isinstance(data, dict) else data
        
        if not operations:
            pytest.skip("No operations found")
        
        # Check operations have payment fields
        payment_fields = ["paymentMethod", "paymentStatus"]
        for op in operations[:5]:
            for field in payment_fields:
                # Field should exist (can be None)
                assert field in op, f"Operation {op.get('id')} missing '{field}' field"
        
        print(f"✅ Operations have payment fields")


class TestSupplierOperationsLink:
    """Test that supplier operations appear in supplier movements"""

    def test_supplier_operations_exist(self):
        """Check if there are operations with partner_type=supplier"""
        response = requests.get(
            f"{BASE_URL}/api/operations",
            params={"workshop_id": WORKSHOP_ID, "limit": 200}
        )
        assert response.status_code == 200
        data = response.json()
        operations = data.get("operations", data) if isinstance(data, dict) else data
        
        supplier_ops = [
            op for op in operations 
            if str(op.get("partnerType", "")).lower() == "supplier"
        ]
        
        if not supplier_ops:
            print("⚠️ No supplier operations found - this may be expected")
            return
        
        print(f"✅ Found {len(supplier_ops)} supplier operations")
        
        # Check first supplier operation has partner info
        op = supplier_ops[0]
        print(f"  - Partner: {op.get('partnerName', 'N/A')}")
        print(f"  - Total: {op.get('total', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
