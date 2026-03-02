"""
Test Chart of Accounts API endpoints
Tests: POST /api/finance/chart-of-accounts, GET /api/finance/chart-of-accounts
Features: Create accounts with all types, duplicate code rejection, default type assignment
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestChartOfAccountsGET:
    """GET /api/finance/chart-of-accounts endpoint tests"""
    
    def test_get_chart_of_accounts_success(self, api_client):
        """Test GET returns accounts list successfully"""
        response = api_client.get(f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert 'data' in data
        assert isinstance(data['data'], list)
        
        # Verify account structure if data exists
        if len(data['data']) > 0:
            account = data['data'][0]
            assert 'code' in account
            assert 'name' in account or 'name_ar' in account
            assert 'type' in account


class TestChartOfAccountsPOST:
    """POST /api/finance/chart-of-accounts endpoint tests"""
    
    def test_create_revenue_account(self, api_client):
        """Test creating a revenue type account"""
        test_code = f"TEST_REV_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "name": "حساب إيراد تجريبي",
            "name_ar": "حساب إيراد تجريبي",
            "type": "revenue"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert data.get('data', {}).get('type') == 'revenue'
        assert data.get('data', {}).get('code') == test_code
        
    def test_create_expense_account(self, api_client):
        """Test creating an expense type account"""
        test_code = f"TEST_EXP_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "name": "مصروف تجريبي",
            "type": "expense"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert data.get('data', {}).get('type') == 'expense'
        
    def test_create_liability_account(self, api_client):
        """Test creating a liability type account"""
        test_code = f"TEST_LIA_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "name": "التزام تجريبي",
            "type": "liability"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert data.get('data', {}).get('type') == 'liability'
        
    def test_create_asset_account(self, api_client):
        """Test creating an asset type account"""
        test_code = f"TEST_AST_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "name": "أصل تجريبي",
            "type": "asset"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert data.get('data', {}).get('type') == 'asset'
        
    def test_create_equity_account(self, api_client):
        """Test creating an equity type account"""
        test_code = f"TEST_EQU_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "name": "حقوق ملكية تجريبية",
            "type": "equity"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert data.get('data', {}).get('type') == 'equity'
        
    def test_create_account_default_type(self, api_client):
        """Test that account defaults to 'asset' type when not specified"""
        test_code = f"TEST_DEF_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "name": "حساب بدون نوع محدد"
            # No 'type' specified - should default to 'asset'
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert data.get('data', {}).get('type') == 'asset', "Default type should be 'asset'"
        
    def test_duplicate_code_rejected(self, api_client):
        """Test that duplicate account code is rejected with error message"""
        # Using an existing code (1101 is النقد from the standard chart)
        payload = {
            "code": "1101",
            "name": "حساب مكرر",
            "type": "asset"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        # Should return 400 with error message
        assert response.status_code == 400
        data = response.json()
        # Check for Arabic error message about duplicate code
        assert 'موجود' in data.get('detail', '') or 'مسبقاً' in data.get('detail', '')
        
    def test_missing_code_rejected(self, api_client):
        """Test that missing code is rejected"""
        payload = {
            "name": "حساب بدون رمز",
            "type": "asset"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 400
        
    def test_missing_name_rejected(self, api_client):
        """Test that missing name is rejected"""
        test_code = f"TEST_NONAME_{uuid.uuid4().hex[:8]}"
        payload = {
            "code": test_code,
            "type": "asset"
            # No 'name' specified
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=payload
        )
        
        assert response.status_code == 400


class TestAccountCreationAndRetrieval:
    """Integration test: Create account and verify it appears in GET"""
    
    def test_create_account_and_verify_in_list(self, api_client):
        """Test that created account appears in chart-of-accounts list"""
        test_code = f"TEST_INT_{uuid.uuid4().hex[:8]}"
        test_name = f"حساب تكامل {datetime.now().strftime('%H%M%S')}"
        
        # Create account
        create_payload = {
            "code": test_code,
            "name": test_name,
            "type": "revenue"
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}",
            json=create_payload
        )
        
        assert create_response.status_code == 200
        create_data = create_response.json()
        assert create_data.get('success') is True
        
        # Verify in GET list
        get_response = api_client.get(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id={WORKSHOP_ID}"
        )
        
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data.get('success') is True
        
        # Find our created account
        accounts = get_data.get('data', [])
        found_account = next((a for a in accounts if a.get('code') == test_code), None)
        
        assert found_account is not None, f"Created account {test_code} not found in list"
        assert found_account.get('type') == 'revenue'


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
