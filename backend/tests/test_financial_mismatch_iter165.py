"""
Iteration 165: Financial Mismatch Audit Test
==============================================
Tests that net_profit/revenue/expenses match between:
- /api/finance/reports/income-statement
- /api/accounts/tree summary

The fix unified the source: accounts/tree now reads from income-statement.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")


class TestFinancialMismatchAudit:
    """Verify financial figures match between income-statement and accounts/tree"""

    def test_income_statement_endpoint_works(self):
        """Test income-statement endpoint returns valid data"""
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        response = requests.get(f"{BASE_URL}/api/finance/reports/income-statement", params=params)
        print(f"Income Statement Status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        totals = data.get("data", {}).get("totals", {})
        print(f"Income Statement Totals: {totals}")
        
        assert "revenue" in totals, "Missing revenue in totals"
        assert "expenses" in totals, "Missing expenses in totals"
        assert "net_income" in totals, "Missing net_income in totals"
        
        return totals

    def test_accounts_tree_endpoint_works(self):
        """Test accounts/tree endpoint returns valid data with summary"""
        params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        response = requests.get(f"{BASE_URL}/api/accounts/tree", params=params)
        print(f"Accounts Tree Status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        summary = data.get("data", {}).get("summary", {})
        print(f"Accounts Tree Summary: {summary}")
        
        assert "revenue" in summary, "Missing revenue in summary"
        assert "expense" in summary or "expenses" in summary, "Missing expense(s) in summary"
        assert "net_profit" in summary, "Missing net_profit in summary"
        
        return summary

    def test_financial_source_is_income_statement(self):
        """Verify accounts/tree uses income-statement as source"""
        params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        response = requests.get(f"{BASE_URL}/api/accounts/tree", params=params)
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("data", {}).get("summary", {})
        
        financial_source = summary.get("financial_source", "")
        print(f"Financial Source: {financial_source}")
        
        assert financial_source == "income_statement", \
            f"Expected financial_source='income_statement', got '{financial_source}'"

    def test_revenue_matches_between_endpoints(self):
        """CRITICAL: Revenue must match between income-statement and accounts/tree"""
        # Get income statement
        income_params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        income_response = requests.get(f"{BASE_URL}/api/finance/reports/income-statement", params=income_params)
        assert income_response.status_code == 200
        income_totals = income_response.json().get("data", {}).get("totals", {})
        income_revenue = float(income_totals.get("revenue", 0))
        
        # Get accounts tree
        tree_params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        tree_response = requests.get(f"{BASE_URL}/api/accounts/tree", params=tree_params)
        assert tree_response.status_code == 200
        tree_summary = tree_response.json().get("data", {}).get("summary", {})
        tree_revenue = float(tree_summary.get("revenue", 0))
        
        delta = abs(income_revenue - tree_revenue)
        print(f"Income Statement Revenue: {income_revenue}")
        print(f"Accounts Tree Revenue: {tree_revenue}")
        print(f"Delta: {delta}")
        
        assert delta == 0, f"Revenue mismatch! Income: {income_revenue}, Tree: {tree_revenue}, Delta: {delta}"

    def test_expenses_matches_between_endpoints(self):
        """CRITICAL: Expenses must match between income-statement and accounts/tree"""
        # Get income statement
        income_params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        income_response = requests.get(f"{BASE_URL}/api/finance/reports/income-statement", params=income_params)
        assert income_response.status_code == 200
        income_totals = income_response.json().get("data", {}).get("totals", {})
        income_expenses = float(income_totals.get("expenses", 0))
        
        # Get accounts tree
        tree_params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        tree_response = requests.get(f"{BASE_URL}/api/accounts/tree", params=tree_params)
        assert tree_response.status_code == 200
        tree_summary = tree_response.json().get("data", {}).get("summary", {})
        tree_expense = float(tree_summary.get("expense", 0))
        
        delta = abs(income_expenses - tree_expense)
        print(f"Income Statement Expenses: {income_expenses}")
        print(f"Accounts Tree Expense: {tree_expense}")
        print(f"Delta: {delta}")
        
        assert delta == 0, f"Expenses mismatch! Income: {income_expenses}, Tree: {tree_expense}, Delta: {delta}"

    def test_net_profit_matches_between_endpoints(self):
        """CRITICAL: Net profit/income must match between income-statement and accounts/tree"""
        # Get income statement
        income_params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        income_response = requests.get(f"{BASE_URL}/api/finance/reports/income-statement", params=income_params)
        assert income_response.status_code == 200
        income_totals = income_response.json().get("data", {}).get("totals", {})
        income_net = float(income_totals.get("net_income", 0))
        
        # Get accounts tree
        tree_params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        tree_response = requests.get(f"{BASE_URL}/api/accounts/tree", params=tree_params)
        assert tree_response.status_code == 200
        tree_summary = tree_response.json().get("data", {}).get("summary", {})
        tree_net = float(tree_summary.get("net_profit", 0))
        
        delta = abs(income_net - tree_net)
        print(f"Income Statement Net Income: {income_net}")
        print(f"Accounts Tree Net Profit: {tree_net}")
        print(f"Delta: {delta}")
        
        assert delta == 0, f"Net profit mismatch! Income: {income_net}, Tree: {tree_net}, Delta: {delta}"

    def test_all_deltas_are_zero(self):
        """COMPREHENSIVE: All financial deltas must be zero after fix"""
        # Get income statement
        income_params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        income_response = requests.get(f"{BASE_URL}/api/finance/reports/income-statement", params=income_params)
        assert income_response.status_code == 200
        income_totals = income_response.json().get("data", {}).get("totals", {})
        
        # Get accounts tree
        tree_params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        tree_response = requests.get(f"{BASE_URL}/api/accounts/tree", params=tree_params)
        assert tree_response.status_code == 200
        tree_summary = tree_response.json().get("data", {}).get("summary", {})
        
        # Calculate all deltas
        revenue_delta = abs(float(income_totals.get("revenue", 0)) - float(tree_summary.get("revenue", 0)))
        expenses_delta = abs(float(income_totals.get("expenses", 0)) - float(tree_summary.get("expense", 0)))
        net_delta = abs(float(income_totals.get("net_income", 0)) - float(tree_summary.get("net_profit", 0)))
        
        print(f"\n=== FINANCIAL MISMATCH AUDIT RESULTS ===")
        print(f"Revenue Delta: {revenue_delta}")
        print(f"Expenses Delta: {expenses_delta}")
        print(f"Net Profit Delta: {net_delta}")
        print(f"Total Absolute Delta: {revenue_delta + expenses_delta + net_delta}")
        print(f"=========================================\n")
        
        total_delta = revenue_delta + expenses_delta + net_delta
        assert total_delta == 0, f"Financial mismatch detected! Total delta: {total_delta}"
        
        print("✅ VERDICT: Financial mismatch RESOLVED - all deltas are zero")


class TestFinancialDashboardConsistency:
    """Test that financial dashboard shows consistent data"""

    def test_balance_sheet_endpoint(self):
        """Test balance sheet endpoint works"""
        params = {
            "workshop_id": WORKSHOP_ID,
            "as_of_date": "2026-12-31",
        }
        response = requests.get(f"{BASE_URL}/api/finance/reports/balance-sheet", params=params)
        print(f"Balance Sheet Status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True or "data" in data

    def test_trial_balance_endpoint(self):
        """Test trial balance endpoint works"""
        params = {
            "workshop_id": WORKSHOP_ID,
            "date": "2026-12-31",
        }
        response = requests.get(f"{BASE_URL}/api/finance/reports/trial-balance", params=params)
        print(f"Trial Balance Status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True or "data" in data

    def test_cash_flow_endpoint(self):
        """Test cash flow endpoint works"""
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        response = requests.get(f"{BASE_URL}/api/finance/reports/cash-flow", params=params)
        print(f"Cash Flow Status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True or "data" in data


class TestChartOfAccountsPageIntegration:
    """Test that ChartOfAccounts page displays correct income snapshot"""

    def test_income_snapshot_source_unified(self):
        """Verify income snapshot in ChartOfAccounts uses income-statement"""
        # The frontend fetches income-statement directly for incomeSnapshot
        # and accounts/tree for the tree data
        # Both should now show the same revenue/expenses/net values
        
        income_params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2000-01-01",
            "end_date": "2026-12-31",
        }
        income_response = requests.get(f"{BASE_URL}/api/finance/reports/income-statement", params=income_params)
        assert income_response.status_code == 200
        income_totals = income_response.json().get("data", {}).get("totals", {})
        
        tree_params = {
            "workshop_id": WORKSHOP_ID,
            "type": "all",
            "hideZero": "false",
            "search": "",
        }
        tree_response = requests.get(f"{BASE_URL}/api/accounts/tree", params=tree_params)
        assert tree_response.status_code == 200
        tree_summary = tree_response.json().get("data", {}).get("summary", {})
        
        # Frontend displays:
        # - incomeSnapshot.revenue (from income-statement)
        # - incomeSnapshot.expenses (from income-statement)
        # - incomeSnapshot.net_income (from income-statement)
        # - summary bar also shows revenue/expense/net from accounts/tree
        
        # After fix, both should be identical
        print(f"\n=== CHART OF ACCOUNTS PAGE DATA SOURCES ===")
        print(f"Income Statement (direct fetch):")
        print(f"  Revenue: {income_totals.get('revenue')}")
        print(f"  Expenses: {income_totals.get('expenses')}")
        print(f"  Net Income: {income_totals.get('net_income')}")
        print(f"\nAccounts Tree Summary (unified source):")
        print(f"  Revenue: {tree_summary.get('revenue')}")
        print(f"  Expense: {tree_summary.get('expense')}")
        print(f"  Net Profit: {tree_summary.get('net_profit')}")
        print(f"  Source: {tree_summary.get('financial_source')}")
        print(f"=============================================\n")
        
        # Verify they match
        assert float(income_totals.get("revenue", 0)) == float(tree_summary.get("revenue", 0))
        assert float(income_totals.get("expenses", 0)) == float(tree_summary.get("expense", 0))
        assert float(income_totals.get("net_income", 0)) == float(tree_summary.get("net_profit", 0))


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
