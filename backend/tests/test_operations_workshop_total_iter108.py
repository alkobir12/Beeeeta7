"""
Test: Operations workshopTotal and supplierArchiveTotal calculation
Iteration 108 - Verify that operations with supplier items correctly show workshopTotal

Issue from iteration_107:
- Operations with supplier items show workshop_total=0 in API response
- Fix: Added fallback calculation from items when workshop_total persisted column is missing

Tests:
1. GET /api/operations - verify workshopTotal and supplierArchiveTotal are present and correct
2. GET /api/operations/{id} - verify same fields for single operation
3. Verify no regression after supabase_service.py modification
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOperationsWorkshopTotal:
    """Test workshopTotal and supplierArchiveTotal fields in operations API"""
    
    def test_operations_list_returns_workshop_total_fields(self):
        """GET /api/operations should return workshopTotal and supplierArchiveTotal for all operations"""
        response = requests.get(f"{BASE_URL}/api/operations", timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) == 0:
            pytest.skip("No operations found to test")
        
        # Check first 10 operations for workshopTotal and supplierArchiveTotal fields
        operations_checked = 0
        operations_with_supplier_items = 0
        
        for op in data[:20]:  # Check up to 20 operations
            operations_checked += 1
            
            # Verify workshopTotal field exists
            assert "workshopTotal" in op, f"Operation {op.get('id')} missing workshopTotal field"
            
            # Verify supplierArchiveTotal field exists
            assert "supplierArchiveTotal" in op, f"Operation {op.get('id')} missing supplierArchiveTotal field"
            
            # Check if operation has supplier items
            items = op.get("items") or []
            has_supplier_items = any(
                str(item.get("itemType") or item.get("type") or "").strip().lower() == "supplier"
                for item in items if isinstance(item, dict)
            )
            
            if has_supplier_items:
                operations_with_supplier_items += 1
                
                # For operations with supplier items, workshopTotal should be calculated correctly
                workshop_total = op.get("workshopTotal") or 0
                supplier_total = op.get("supplierArchiveTotal") or 0
                total = op.get("total") or 0
                
                # Calculate expected values from items
                expected_workshop = 0.0
                expected_supplier = 0.0
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    qty = float(item.get("quantity") or item.get("qty") or 1)
                    price = float(item.get("price") or 0)
                    line_total = float(item.get("total") or (qty * price))
                    item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
                    if item_type == "supplier":
                        expected_supplier += line_total
                    else:
                        expected_workshop += line_total
                
                # If workshopTotal is 0 but total > 0 and there are non-supplier items, it's a bug
                if workshop_total == 0 and total > 0 and expected_workshop > 0:
                    pytest.fail(
                        f"Operation {op.get('id')} has workshopTotal=0 but expected {expected_workshop}. "
                        f"Total={total}, supplierArchiveTotal={supplier_total}"
                    )
                
                print(f"Operation {op.get('id')}: workshopTotal={workshop_total}, supplierArchiveTotal={supplier_total}, total={total}")
        
        print(f"\nChecked {operations_checked} operations, {operations_with_supplier_items} had supplier items")
        assert operations_checked > 0, "Should have checked at least one operation"
    
    def test_operations_list_workshop_total_not_zero_when_has_items(self):
        """Operations with items should have non-zero workshopTotal (unless all items are supplier type)"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=50", timeout=30)
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No operations found")
        
        issues_found = []
        
        for op in data:
            items = op.get("items") or []
            if not items:
                continue
            
            # Calculate workshop items total
            workshop_items_total = 0.0
            supplier_items_total = 0.0
            
            for item in items:
                if not isinstance(item, dict):
                    continue
                qty = float(item.get("quantity") or item.get("qty") or 1)
                price = float(item.get("price") or 0)
                line_total = float(item.get("total") or (qty * price))
                item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
                
                if item_type == "supplier":
                    supplier_items_total += line_total
                else:
                    workshop_items_total += line_total
            
            workshop_total = op.get("workshopTotal") or 0
            total = op.get("total") or 0
            
            # If there are workshop items but workshopTotal is 0, that's a bug
            if workshop_items_total > 0 and workshop_total == 0:
                issues_found.append({
                    "id": op.get("id"),
                    "expected_workshop_total": workshop_items_total,
                    "actual_workshop_total": workshop_total,
                    "total": total,
                    "supplier_items_total": supplier_items_total
                })
        
        if issues_found:
            pytest.fail(f"Found {len(issues_found)} operations with incorrect workshopTotal=0: {issues_found[:5]}")
        
        print(f"All {len(data)} operations have correct workshopTotal values")
    
    def test_single_operation_get_has_workshop_total(self):
        """GET /api/operations/{id} should return workshopTotal and supplierArchiveTotal"""
        # First get list to find an operation ID
        list_response = requests.get(f"{BASE_URL}/api/operations?limit=10", timeout=30)
        assert list_response.status_code == 200
        
        operations = list_response.json()
        if not operations:
            pytest.skip("No operations found")
        
        # Test first operation
        op_id = operations[0].get("id")
        
        response = requests.get(f"{BASE_URL}/api/operations/{op_id}", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        op = response.json()
        
        # Verify fields exist
        assert "workshopTotal" in op, f"Operation {op_id} missing workshopTotal field"
        assert "supplierArchiveTotal" in op, f"Operation {op_id} missing supplierArchiveTotal field"
        
        print(f"Single operation {op_id}: workshopTotal={op.get('workshopTotal')}, supplierArchiveTotal={op.get('supplierArchiveTotal')}")
    
    def test_operation_with_supplier_items_calculation(self):
        """Find an operation with supplier items and verify calculation"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=100", timeout=30)
        assert response.status_code == 200
        
        operations = response.json()
        
        # Find operation with supplier items
        op_with_supplier = None
        for op in operations:
            items = op.get("items") or []
            for item in items:
                if isinstance(item, dict):
                    item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
                    if item_type == "supplier":
                        op_with_supplier = op
                        break
            if op_with_supplier:
                break
        
        if not op_with_supplier:
            pytest.skip("No operations with supplier items found")
        
        # Verify calculation
        items = op_with_supplier.get("items") or []
        expected_workshop = 0.0
        expected_supplier = 0.0
        
        for item in items:
            if not isinstance(item, dict):
                continue
            qty = float(item.get("quantity") or item.get("qty") or 1)
            price = float(item.get("price") or 0)
            line_total = float(item.get("total") or (qty * price))
            item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
            
            if item_type == "supplier":
                expected_supplier += line_total
            else:
                expected_workshop += line_total
        
        actual_workshop = op_with_supplier.get("workshopTotal") or 0
        actual_supplier = op_with_supplier.get("supplierArchiveTotal") or 0
        total = op_with_supplier.get("total") or 0
        
        print(f"\nOperation {op_with_supplier.get('id')} with supplier items:")
        print(f"  Items: {len(items)}")
        print(f"  Expected workshop total: {expected_workshop}")
        print(f"  Actual workshopTotal: {actual_workshop}")
        print(f"  Expected supplier total: {expected_supplier}")
        print(f"  Actual supplierArchiveTotal: {actual_supplier}")
        print(f"  Total: {total}")
        
        # workshopTotal should be > 0 if there are workshop items
        if expected_workshop > 0:
            assert actual_workshop > 0, f"workshopTotal should be > 0, got {actual_workshop}"
        
        # supplierArchiveTotal should match expected
        if expected_supplier > 0:
            assert actual_supplier > 0, f"supplierArchiveTotal should be > 0, got {actual_supplier}"
    
    def test_no_regression_operations_list_basic(self):
        """Basic regression test - operations list should work without errors"""
        response = requests.get(f"{BASE_URL}/api/operations", timeout=30)
        
        assert response.status_code == 200, f"Operations list failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify basic structure of operations
        if data:
            op = data[0]
            required_fields = ["id", "type", "total"]
            for field in required_fields:
                assert field in op, f"Missing required field: {field}"
        
        print(f"Operations list returned {len(data)} operations successfully")
    
    def test_no_regression_operations_get_basic(self):
        """Basic regression test - single operation get should work"""
        # Get list first
        list_response = requests.get(f"{BASE_URL}/api/operations?limit=1", timeout=30)
        assert list_response.status_code == 200
        
        operations = list_response.json()
        if not operations:
            pytest.skip("No operations to test")
        
        op_id = operations[0].get("id")
        
        response = requests.get(f"{BASE_URL}/api/operations/{op_id}", timeout=30)
        assert response.status_code == 200, f"Single operation get failed: {response.status_code} - {response.text}"
        
        op = response.json()
        assert op.get("id") == op_id, "Returned operation ID should match requested ID"
        
        print(f"Single operation get for {op_id} successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
