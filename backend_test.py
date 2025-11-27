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
BACKEND_URL = "https://garage-tracker-9.preview.emergentagent.com/api"

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