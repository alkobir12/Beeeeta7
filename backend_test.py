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
            'response': response_data
        })
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{API_BASE}{endpoint}"
        try:
            kwargs = {}
            if data:
                kwargs['json'] = data
            if params:
                kwargs['params'] = params
                
            async with self.session.request(method, url, **kwargs) as response:
                try:
                    response_data = await response.json()
                except:
                    response_data = await response.text()
                
                return response.status < 400, response_data, response.status
        except Exception as e:
            return False, {"error": str(e)}, 0
    
    async def test_services_crud(self):
        """Test Services CRUD operations with Arabic data"""
        print("\n🔧 Testing Services CRUD API...")
        
        # Test 1: POST /api/services with Arabic data
        service_data = {
            "name": "تنظيف بخاخات",
            "category": "محرك", 
            "price": 150,
            "duration": 45
        }
        
        success, response, status = await self.make_request('POST', '/services', service_data)
        if success and 'id' in response:
            self.created_service_id = response['id']
            self.log_test("POST /api/services (Arabic data)", True, 
                         f"Created service with ID: {self.created_service_id}")
        else:
            self.log_test("POST /api/services (Arabic data)", False, 
                         f"Status: {status}", response)
            return
        
        # Test 2: GET /api/services and verify created service
        success, response, status = await self.make_request('GET', '/services')
        if success and isinstance(response, list):
            created_service = next((s for s in response if s.get('id') == self.created_service_id), None)
            if created_service:
                self.log_test("GET /api/services (verify creation)", True,
                             f"Found created service: {created_service.get('name')}")
            else:
                self.log_test("GET /api/services (verify creation)", False,
                             "Created service not found in list")
        else:
            self.log_test("GET /api/services (verify creation)", False,
                         f"Status: {status}", response)
        
        # Test 3: PUT /api/services/{id} to update price
        update_data = {"price": 180}
        success, response, status = await self.make_request('PUT', f'/services/{self.created_service_id}', update_data)
        if success and response.get('price') == 180:
            self.log_test("PUT /api/services/{id} (update price)", True,
                         f"Updated price to {response.get('price')}")
        else:
            self.log_test("PUT /api/services/{id} (update price)", False,
                         f"Status: {status}", response)
        
        # Test 4: DELETE /api/services/{id}
        success, response, status = await self.make_request('DELETE', f'/services/{self.created_service_id}')
        if success:
            self.log_test("DELETE /api/services/{id}", True, "Service deleted successfully")
        else:
            self.log_test("DELETE /api/services/{id}", False,
                         f"Status: {status}", response)
    
    async def test_pending_operations_apis(self):
        """Test Pending Operations APIs"""
        print("\n⏳ Testing Pending Operations APIs...")
        
        # Test 1: GET /api/operations/pending (no params)
        success, response, status = await self.make_request('GET', '/operations/pending')
        if success and 'count' in response and 'items' in response:
            # Verify ISO dates
            items = response.get('items', [])
            iso_dates_valid = True
            for item in items[:3]:  # Check first 3 items
                for date_field in ['entryDate', 'estimatedCompletion']:
                    if date_field in item and item[date_field]:
                        try:
                            datetime.fromisoformat(item[date_field].replace('Z', '+00:00'))
                        except:
                            iso_dates_valid = False
                            break
                if not iso_dates_valid:
                    break
            
            self.log_test("GET /api/operations/pending", True,
                         f"Count: {response['count']}, ISO dates valid: {iso_dates_valid}")
        else:
            self.log_test("GET /api/operations/pending", False,
                         f"Status: {status}", response)
        
        # Test 2: GET /api/operations/analytics/pending
        success, response, status = await self.make_request('GET', '/operations/analytics/pending')
        if success and all(key in response for key in ['total', 'byStatus', 'overdue']):
            by_status = response.get('byStatus', {})
            expected_statuses = ['diagnosis', 'quotation', 'repair']
            has_all_statuses = all(status in by_status for status in expected_statuses)
            
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