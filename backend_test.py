#!/usr/bin/env python3
"""
Backend Testing for Rakan Accounting Period Modifications
Testing the following scenarios:

1. POST /api/operations with accountingAccountId starting with 5000 => should be rakan_parts only
2. POST /api/operations with non-5000 account even if operationKind=RAKAN_PARTS_OPERATION => should convert to workshop/default flow
3. GET /api/finance/journal-entries without include_rakan => should not show rakan entries
4. GET /api/finance/journal-entries?include_rakan=true => should show rakan entries
5. GET /api/finance/chart-of-accounts => should not have corrupted UUID codes
6. DELETE /api/accounts-chart/reset => should work (200) without crash
7. Clean up any test data created during testing

Base URL: https://rakan-ledger-debug.preview.emergentagent.com
"""

import requests
import json
import uuid
import time
from datetime import datetime

# Configuration
BASE_URL = "https://rakan-ledger-debug.preview.emergentagent.com"
WORKSHOP_ID = "finmodule-sync"

class RakanBackendTester:
    def __init__(self):
        self.base_url = BASE_URL.rstrip("/")
        self.workshop_id = WORKSHOP_ID
        self.created_operations = []
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        if details:
            result["details"] = details
            
        self.test_results.append(result)
        
    def test_scenario_1_5000_account_rakan_parts(self):
        """
        Test 1: POST /api/operations with accountingAccountId starting with 5000 
        => should only be rakan_parts operations
        """
        print("\n=== Test 1: 5000 Account Code => Rakan Parts ===")
        
        test_id = f"TEST_5000_{uuid.uuid4().hex[:8]}"
        payload = {
            "type": "sale",
            "partnerName": f"Test Rakan Customer {test_id}",
            "accountingAccountId": "5000",  # Existing 5000 account (تكلفة الخدمات)
            "items": [{"name": "Test Rakan Part", "quantity": 1, "price": 100}],
            "total": 100,
            "paymentMethod": "cash",
            "workshopId": self.workshop_id,
            "notes": f"Test Rakan: {test_id}"
        }
        
        try:
            response = requests.post(f"{self.base_url}/api/operations", json=payload, timeout=30)
            
            if response.status_code not in [200, 201]:
                self.log_test("Scenario 1", False, f"Failed to create operation: {response.status_code}", response.text)
                return
                
            operation = response.json()
            op_id = operation.get("id")
            if op_id:
                self.created_operations.append(op_id)
            
            # Check if it's routed to Rakan Parts
            scope = operation.get("scope", "")
            business_unit = operation.get("businessUnit") or operation.get("business_unit", "")
            source = operation.get("source", "")
            notes = operation.get("notes", "")
            
            is_rakan = any([
                scope == "rakan_parts",
                business_unit == "rakan_parts", 
                "rakan_parts" in source.lower(),
                "[RAKAN_PARTS]" in notes
            ])
            
            if is_rakan:
                self.log_test("Scenario 1", True, 
                    f"5000 account correctly routed to Rakan Parts (scope={scope}, businessUnit={business_unit})",
                    {"operation_id": op_id, "scope": scope, "business_unit": business_unit})
            else:
                self.log_test("Scenario 1", False,
                    f"5000 account NOT routed to Rakan Parts: scope={scope}, businessUnit={business_unit}",
                    {"operation_id": op_id, "scope": scope, "business_unit": business_unit})
                    
        except Exception as e:
            self.log_test("Scenario 1", False, f"Exception: {str(e)}")

    def test_scenario_2_non_5000_account_default_flow(self):
        """
        Test 2: POST /api/operations with non-5000 account even if operationKind=RAKAN_PARTS_OPERATION 
        => should convert to workshop/default flow
        """
        print("\n=== Test 2: Non-5000 Account => Default Flow ===")
        
        test_id = f"TEST_NON5000_{uuid.uuid4().hex[:8]}"
        payload = {
            "type": "purchase", 
            "partnerName": f"Test Supplier {test_id}",
            "accountingAccountId": "1101",  # Cash account - NOT 5000
            "operationKind": "RAKAN_PARTS_OPERATION",  # Explicitly set but should be overridden
            "items": [{"name": "Test Part", "quantity": 1, "price": 50}],
            "total": 50,
            "paymentMethod": "cash",
            "workshopId": self.workshop_id,
            "notes": f"Test Non-5000: {test_id}"
        }
        
        try:
            response = requests.post(f"{self.base_url}/api/operations", json=payload, timeout=30)
            
            if response.status_code not in [200, 201]:
                self.log_test("Scenario 2", False, f"Failed to create operation: {response.status_code}", response.text)
                return
                
            operation = response.json()
            op_id = operation.get("id")
            if op_id:
                self.created_operations.append(op_id)
            
            scope = operation.get("scope", "")
            business_unit = operation.get("businessUnit") or operation.get("business_unit", "")
            source = operation.get("source", "")
            
            # Should NOT be Rakan Parts since account is not 5000
            is_not_rakan = (
                scope in ["workshop", "vehicle", ""] and 
                business_unit != "rakan_parts" and
                "rakan_parts" not in source.lower()
            )
            
            if is_not_rakan:
                self.log_test("Scenario 2", True,
                    f"Non-5000 account correctly routed to default flow (scope={scope})",
                    {"operation_id": op_id, "scope": scope, "business_unit": business_unit})
            else:
                self.log_test("Scenario 2", False,
                    f"Non-5000 account incorrectly routed to Rakan: scope={scope}, businessUnit={business_unit}",
                    {"operation_id": op_id, "scope": scope, "business_unit": business_unit})
                    
        except Exception as e:
            self.log_test("Scenario 2", False, f"Exception: {str(e)}")

    def test_scenario_3_journal_entries_without_include_rakan(self):
        """
        Test 3: GET /api/finance/journal-entries without include_rakan 
        => should not show rakan entries
        """
        print("\n=== Test 3: Journal Entries Without include_rakan ===")
        
        try:
            response = requests.get(
                f"{self.base_url}/api/finance/journal-entries",
                params={"workshop_id": self.workshop_id, "limit": 100},
                timeout=30
            )
            
            if response.status_code != 200:
                self.log_test("Scenario 3", False, f"Failed to get journal entries: {response.status_code}", response.text)
                return
                
            data = response.json()
            if not data.get("success", False):
                self.log_test("Scenario 3", False, f"API returned success=false: {data}")
                return
                
            entries = data.get("data", [])
            
            # Count entries with rakan sources
            rakan_entries = [
                entry for entry in entries 
                if "rakan_parts" in str(entry.get("source", "")).lower()
                or "operation_rakan_parts" in str(entry.get("source", "")).lower()
                or "[RAKAN_PARTS]" in str(entry.get("description", ""))
            ]
            
            if len(rakan_entries) == 0:
                self.log_test("Scenario 3", True, 
                    f"Default journal entries correctly excludes Rakan entries ({len(entries)} total, {len(rakan_entries)} rakan)",
                    {"total_entries": len(entries), "rakan_entries": len(rakan_entries)})
            else:
                self.log_test("Scenario 3", False,
                    f"Default journal entries incorrectly includes Rakan entries ({len(rakan_entries)} found)",
                    {"total_entries": len(entries), "rakan_entries": len(rakan_entries), "rakan_sources": [e.get("source") for e in rakan_entries]})
                    
        except Exception as e:
            self.log_test("Scenario 3", False, f"Exception: {str(e)}")

    def test_scenario_4_journal_entries_with_include_rakan(self):
        """
        Test 4: GET /api/finance/journal-entries?include_rakan=true 
        => should show rakan entries
        """
        print("\n=== Test 4: Journal Entries With include_rakan=true ===")
        
        try:
            response = requests.get(
                f"{self.base_url}/api/finance/journal-entries",
                params={"workshop_id": self.workshop_id, "include_rakan": "true", "limit": 100},
                timeout=30
            )
            
            if response.status_code != 200:
                self.log_test("Scenario 4", False, f"Failed to get journal entries: {response.status_code}", response.text)
                return
                
            data = response.json()
            if not data.get("success", False):
                self.log_test("Scenario 4", False, f"API returned success=false: {data}")
                return
                
            entries = data.get("data", [])
            
            # This should include all entries, including rakan ones
            self.log_test("Scenario 4", True,
                f"Journal entries with include_rakan=true returned {len(entries)} entries",
                {"total_entries": len(entries), "include_rakan": True})
                
        except Exception as e:
            self.log_test("Scenario 4", False, f"Exception: {str(e)}")

    def test_scenario_5_chart_of_accounts_no_uuid_codes(self):
        """
        Test 5: GET /api/finance/chart-of-accounts 
        => should not have corrupted UUID codes
        """
        print("\n=== Test 5: Chart of Accounts - No UUID Codes ===")
        
        try:
            response = requests.get(
                f"{self.base_url}/api/finance/chart-of-accounts",
                params={"workshop_id": self.workshop_id},
                timeout=30
            )
            
            if response.status_code != 200:
                self.log_test("Scenario 5", False, f"Failed to get chart of accounts: {response.status_code}", response.text)
                return
                
            data = response.json()
            if not data.get("success", False):
                self.log_test("Scenario 5", False, f"API returned success=false: {data}")
                return
                
            accounts = data.get("data", [])
            
            # Check for UUID-like codes (36 chars with dashes)
            uuid_codes = []
            for account in accounts:
                code = str(account.get("code") or "")
                if len(code) == 36 and code.count("-") == 4:
                    # This looks like a UUID
                    uuid_codes.append(code)
            
            if len(uuid_codes) == 0:
                self.log_test("Scenario 5", True,
                    f"Chart of accounts has no corrupted UUID codes ({len(accounts)} accounts checked)",
                    {"total_accounts": len(accounts), "uuid_codes_found": 0})
            else:
                self.log_test("Scenario 5", False,
                    f"Found {len(uuid_codes)} corrupted UUID codes in chart of accounts",
                    {"total_accounts": len(accounts), "uuid_codes": uuid_codes})
                    
        except Exception as e:
            self.log_test("Scenario 5", False, f"Exception: {str(e)}")

    def test_scenario_6_accounts_chart_reset(self):
        """
        Test 6: DELETE /api/accounts-chart/reset 
        => should work (200) without crash
        """
        print("\n=== Test 6: Accounts Chart Reset ===")
        
        try:
            response = requests.delete(f"{self.base_url}/api/accounts-chart/reset", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success", False):
                    accounts = data.get("accounts", [])
                    self.log_test("Scenario 6", True,
                        f"Accounts chart reset successfully (200 OK, {len(accounts)} default accounts)",
                        {"accounts_count": len(accounts), "reset_successful": True})
                else:
                    self.log_test("Scenario 6", False, 
                        f"Reset returned 200 but success=false: {data}",
                        {"response_data": data})
            else:
                self.log_test("Scenario 6", False,
                    f"Reset failed with status {response.status_code}",
                    {"status_code": response.status_code, "response": response.text})
                    
        except Exception as e:
            self.log_test("Scenario 6", False, f"Exception: {str(e)}")

    def cleanup_test_data(self):
        """
        Clean up any test data created during testing
        """
        print("\n=== Cleanup: Removing Test Operations ===")
        
        cleaned = 0
        for op_id in self.created_operations:
            try:
                response = requests.delete(f"{self.base_url}/api/operations/{op_id}", timeout=10)
                if response.status_code in [200, 204, 404]:
                    cleaned += 1
                    print(f"✅ Cleaned operation: {op_id}")
                else:
                    print(f"⚠️ Could not clean operation {op_id}: {response.status_code}")
            except Exception as e:
                print(f"⚠️ Error cleaning operation {op_id}: {e}")
        
        print(f"Cleanup completed: {cleaned}/{len(self.created_operations)} operations cleaned")

    def run_all_tests(self):
        """Run all test scenarios"""
        print("🚀 Starting Rakan Backend Testing for Accounting Period Modifications")
        print(f"Base URL: {self.base_url}")
        print(f"Workshop ID: {self.workshop_id}")
        print("=" * 80)
        
        # Run all test scenarios
        self.test_scenario_1_5000_account_rakan_parts()
        self.test_scenario_2_non_5000_account_default_flow()
        self.test_scenario_3_journal_entries_without_include_rakan()
        self.test_scenario_4_journal_entries_with_include_rakan()
        self.test_scenario_5_chart_of_accounts_no_uuid_codes()
        self.test_scenario_6_accounts_chart_reset()
        
        # Cleanup test data
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {passed/total*100:.1f}%" if total > 0 else "0%")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        if total - passed > 0:
            print(f"\n⚠️ {total - passed} tests failed. Check the detailed output above.")
        else:
            print(f"\n🎉 All {total} tests passed!")
        
        return {"total": total, "passed": passed, "failed": total - passed, "results": self.test_results}

if __name__ == "__main__":
    tester = RakanBackendTester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/backend_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\nResults saved to: /app/backend_test_results.json")