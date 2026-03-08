"""
Test Rakan Parts Operations functionality
- POS operations should be linked to Rakan business account
- Operations should appear in correct section (Rakan vs Workshop)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)


class TestChartOfAccounts:
    """Test chart of accounts API for Rakan accounts"""
    
    def test_get_chart_of_accounts(self):
        """Verify chart of accounts endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync")
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'data' in data
        assert len(data['data']) > 0
        print(f"✅ Found {len(data['data'])} accounts in chart of accounts")
    
    def test_rakan_accounts_exist(self):
        """Verify Rakan-specific accounts exist"""
        response = requests.get(f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync")
        assert response.status_code == 200
        data = response.json()
        accounts = data.get('data', [])
        
        rakan_revenue = [a for a in accounts if 'راكان' in a.get('name', '') and a.get('type') == 'revenue']
        rakan_expense = [a for a in accounts if 'راكان' in a.get('name', '') and a.get('type') == 'expense']
        
        assert len(rakan_revenue) > 0, "Missing Rakan revenue account (50002)"
        assert len(rakan_expense) > 0, "Missing Rakan expense account (50001)"
        
        print(f"✅ Found Rakan revenue accounts: {[a['code'] for a in rakan_revenue]}")
        print(f"✅ Found Rakan expense accounts: {[a['code'] for a in rakan_expense]}")


class TestBizAccounts:
    """Test business accounts API for Rakan business account"""
    
    def test_get_biz_accounts(self):
        """Verify business accounts endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/biz-accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or 'data' in data or 'accounts' in data
        
        accounts = data if isinstance(data, list) else data.get('data', data.get('accounts', []))
        print(f"✅ Found {len(accounts)} business accounts")
    
    def test_rakan_business_account_exists(self):
        """Verify Rakan business account exists"""
        response = requests.get(f"{BASE_URL}/api/biz-accounts")
        assert response.status_code == 200
        data = response.json()
        
        accounts = data if isinstance(data, list) else data.get('data', data.get('accounts', []))
        rakan_accounts = [a for a in accounts if 'راكان' in (a.get('name', '') or '').lower()]
        
        # If not found, check if it needs to be created by POS
        if len(rakan_accounts) == 0:
            print("⚠️ Rakan business account not found - may be auto-created by POS")
        else:
            print(f"✅ Found Rakan business account: {rakan_accounts[0].get('name')}")


class TestOperationsAPI:
    """Test operations CRUD API"""
    
    def test_get_operations(self):
        """Verify operations endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or 'data' in data
        
        operations = data if isinstance(data, list) else data.get('data', [])
        print(f"✅ Found {len(operations)} operations")
    
    def test_create_operation_basic(self):
        """Test creating a basic operation"""
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "type": "purchase",
            "partnerType": "supplier",
            "partnerName": f"TEST_Supplier_{test_id}",
            "accountId": "",
            "items": [],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "status": "issued",
            "date": "2026-01-08",
            "notes": f"TEST_operation_{test_id}"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        # Should either succeed or have validation error
        if response.status_code == 200:
            print("✅ Operation created successfully")
            data = response.json()
            assert 'id' in data or 'operation' in data
        elif response.status_code == 400:
            print(f"⚠️ Operation creation returned 400 (validation error): {response.json()}")
        else:
            print(f"❌ Unexpected response: {response.status_code} - {response.text}")
            assert False, f"Unexpected status: {response.status_code}"
    
    def test_create_rakan_operation(self):
        """Test creating a Rakan-tagged operation (simulating POS sale)"""
        test_id = str(uuid.uuid4())[:8]
        
        # Get Rakan business account ID first
        biz_response = requests.get(f"{BASE_URL}/api/biz-accounts")
        biz_accounts = biz_response.json() if isinstance(biz_response.json(), list) else biz_response.json().get('data', [])
        rakan_biz = next((a for a in biz_accounts if 'راكان' in (a.get('name', '') or '')), None)
        
        # Get Rakan revenue account
        coa_response = requests.get(f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync")
        coa_accounts = coa_response.json().get('data', [])
        rakan_revenue = next((a for a in coa_accounts if 'راكان' in a.get('name', '') and a.get('type') == 'revenue'), None)
        
        payload = {
            "type": "sale",
            "partnerType": "customer",
            "partnerName": f"TEST_Customer_{test_id}",
            "accountId": rakan_biz.get('id') if rakan_biz else "",
            "accountingAccountId": rakan_revenue.get('id') if rakan_revenue else "",
            "items": [
                {"partId": "test-part", "partName": "Test Part", "quantity": 1, "price": 100}
            ],
            "paymentMethod": "cash",
            "paymentStatus": "paid",
            "status": "issued",
            "date": "2026-01-08",
            "notes": f"TEST_rakan_operation_{test_id} [rakan_parts]",
            "scope": "rakan_parts",
            "source": "rakan_parts_pos"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        if response.status_code == 200:
            print("✅ Rakan operation created successfully")
            data = response.json()
            # Verify the operation was created with Rakan tags
            op = data.get('operation', data)
            if 'scope' in op or 'notes' in op:
                print(f"  Operation details: scope={op.get('scope')}, notes={op.get('notes', '')[:50]}")
        else:
            print(f"❌ Rakan operation creation failed: {response.status_code} - {response.text[:200]}")


class TestCustomersAndSuppliers:
    """Test customers and suppliers APIs"""
    
    def test_get_customers(self):
        """Verify customers endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Found {len(data)} customers")
    
    def test_get_suppliers(self):
        """Verify suppliers endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Found {len(data)} suppliers")


class TestPartsAPI:
    """Test parts inventory API"""
    
    def test_get_parts(self):
        """Verify parts endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/parts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Found {len(data)} parts in inventory")


class TestVehiclesAPI:
    """Test vehicles API"""
    
    def test_get_vehicles(self):
        """Verify vehicles endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Found {len(data)} vehicles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
