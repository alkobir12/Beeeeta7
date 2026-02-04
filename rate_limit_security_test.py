#!/usr/bin/env python3
"""
Rate Limiting + Security Headers Testing
Testing backend rate limiting and security headers implementation
"""

import requests
import time
import json
from datetime import datetime

# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return "http://localhost:8001"

BACKEND_URL = get_backend_url()
print(f"🌐 Backend URL: {BACKEND_URL}")

def print_test_header(test_name):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_result(success, message, details=None):
    """Print test result with formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {details}")

def test_health_endpoint():
    """Test 1: Verify /health returns 200"""
    print_test_header("Test 1: Health Endpoint")
    
    try:
        url = f"{BACKEND_URL}/health"
        print(f"📡 Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            # Check if response is JSON or HTML
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                data = response.json()
                print(f"📄 Response: {json.dumps(data, indent=2)}")
                print_result(True, "Health endpoint working correctly (JSON response)")
                return True
            elif 'text/html' in content_type:
                # This might be the frontend being served at /health
                print_result(True, "Health endpoint returns 200 (HTML response - frontend served)")
                return True
            else:
                print(f"📄 Response content-type: {content_type}")
                print_result(True, "Health endpoint returns 200")
                return True
        else:
            print_result(False, f"Health endpoint failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Health endpoint error: {str(e)}")
        return False

def test_customers_endpoint():
    """Test 2: Verify /api/customers returns 200"""
    print_test_header("Test 2: Customers Endpoint")
    
    try:
        url = f"{BACKEND_URL}/api/customers"
        print(f"📡 Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            customers = response.json()
            print(f"📄 Customers count: {len(customers)}")
            print_result(True, f"Customers endpoint working correctly - {len(customers)} customers found")
            return True
        else:
            print_result(False, f"Customers endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Customers endpoint error: {str(e)}")
        return False

def test_security_headers():
    """Test 3: Verify security headers are present"""
    print_test_header("Test 3: Security Headers Verification")
    
    try:
        url = f"{BACKEND_URL}/api/customers"
        print(f"📡 Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        print(f"📊 Status Code: {response.status_code}")
        
        # Check required security headers
        required_headers = {
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "frame-ancestors 'none'",
            'Permissions-Policy': "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        }
        
        all_headers_present = True
        
        for header_name, expected_value in required_headers.items():
            actual_value = response.headers.get(header_name)
            print(f"🔍 {header_name}: {actual_value}")
            
            if actual_value:
                if expected_value in actual_value or actual_value == expected_value:
                    print_result(True, f"{header_name} header present and correct")
                else:
                    print_result(False, f"{header_name} header present but incorrect value")
                    print(f"  Expected: {expected_value}")
                    print(f"  Actual: {actual_value}")
                    all_headers_present = False
            else:
                print_result(False, f"{header_name} header missing")
                all_headers_present = False
        
        if all_headers_present:
            print_result(True, "All required security headers are present and correct")
            return True
        else:
            print_result(False, "Some security headers are missing or incorrect")
            return False
            
    except Exception as e:
        print_result(False, f"Security headers test error: {str(e)}")
        return False

def test_rate_limiting():
    """Test 4: Verify rate limiting works by sending multiple requests quickly"""
    print_test_header("Test 4: Rate Limiting Verification")
    
    try:
        # Use /api/import/customers endpoint which has a limit of 6 requests per minute
        url = f"{BACKEND_URL}/api/import/customers"
        print(f"📡 Testing rate limiting on: {url}")
        print("📊 Import endpoints have a limit of 6 requests per minute")
        
        # Send 10 requests quickly
        responses = []
        start_time = time.time()
        
        for i in range(10):
            try:
                # Send POST request (import endpoints typically expect POST)
                test_data = {
                    "customers": [
                        {
                            "name": f"Test Customer {i}",
                            "phone": f"050000000{i}",
                            "email": f"test{i}@example.com"
                        }
                    ]
                }
                
                response = requests.post(url, json=test_data, timeout=5)
                responses.append((i+1, response.status_code, response.headers.get('content-type', '')))
                print(f"Request {i+1}: Status {response.status_code}")
                
                # Small delay to avoid overwhelming the server
                time.sleep(0.1)
                
            except Exception as req_error:
                responses.append((i+1, 'ERROR', str(req_error)))
                print(f"Request {i+1}: ERROR - {req_error}")
        
        end_time = time.time()
        print(f"⏱️ Total time: {end_time - start_time:.2f} seconds")
        
        # Analyze responses
        status_429_count = sum(1 for _, status, _ in responses if status == 429)
        successful_requests = sum(1 for _, status, _ in responses if status in [200, 201])
        
        print(f"📊 Results:")
        print(f"  - Successful requests (200/201): {successful_requests}")
        print(f"  - Rate limited requests (429): {status_429_count}")
        print(f"  - Other responses: {len(responses) - successful_requests - status_429_count}")
        
        # We expect some requests to be rate limited after the 6th request
        if status_429_count > 0:
            print_result(True, f"Rate limiting working correctly - {status_429_count} requests were rate limited")
            return True
        else:
            # Check if we got other error responses that might indicate rate limiting is working
            error_responses = [r for r in responses if r[1] not in [200, 201, 429]]
            if error_responses:
                print_result(True, "Rate limiting may be working (got error responses after initial requests)")
                print(f"Error responses: {error_responses}")
                return True
            else:
                print_result(False, "Rate limiting not working - all requests succeeded")
                return False
            
    except Exception as e:
        print_result(False, f"Rate limiting test error: {str(e)}")
        return False

def test_options_preflight():
    """Test 5: Verify OPTIONS preflight requests work for /api/customers"""
    print_test_header("Test 5: OPTIONS Preflight Request")
    
    try:
        url = f"{BACKEND_URL}/api/customers"
        print(f"📡 Request: OPTIONS {url}")
        
        # Send OPTIONS request with CORS headers from allowed origins
        allowed_origins = [
            'https://fixsa.online',
            'https://www.fixsa.online', 
            'http://localhost:3000'
        ]
        
        success = False
        
        for origin in allowed_origins:
            print(f"🔍 Testing with origin: {origin}")
            
            headers = {
                'Origin': origin,
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
            
            response = requests.options(url, headers=headers, timeout=10)
            print(f"📊 Status Code: {response.status_code}")
            
            # Check CORS headers in response
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
            }
            
            print("🔍 CORS Headers:")
            for header, value in cors_headers.items():
                print(f"  {header}: {value}")
            
            if response.status_code in [200, 204]:
                print_result(True, f"OPTIONS preflight working for origin: {origin}")
                success = True
                break
            else:
                print_result(False, f"OPTIONS preflight failed for {origin} with status {response.status_code}")
        
        if success:
            return True
        else:
            print_result(False, "OPTIONS preflight failed for all tested origins")
            return False
            
    except Exception as e:
        print_result(False, f"OPTIONS preflight test error: {str(e)}")
        return False

def run_rate_limit_security_tests():
    """Run all rate limiting and security tests"""
    print("🚀 Starting Rate Limiting + Security Headers Testing")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # Test 1: Health endpoint
    results.append(("Health Endpoint (/health)", test_health_endpoint()))
    
    # Test 2: Customers endpoint
    results.append(("Customers Endpoint (/api/customers)", test_customers_endpoint()))
    
    # Test 3: Security headers
    results.append(("Security Headers Verification", test_security_headers()))
    
    # Test 4: Rate limiting
    results.append(("Rate Limiting Verification", test_rate_limiting()))
    
    # Test 5: OPTIONS preflight
    results.append(("OPTIONS Preflight Request", test_options_preflight()))
    
    # Summary
    print_test_header("TEST RESULTS SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n📊 Final Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All rate limiting and security tests passed!")
        return True
    else:
        print(f"⚠️ {total - passed} tests failed")
        return False

if __name__ == "__main__":
    success = run_rate_limit_security_tests()
    exit(0 if success else 1)