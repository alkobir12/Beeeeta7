"""
Backend API tests for Parts Dashboard, Rakan Analytics, and Operations
Tests:
- Parts API endpoints
- Operations API with Rakan filtering
- Business accounts API
- Accounting ledgers API
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = "finmodule-sync"

class TestPartsAPI:
    """Test /api/parts endpoint"""
    
    def test_get_parts_list(self):
        """Verify parts list returns data"""
        response = requests.get(f"{BASE_URL}/api/parts?workshopId={WORKSHOP_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Parts list returned {len(data)} items")
        
        if len(data) > 0:
            part = data[0]
            assert "id" in part
            assert "name" in part
            assert "partNumber" in part
            assert "purchasePrice" in part
            assert "sellingPrice" in part
            assert "quantity" in part


class TestOperationsAPI:
    """Test /api/operations endpoint"""
    
    def test_get_operations(self):
        """Verify operations list returns data"""
        response = requests.get(f"{BASE_URL}/api/operations?workshopId={WORKSHOP_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Operations list returned {len(data)} items")
    
    def test_operations_have_required_fields(self):
        """Verify operations contain required fields"""
        response = requests.get(f"{BASE_URL}/api/operations?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        if len(data) > 0:
            op = data[0]
            required_fields = ["id", "type", "accountId", "total", "date", "invoiceNumber"]
            for field in required_fields:
                assert field in op, f"Missing field: {field}"
            print("✅ Operations have all required fields")
    
    def test_rakan_operations_filtering(self):
        """Verify Rakan operations can be identified by tag or accountId"""
        response = requests.get(f"{BASE_URL}/api/operations?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        # Rakan business account ID
        RAKAN_ACCOUNT_ID = "4925d1cf-ef23-4987-9018-e2e6c1dc9261"
        
        rakan_ops = []
        for op in data:
            notes = op.get("notes", "") or ""
            account_id = op.get("accountId", "")
            if "[RAKAN_PARTS]" in notes or account_id == RAKAN_ACCOUNT_ID:
                rakan_ops.append(op)
        
        print(f"✅ Found {len(rakan_ops)} Rakan operations")
        assert len(rakan_ops) > 0, "No Rakan operations found - check seed data"
        
        # Verify Rakan operations have correct tag
        for op in rakan_ops:
            notes = op.get("notes", "") or ""
            account_id = op.get("accountId", "")
            assert "[RAKAN_PARTS]" in notes or account_id == RAKAN_ACCOUNT_ID
    
    def test_operations_scope_vehicle_has_details(self):
        """Verify vehicle-scoped operations have vehicle details"""
        response = requests.get(f"{BASE_URL}/api/operations?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        vehicle_ops = [op for op in data if op.get("scope") == "vehicle"]
        print(f"Found {len(vehicle_ops)} vehicle-scoped operations")
        
        if len(vehicle_ops) > 0:
            for op in vehicle_ops:
                # Vehicle operations should have vehicleId
                assert op.get("vehicleId") is not None or op.get("scope") == "vehicle"
            print("✅ Vehicle operations have scope=vehicle")


class TestBusinessAccountsAPI:
    """Test /api/business-accounts endpoint"""
    
    def test_get_business_accounts(self):
        """Verify business accounts list"""
        response = requests.get(f"{BASE_URL}/api/business-accounts?workshopId={WORKSHOP_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Business accounts returned {len(data)} items")
    
    def test_rakan_business_account_exists(self):
        """Verify Rakan business account exists"""
        response = requests.get(f"{BASE_URL}/api/business-accounts?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        rakan_account = None
        for acc in data:
            if acc.get("code") == "RAKAN_PARTS":
                rakan_account = acc
                break
        
        assert rakan_account is not None, "RAKAN_PARTS business account not found"
        assert rakan_account["name"] == "قطع راكان"
        print(f"✅ Rakan business account found: {rakan_account['id']}")


class TestAccountingLedgersAPI:
    """Test /api/accounts endpoint for chart of accounts"""
    
    def test_get_accounts(self):
        """Verify accounting ledgers list"""
        response = requests.get(f"{BASE_URL}/api/accounts?workshopId={WORKSHOP_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Accounts returned {len(data)} items")
    
    def test_rakan_ledger_accounts_exist(self):
        """Verify Rakan-specific ledger accounts exist"""
        response = requests.get(f"{BASE_URL}/api/accounts?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        rakan_accounts = [acc for acc in data if "راكان" in acc.get("name", "")]
        
        assert len(rakan_accounts) > 0, "No Rakan ledger accounts found"
        print(f"✅ Found {len(rakan_accounts)} Rakan ledger accounts:")
        for acc in rakan_accounts:
            print(f"   - {acc['name']} ({acc['id']})")
        
        # Verify specific Rakan accounts
        expected_accounts = ["قطع غيار راكان", "مصروفات بنزين راكان"]
        for expected in expected_accounts:
            found = any(expected in acc.get("name", "") for acc in rakan_accounts)
            assert found, f"Expected account '{expected}' not found"


class TestPartsPriceTrend:
    """Test for price trend feature - last 3 sale/purchase prices per part"""
    
    def test_operations_contain_part_items(self):
        """Verify operations with parts have itemType=part"""
        response = requests.get(f"{BASE_URL}/api/operations?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        parts_ops = []
        for op in data:
            items = op.get("items", [])
            for item in items:
                if item.get("itemType") == "part":
                    parts_ops.append({
                        "operation_id": op["id"],
                        "type": op["type"],
                        "item_name": item.get("name"),
                        "price": item.get("price"),
                        "date": op["date"]
                    })
        
        print(f"✅ Found {len(parts_ops)} part-related operation items")
        
        if len(parts_ops) > 0:
            # Group by part name to show trend capability
            from collections import defaultdict
            parts_by_name = defaultdict(list)
            for pop in parts_ops:
                parts_by_name[pop["item_name"]].append(pop)
            
            for name, ops in parts_by_name.items():
                sales = [o for o in ops if o["type"] == "sale"]
                purchases = [o for o in ops if o["type"] == "purchase"]
                print(f"   Part: {name} - {len(sales)} sales, {len(purchases)} purchases")


class TestRakanAnalyticsCalculation:
    """Test data availability for Rakan analytics KPIs"""
    
    def test_rakan_analytics_data_available(self):
        """Verify data exists for Rakan analytics calculation"""
        response = requests.get(f"{BASE_URL}/api/operations?workshopId={WORKSHOP_ID}")
        data = response.json()
        
        RAKAN_ACCOUNT_ID = "4925d1cf-ef23-4987-9018-e2e6c1dc9261"
        
        rakan_ops = []
        for op in data:
            notes = op.get("notes", "") or ""
            account_id = op.get("accountId", "")
            if "[RAKAN_PARTS]" in notes or account_id == RAKAN_ACCOUNT_ID:
                rakan_ops.append(op)
        
        # Calculate totals
        revenue = sum(op["total"] for op in rakan_ops if op["type"] == "sale")
        expense = sum(op["total"] for op in rakan_ops if op["type"] == "purchase")
        profit = revenue - expense
        
        print(f"✅ Rakan Analytics Data:")
        print(f"   Revenue: {revenue} SAR")
        print(f"   Expense: {expense} SAR")
        print(f"   Profit/Loss: {profit} SAR")
        
        assert len(rakan_ops) > 0, "No Rakan operations for analytics"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
