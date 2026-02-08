#!/usr/bin/env python3
"""
Production Backend Testing for https://fixsa.online
Testing Arabic review request requirements:
1) GET /health => 200
2) GET /api/settings => 200 JSON
3) GET /api/vehicles => 200 JSON
4) OPTIONS preflight on /api/vehicles with Origin=https://fixsa.online => Access-Control-Allow-Origin
5) Verify INFOBIP_API_KEY absence doesn't break server (test whatsapp-bot endpoints if available)
"""

import requests
import json
import sys
from datetime import datetime
import traceback

class ProductionBackendTester:
    def __init__(self):
        self.base_url = "https://fixsa.online"
        self.api_url = f"{self.base_url}/api"
        self.results = []
        self.session = requests.Session()
        
        # Set headers for all requests
        self.session.headers.update({
            'User-Agent': 'Backend-Tester/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
    
    def log_result(self, test_name, success, status_code=None, response_data=None, error=None, details=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'timestamp': datetime.now().isoformat(),
            'status_code': status_code,
            'error': str(error) if error else None,
            'details': details
        }
        
        if response_data and isinstance(response_data, dict):
            result['response_keys'] = list(response_data.keys())
            result['response_size'] = len(str(response_data))
        
        self.results.append(result)
        
        # Print immediate feedback
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if status_code:
            print(f"    Status: {status_code}")
        if error:
            print(f"    Error: {error}")
        if details:
            print(f"    Details: {details}")
        print()
    
    def test_health_endpoint(self):
        """Test 1: GET /health => 200"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        "GET /health", 
                        True, 
                        response.status_code, 
                        data,
                        details=f"Health status: {data.get('status', 'unknown')}"
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "GET /health", 
                        True, 
                        response.status_code,
                        details="Response is not JSON but status 200 received"
                    )
            else:
                self.log_result(
                    "GET /health", 
                    False, 
                    response.status_code,
                    error=f"Expected 200, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result("GET /health", False, error=e)
    
    def test_settings_endpoint(self):
        """Test 2: GET /api/settings => 200 JSON"""
        try:
            response = self.session.get(f"{self.api_url}/settings", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.log_result(
                        "GET /api/settings", 
                        True, 
                        response.status_code, 
                        data,
                        details=f"Settings keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}"
                    )
                except json.JSONDecodeError:
                    self.log_result(
                        "GET /api/settings", 
                        False, 
                        response.status_code,
                        error="Response is not valid JSON"
                    )
            else:
                self.log_result(
                    "GET /api/settings", 
                    False, 
                    response.status_code,
                    error=f"Expected 200, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result("GET /api/settings", False, error=e)
    
    def test_vehicles_endpoint(self):
        """Test 3: GET /api/vehicles => 200 JSON"""
        try:
            response = self.session.get(f"{self.api_url}/vehicles", timeout=15)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, list):
                        self.log_result(
                            "GET /api/vehicles", 
                            True, 
                            response.status_code, 
                            {"vehicles": data},
                            details=f"Found {len(data)} vehicles"
                        )
                    else:
                        self.log_result(
                            "GET /api/vehicles", 
                            True, 
                            response.status_code, 
                            data,
                            details="Response is not a list but valid JSON"
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "GET /api/vehicles", 
                        False, 
                        response.status_code,
                        error="Response is not valid JSON"
                    )
            else:
                self.log_result(
                    "GET /api/vehicles", 
                    False, 
                    response.status_code,
                    error=f"Expected 200, got {response.status_code}"
                )
                
        except Exception as e:
            self.log_result("GET /api/vehicles", False, error=e)
    
    def test_cors_preflight(self):
        """Test 4: OPTIONS preflight on /api/vehicles with Origin=https://fixsa.online => Access-Control-Allow-Origin"""
        try:
            headers = {
                'Origin': 'https://fixsa.online',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
            
            response = self.session.options(f"{self.api_url}/vehicles", headers=headers, timeout=10)
            
            cors_origin = response.headers.get('Access-Control-Allow-Origin')
            cors_methods = response.headers.get('Access-Control-Allow-Methods')
            cors_headers = response.headers.get('Access-Control-Allow-Headers')
            
            if cors_origin:
                self.log_result(
                    "OPTIONS /api/vehicles CORS", 
                    True, 
                    response.status_code,
                    details=f"CORS Origin: {cors_origin}, Methods: {cors_methods}, Headers: {cors_headers}"
                )
            else:
                self.log_result(
                    "OPTIONS /api/vehicles CORS", 
                    False, 
                    response.status_code,
                    error="Access-Control-Allow-Origin header not found",
                    details=f"Available headers: {dict(response.headers)}"
                )
                
        except Exception as e:
            self.log_result("OPTIONS /api/vehicles CORS", False, error=e)
    
    def test_whatsapp_bot_endpoints(self):
        """Test 5: Verify INFOBIP_API_KEY absence doesn't break server - test whatsapp-bot endpoints"""
        # First, let's check if whatsapp-bot endpoints exist by testing common patterns
        whatsapp_endpoints = [
            "/api/whatsapp-bot/status",
            "/api/whatsapp-bot/info",
            "/api/whatsapp/status",
            "/api/whatsapp/info",
            "/api/bot/status",
            "/api/bot/info"
        ]
        
        found_endpoint = False
        
        for endpoint in whatsapp_endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
                
                # If we get anything other than 404, the endpoint exists
                if response.status_code != 404:
                    found_endpoint = True
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            self.log_result(
                                f"WhatsApp Bot {endpoint}", 
                                True, 
                                response.status_code,
                                data,
                                details="WhatsApp bot endpoint working despite missing INFOBIP_API_KEY"
                            )
                        except json.JSONDecodeError:
                            self.log_result(
                                f"WhatsApp Bot {endpoint}", 
                                True, 
                                response.status_code,
                                details="Endpoint responds but not JSON"
                            )
                    elif response.status_code == 500:
                        self.log_result(
                            f"WhatsApp Bot {endpoint}", 
                            False, 
                            response.status_code,
                            error="Server error - possibly due to missing INFOBIP_API_KEY"
                        )
                    else:
                        self.log_result(
                            f"WhatsApp Bot {endpoint}", 
                            True, 
                            response.status_code,
                            details=f"Endpoint exists with status {response.status_code}"
                        )
                    break
                    
            except Exception as e:
                # Continue to next endpoint
                continue
        
        if not found_endpoint:
            # No whatsapp endpoints found, verify server stability by re-testing health and settings
            print("No WhatsApp bot endpoints found. Verifying server stability...")
            
            try:
                # Re-test health endpoint
                health_response = self.session.get(f"{self.base_url}/health", timeout=10)
                settings_response = self.session.get(f"{self.api_url}/settings", timeout=10)
                
                if health_response.status_code == 200 and settings_response.status_code == 200:
                    self.log_result(
                        "Server Stability (No WhatsApp endpoints)", 
                        True,
                        details="Health and settings endpoints still working - server stable without INFOBIP_API_KEY"
                    )
                else:
                    self.log_result(
                        "Server Stability (No WhatsApp endpoints)", 
                        False,
                        error=f"Health: {health_response.status_code}, Settings: {settings_response.status_code}"
                    )
                    
            except Exception as e:
                self.log_result(
                    "Server Stability (No WhatsApp endpoints)", 
                    False,
                    error=f"Server stability check failed: {e}"
                )
    
    def run_all_tests(self):
        """Run all production tests"""
        print("🚀 Starting Production Backend Tests for https://fixsa.online")
        print("=" * 60)
        
        # Test 1: Health endpoint
        self.test_health_endpoint()
        
        # Test 2: Settings endpoint
        self.test_settings_endpoint()
        
        # Test 3: Vehicles endpoint
        self.test_vehicles_endpoint()
        
        # Test 4: CORS preflight
        self.test_cors_preflight()
        
        # Test 5: WhatsApp bot / INFOBIP stability
        self.test_whatsapp_bot_endpoints()
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        # Show failed tests
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['error']}")
            print()
        
        # Show passed tests
        print("✅ PASSED TESTS:")
        for result in self.results:
            if result['success']:
                details = f" ({result['details']})" if result['details'] else ""
                print(f"  - {result['test']}{details}")
        
        print()
        print("🎯 PRODUCTION VERIFICATION COMPLETE")
        
        # Save detailed results to file
        try:
            with open('/app/production_test_results.json', 'w', encoding='utf-8') as f:
                json.dump(self.results, f, ensure_ascii=False, indent=2)
            print("📄 Detailed results saved to: /app/production_test_results.json")
        except Exception as e:
            print(f"⚠️ Could not save results file: {e}")

def main():
    """Main test execution"""
    try:
        tester = ProductionBackendTester()
        tester.run_all_tests()
        
        # Return appropriate exit code
        failed_tests = len([r for r in tester.results if not r['success']])
        sys.exit(1 if failed_tests > 0 else 0)
        
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Critical error during testing: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()