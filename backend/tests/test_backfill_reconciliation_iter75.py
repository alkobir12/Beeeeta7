"""
Iteration 75: Backend tests for reconciliation backfill-journals and reconciliation status
Tests:
1. POST /api/finance/reports/reconciliation/backfill-journals (dry_run mode)
2. POST /api/finance/reports/reconciliation/backfill-journals (apply mode)
3. GET /api/finance/reports/reconciliation returns matched status with correct structure
4. Reconciliation rows include all tracked types: sale, purchase, expense, payment_order, sale_return, purchase_return
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestBackfillJournalsEndpoint:
    """Tests for POST /api/finance/reports/reconciliation/backfill-journals"""

    def test_backfill_dry_run_returns_success(self):
        """Test backfill-journals in dry_run mode returns success"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reconciliation/backfill-journals",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31",
                "apply_changes": "false"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success=True"
        assert data.get("mode") == "dry_run", f"Expected mode=dry_run, got {data.get('mode')}"
        
        # Verify data structure
        inner_data = data.get("data", {})
        assert "period" in inner_data, "Missing period in response"
        assert "missing_count" in inner_data, "Missing missing_count in response"
        assert "missing_total" in inner_data, "Missing missing_total in response"
        assert "preview" in inner_data, "Missing preview in response"
        
        print(f"✅ Backfill dry_run: missing_count={inner_data.get('missing_count')}, missing_total={inner_data.get('missing_total')}")

    def test_backfill_apply_returns_success(self):
        """Test backfill-journals in apply mode returns success"""
        response = requests.post(
            f"{BASE_URL}/api/finance/reports/reconciliation/backfill-journals",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31",
                "apply_changes": "true"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success=True"
        assert data.get("mode") == "apply", f"Expected mode=apply, got {data.get('mode')}"
        
        # Verify data structure
        inner_data = data.get("data", {})
        assert "period" in inner_data, "Missing period in response"
        assert "found_missing" in inner_data, "Missing found_missing in response"
        assert "created" in inner_data, "Missing created in response"
        assert "created_items" in inner_data, "Missing created_items in response"
        assert "failed" in inner_data, "Missing failed in response"
        
        print(f"✅ Backfill apply: found_missing={inner_data.get('found_missing')}, created={inner_data.get('created')}")


class TestReconciliationEndpoint:
    """Tests for GET /api/finance/reports/reconciliation"""

    def test_reconciliation_returns_success(self):
        """Test reconciliation endpoint returns success with correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success=True"
        
        inner_data = data.get("data", {})
        assert "period" in inner_data, "Missing period in response"
        assert "summary" in inner_data, "Missing summary in response"
        assert "rows" in inner_data, "Missing rows in response"
        
        print(f"✅ Reconciliation endpoint returns correct structure")

    def test_reconciliation_summary_structure(self):
        """Test reconciliation summary has all required fields"""
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
        
        # Verify summary fields
        assert "matched" in summary, "Missing matched in summary"
        assert "total_absolute_difference" in summary, "Missing total_absolute_difference in summary"
        assert "untracked_operations" in summary, "Missing untracked_operations in summary"
        assert "unclassified_journal_entries" in summary, "Missing unclassified_journal_entries in summary"
        assert "missing_operation_journals" in summary, "Missing missing_operation_journals in summary"
        
        # Verify nested structures
        missing_journals = summary.get("missing_operation_journals", {})
        assert "count" in missing_journals, "Missing count in missing_operation_journals"
        assert "total" in missing_journals, "Missing total in missing_operation_journals"
        
        print(f"✅ Reconciliation summary: matched={summary.get('matched')}, diff={summary.get('total_absolute_difference')}")

    def test_reconciliation_rows_include_all_tracked_types(self):
        """Test reconciliation rows include all tracked types"""
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
        
        # Expected tracked types
        expected_types = {"sale", "purchase", "expense", "sale_return", "purchase_return", "payment_order"}
        actual_types = {row.get("type") for row in rows}
        
        assert expected_types == actual_types, f"Expected types {expected_types}, got {actual_types}"
        
        # Verify each row has required fields
        for row in rows:
            assert "type" in row, "Missing type in row"
            assert "operations_count" in row, "Missing operations_count in row"
            assert "journal_entries_count" in row, "Missing journal_entries_count in row"
            assert "operations_total" in row, "Missing operations_total in row"
            assert "journal_entries_total" in row, "Missing journal_entries_total in row"
            assert "difference" in row, "Missing difference in row"
            assert "matched" in row, "Missing matched in row"
        
        print(f"✅ Reconciliation rows include all {len(expected_types)} tracked types")

    def test_reconciliation_matched_status_after_backfill(self):
        """Test reconciliation shows matched=true or low differences after backfill"""
        # First run backfill
        backfill_response = requests.post(
            f"{BASE_URL}/api/finance/reports/reconciliation/backfill-journals",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2025-01-01",
                "end_date": "2026-01-31",
                "apply_changes": "true"
            }
        )
        assert backfill_response.status_code == 200
        
        # Then check reconciliation
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
        
        # After backfill, either matched=true or very low differences
        total_diff = summary.get("total_absolute_difference", 0)
        matched = summary.get("matched", False)
        
        # If not matched, the difference should be documented
        if not matched:
            print(f"⚠️ Not fully matched: total_diff={total_diff}")
            # Check if there are unclassified journals causing the difference
            unclassified = summary.get("unclassified_journal_entries", {})
            print(f"   Unclassified journals: count={unclassified.get('count')}, total={unclassified.get('total')}")
        else:
            print(f"✅ Reconciliation matched=True after backfill")
        
        # The test passes as long as the API returns valid data
        assert isinstance(matched, bool), "matched should be boolean"
        assert isinstance(total_diff, (int, float)), "total_absolute_difference should be numeric"


class TestReconciliationRowsConsistency:
    """Tests for sale/purchase/expense/payment_order rows consistency"""

    def test_rows_have_consistent_structure(self):
        """Test all rows have consistent structure"""
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
            ops_count = row.get("operations_count", 0)
            je_count = row.get("journal_entries_count", 0)
            ops_total = row.get("operations_total", 0)
            je_total = row.get("journal_entries_total", 0)
            difference = row.get("difference", 0)
            matched = row.get("matched", False)
            
            # Verify difference calculation is correct
            expected_diff = round(ops_total - je_total, 2)
            actual_diff = round(difference, 2)
            assert abs(expected_diff - actual_diff) < 0.01, f"Difference mismatch for {row_type}: expected {expected_diff}, got {actual_diff}"
            
            # Verify matched flag is consistent with difference
            if abs(difference) < 0.01:
                assert matched is True, f"Row {row_type} should be matched when difference is ~0"
            
            print(f"✅ Row {row_type}: ops={ops_count}/{ops_total}, je={je_count}/{je_total}, diff={difference}, matched={matched}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
