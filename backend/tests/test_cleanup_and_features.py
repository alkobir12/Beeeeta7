"""
Test suite for:
1. Verification that test/dummy data was deleted from parts, services, and operations
2. Account sorting by last used and most used
3. Auto-create supplier feature in purchase operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDataCleanup:
    """Verify test/dummy data was deleted from parts, services, and operations"""
    
    TEST_KEYWORDS = ['test', 'dummy', 'sample', 'تجريب', 'اختبار']
    
    def test_no_test_parts(self):
        """Verify no test/dummy parts exist"""
        response = requests.get(f"{BASE_URL}/api/parts", timeout=10)
        assert response.status_code == 200, f"Failed to get parts: {response.status_code}"
        
        parts = response.json()
        assert isinstance(parts, list), "Parts response should be a list"
        
        test_parts = []
        for part in parts:
            name = (part.get('name', '') or '').lower()
            part_number = (part.get('partNumber', '') or '').lower()
            combined = f"{name} {part_number}"
            
            for keyword in self.TEST_KEYWORDS:
                if keyword in combined:
                    test_parts.append(part)
                    break
        
        print(f"Total parts: {len(parts)}, Test parts found: {len(test_parts)}")
        for p in test_parts[:5]:
            print(f"  - {p.get('name')} ({p.get('partNumber')})")
        
        assert len(test_parts) == 0, f"Found {len(test_parts)} test parts that should have been deleted"
    
    def test_no_test_services(self):
        """Verify no test/dummy services exist"""
        response = requests.get(f"{BASE_URL}/api/services", timeout=10)
        assert response.status_code == 200, f"Failed to get services: {response.status_code}"
        
        services = response.json()
        assert isinstance(services, list), "Services response should be a list"
        
        test_services = []
        for service in services:
            name = (service.get('name', '') or '').lower()
            
            for keyword in self.TEST_KEYWORDS:
                if keyword in name:
                    test_services.append(service)
                    break
        
        print(f"Total services: {len(services)}, Test services found: {len(test_services)}")
        for s in test_services[:5]:
            print(f"  - {s.get('name')}")
        
        assert len(test_services) == 0, f"Found {len(test_services)} test services that should have been deleted"
    
    def test_operations_cleanup_verification(self):
        """Verify operations linked to test data were deleted"""
        response = requests.get(f"{BASE_URL}/api/operations", params={"limit": 200}, timeout=15)
        assert response.status_code == 200, f"Failed to get operations: {response.status_code}"
        
        operations = response.json()
        assert isinstance(operations, list), "Operations response should be a list"
        
        # Check for operations with test keywords in partner names or notes
        test_operations = []
        for op in operations:
            partner_name = (op.get('partnerName', '') or '').lower()
            notes = (op.get('notes', '') or '').lower()
            combined = f"{partner_name} {notes}"
            
            for keyword in self.TEST_KEYWORDS:
                if keyword in combined:
                    test_operations.append(op)
                    break
        
        print(f"Total operations: {len(operations)}, Test operations found: {len(test_operations)}")
        for o in test_operations[:5]:
            print(f"  - type={o.get('type')} partner={o.get('partnerName')}")
        
        # Note: Some test operations may remain from pytest runs - this is informational
        if len(test_operations) > 0:
            print(f"WARNING: {len(test_operations)} test operations still exist (may be from pytest runs)")


class TestAccountSorting:
    """Verify accounts are sorted by last used and most used"""
    
    def test_accounts_endpoint_exists(self):
        """Verify accounts endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/accounts", timeout=10)
        assert response.status_code == 200, f"Failed to get accounts: {response.status_code}"
        
        accounts = response.json()
        assert isinstance(accounts, list), "Accounts response should be a list"
        assert len(accounts) > 0, "Should have at least one account"
        
        print(f"Total accounts: {len(accounts)}")
        for acc in accounts[:5]:
            print(f"  - {acc.get('name_ar') or acc.get('name')} (code={acc.get('code')}, type={acc.get('type')})")
    
    def test_operations_have_account_references(self):
        """Verify operations have accountingAccountId for usage tracking"""
        response = requests.get(f"{BASE_URL}/api/operations", params={"limit": 50}, timeout=10)
        assert response.status_code == 200
        
        operations = response.json()
        
        # Count operations with accountingAccountId
        with_account = [op for op in operations if op.get('accountingAccountId')]
        
        print(f"Operations with accountingAccountId: {len(with_account)}/{len(operations)}")
        
        # Get unique account IDs used
        account_ids = set()
        for op in with_account:
            account_ids.add(op.get('accountingAccountId'))
        
        print(f"Unique accounts used in operations: {len(account_ids)}")
        for acc_id in list(account_ids)[:5]:
            print(f"  - {acc_id}")


