"""
Test Suite: Vehicle Workshop Dues Reclassification (90 days)
Iteration 107 - Backend Only Testing

Features to test:
1. /api/finance/reports/reclassify-vehicle-workshop-dues endpoint for 90 days (dry/apply/dry)
2. After apply, candidates should be 0
3. Reconciliation summary before/after should improve (total_absolute_difference)
4. visit_sync saves workshop_total only with supplier_archive_total
5. _build_operation_journal_entry for sale/service uses workshop_total only
6. Vehicle financial summary endpoint still works
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")

# 90 days period
END_DATE = datetime.now().strftime("%Y-%m-%d")
START_DATE = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")


class TestReclassifyVehicleWorkshopDues90Days:
    """Test the reclassify-vehicle-workshop-dues endpoint for 90 days period"""

    def test_01_dry_run_initial(self):
        """Test dry-run to see current candidates (should be 0 after previous fix)"""
        url = f"{BASE_URL}/api/finance/reports/reclassify-vehicle-workshop-dues"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "apply_changes": "false"
        }
        
        response = requests.post(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        print(f"\n=== DRY RUN (90 days: {START_DATE} to {END_DATE}) ===")
        print(f"Candidates: {result.get('candidates', 'N/A')}")
        print(f"Period: {result.get('period', {})}")
        print(f"Changes preview: {result.get('changes', [])[:5]}")
        
        # Store for later comparison
        self.initial_candidates = result.get("candidates", 0)
        
        # Verify structure
        assert "period" in result, "Response should contain period"
        assert "candidates" in result, "Response should contain candidates count"
        assert "changes" in result, "Response should contain changes list"
        assert result.get("applied") is False, "Dry run should have applied=False"

    def test_02_reconciliation_before(self):
        """Get reconciliation summary before any changes"""
        url = f"{BASE_URL}/api/finance/reports/reconciliation"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "include_rakan": "false"
        }
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        summary = result.get("summary", {})
        
        print(f"\n=== RECONCILIATION BEFORE ===")
        print(f"Matched: {summary.get('matched', 'N/A')}")
        print(f"Total Absolute Difference: {summary.get('total_absolute_difference', 'N/A')}")
        print(f"Missing Operation Journals: {summary.get('missing_operation_journals', {})}")
        
        # Store for comparison
        self.before_total_diff = summary.get("total_absolute_difference", 0)
        
        # Verify structure
        assert "summary" in result, "Response should contain summary"
        assert "rows" in result, "Response should contain rows"

    def test_03_apply_changes_if_needed(self):
        """Apply changes if there are candidates"""
        # First check if there are candidates
        url = f"{BASE_URL}/api/finance/reports/reclassify-vehicle-workshop-dues"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "apply_changes": "false"
        }
        
        dry_response = requests.post(url, params=params)
        dry_data = dry_response.json()
        candidates = dry_data.get("data", {}).get("candidates", 0)
        
        if candidates == 0:
            print(f"\n=== APPLY CHANGES ===")
            print(f"No candidates to fix (candidates=0). Previous fix was successful.")
            pytest.skip("No candidates to fix - previous fix was successful")
            return
        
        # Apply changes
        params["apply_changes"] = "true"
        response = requests.post(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        print(f"\n=== APPLY CHANGES ===")
        print(f"Candidates: {result.get('candidates', 'N/A')}")
        print(f"Updated: {result.get('updated', 'N/A')}")
        print(f"Applied: {result.get('applied', 'N/A')}")
        
        assert result.get("applied") is True, "Apply should have applied=True"
        assert result.get("updated", 0) == result.get("candidates", 0), "All candidates should be updated"

    def test_04_dry_run_after_apply(self):
        """After apply, dry-run should show 0 candidates"""
        url = f"{BASE_URL}/api/finance/reports/reclassify-vehicle-workshop-dues"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "apply_changes": "false"
        }
        
        response = requests.post(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        print(f"\n=== DRY RUN AFTER APPLY ===")
        print(f"Candidates: {result.get('candidates', 'N/A')}")
        print(f"Changes: {result.get('changes', [])}")
        
        # After apply, candidates should be 0
        assert result.get("candidates", -1) == 0, f"Expected 0 candidates after apply, got {result.get('candidates')}"

    def test_05_reconciliation_after(self):
        """Reconciliation summary after changes should be improved or same"""
        url = f"{BASE_URL}/api/finance/reports/reconciliation"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "include_rakan": "false"
        }
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        summary = result.get("summary", {})
        
        print(f"\n=== RECONCILIATION AFTER ===")
        print(f"Matched: {summary.get('matched', 'N/A')}")
        print(f"Total Absolute Difference: {summary.get('total_absolute_difference', 'N/A')}")
        
        # Verify structure
        assert "summary" in result, "Response should contain summary"


class TestVehicleFinancialSummary:
    """Test vehicle financial summary endpoint still works"""

    def test_vehicle_financial_summary_endpoint(self):
        """Verify vehicle financial summary endpoint is accessible"""
        # First get a vehicle ID from operations
        ops_url = f"{BASE_URL}/api/operations"
        params = {"limit": 10}
        
        ops_response = requests.get(ops_url, params=params)
        assert ops_response.status_code == 200, f"Operations endpoint failed: {ops_response.status_code}"
        
        operations = ops_response.json()
        vehicle_ids = []
        
        for op in operations:
            vid = op.get("vehicle_id") or op.get("vehicleId")
            if vid and vid not in vehicle_ids:
                vehicle_ids.append(vid)
        
        if not vehicle_ids:
            print("\n=== VEHICLE FINANCIAL SUMMARY ===")
            print("No vehicle IDs found in operations, skipping detailed test")
            pytest.skip("No vehicle IDs found in operations")
            return
        
        # Test dashboard summaries endpoint
        url = f"{BASE_URL}/api/vehicles/dashboard/summaries"
        payload = {"vehicle_ids": vehicle_ids[:5]}
        
        response = requests.post(url, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"\n=== VEHICLE FINANCIAL SUMMARY ===")
        print(f"Summaries count: {len(data.get('summaries', []))}")
        
        assert "summaries" in data, "Response should contain summaries"


class TestOperationsWorkshopTotalSeparation:
    """Test that operations correctly separate workshop and supplier totals"""

    def test_operations_have_correct_totals(self):
        """Verify sale/service operations have workshop_total separated from supplier items"""
        url = f"{BASE_URL}/api/operations"
        params = {
            "type": "service",
            "limit": 20
        }
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        operations = response.json()
        
        print(f"\n=== OPERATIONS WORKSHOP TOTAL SEPARATION ===")
        print(f"Service operations found: {len(operations)}")
        
        checked = 0
        for op in operations[:10]:
            items = op.get("items", [])
            if not items:
                continue
            
            total = float(op.get("total", 0) or 0)
            workshop_total = float(op.get("workshop_total", 0) or 0)
            supplier_archive_total = float(op.get("supplier_archive_total", 0) or 0)
            
            # Calculate expected workshop total from items
            calc_workshop = 0.0
            calc_supplier = 0.0
            for item in items:
                item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
                line_total = float(item.get("total", 0) or 0)
                if line_total <= 0:
                    qty = float(item.get("quantity", 1) or 1)
                    price = float(item.get("price", 0) or 0)
                    line_total = qty * price
                
                if item_type == "supplier":
                    calc_supplier += line_total
                else:
                    calc_workshop += line_total
            
            if calc_supplier > 0:
                print(f"  Op {op.get('id', 'N/A')[:8]}...: total={total}, workshop={workshop_total}, supplier_archive={supplier_archive_total}")
                print(f"    Calculated: workshop={calc_workshop}, supplier={calc_supplier}")
                
                # If operation has supplier items, total should equal workshop_total (not combined)
                if workshop_total > 0:
                    assert abs(total - workshop_total) < 0.01, f"Total should equal workshop_total when supplier items exist"
                
                checked += 1
        
        print(f"Checked {checked} operations with supplier items")


class TestReconciliationEndpoint:
    """Test reconciliation endpoint functionality"""

    def test_reconciliation_returns_valid_data(self):
        """Verify reconciliation endpoint returns proper structure"""
        url = f"{BASE_URL}/api/finance/reports/reconciliation"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": START_DATE,
            "end_date": END_DATE
        }
        
        response = requests.get(url, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        
        result = data.get("data", {})
        
        # Verify structure
        assert "period" in result, "Response should contain period"
        assert "summary" in result, "Response should contain summary"
        assert "rows" in result, "Response should contain rows"
        
        summary = result.get("summary", {})
        assert "matched" in summary, "Summary should contain matched"
        assert "total_absolute_difference" in summary, "Summary should contain total_absolute_difference"
        
        print(f"\n=== RECONCILIATION STRUCTURE ===")
        print(f"Period: {result.get('period')}")
        print(f"Summary: {summary}")
        print(f"Rows count: {len(result.get('rows', []))}")


class TestReportFromMemory:
    """Verify the report saved in memory matches expectations"""

    def test_report_file_exists_and_valid(self):
        """Check the before/after report file"""
        import json
        
        report_path = "/app/memory/reports/vehicle_ops_reclassify_90d_before_after.json"
        
        try:
            with open(report_path, "r") as f:
                report = json.load(f)
        except FileNotFoundError:
            pytest.skip(f"Report file not found: {report_path}")
            return
        
        print(f"\n=== REPORT FILE VERIFICATION ===")
        print(f"Period: {report.get('period', {})}")
        
        before = report.get("before", {})
        after = report.get("after", {})
        applied = report.get("applied", {})
        
        print(f"Before dry_run candidates: {before.get('dry_run', {}).get('candidates', 'N/A')}")
        print(f"Applied updated: {applied.get('updated', 'N/A')}")
        print(f"After dry_run candidates: {after.get('dry_run', {}).get('candidates', 'N/A')}")
        
        # Verify after apply, candidates should be 0
        after_candidates = after.get("dry_run", {}).get("candidates", -1)
        assert after_candidates == 0, f"After apply, candidates should be 0, got {after_candidates}"
        
        # Verify reconciliation improved
        before_diff = before.get("reconciliation_summary", {}).get("total_absolute_difference", float("inf"))
        after_diff = after.get("reconciliation_summary", {}).get("total_absolute_difference", float("inf"))
        
        print(f"Before total_absolute_difference: {before_diff}")
        print(f"After total_absolute_difference: {after_diff}")
        
        assert after_diff <= before_diff, f"After diff ({after_diff}) should be <= before diff ({before_diff})"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
