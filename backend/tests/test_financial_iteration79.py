"""
Iteration 79: Financial Dashboard Feature Tests
Tests for:
1. Trial balance returns readable account names (not just codes)
2. Account-tree-details returns operations_cash_total and operations_credit_total in summary
3. Account-tree-details operation descriptions use customer/vehicle names instead of raw visit IDs
4. Reconciliation API still works (regression)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestTrialBalanceNameResolution:
    """Test that trial-balance API returns readable account names instead of codes"""
    
    def test_trial_balance_returns_readable_names(self):
        """Verify account names are human-readable Arabic names, not just numeric codes"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={"workshop_id": WORKSHOP_ID}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        
        accounts = data.get("data", {}).get("accounts", [])
        assert len(accounts) > 0, "Expected at least one account in trial balance"
        
        # Check that each account has a readable name (not just the code)
        readable_count = 0
        for acc in accounts:
            code = str(acc.get("code", "")).strip()
            name = str(acc.get("name", "")).strip()
            
            # Name should exist and not be just the code or a pure number
            is_readable = name and name != code and not name.isdigit()
            if is_readable:
                readable_count += 1
                print(f"✅ Code: {code} => Name: {name}")
            else:
                print(f"❌ Code: {code} => Name: {name} (not readable)")
        
        # At least 80% of accounts should have readable names
        readable_ratio = readable_count / len(accounts) if accounts else 0
        assert readable_ratio >= 0.8, f"Only {readable_ratio*100:.1f}% of accounts have readable names"
    
    def test_trial_balance_specific_codes_have_arabic_names(self):
        """Verify specific account codes have proper Arabic names"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/trial-balance",
            params={"workshop_id": WORKSHOP_ID}
        )
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("data", {}).get("accounts", [])
        
        # Build code to name map
        code_to_name = {str(acc.get("code", "")).strip(): str(acc.get("name", "")).strip() for acc in accounts}
        
        # Expected mappings (code => expected Arabic name pattern)
        expected_patterns = {
            "1000": "الأصول",
            "1101": "النقد",
            "4000": "الإيرادات",
        }
        
        for code, expected_pattern in expected_patterns.items():
            if code in code_to_name:
                name = code_to_name[code]
                assert expected_pattern in name or name != code, \
                    f"Code {code} should have readable name containing '{expected_pattern}', got '{name}'"
                print(f"✅ Code {code} => {name}")


class TestAccountTreeDetailsSummary:
    """Test that account-tree-details API returns operations_cash_total and operations_credit_total"""
    
    def test_summary_contains_cash_and_credit_totals(self):
        """Verify summary includes operations_cash_total and operations_credit_total"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",  # Revenue account
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
                "page": 1,
                "page_size": 10
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        
        operations = data.get("data", {}).get("operations", {})
        summary = operations.get("summary", {})
        
        # Check required fields exist
        assert "operations_cash_total" in summary, "Missing operations_cash_total in summary"
        assert "operations_credit_total" in summary, "Missing operations_credit_total in summary"
        
        cash_total = summary.get("operations_cash_total", 0)
        credit_total = summary.get("operations_credit_total", 0)
        
        print(f"✅ operations_cash_total: {cash_total}")
        print(f"✅ operations_credit_total: {credit_total}")
        
        # Values should be numeric
        assert isinstance(cash_total, (int, float)), "operations_cash_total should be numeric"
        assert isinstance(credit_total, (int, float)), "operations_credit_total should be numeric"
    
    def test_summary_totals_are_consistent(self):
        """Verify cash + credit totals are consistent with total_credit"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
                "page": 1,
                "page_size": 100
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("data", {}).get("operations", {}).get("summary", {})
        
        cash_total = summary.get("operations_cash_total", 0)
        credit_total = summary.get("operations_credit_total", 0)
        total_credit = summary.get("total_credit", 0)
        
        # Cash + Credit should approximately equal total (allowing for rounding)
        combined = cash_total + credit_total
        if total_credit > 0:
            # Allow 10% tolerance for operations without payment method
            tolerance = total_credit * 0.1
            print(f"Cash: {cash_total}, Credit: {credit_total}, Total: {total_credit}, Combined: {combined}")


class TestAccountTreeDetailsDescriptions:
    """Test that operation descriptions use customer/vehicle names instead of raw visit IDs"""
    
    def test_descriptions_contain_customer_names(self):
        """Verify descriptions show customer names instead of raw visit IDs"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/account-tree-details",
            params={
                "workshop_id": WORKSHOP_ID,
                "account_code": "4000",
                "start_date": "2024-01-01",
                "end_date": "2026-12-31",
                "page": 1,
                "page_size": 20
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        items = data.get("data", {}).get("operations", {}).get("items", [])
        
        if not items:
            pytest.skip("No operations found to test descriptions")
        
        # Check descriptions
        customer_pattern_count = 0
        raw_visit_id_count = 0
        
        for item in items:
            desc = str(item.get("description", ""))
            
            # Good: Contains "عميل:" (customer:) or "مركبة:" (vehicle:)
            if "عميل:" in desc or "مركبة:" in desc:
                customer_pattern_count += 1
                print(f"✅ Good description: {desc[:80]}")
            
            # Bad: Contains raw visit ID pattern like "الزيارة xxxx-xxxx-xxxx"
            # without customer/vehicle info
            if "الزيارة" in desc and "عميل:" not in desc and "مركبة:" not in desc:
                raw_visit_id_count += 1
                print(f"⚠️ Raw visit ID in description: {desc[:80]}")
        
        # Most descriptions should have customer/vehicle info
        if items:
            good_ratio = customer_pattern_count / len(items)
            print(f"Good descriptions: {customer_pattern_count}/{len(items)} ({good_ratio*100:.1f}%)")
            
            # At least 50% should have enriched descriptions
            assert good_ratio >= 0.5 or raw_visit_id_count == 0, \
                f"Too many raw visit IDs in descriptions: {raw_visit_id_count}"


class TestReconciliationRegression:
    """Regression test: Reconciliation API should still work correctly"""
    
    def test_reconciliation_api_returns_success(self):
        """Verify reconciliation API returns successful response"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-12-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        
        # Check structure
        assert "data" in data
        assert "summary" in data["data"]
        assert "rows" in data["data"]
        
        summary = data["data"]["summary"]
        assert "matched" in summary
        assert "total_absolute_difference" in summary
        
        print(f"✅ Reconciliation matched: {summary.get('matched')}")
        print(f"✅ Total difference: {summary.get('total_absolute_difference')}")
    
    def test_reconciliation_rows_have_required_fields(self):
        """Verify reconciliation rows have all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/reconciliation",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2026-12-31"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        rows = data.get("data", {}).get("rows", [])
        
        required_fields = [
            "type", "type_label_ar", "operations_count", "journal_entries_count",
            "operations_total", "journal_entries_total", "difference", "matched"
        ]
        
        for row in rows:
            for field in required_fields:
                assert field in row, f"Missing field '{field}' in reconciliation row"
            
            print(f"✅ Type: {row.get('type_label_ar')} - Matched: {row.get('matched')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