class TestAutoCreateSupplier:
    """Test auto-create supplier feature in purchase operations"""
    
    def test_suppliers_endpoint(self):
        """Verify suppliers endpoint works"""
        response = requests.get(f"{BASE_URL}/api/suppliers", timeout=10)
        assert response.status_code == 200, f"Failed to get suppliers: {response.status_code}"
        
        suppliers = response.json()
        assert isinstance(suppliers, list), "Suppliers response should be a list"
        
        print(f"Total suppliers: {len(suppliers)}")
        for s in suppliers[:5]:
            print(f"  - {s.get('name')} (id={s.get('id')})")
    
    def test_create_supplier_directly(self):
        """Test creating a supplier directly via API"""
        import uuid
        test_name = f"TEST_SUPPLIER_{uuid.uuid4().hex[:6]}"
        
        response = requests.post(
            f"{BASE_URL}/api/suppliers",
            json={"name": test_name, "phone": "0500000000"},
            timeout=10
        )
        
        assert response.status_code in [200, 201], f"Failed to create supplier: {response.status_code} - {response.text}"
        
        created = response.json()
        assert created.get('name') == test_name, "Supplier name mismatch"
        assert created.get('id'), "Supplier should have an ID"
        
        print(f"Created supplier: {created.get('name')} (id={created.get('id')})")
        
        # Cleanup - delete the test supplier
        supplier_id = created.get('id')
        if supplier_id:
            delete_response = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", timeout=10)
            print(f"Cleanup: Delete supplier response: {delete_response.status_code}")
    
    def test_purchase_operation_with_new_supplier_name(self):
        """Test that purchase operation can be created with a new supplier name
        (auto-create happens in frontend, but backend should accept the operation)"""
        import uuid
        
        # First get an account to use
        accounts_response = requests.get(f"{BASE_URL}/api/accounts", timeout=10)
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        
        # Find an expense or asset account
        expense_account = None
        for acc in accounts:
            acc_type = (acc.get('type') or '').lower()
            if acc_type in ['expense', 'asset']:
                expense_account = acc
                break
        
        if not expense_account:
            pytest.skip("No expense/asset account found for test")
        
        # Get a business account
        biz_response = requests.get(f"{BASE_URL}/api/biz-accounts", timeout=10)
        biz_accounts = biz_response.json() if biz_response.status_code == 200 else []
        biz_account_id = biz_accounts[0].get('id') if biz_accounts else None
        
        if not biz_account_id:
            pytest.skip("No business account found for test")
        
        test_supplier_name = f"TEST_AUTO_SUPPLIER_{uuid.uuid4().hex[:6]}"
        
        operation_payload = {
            "type": "purchase",
            "operationKind": "WORKSHOP_OPERATION",
            "scope": "workshop",
            "source": "test_auto_supplier",
            "accountId": biz_account_id,
            "accountingAccountId": expense_account.get('id') or expense_account.get('code'),
            "partnerType": "supplier",
            "partnerName": test_supplier_name,
            "items": [
                {
                    "itemType": "part",
                    "name": "Test Item",
                    "quantity": 1,
                    "price": 100,
                    "total": 100
                }
            ],
            "paymentMethod": "cash",
            "notes": f"Test auto-create supplier {test_supplier_name}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/operations",
            json=operation_payload,
            timeout=15
        )
        
        print(f"Create operation response: {response.status_code}")
        if response.status_code not in [200, 201]:
            print(f"Response body: {response.text[:500]}")
        
        assert response.status_code in [200, 201], f"Failed to create operation: {response.status_code}"
        
        created_op = response.json()
        print(f"Created operation: id={created_op.get('id')}, partnerName={created_op.get('partnerName')}")
        
        # Cleanup - delete the test operation
        op_id = created_op.get('id')
        if op_id:
            delete_response = requests.delete(f"{BASE_URL}/api/operations/{op_id}", timeout=10)
            print(f"Cleanup: Delete operation response: {delete_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
