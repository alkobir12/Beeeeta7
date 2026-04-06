"""
Iteration 77: Test account-tree-details and reconciliation APIs
- GET /api/finance/reports/account-tree-details with pagination
- GET /api/finance/reports/reconciliation with type_label_ar and account_labels
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestAccountTreeDetailsAPI:
    """Tests for GET /api/finance/reports/account-tree-details endpoint"""

    def test_account_tree_details_returns_success(self):
        """Test that account-tree-details returns success=true"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-01-31",
                "page": 1,
                "page_size": 10
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True

    def test_account_tree_details_returns_account_info(self):
        """Test that account-tree-details returns account info with code, name, type"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        account = data.get("data", {}).get("account", {})
        assert "code" in account
        assert "name" in account
        assert "type" in account
        assert account["code"] == "4000"

    def test_account_tree_details_returns_children(self):
        """Test that account-tree-details returns children array"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        children = data.get("data", {}).get("children", [])
        assert isinstance(children, list)
        # Check children structure if any exist
        if children:
            child = children[0]
            assert "code" in child
            assert "name" in child
            assert "has_children" in child

    def test_account_tree_details_returns_operations_with_pagination(self):
        """Test that account-tree-details returns operations with pagination info"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-01-31",
                "page": 1,
                "page_size": 5
            }
        )
        assert response.status_code == 200
        data = response.json()
        operations = data.get("data", {}).get("operations", {})
        
        # Check operations structure
        assert "items" in operations
        assert "pagination" in operations
        
        # Check pagination structure
        pagination = operations.get("pagination", {})
        assert "page" in pagination
        assert "page_size" in pagination
        assert "total_items" in pagination
        assert "total_pages" in pagination
        assert "has_next" in pagination
        assert "has_prev" in pagination

    def test_account_tree_details_pagination_page_size(self):
        """Test that page_size parameter is respected"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-01-31",
                "page": 1,
                "page_size": 3
            }
        )
        assert response.status_code == 200
        data = response.json()
        pagination = data.get("data", {}).get("operations", {}).get("pagination", {})
        assert pagination.get("page_size") == 3

    def test_account_tree_details_child_account(self):
        """Test fetching details for a child account (4100)"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4100",
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        account = data.get("data", {}).get("account", {})
        assert account.get("code") == "4100"


class TestReconciliationAPI:
    """Tests for GET /api/finance/reports/reconciliation endpoint"""

    def test_reconciliation_returns_success(self):
        """Test that reconciliation returns success=true"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True

    def test_reconciliation_rows_have_type_label_ar(self):
        """Test that reconciliation rows include type_label_ar field"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        # Check that all rows have type_label_ar
        for row in rows:
            assert "type_label_ar" in row, f"Row missing type_label_ar: {row}"
            assert row["type_label_ar"], f"type_label_ar is empty for type: {row.get('type')}"

    def test_reconciliation_rows_have_account_labels(self):
        """Test that reconciliation rows include account_labels field"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        # Check that all rows have account_labels array
        for row in rows:
            assert "account_labels" in row, f"Row missing account_labels: {row}"
            assert isinstance(row["account_labels"], list), f"account_labels should be a list"

    def test_reconciliation_type_label_ar_values(self):
        """Test that type_label_ar has correct Arabic translations"""
        expected_labels = {
            "sale": "بيع",
            "purchase": "شراء",
            "expense": "مصروف",
            "sale_return": "مرتجع بيع",
            "purchase_return": "مرتجع شراء",
            "payment_order": "أمر سداد"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        for row in rows:
            row_type = row.get("type")
            if row_type in expected_labels:
                assert row.get("type_label_ar") == expected_labels[row_type], \
                    f"Expected '{expected_labels[row_type]}' for type '{row_type}', got '{row.get('type_label_ar')}'"

    def test_reconciliation_includes_all_tracked_types(self):
        """Test that reconciliation includes all 6 tracked types"""
        expected_types = {"sale", "purchase", "expense", "sale_return", "purchase_return", "payment_order"}
        
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        actual_types = {row.get("type") for row in rows}
        assert expected_types == actual_types, f"Expected types {expected_types}, got {actual_types}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
