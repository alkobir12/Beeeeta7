#!/usr/bin/env python3
"""
Backend API Testing for Review Request
Testing specific endpoints to verify they work correctly and return data without 500 errors
DB_PROVIDER: memory or supabase
"""

import requests
import json
import uuid
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://autofix-flow.preview.emergentagent.com/api"

def test_endpoint(method, endpoint, data=None, expected_status=200):
    """Test an API endpoint and return result"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=30)
        else:
            return {"success": False, "error": f"Unsupported method: {method}"}
        
        result = {
            "success": response.status_code == expected_status,
            "status_code": response.status_code,
            "endpoint": endpoint,
            "method": method
        }
        
        # Try to parse JSON response
        try:
            result["data"] = response.json()
            result["data_type"] = type(result["data"]).__name__
            if isinstance(result["data"], list):
                result["count"] = len(result["data"])
        except:
            result["data"] = response.text[:200] if response.text else ""
            result["data_type"] = "text"
        
        return result
        
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timeout", "endpoint": endpoint}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e), "endpoint": endpoint}

def main():
    print("🔍 Backend API Testing - Review Request Verification")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Testing DB_PROVIDER: memory or supabase mode")
    print()
    
    # Test endpoints from review request
    endpoints_to_test = [
        ("GET", "/operations"),
        ("GET", "/vehicles"),
        ("GET", "/customers"),
        ("GET", "/invoices"),
        ("GET", "/transactions"),
        ("GET", "/technicians"),
        ("GET", "/services"),
        ("GET", "/biz-accounts"),
        ("GET", "/operations/analytics/summary"),
        ("GET", "/operations/pending")
    ]
    
    results = []
    passed = 0
    failed = 0
    
    print("📋 Testing GET endpoints:")
    print("-" * 40)
    
    for method, endpoint in endpoints_to_test:
        print(f"Testing {method} {endpoint}...", end=" ")
        result = test_endpoint(method, endpoint)
        results.append(result)
        
        if result["success"]:
            status = "✅ PASS"
            passed += 1
            if "count" in result:
                status += f" ({result['count']} items)"
            elif "data_type" in result:
                status += f" ({result['data_type']})"
        else:
            status = "❌ FAIL"
            failed += 1
            if "error" in result:
                status += f" - {result['error']}"
            elif "status_code" in result:
                status += f" - HTTP {result['status_code']}"
        
        print(status)
    
    print()
    print("🚗 Testing POST /vehicles with valid data:")
    print("-" * 40)
    
    # Test vehicle creation
    vehicle_data = {
        "plateNumber": f"ABC-{str(uuid.uuid4())[:4].upper()}",
        "brand": "تويوتا",
        "model": "كامري",
        "year": 2020,
        "color": "أبيض",
        "customerName": "أحمد محمد",
        "customerPhone": "966501234567",
        "customerEmail": "ahmed@example.com",
        "issue": "فحص دوري",
        "status": "diagnosis",
        "mileage": 50000
    }
    
    print("Creating vehicle with Arabic data...", end=" ")
    vehicle_result = test_endpoint("POST", "/vehicles", vehicle_data, 200)
    results.append(vehicle_result)
    
    if vehicle_result["success"]:
        print("✅ PASS - Vehicle created successfully")
        passed += 1
        if "data" in vehicle_result and isinstance(vehicle_result["data"], dict):
            vehicle_id = vehicle_result["data"].get("id")
            if vehicle_id:
                print(f"   Created vehicle ID: {vehicle_id}")
    else:
        print("❌ FAIL - Vehicle creation failed")
        failed += 1
        if "error" in vehicle_result:
            print(f"   Error: {vehicle_result['error']}")
        elif "status_code" in vehicle_result:
            print(f"   HTTP Status: {vehicle_result['status_code']}")
    
    print()
    print("📊 Test Summary:")
    print("=" * 60)
    print(f"Total Tests: {len(results)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/len(results)*100):.1f}%")
    
    print()
    print("🔍 Detailed Results:")
    print("-" * 60)
    
    for result in results:
        endpoint = result.get("endpoint", "unknown")
        method = result.get("method", "GET")
        
        if result["success"]:
            print(f"✅ {method} {endpoint}")
            if "count" in result:
                print(f"   → Returned {result['count']} items")
            elif "data_type" in result:
                print(f"   → Data type: {result['data_type']}")
        else:
            print(f"❌ {method} {endpoint}")
            if "status_code" in result:
                print(f"   → HTTP {result['status_code']}")
            if "error" in result:
                print(f"   → Error: {result['error']}")
            if "data" in result and result["data"]:
                print(f"   → Response: {str(result['data'])[:100]}...")
    
    print()
    
    # Check for critical issues
    critical_failures = []
    for result in results:
        if not result["success"] and result.get("status_code") == 500:
            critical_failures.append(result["endpoint"])
    
    if critical_failures:
        print("🚨 CRITICAL ISSUES FOUND:")
        print("-" * 30)
        for endpoint in critical_failures:
            print(f"   • {endpoint} returning 500 errors")
        print()
    
    # Memory mode validation
    memory_working = []
    memory_failing = []
    
    for result in results:
        if result["success"]:
            memory_working.append(result["endpoint"])
        else:
            memory_failing.append(result["endpoint"])
    
    print("💾 Memory Mode Status:")
    print("-" * 30)
    if memory_working:
        print("✅ Working endpoints:")
        for ep in memory_working:
            print(f"   • {ep}")
    
    if memory_failing:
        print("❌ Failing endpoints:")
        for ep in memory_failing:
            print(f"   • {ep}")
    
    print()
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! All endpoints working correctly.")
    elif passed > failed:
        print("⚠️  MOSTLY WORKING - Some endpoints need attention.")
    else:
        print("🚨 CRITICAL ISSUES - Multiple endpoints failing.")
    
    return passed, failed, results

if __name__ == "__main__":
    main()
            
            self.log_test("GET /api/operations/analytics/pending", True,
                         f"Total: {response['total']}, Overdue: {response['overdue']}, Has all statuses: {has_all_statuses}")
        else:
            self.log_test("GET /api/operations/analytics/pending", False,
                         f"Status: {status}", response)
    
    async def test_branches_cleanup(self):
        """Test Branches Cleanup API"""
        print("\n🏢 Testing Branches Cleanup API...")
        
        # First, get current biz-accounts to see what we have
        success, response, status = await self.make_request('GET', '/biz-accounts')
        if success:
            initial_count = len(response) if isinstance(response, list) else 0
            print(f"   Initial biz-accounts count: {initial_count}")
        
        # Test: POST /api/biz-accounts/cleanup with keep=2 and mode=hard
        cleanup_data = {"keep": 2, "mode": "hard"}
        success, response, status = await self.make_request('POST', '/biz-accounts/cleanup', cleanup_data)
        if success and 'status' in response and response['status'] == 'ok':
            final_accounts = response.get('final', [])
            self.log_test("POST /api/biz-accounts/cleanup", True,
                         f"Cleanup successful, final count: {len(final_accounts)}")
            
            # Store remaining account IDs for budget test
            self.remaining_account_ids = [acc.get('id') for acc in final_accounts if acc.get('id')]
        else:
            self.log_test("POST /api/biz-accounts/cleanup", False,
                         f"Status: {status}", response)
        
        # Verify: GET /api/biz-accounts and confirm only 2 active remain
        success, response, status = await self.make_request('GET', '/biz-accounts')
        if success and isinstance(response, list):
            active_accounts = [acc for acc in response if not acc.get('archived')]
            if len(active_accounts) == 2:
                self.log_test("GET /api/biz-accounts (verify cleanup)", True,
                             f"Confirmed 2 active accounts remain")
            else:
                self.log_test("GET /api/biz-accounts (verify cleanup)", False,
                             f"Expected 2 active accounts, found {len(active_accounts)}")
        else:
            self.log_test("GET /api/biz-accounts (verify cleanup)", False,
                         f"Status: {status}", response)
    
    async def test_budgets_regression(self):
        """Test Budgets minimal regression"""
        print("\n💰 Testing Budgets API...")
        
        # Test 1: GET /api/budgets (should return 200 list)
        success, response, status = await self.make_request('GET', '/budgets')
        if success and isinstance(response, list):
            self.log_test("GET /api/budgets", True,
                         f"Returned list with {len(response)} budgets")
        else:
            self.log_test("GET /api/budgets", False,
                         f"Status: {status}", response)
        
        # Test 2: POST /api/budgets with sample body
        if self.remaining_account_ids:
            account_id = self.remaining_account_ids[0]
            budget_data = {
                "accountId": account_id,
                "period": "2025-11",
                "incomeTarget": 50000,
                "expenseTarget": 25000
            }
            
            success, response, status = await self.make_request('POST', '/budgets', budget_data)
            if success and 'id' in response:
                created_budget_id = response['id']
                self.log_test("POST /api/budgets", True,
                             f"Created budget with ID: {created_budget_id}")
                
                # Test 3: GET /api/budgets with filters
                params = {"account_id": account_id, "period": "2025-11"}
                success, response, status = await self.make_request('GET', '/budgets', params=params)
                if success and isinstance(response, list) and len(response) > 0:
                    found_budget = next((b for b in response if b.get('id') == created_budget_id), None)
                    if found_budget:
                        self.log_test("GET /api/budgets (filtered)", True,
                                     f"Found created budget in filtered results")
                    else:
                        self.log_test("GET /api/budgets (filtered)", False,
                                     "Created budget not found in filtered results")
                else:
                    self.log_test("GET /api/budgets (filtered)", False,
                                 f"Status: {status}", response)
            else:
                self.log_test("POST /api/budgets", False,
                             f"Status: {status}", response)
        else:
            self.log_test("POST /api/budgets", False,
                         "No account IDs available from cleanup test")
    
    async def check_no_id_leakage(self):
        """Verify no _id fields leak in responses"""
        print("\n🔍 Checking for _id field leakage...")
        
        endpoints_to_check = [
            '/services',
            '/biz-accounts', 
            '/budgets',
            '/operations/pending'
        ]
        
        for endpoint in endpoints_to_check:
            success, response, status = await self.make_request('GET', endpoint)
            if success:
                has_id_leak = False
                if isinstance(response, list):
                    for item in response[:5]:  # Check first 5 items
                        if '_id' in item:
                            has_id_leak = True
                            break
                elif isinstance(response, dict):
                    if '_id' in response:
                        has_id_leak = True
                    # Check items array if present
                    items = response.get('items', [])
                    for item in items[:5]:
                        if isinstance(item, dict) and '_id' in item:
                            has_id_leak = True
                            break
                
                self.log_test(f"No _id leakage in {endpoint}", not has_id_leak,
                             "Found _id field in response" if has_id_leak else "No _id fields found")
            else:
                self.log_test(f"No _id leakage in {endpoint}", False,
                             f"Could not test - endpoint failed: {status}")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests")
        print(f"Backend URL: {API_BASE}")
        print("=" * 60)
        
        # Run all test suites
        await self.test_services_crud()
        await self.test_pending_operations_apis()
        await self.test_branches_cleanup()
        await self.test_budgets_regression()
        await self.check_no_id_leakage()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests, total_tests

async def main():
    """Main test execution"""
    async with BackendTester() as tester:
        passed, failed, total = await tester.run_all_tests()
        
        # Exit with appropriate code
        if failed == 0:
            print(f"\n🎉 All tests passed!")
            return 0
        else:
            print(f"\n⚠️  {failed} test(s) failed")
            return 1

if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)