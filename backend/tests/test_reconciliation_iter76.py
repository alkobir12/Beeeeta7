"""
Iteration 76: Backend tests for reconciliation and backfill-journals APIs
Tests:
- GET /api/finance/reports/reconciliation returns matched=true and total_absolute_difference=0
- POST /api/finance/reports/reconciliation/backfill-journals dry_run returns missing_count=0
- Reconciliation rows include all tracked types (sale, purchase, expense, payment_order, etc.)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestReconciliationAPI:
    """Tests for GET /api/finance/reports/reconciliation"""

    def test_reconciliation_returns_success(self):
        """Test that reconciliation API returns success"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print(f"✅ Reconciliation API returned success=True")

    def test_reconciliation_matched_true_after_backfill(self):
        """Test that reconciliation returns matched=true and total_absolute_difference=0"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        summary = data.get("data", {}).get("summary", {})
        
        assert summary.get("matched") is True, f"Expected matched=True, got {summary.get('matched')}"
        assert summary.get("total_absolute_difference") == 0.0, f"Expected total_absolute_difference=0, got {summary.get('total_absolute_difference')}"
        print(f"✅ Reconciliation matched=True, total_absolute_difference=0")

    def test_reconciliation_rows_include_all_tracked_types(self):
        """Test that reconciliation rows include all 6 tracked types"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        expected_types = {"sale", "purchase", "expense", "sale_return", "purchase_return", "payment_order"}
        actual_types = {row.get("type") for row in rows}
        
        assert expected_types == actual_types, f"Expected types {expected_types}, got {actual_types}"
        print(f"✅ Reconciliation rows include all 6 tracked types: {actual_types}")

    def test_reconciliation_rows_balanced(self):
        """Test that each reconciliation row is balanced (matched=true)"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        for row in rows:
            row_type = row.get("type")
            matched = row.get("matched")
            difference = row.get("difference", 0)
            assert matched is True, f"Row {row_type} not matched: difference={difference}"
            print(f"✅ Row {row_type}: matched=True, difference={difference}")

    def test_reconciliation_summary_structure(self):
        """Test that reconciliation summary has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        summary = data.get("data", {}).get("summary", {})
        
        # Check required fields
        assert "matched" in summary
        assert "total_absolute_difference" in summary
        assert "untracked_operations" in summary
        assert "unclassified_journal_entries" in summary
        assert "missing_operation_journals" in summary
        
        # Check nested structure
        assert "count" in summary.get("missing_operation_journals", {})
        assert "count" in summary.get("unclassified_journal_entries", {})
        print(f"✅ Reconciliation summary has correct structure")


class TestBackfillJournalsAPI:
    """Tests for POST /api/finance/reports/reconciliation/backfill-journals"""

    def test_backfill_dry_run_returns_success(self):
        """Test that backfill dry_run returns success"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reconciliation/backfill-journals",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31",
                "apply_changes": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data.get("mode") == "dry_run"
        print(f"✅ Backfill dry_run returned success=True, mode=dry_run")

    def test_backfill_dry_run_missing_count_zero(self):
        """Test that backfill dry_run returns missing_count=0 after backfill"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reconciliation/backfill-journals",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31",
                "apply_changes": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        missing_count = data.get("data", {}).get("missing_count", -1)
        
        assert missing_count == 0, f"Expected missing_count=0, got {missing_count}"
        print(f"✅ Backfill dry_run missing_count=0 (no missing journals)")

    def test_backfill_dry_run_structure(self):
        """Test that backfill dry_run response has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reconciliation/backfill-journals",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31",
                "apply_changes": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert "mode" in data
        assert "data" in data
        
        inner_data = data.get("data", {})
        assert "period" in inner_data
        assert "missing_count" in inner_data
        assert "missing_total" in inner_data
        assert "preview" in inner_data
        print(f"✅ Backfill dry_run response has correct structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
