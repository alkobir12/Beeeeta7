#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Workshop Management System
Testing Order:
1. Workshop Profile (معلومات الورشة)
2. Add New Vehicle (إضافة مركبة جديدة)
3. Knowledge Management - AI Endpoints (إدارة المعرفة)
4. Basic Services (الخدمات الأساسية)
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from environment
BACKEND_URL = "https://workshop-genius-6.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(test_name: str, status: str, details: str = "", response_time: float = 0):
    """Log test results with colors"""
    color = Colors.GREEN if status == "PASS" else Colors.RED if status == "FAIL" else Colors.YELLOW
    print(f"{color}[{status}]{Colors.RESET} {test_name}")
    if details:
        print(f"  {details}")
    if response_time > 0:
        print(f"  ⏱️  Response Time: {response_time:.3f}s")
    print()

def test_workshop_profile():
    """Test 1: Workshop Profile APIs"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 1: Workshop Profile (معلومات الورشة)")
    print(f"{'='*80}{Colors.RESET}\n")
    
    results = []
    
    # Test 1.1: GET /api/profile - Check current data
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/profile", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            log_test(
                "GET /api/profile - تحقق من البيانات الحالية",
                "PASS",
                f"Status: {response.status_code}, Data keys: {list(data.keys())}",
                response_time
            )
            results.append(("GET /api/profile", True, response_time))
            initial_profile = data
        else:
            log_test(
                "GET /api/profile - تحقق من البيانات الحالية",
                "FAIL",
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            results.append(("GET /api/profile", False, 0))
            return results
    except Exception as e:
        log_test("GET /api/profile", "FAIL", f"Exception: {str(e)}")
        results.append(("GET /api/profile", False, 0))
        return results
    
    # Test 1.2: PUT /api/profile - Update with new data
    try:
        new_profile_data = {
            "workshopName": "ورشة الاختبار الشاملة",
            "phone": "+966501234567",
            "email": "test@workshop.sa",
            "address": "الرياض، المملكة العربية السعودية",
            "taxNumber": "123456789"
        }
        
        start_time = time.time()
        response = requests.put(
            f"{BACKEND_URL}/profile",
            json=new_profile_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            log_test(
                "PUT /api/profile - تحديث البيانات",
                "PASS",
                f"Status: {response.status_code}, Updated profile with new data",
                response_time
            )
            results.append(("PUT /api/profile", True, response_time))
        else:
            log_test(
                "PUT /api/profile - تحديث البيانات",
                "FAIL",
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            results.append(("PUT /api/profile", False, 0))
    except Exception as e:
        log_test("PUT /api/profile", "FAIL", f"Exception: {str(e)}")
        results.append(("PUT /api/profile", False, 0))
    
    # Test 1.3: GET /api/profile again - Verify data was saved
    try:
        time.sleep(0.5)  # Small delay to ensure data is persisted
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/profile", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            # Verify the data was actually saved
            saved_correctly = (
                data.get("workshopName") == "ورشة الاختبار الشاملة" and
                data.get("phone") == "+966501234567" and
                data.get("email") == "test@workshop.sa"
            )
            
            if saved_correctly:
                log_test(
                    "GET /api/profile - التحقق من حفظ البيانات",
                    "PASS",
                    f"✅ Data persisted correctly: workshopName={data.get('workshopName')}, phone={data.get('phone')}",
                    response_time
                )
                results.append(("GET /api/profile (verify)", True, response_time))
            else:
                log_test(
                    "GET /api/profile - التحقق من حفظ البيانات",
                    "FAIL",
                    f"❌ Data NOT persisted correctly. Expected 'ورشة الاختبار الشاملة', got: {data.get('workshopName')}"
                )
                results.append(("GET /api/profile (verify)", False, 0))
        else:
            log_test(
                "GET /api/profile - التحقق من حفظ البيانات",
                "FAIL",
                f"Status: {response.status_code}"
            )
            results.append(("GET /api/profile (verify)", False, 0))
    except Exception as e:
        log_test("GET /api/profile (verify)", "FAIL", f"Exception: {str(e)}")
        results.append(("GET /api/profile (verify)", False, 0))
    
    return results

def test_vehicle_management():
    """Test 2: Vehicle Management APIs"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 2: Vehicle Management (إضافة مركبة جديدة)")
    print(f"{'='*80}{Colors.RESET}\n")
    
    results = []
    vehicle_id = None
    
    # Test 2.1: POST /api/vehicles - Create new vehicle with complete data
    try:
        # First, get some service IDs from the database
        services_response = requests.get(f"{BACKEND_URL}/services", timeout=10)
        service_ids = []
        if services_response.status_code == 200:
            services = services_response.json()
            # Get at least 2 service IDs
            service_ids = [s.get("id") for s in services[:2] if s.get("id")]
        
        # If no services found, use empty list (still valid)
        if not service_ids:
            service_ids = []
        
        vehicle_data = {
            "customerName": "أحمد محمد الراشد",
            "customerPhone": "+966555123456",
            "customerEmail": "ahmed@example.sa",
            "plateNumber": "ABC-7890",
            "brand": "تويوتا",
            "model": "كامري",
            "year": 2022,
            "color": "أبيض",
            "mileage": 45000,
            "status": "diagnosis",
            "services": service_ids,  # List of service IDs
            "notes": "العميل يشتكي من صوت غريب في المحرك"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/vehicles",
            json=vehicle_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            vehicle_id = data.get("id")
            log_test(
                "POST /api/vehicles - إضافة مركبة جديدة",
                "PASS",
                f"✅ Vehicle created: ID={vehicle_id}, Plate={data.get('plateNumber')}, Services count={len(data.get('services', []))}",
                response_time
            )
            results.append(("POST /api/vehicles", True, response_time))
        else:
            log_test(
                "POST /api/vehicles - إضافة مركبة جديدة",
                "FAIL",
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            results.append(("POST /api/vehicles", False, 0))
            return results
    except Exception as e:
        log_test("POST /api/vehicles", "FAIL", f"Exception: {str(e)}")
        results.append(("POST /api/vehicles", False, 0))
        return results
    
    # Test 2.2: GET /api/vehicles - Verify vehicle appears in list
    try:
        time.sleep(0.5)
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/vehicles", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            vehicles = response.json()
            vehicle_found = any(v.get("id") == vehicle_id for v in vehicles)
            
            if vehicle_found:
                log_test(
                    "GET /api/vehicles - التحقق من ظهور المركبة",
                    "PASS",
                    f"✅ Vehicle found in list. Total vehicles: {len(vehicles)}",
                    response_time
                )
                results.append(("GET /api/vehicles", True, response_time))
            else:
                log_test(
                    "GET /api/vehicles - التحقق من ظهور المركبة",
                    "FAIL",
                    f"❌ Vehicle NOT found in list. Total vehicles: {len(vehicles)}"
                )
                results.append(("GET /api/vehicles", False, 0))
        else:
            log_test(
                "GET /api/vehicles - التحقق من ظهور المركبة",
                "FAIL",
                f"Status: {response.status_code}"
            )
            results.append(("GET /api/vehicles", False, 0))
    except Exception as e:
        log_test("GET /api/vehicles", "FAIL", f"Exception: {str(e)}")
        results.append(("GET /api/vehicles", False, 0))
    
    # Test 2.3: GET /api/vehicles/{id} - Verify vehicle details
    if vehicle_id:
        try:
            start_time = time.time()
            response = requests.get(f"{BACKEND_URL}/vehicles/{vehicle_id}", timeout=10)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                # Verify all important fields
                has_customer = data.get("customerName") == "أحمد محمد الراشد"
                has_plate = data.get("plateNumber") == "ABC-7890"
                has_services = len(data.get("services", [])) >= 2
                
                if has_customer and has_plate and has_services:
                    log_test(
                        "GET /api/vehicles/{id} - التحقق من تفاصيل المركبة",
                        "PASS",
                        f"✅ All details correct: Customer={data.get('customerName')}, Plate={data.get('plateNumber')}, Services={len(data.get('services', []))}",
                        response_time
                    )
                    results.append(("GET /api/vehicles/{id}", True, response_time))
                else:
                    log_test(
                        "GET /api/vehicles/{id} - التحقق من تفاصيل المركبة",
                        "FAIL",
                        f"❌ Details incomplete or incorrect"
                    )
                    results.append(("GET /api/vehicles/{id}", False, 0))
            else:
                log_test(
                    "GET /api/vehicles/{id} - التحقق من تفاصيل المركبة",
                    "FAIL",
                    f"Status: {response.status_code}"
                )
                results.append(("GET /api/vehicles/{id}", False, 0))
        except Exception as e:
            log_test("GET /api/vehicles/{id}", "FAIL", f"Exception: {str(e)}")
            results.append(("GET /api/vehicles/{id}", False, 0))
    
    return results

def test_ai_knowledge_base():
    """Test 3: AI Knowledge Base Endpoints"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 3: AI Knowledge Base (إدارة المعرفة - AI Endpoints)")
    print(f"{'='*80}{Colors.RESET}\n")
    
    results = []
    
    # Test 3.1: POST /api/ai/kb/engine-info - Simple Arabic query
    try:
        query_data = {
            "query": "ما هي أسباب ارتفاع حرارة المحرك؟"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/ai/kb/engine-info",
            json=query_data,
            headers={"Content-Type": "application/json"},
            timeout=30  # Increased timeout for AI processing
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            log_test(
                "POST /api/ai/kb/engine-info - استعلام عربي بسيط",
                "PASS",
                f"✅ Response received: {str(data)[:100]}...",
                response_time
            )
            results.append(("POST /api/ai/kb/engine-info", True, response_time))
            
            # Check response speed
            if response_time > 10.0:
                print(f"  {Colors.YELLOW}⚠️  Warning: Response time is slow ({response_time:.3f}s){Colors.RESET}")
        else:
            log_test(
                "POST /api/ai/kb/engine-info - استعلام عربي بسيط",
                "FAIL",
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            results.append(("POST /api/ai/kb/engine-info", False, 0))
    except requests.exceptions.Timeout:
        log_test(
            "POST /api/ai/kb/engine-info", 
            "FAIL", 
            f"⚠️  Timeout after 30s - AI endpoint is too slow or unresponsive"
        )
        results.append(("POST /api/ai/kb/engine-info", False, 0))
    except Exception as e:
        log_test("POST /api/ai/kb/engine-info", "FAIL", f"Exception: {str(e)}")
        results.append(("POST /api/ai/kb/engine-info", False, 0))
    
    # Test 3.2: POST /api/ai/kb/smart-search - Arabic search term
    try:
        search_data = {
            "query": "فرامل"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/ai/kb/smart-search",
            json=search_data,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            log_test(
                "POST /api/ai/kb/smart-search - كلمة بحث عربية",
                "PASS",
                f"✅ Search results received: {str(data)[:100]}...",
                response_time
            )
            results.append(("POST /api/ai/kb/smart-search", True, response_time))
            
            # Check response speed
            if response_time > 5.0:
                print(f"  {Colors.YELLOW}⚠️  Warning: Response time is slow ({response_time:.3f}s){Colors.RESET}")
        else:
            log_test(
                "POST /api/ai/kb/smart-search - كلمة بحث عربية",
                "FAIL",
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            results.append(("POST /api/ai/kb/smart-search", False, 0))
    except Exception as e:
        log_test("POST /api/ai/kb/smart-search", "FAIL", f"Exception: {str(e)}")
        results.append(("POST /api/ai/kb/smart-search", False, 0))
    
    return results

def test_basic_services():
    """Test 4: Basic Service Endpoints"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 4: Basic Services (الخدمات الأساسية)")
    print(f"{'='*80}{Colors.RESET}\n")
    
    results = []
    
    # Test 4.1: GET /api/services - Verify services exist
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/services", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            services = response.json()
            log_test(
                "GET /api/services - التحقق من وجود خدمات",
                "PASS",
                f"✅ Services found: {len(services)} services available",
                response_time
            )
            results.append(("GET /api/services", True, response_time))
        else:
            log_test(
                "GET /api/services - التحقق من وجود خدمات",
                "FAIL",
                f"Status: {response.status_code}"
            )
            results.append(("GET /api/services", False, 0))
    except Exception as e:
        log_test("GET /api/services", "FAIL", f"Exception: {str(e)}")
        results.append(("GET /api/services", False, 0))
    
    # Test 4.2: GET /api/parts - Verify parts access
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/parts", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            parts = response.json()
            log_test(
                "GET /api/parts - التحقق من إمكانية الوصول للقطع",
                "PASS",
                f"✅ Parts accessible: {len(parts)} parts available",
                response_time
            )
            results.append(("GET /api/parts", True, response_time))
        else:
            log_test(
                "GET /api/parts - التحقق من إمكانية الوصول للقطع",
                "FAIL",
                f"Status: {response.status_code}"
            )
            results.append(("GET /api/parts", False, 0))
    except Exception as e:
        log_test("GET /api/parts", "FAIL", f"Exception: {str(e)}")
        results.append(("GET /api/parts", False, 0))
    
    # Test 4.3: GET /api/customers - Verify customer list
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/customers", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            customers = response.json()
            log_test(
                "GET /api/customers - التحقق من قائمة العملاء",
                "PASS",
                f"✅ Customers accessible: {len(customers)} customers in database",
                response_time
            )
            results.append(("GET /api/customers", True, response_time))
        else:
            log_test(
                "GET /api/customers - التحقق من قائمة العملاء",
                "FAIL",
                f"Status: {response.status_code}"
            )
            results.append(("GET /api/customers", False, 0))
    except Exception as e:
        log_test("GET /api/customers", "FAIL", f"Exception: {str(e)}")
        results.append(("GET /api/customers", False, 0))
    
    return results

def print_summary(all_results: List[tuple]):
    """Print comprehensive test summary"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST SUMMARY (ملخص الاختبار)")
    print(f"{'='*80}{Colors.RESET}\n")
    
    total_tests = len(all_results)
    passed_tests = sum(1 for _, passed, _ in all_results if passed)
    failed_tests = total_tests - passed_tests
    
    # Calculate average response time
    response_times = [rt for _, passed, rt in all_results if passed and rt > 0]
    avg_response_time = sum(response_times) / len(response_times) if response_times else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"{Colors.GREEN}Passed: {passed_tests}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {failed_tests}{Colors.RESET}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    print(f"Average Response Time: {avg_response_time:.3f}s\n")
    
    # Detailed results
    print("Detailed Results:")
    print("-" * 80)
    for test_name, passed, response_time in all_results:
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        time_str = f"({response_time:.3f}s)" if response_time > 0 else ""
        print(f"{status} {test_name} {time_str}")
    
    print("\n" + "="*80)
    
    # Final verdict
    if failed_tests == 0:
        print(f"{Colors.GREEN}🎉 ALL TESTS PASSED! System is working correctly.{Colors.RESET}")
    else:
        print(f"{Colors.RED}⚠️  {failed_tests} TEST(S) FAILED. Please review the issues above.{Colors.RESET}")
    print("="*80 + "\n")

def main():
    """Main test execution"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"WORKSHOP MANAGEMENT SYSTEM - COMPREHENSIVE BACKEND TESTING")
    print(f"نظام إدارة الورش - اختبار شامل للوظائف الأساسية")
    print(f"{'='*80}{Colors.RESET}\n")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    all_results = []
    
    # Run all tests in order
    all_results.extend(test_workshop_profile())
    all_results.extend(test_vehicle_management())
    all_results.extend(test_ai_knowledge_base())
    all_results.extend(test_basic_services())
    
    # Print summary
    print_summary(all_results)

if __name__ == "__main__":
    main()
