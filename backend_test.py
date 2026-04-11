#!/usr/bin/env python3
"""
Backend API Testing Script for P1 Inventory APIs

Testing the following endpoints:
1. GET /api/inventory/control-panel
2. GET /api/inventory/architecture  
3. GET /api/inventory/rakan-analytics
"""

import requests
import json
import sys
from typing import Dict, Any

class InventoryAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def test_control_panel_default(self) -> Dict[str, Any]:
        """Test GET /api/inventory/control-panel (without params) => period_days = 30"""
        print("🔍 Testing: GET /api/inventory/control-panel (default params)")
        
        try:
            response = self.session.get(f"{self.base_url}/api/inventory/control-panel")
            
            result = {
                "endpoint": "/api/inventory/control-panel",
                "status_code": response.status_code,
                "success": False,
                "issues": []
            }
            
            if response.status_code != 200:
                result["issues"].append(f"Status code {response.status_code}, expected 200")
                return result
                
            try:
                data = response.json()
                result["data"] = data
            except json.JSONDecodeError as e:
                result["issues"].append(f"Invalid JSON response: {e}")
                return result
                
            # Check for required structure and period_days = 30
            if "overview" not in data:
                result["issues"].append("Missing 'overview' field in response")
            elif "period_days" not in data["overview"]:
                result["issues"].append("Missing 'period_days' in overview")
            elif data["overview"]["period_days"] != 30:
                result["issues"].append(f"Expected period_days=30, got {data['overview']['period_days']}")
                
            if not result["issues"]:
                result["success"] = True
                print("✅ Control Panel API: PASSED - Default period_days = 30 confirmed")
            else:
                print("❌ Control Panel API: FAILED")
                for issue in result["issues"]:
                    print(f"   - {issue}")
                    
            return result
            
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": "/api/inventory/control-panel",
                "status_code": None,
                "success": False,
                "issues": [f"Request failed: {e}"]
            }
            print("❌ Control Panel API: FAILED - Request error")
            print(f"   - {e}")
            return result

    def test_architecture_api(self) -> Dict[str, Any]:
        """Test GET /api/inventory/architecture => execution_budget exists with urgent/high/planned/total_commitment"""
        print("🔍 Testing: GET /api/inventory/architecture")
        
        try:
            response = self.session.get(f"{self.base_url}/api/inventory/architecture")
            
            result = {
                "endpoint": "/api/inventory/architecture",
                "status_code": response.status_code,
                "success": False,
                "issues": []
            }
            
            if response.status_code != 200:
                result["issues"].append(f"Status code {response.status_code}, expected 200")
                return result
                
            try:
                data = response.json()
                result["data"] = data
            except json.JSONDecodeError as e:
                result["issues"].append(f"Invalid JSON response: {e}")
                return result
                
            # Check for execution_budget structure
            if "execution_budget" not in data:
                result["issues"].append("Missing 'execution_budget' field in response")
            else:
                budget = data["execution_budget"]
                required_fields = ["urgent", "high", "planned", "total_commitment"]
                
                for field in required_fields:
                    if field not in budget:
                        result["issues"].append(f"Missing '{field}' in execution_budget")
                        
                # Check that values are numeric
                for field in required_fields:
                    if field in budget:
                        try:
                            float(budget[field])
                        except (TypeError, ValueError):
                            result["issues"].append(f"execution_budget.{field} is not numeric: {budget[field]}")
                            
            if not result["issues"]:
                result["success"] = True
                print("✅ Architecture API: PASSED - execution_budget structure confirmed")
                print(f"   - urgent: {data['execution_budget']['urgent']}")
                print(f"   - high: {data['execution_budget']['high']}")
                print(f"   - planned: {data['execution_budget']['planned']}")
                print(f"   - total_commitment: {data['execution_budget']['total_commitment']}")
            else:
                print("❌ Architecture API: FAILED")
                for issue in result["issues"]:
                    print(f"   - {issue}")
                    
            return result
            
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": "/api/inventory/architecture",
                "status_code": None,
                "success": False,
                "issues": [f"Request failed: {e}"]
            }
            print("❌ Architecture API: FAILED - Request error")
            print(f"   - {e}")
            return result

    def test_rakan_analytics_api(self) -> Dict[str, Any]:
        """Test GET /api/inventory/rakan-analytics => expense_tracking + price_timeline exist with correct structure"""
        print("🔍 Testing: GET /api/inventory/rakan-analytics")
        
        try:
            response = self.session.get(f"{self.base_url}/api/inventory/rakan-analytics")
            
            result = {
                "endpoint": "/api/inventory/rakan-analytics",
                "status_code": response.status_code,
                "success": False,
                "issues": []
            }
            
            if response.status_code != 200:
                result["issues"].append(f"Status code {response.status_code}, expected 200")
                return result
                
            try:
                data = response.json()
                result["data"] = data
            except json.JSONDecodeError as e:
                result["issues"].append(f"Invalid JSON response: {e}")
                return result
                
            # Check for expense_tracking structure
            if "expense_tracking" not in data:
                result["issues"].append("Missing 'expense_tracking' field in response")
            else:
                expense_tracking = data["expense_tracking"]
                if not isinstance(expense_tracking, dict):
                    result["issues"].append("expense_tracking should be an object")
                    
            # Check for price_timeline structure  
            if "price_timeline" not in data:
                result["issues"].append("Missing 'price_timeline' field in response")
            else:
                price_timeline = data["price_timeline"]
                if not isinstance(price_timeline, list):
                    result["issues"].append("price_timeline should be an array")
                    
            if not result["issues"]:
                result["success"] = True
                print("✅ Rakan Analytics API: PASSED - expense_tracking + price_timeline confirmed")
                print(f"   - expense_tracking keys: {list(data['expense_tracking'].keys())}")
                print(f"   - price_timeline items: {len(data['price_timeline'])}")
            else:
                print("❌ Rakan Analytics API: FAILED")
                for issue in result["issues"]:
                    print(f"   - {issue}")
                    
            return result
            
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": "/api/inventory/rakan-analytics",
                "status_code": None,
                "success": False,
                "issues": [f"Request failed: {e}"]
            }
            print("❌ Rakan Analytics API: FAILED - Request error")
            print(f"   - {e}")
            return result

    def test_no_500_errors(self, results: list) -> Dict[str, Any]:
        """Check that none of the APIs returned 500 errors"""
        print("🔍 Testing: No 500 errors in responses")
        
        result = {
            "test": "no_500_errors",
            "success": True,
            "issues": []
        }
        
        for test_result in results:
            if test_result.get("status_code") == 500:
                result["success"] = False
                result["issues"].append(f"{test_result['endpoint']}: returned 500 error")
                
        if result["success"]:
            print("✅ No 500 Errors: PASSED - All APIs returned non-500 status codes")
        else:
            print("❌ No 500 Errors: FAILED")
            for issue in result["issues"]:
                print(f"   - {issue}")
                
        return result

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return summary"""
        print(f"🚀 Starting Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        results = []
        
        # Test 1: Control Panel (default params => period_days = 30)
        results.append(self.test_control_panel_default())
        print()
        
        # Test 2: Architecture (execution_budget structure)
        results.append(self.test_architecture_api()) 
        print()
        
        # Test 3: Rakan Analytics (expense_tracking + price_timeline)
        results.append(self.test_rakan_analytics_api())
        print()
        
        # Test 4: No 500 errors
        no_500_result = self.test_no_500_errors(results)
        results.append(no_500_result)
        print()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed_count = sum(1 for r in results if r.get("success", False))
        total_count = len(results)
        
        for result in results:
            endpoint = result.get("endpoint", result.get("test", "Unknown"))
            status = "✅ PASS" if result.get("success", False) else "❌ FAIL"
            print(f"{status} {endpoint}")
            
        print(f"\nOverall: {passed_count}/{total_count} tests passed")
        
        overall_success = passed_count == total_count
        
        if overall_success:
            print("🎉 ALL TESTS PASSED - P1 APIs working correctly!")
        else:
            print("⚠️ SOME TESTS FAILED - Check logs above for details")
            
        return {
            "overall_success": overall_success,
            "passed_count": passed_count,
            "total_count": total_count,
            "results": results
        }


def main():
    """Main function to run the tests"""
    # Use the base URL from frontend/.env
    BASE_URL = "https://repair-mgmt-fresh.preview.emergentagent.com"
    
    if len(sys.argv) > 1:
        BASE_URL = sys.argv[1]
        
    print("Backend P1 Inventory APIs Testing")
    print("=" * 60)
    
    tester = InventoryAPITester(BASE_URL)
    summary = tester.run_all_tests()
    
    # Exit with appropriate code
    exit_code = 0 if summary["overall_success"] else 1
    sys.exit(exit_code)


if __name__ == "__main__":
    main()