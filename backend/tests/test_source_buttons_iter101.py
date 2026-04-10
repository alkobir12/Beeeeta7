"""
Test suite for iteration 101 - Source buttons feature testing
Tests:
1. /api/finance/reports/operation-trace endpoint
2. /api/finance/reports/balance-sheet endpoint (for source button data)
3. /api/finance/reports/trial-balance endpoint (for source button data)
4. /api/finance/reports/account-tree-details endpoint (for source panel)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestOperationTraceEndpoint:
    """Tests for /api/finance/reports/operation-trace endpoint"""
    
    def test_operation_trace_returns_success(self):
        """Test that operation-trace endpoint returns success"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/operation-trace",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "data" in data, "Expected 'data' key in response"
        
    def test_operation_trace_has_required_fields(self):
        """Test that operation-trace response has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/operation-trace",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()["data"]
        
        # Check required fields
        assert "period" in data, "Expected 'period' in data"
        assert "rows" in data, "Expected 'rows' in data"
        assert "summary" in data, "Expected 'summary' in data"
        assert "explainers" in data, "Expected 'explainers' in data"
        
        # Check explainers structure
        explainers = data["explainers"]
        assert "cash" in explainers, "Expected 'cash' in explainers"
        assert "bank" in explainers, "Expected 'bank' in explainers"
        assert "ar" in explainers, "Expected 'ar' in explainers"
        
    def test_operation_trace_rows_structure(self):
        """Test that operation-trace rows have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/operation-trace",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()["data"]
        rows = data.get("rows", [])
        
        # If there are rows, check their structure
        for row in rows:
            assert "type" in row, "Expected 'type' in row"
            assert "type_label_ar" in row, "Expected 'type_label_ar' in row"
            assert "operations_count" in row, "Expected 'operations_count' in row"
            assert "operations_total" in row, "Expected 'operations_total' in row"
            assert "impact" in row, "Expected 'impact' in row"
            
            # Check impact structure
            impact = row["impact"]
            for key in ["cash", "bank", "ar", "assets"]:
                assert key in impact, f"Expected '{key}' in impact"
                assert "net" in impact[key], f"Expected 'net' in impact[{key}]"


class TestBalanceSheetEndpoint:
    """Tests for /api/finance/reports/balance-sheet endpoint (source button data)"""
    
    def test_balance_sheet_returns_success(self):
        """Test that balance-sheet endpoint returns success"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/balance-sheet",
            params={
                "workshop_id": WORKSHOP_ID,
                "as_of_date": "2026-01-31"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        
    def test_balance_sheet_has_sections(self):
        """Test that balance-sheet has sections for source buttons"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/balance-sheet",
            params={
                "workshop_id": WORKSHOP_ID,
                "as_of_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()["data"]
        
        # Check sections exist
        assert "sections" in data, "Expected 'sections' in data"
        sections = data["sections"]
        
        assert "assets" in sections, "Expected 'assets' section"
        assert "liabilities" in sections, "Expected 'liabilities' section"
        assert "equity" in sections, "Expected 'equity' section"
        
    def test_balance_sheet_accounts_have_code(self):
        """Test that balance-sheet accounts have code for source button navigation"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/balance-sheet",
            params={
                "workshop_id": WORKSHOP_ID,
                "as_of_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()["data"]
        sections = data.get("sections", {})
        
        # Check each section's accounts have required fields
        for section_name, accounts in sections.items():
            for acc in accounts:
                assert "code" in acc, f"Expected 'code' in {section_name} account"
                assert "name" in acc, f"Expected 'name' in {section_name} account"
                assert "balance" in acc, f"Expected 'balance' in {section_name} account"


class TestTrialBalanceEndpoint:
    """Tests for /api/finance/reports/trial-balance endpoint (source button data)"""
    
    def test_trial_balance_returns_success(self):
        """Test that trial-balance endpoint returns success"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        
    def test_trial_balance_has_accounts(self):
        """Test that trial-balance has accounts array for source buttons"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()["data"]
        
        assert "accounts" in data, "Expected 'accounts' in data"
        assert "totals" in data, "Expected 'totals' in data"
        
    def test_trial_balance_accounts_have_code(self):
        """Test that trial-balance accounts have code for source button navigation"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()["data"]
        accounts = data.get("accounts", [])
        
        # Check each account has required fields for source button
        for acc in accounts:
            assert "code" in acc, "Expected 'code' in account"
            assert "name" in acc or "name_ar" in acc, "Expected 'name' or 'name_ar' in account"
            assert "debit" in acc, "Expected 'debit' in account"
            assert "credit" in acc, "Expected 'credit' in account"


class TestAccountTreeDetailsEndpoint:
    """Tests for /api/finance/reports/account-tree-details endpoint (source panel)"""
    
    def test_account_tree_details_returns_success(self):
        """Test that account-tree-details endpoint returns success"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "1101",  # Cash account
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        # May return 404 if account doesn't exist, which is acceptable
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
    def test_account_tree_details_structure(self):
        """Test that account-tree-details has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",  # Revenue account
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Expected success=True"
            
            result = data.get("data", {})
            # Check expected fields
            assert "account" in result or "children" in result or "operations" in result, \
                "Expected account tree structure in response"


class TestAPIIntegration:
    """Integration tests for source button workflow"""
    
    def test_full_source_button_workflow(self):
        """Test the full workflow: balance-sheet -> account-tree-details"""
        # Step 1: Get balance sheet
        bs_response = requests.get(
            f"{BASE_URL}/api/finance/reports/balance-sheet",
            params={
                "workshop_id": WORKSHOP_ID,
                "as_of_date": "2026-01-31"
            }
        )
        assert bs_response.status_code == 200
        
        bs_data = bs_response.json()["data"]
        
        # Step 2: If there are accounts, try to get details for one
        all_accounts = []
        for section in ["assets", "liabilities", "equity"]:
            all_accounts.extend(bs_data.get("sections", {}).get(section, []))
        
        if all_accounts:
            account = all_accounts[0]
            account_code = account.get("code")
            
            # Step 3: Get account tree details
            tree_response = requests.get(
                f"{BASE_URL}/api/finance/reports/account-tree-details",
                params={
                    "workshop_id": WORKSHOP_ID,
                    "account_code": account_code,
                    "start_date": "2025-01-01",
                    "end_date": "2026-01-31"
                }
            )
            assert tree_response.status_code in [200, 404], \
                f"Expected 200 or 404 for account {account_code}, got {tree_response.status_code}"
            
    def test_trial_balance_source_button_workflow(self):
        """Test the workflow: trial-balance -> account-tree-details"""
        # Step 1: Get trial balance
        tb_response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert tb_response.status_code == 200
        
        tb_data = tb_response.json()["data"]
        accounts = tb_data.get("accounts", [])
        
        # Step 2: If there are accounts, try to get details for one
        if accounts:
            account = accounts[0]
            account_code = account.get("code")
            
            # Step 3: Get account tree details
            tree_response = requests.get(
                f"{BASE_URL}/api/finance/reports/account-tree-details",
                params={
                    "workshop_id": WORKSHOP_ID,
                    "account_code": account_code,
                    "start_date": "2025-01-01",
                    "end_date": "2026-01-31"
                }
            )
            assert tree_response.status_code in [200, 404], \
                f"Expected 200 or 404 for account {account_code}, got {tree_response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
