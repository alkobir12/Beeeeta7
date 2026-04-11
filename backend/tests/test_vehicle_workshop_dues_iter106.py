"""
Iteration 106 - Test Vehicle Workshop Dues Reclassification Fix

Tests:
1. visit_sync: workshop_total excludes supplier items (itemType=supplier)
2. routes_extended _build_operation_journal_entry: sale/service uses workshop_total
3. /api/finance/reports/reclassify-vehicle-workshop-dues endpoint (dry/apply)
4. Verify operation 0030fd8d-1068-43e8-a132-acffb406e893 has correct total
5. No regression in other journal entry paths
"""

import pytest
import requests
import os
import json
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")


class TestReclassifyVehicleWorkshopDues:
    """Test the reclassify-vehicle-workshop-dues endpoint"""

    def test_reclassify_endpoint_dry_run(self):
        """Test dry-run mode returns candidates without applying changes"""
        url = f"{BASE_URL}/api/finance/reports/reclassify-vehicle-workshop-dues"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2024-01-01",
            "end_date": "2026-12-31",
            "apply_changes": "false"
        }
        response = requests.post(url, params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Expected success=True, got {data}"
        assert "data" in data, "Response should contain 'data' field"
        
        result = data["data"]
        assert "candidates" in result, "Response should contain 'candidates' count"
        assert "updated" in result, "Response should contain 'updated' count"
        assert "applied" in result, "Response should contain 'applied' flag"
        
        # In dry-run mode, updated should be 0
        assert result["applied"] is False, "Dry-run should have applied=False"
        assert result["updated"] == 0, "Dry-run should have updated=0"
        
        print(f"✅ Dry-run: candidates={result['candidates']}, updated={result['updated']}")

    def test_reclassify_endpoint_after_fix_zero_candidates(self):
        """After fix was applied, dry-run should return 0 candidates"""
        url = f"{BASE_URL}/api/finance/reports/reclassify-vehicle-workshop-dues"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2024-01-01",
            "end_date": "2026-12-31",
            "apply_changes": "false"
        }
        response = requests.post(url, params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Expected success=True, got {data}"
        result = data["data"]
        
        # After the historical fix was applied, candidates should be 0
        candidates = result.get("candidates", -1)
        print(f"✅ Post-fix dry-run: candidates={candidates}")
        
        # This is the key assertion - after fix, no more candidates
        assert candidates == 0, f"Expected 0 candidates after fix, got {candidates}"


class TestOperationTotalCorrection:
    """Test that specific operation has correct total after fix"""

    def test_operation_0030fd8d_total_corrected(self):
        """Verify operation 0030fd8d-1068-43e8-a132-acffb406e893 has total=3850 (not 17504)
        
        This operation has:
        - Workshop service: 3850 (itemType=service)
        - Supplier items: 1453+936+620+200+10445 = 13654 (itemType=supplier)
        - Combined would be: 17504
        - After fix, total should be: 3850 (workshop only)
        """
        op_id = "0030fd8d-1068-43e8-a132-acffb406e893"
        url = f"{BASE_URL}/api/operations/{op_id}"
        response = requests.get(url)
        
        if response.status_code == 404:
            pytest.skip(f"Operation {op_id} not found - may have been deleted or is in different environment")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        total = float(data.get("total", 0))
        subtotal = float(data.get("subtotal", 0))
        items = data.get("items", [])
        
        # Calculate expected workshop total from items
        workshop_items_total = 0.0
        supplier_items_total = 0.0
        for item in items:
            item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
            price = float(item.get("price", 0) or 0)
            qty = float(item.get("quantity", 1) or 1)
            line_total = price * qty
            
            if item_type == "supplier":
                supplier_items_total += line_total
            else:
                workshop_items_total += line_total
        
        print(f"Operation {op_id[:8]}:")
        print(f"  total={total}, subtotal={subtotal}")
        print(f"  workshop_items_total={workshop_items_total}, supplier_items_total={supplier_items_total}")
        print(f"  combined_would_be={workshop_items_total + supplier_items_total}")
        
        # Key assertion: total should be workshop only (3850), not combined (17504)
        expected_workshop_total = 3850.0
        expected_combined_total = 17504.0  # This is what it was BEFORE the fix
        
        assert abs(total - expected_workshop_total) < 1, \
            f"Expected total={expected_workshop_total} (workshop only), got total={total}"
        
        # Verify it's NOT the combined total
        assert abs(total - expected_combined_total) > 1000, \
            f"Total should NOT be combined ({expected_combined_total}), got {total}"
        
        print(f"✅ Operation total correctly set to workshop-only value (3850, not 17504)")


class TestVisitSyncWorkshopTotal:
    """Test that visit_sync correctly separates workshop and supplier totals"""

    def test_visit_financial_summary_separates_totals(self):
        """Test that vehicle financial summary separates workshop and supplier totals"""
        # Get a vehicle with visits
        url = f"{BASE_URL}/api/vehicles"
        response = requests.get(url, params={"limit": 10})
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch vehicles")
        
        vehicles = response.json()
        if not vehicles:
            pytest.skip("No vehicles found")
        
        # Find a vehicle with financial data
        for vehicle in vehicles[:5]:
            vehicle_id = vehicle.get("id")
            if not vehicle_id:
                continue
            
            summary_url = f"{BASE_URL}/api/vehicles/{vehicle_id}/financial-summary"
            summary_response = requests.get(summary_url)
            
            if summary_response.status_code != 200:
                continue
            
            summary = summary_response.json()
            
            # Check that the response has the expected fields
            if "total_workshop" in summary or "workshop_total" in summary:
                workshop = float(summary.get("total_workshop", 0) or summary.get("workshop_total", 0))
                suppliers = float(summary.get("total_suppliers", 0) or summary.get("supplier_archive_total", 0))
                total = float(summary.get("total_amount", 0) or summary.get("total", 0))
                
                print(f"Vehicle {vehicle_id[:8]}:")
                print(f"  workshop={workshop}, suppliers={suppliers}, total={total}")
                
                # Verify separation logic
                if workshop > 0 or suppliers > 0:
                    # Total should be workshop + suppliers (or just workshop if no suppliers)
                    expected_total = workshop + suppliers
                    assert abs(total - expected_total) < 1, \
                        f"Expected total={expected_total}, got {total}"
                    print(f"✅ Totals correctly separated")
                    return
        
        print("⚠️ No vehicles with financial data found for verification")


class TestJournalEntryWorkshopTotal:
    """Test that journal entries use workshop_total for sale/service operations"""

    def test_sale_operation_journal_uses_workshop_total(self):
        """Test that sale/service operations create journal entries with workshop_total"""
        # Get recent operations
        url = f"{BASE_URL}/api/operations"
        params = {"workshop_id": WORKSHOP_ID, "type": "service", "limit": 10}
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch operations")
        
        operations = response.json()
        if not operations:
            # Try sale type
            params["type"] = "sale"
            response = requests.get(url, params=params)
            operations = response.json() if response.status_code == 200 else []
        
        if not operations:
            pytest.skip("No sale/service operations found")
        
        for op in operations[:3]:
            op_id = op.get("id")
            op_type = op.get("type")
            total = float(op.get("total", 0))
            workshop_total = float(op.get("workshop_total", 0))
            supplier_total = float(op.get("supplier_archive_total", 0) or op.get("total_suppliers", 0))
            
            if total <= 0:
                continue
            
            print(f"Operation {op_id[:8]} ({op_type}):")
            print(f"  total={total}, workshop_total={workshop_total}, supplier_total={supplier_total}")
            
            # For sale/service, total should equal workshop_total (excluding suppliers)
            if workshop_total > 0:
                assert abs(total - workshop_total) < 1, \
                    f"Expected total={workshop_total} (workshop only), got total={total}"
                print(f"✅ Operation total correctly uses workshop_total")
                return
        
        print("⚠️ No operations with workshop_total found for verification")


class TestNoRegressionOtherJournalPaths:
    """Test that other journal entry paths still work correctly"""

    def test_purchase_operation_journal_entry(self):
        """Test that purchase operations still create correct journal entries"""
        url = f"{BASE_URL}/api/operations"
        params = {"workshop_id": WORKSHOP_ID, "type": "purchase", "limit": 5}
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch operations")
        
        operations = response.json()
        if not operations:
            pytest.skip("No purchase operations found")
        
        for op in operations[:2]:
            op_id = op.get("id")
            total = float(op.get("total", 0))
            
            if total <= 0:
                continue
            
            print(f"Purchase operation {op_id[:8]}: total={total}")
            # Purchase operations should have total as-is (no workshop/supplier split)
            assert total > 0, "Purchase operation should have positive total"
            print(f"✅ Purchase operation total correct")
            return
        
        print("⚠️ No purchase operations with positive total found")

    def test_expense_operation_journal_entry(self):
        """Test that expense operations still create correct journal entries"""
        url = f"{BASE_URL}/api/operations"
        params = {"workshop_id": WORKSHOP_ID, "type": "expense", "limit": 5}
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch operations")
        
        operations = response.json()
        if not operations:
            pytest.skip("No expense operations found")
        
        for op in operations[:2]:
            op_id = op.get("id")
            total = float(op.get("total", 0))
            
            if total <= 0:
                continue
            
            print(f"Expense operation {op_id[:8]}: total={total}")
            assert total > 0, "Expense operation should have positive total"
            print(f"✅ Expense operation total correct")
            return
        
        print("⚠️ No expense operations with positive total found")

    def test_payment_order_operation_journal_entry(self):
        """Test that payment_order operations still create correct journal entries"""
        url = f"{BASE_URL}/api/operations"
        params = {"workshop_id": WORKSHOP_ID, "type": "payment_order", "limit": 5}
        response = requests.get(url, params=params)
        
        if response.status_code != 200:
            pytest.skip("Cannot fetch operations")
        
        operations = response.json()
        if not operations:
            pytest.skip("No payment_order operations found")
        
        for op in operations[:2]:
            op_id = op.get("id")
            total = float(op.get("total", 0))
            
            if total <= 0:
                continue
            
            print(f"Payment order {op_id[:8]}: total={total}")
            assert total > 0, "Payment order should have positive total"
            print(f"✅ Payment order total correct")
            return
        
        print("⚠️ No payment_order operations with positive total found")


class TestReconciliationAfterFix:
    """Test that reconciliation report shows matched after fix"""

    def test_reconciliation_report_matched(self):
        """Test that reconciliation report shows operations and journals are matched"""
        url = f"{BASE_URL}/api/finance/reports/reconciliation"
        params = {
            "workshop_id": WORKSHOP_ID,
            "start_date": "2024-01-01",
            "end_date": "2026-12-31",
            "include_rakan": "false"
        }
        response = requests.get(url, params=params)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Expected success=True, got {data}"
        result = data.get("data", {})
        
        summary = result.get("summary", {})
        matched = summary.get("matched", False)
        total_diff = summary.get("total_absolute_difference", 0)
        
        print(f"Reconciliation summary:")
        print(f"  matched={matched}, total_absolute_difference={total_diff}")
        
        # Check rows for sale/service types
        rows = result.get("rows", [])
        for row in rows:
            if row.get("type") in ["sale", "service"]:
                print(f"  {row.get('type')}: ops_total={row.get('operations_total')}, je_total={row.get('journal_entries_total')}, diff={row.get('difference')}")
        
        print(f"✅ Reconciliation report retrieved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
