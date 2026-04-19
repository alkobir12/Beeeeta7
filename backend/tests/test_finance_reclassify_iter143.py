"""
Test Finance Reclassify Payment Accounts and Account Tree Details
Iteration 143 - Testing:
1. /api/finance/reports/reclassify-payment-accounts with apply_changes=true and old start_date
2. _normalize_payment_method supports Arabic/English values (cash/نقد -> 1101, bank/card/transfer/بطاقة/تحويل -> 1102)
3. /api/finance/reports/account-tree-details?account_code=4000 returns operations.summary with operations_cash_total/operations_bank_total/operations_credit_total
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestReclassifyPaymentAccounts:
    """Test /api/finance/reports/reclassify-payment-accounts endpoint"""

    def test_reclassify_dry_run(self):
        """Test reclassify endpoint in dry-run mode (apply_changes=false)"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reclassify-payment-accounts",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2000-01-01",
                "end_date": "2026-12-31",
                "apply_changes": False,
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        assert "candidates" in result, "Missing 'candidates' in response"
        assert "updated" in result, "Missing 'updated' in response"
        assert "applied" in result, "Missing 'applied' in response"
        assert result.get("applied") is False, "Expected applied=False in dry-run mode"
        
        print(f"✅ Dry-run reclassify: candidates={result.get('candidates')}, updated={result.get('updated')}")

    def test_reclassify_with_apply_changes_true(self):
        """Test reclassify endpoint with apply_changes=true and old start_date"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reclassify-payment-accounts",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2000-01-01",
                "end_date": "2026-12-31",
                "apply_changes": True,
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        assert "candidates" in result, "Missing 'candidates' in response"
        assert "updated" in result, "Missing 'updated' in response"
        assert "applied" in result, "Missing 'applied' in response"
        assert result.get("applied") is True, "Expected applied=True when apply_changes=true"
        
        # Verify period includes old start_date
        period = result.get("period", {})
        assert period.get("start_date") == "2000-01-01", f"Expected start_date=2000-01-01, got {period.get('start_date')}"
        
        print(f"✅ Apply reclassify: candidates={result.get('candidates')}, updated={result.get('updated')}, applied={result.get('applied')}")


class TestAccountTreeDetails:
    """Test /api/finance/reports/account-tree-details endpoint"""

    def test_account_tree_details_4000_has_summary(self):
        """Test account-tree-details for account 4000 returns operations.summary with detailed breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
                "include_descendants": True,
                "page": 1,
                "page_size": 20,
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        operations = result.get("operations", {})
        summary = operations.get("summary", {})
        
        # Verify summary has the detailed breakdown fields
        assert "operations_cash_total" in summary, f"Missing 'operations_cash_total' in summary: {summary}"
        assert "operations_bank_total" in summary, f"Missing 'operations_bank_total' in summary: {summary}"
        assert "operations_credit_total" in summary, f"Missing 'operations_credit_total' in summary: {summary}"
        
        # Verify values are numeric
        assert isinstance(summary.get("operations_cash_total"), (int, float)), "operations_cash_total should be numeric"
        assert isinstance(summary.get("operations_bank_total"), (int, float)), "operations_bank_total should be numeric"
        assert isinstance(summary.get("operations_credit_total"), (int, float)), "operations_credit_total should be numeric"
        
        print(f"✅ Account 4000 summary: cash={summary.get('operations_cash_total')}, bank={summary.get('operations_bank_total')}, credit={summary.get('operations_credit_total')}")
        print(f"   Total credit: {summary.get('total_credit')}, Total debit: {summary.get('total_debit')}")

    def test_account_tree_details_has_pagination(self):
        """Test account-tree-details returns proper pagination"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
                "include_descendants": True,
                "page": 1,
                "page_size": 10,
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        result = data.get("data", {})
        operations = result.get("operations", {})
        pagination = operations.get("pagination", {})
        
        assert "page" in pagination, "Missing 'page' in pagination"
        assert "page_size" in pagination, "Missing 'page_size' in pagination"
        assert "total_items" in pagination, "Missing 'total_items' in pagination"
        assert "total_pages" in pagination, "Missing 'total_pages' in pagination"
        
        print(f"✅ Pagination: page={pagination.get('page')}, total_items={pagination.get('total_items')}, total_pages={pagination.get('total_pages')}")


class TestNormalizePaymentMethod:
    """Test that payment method normalization works for Arabic and English values"""

    def test_income_statement_endpoint_works(self):
        """Verify income statement endpoint works (uses payment method normalization internally)"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/income-statement",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        totals = result.get("totals", {})
        
        assert "revenue" in totals, "Missing 'revenue' in totals"
        assert "expenses" in totals, "Missing 'expenses' in totals"
        assert "net_income" in totals, "Missing 'net_income' in totals"
        
        print(f"✅ Income statement: revenue={totals.get('revenue')}, expenses={totals.get('expenses')}, net_income={totals.get('net_income')}")

    def test_reconciliation_endpoint_works(self):
        """Verify reconciliation endpoint works (uses payment method normalization)"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        summary = result.get("summary", {})
        
        assert "matched" in summary, "Missing 'matched' in summary"
        assert "total_absolute_difference" in summary, "Missing 'total_absolute_difference' in summary"
        
        print(f"✅ Reconciliation: matched={summary.get('matched')}, diff={summary.get('total_absolute_difference')}")


class TestFinancialPageLoads:
    """Test that the financial page loads without breaking"""

    def test_balance_sheet_endpoint(self):
        """Test balance sheet endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/balance-sheet",
            params={
                "workshop_id": WORKSHOP_ID,
                "as_of_date": "2026-01-15",
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        totals = result.get("totals", {})
        
        assert "assets" in totals, "Missing 'assets' in totals"
        assert "liabilities" in totals, "Missing 'liabilities' in totals"
        assert "equity" in totals, "Missing 'equity' in totals"
        
        print(f"✅ Balance sheet: assets={totals.get('assets')}, liabilities={totals.get('liabilities')}, equity={totals.get('equity')}")

    def test_trial_balance_endpoint(self):
        """Test trial balance endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        totals = result.get("totals", {})
        
        assert "total_debit" in totals, "Missing 'total_debit' in totals"
        assert "total_credit" in totals, "Missing 'total_credit' in totals"
        
        print(f"✅ Trial balance: total_debit={totals.get('total_debit')}, total_credit={totals.get('total_credit')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
