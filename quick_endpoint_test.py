#!/usr/bin/env python3
"""
Quick endpoint test for missing template endpoints causing 404 errors
Testing:
1. DELETE /api/templates/{id}
2. POST /api/templates/{id}/make-default
3. POST /api/templates/{id}/apply-to-all
4. POST /api/services (422 error)
5. POST /api/parts (422 error)
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

# Get backend URL
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
BASE_URL = f"{BACKEND_URL}/api"

print(f"🔍 Testing endpoints at: {BASE_URL}\n")

def test_endpoint(method, endpoint, data=None, description=""):
    """Test an endpoint and return result"""
    url = f"{BASE_URL}{endpoint}"
    print(f"{'='*80}")
    print(f"TEST: {description}")
    print(f"Method: {method} {endpoint}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            print(f"❌ ENDPOINT NOT FOUND (404)")
            return {"status": 404, "found": False, "error": "Not Found"}
        elif response.status_code == 422:
            print(f"⚠️  VALIDATION ERROR (422)")
            try:
                error_detail = response.json()
                print(f"Error Details: {json.dumps(error_detail, indent=2)}")
                return {"status": 422, "found": True, "error": error_detail}
            except:
                print(f"Error Details: {response.text}")
                return {"status": 422, "found": True, "error": response.text}
        elif response.status_code == 405:
            print(f"❌ METHOD NOT ALLOWED (405)")
            return {"status": 405, "found": False, "error": "Method Not Allowed"}
        elif response.status_code >= 400:
            print(f"❌ ERROR ({response.status_code})")
            try:
                print(f"Response: {response.json()}")
            except:
                print(f"Response: {response.text}")
            return {"status": response.status_code, "found": True, "error": response.text}
        else:
            print(f"✅ SUCCESS ({response.status_code})")
            try:
                resp_json = response.json()
                print(f"Response: {json.dumps(resp_json, indent=2)[:200]}...")
                return {"status": response.status_code, "found": True, "data": resp_json}
            except:
                print(f"Response: {response.text[:200]}...")
                return {"status": response.status_code, "found": True, "data": response.text}
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        return {"status": 0, "found": False, "error": str(e)}

# Test results
results = {}

# First, create a template to test with
print("\n" + "="*80)
print("SETUP: Creating a test template")
print("="*80)
create_response = test_endpoint(
    "POST", 
    "/templates",
    {"type": "invoice", "name": "Test Template", "content": "Test content"},
    "Create test template"
)

template_id = None
if create_response.get("status") == 200 and create_response.get("data"):
    template_id = create_response["data"].get("id")
    print(f"\n✅ Created template with ID: {template_id}")
else:
    print(f"\n⚠️  Could not create template, will use dummy ID for testing")
    template_id = "test-template-id"

print("\n" + "="*80)
print("STARTING ENDPOINT TESTS")
print("="*80 + "\n")

# Test 1: DELETE /api/templates/{id}
results["delete_template"] = test_endpoint(
    "DELETE",
    f"/templates/{template_id}",
    description="Test 1: DELETE /api/templates/{id}"
)

# Test 2: POST /api/templates/{id}/make-default
results["make_default"] = test_endpoint(
    "POST",
    f"/templates/{template_id}/make-default",
    {},
    description="Test 2: POST /api/templates/{id}/make-default"
)

# Test 3: POST /api/templates/{id}/apply-to-all
results["apply_to_all"] = test_endpoint(
    "POST",
    f"/templates/{template_id}/apply-to-all",
    {},
    description="Test 3: POST /api/templates/{id}/apply-to-all"
)

# Test 4: POST /api/services (with invalid data to trigger 422)
results["services_422"] = test_endpoint(
    "POST",
    "/services",
    {},  # Empty payload should trigger validation error
    description="Test 4: POST /api/services (empty payload)"
)

# Test 5: POST /api/parts (with invalid data to trigger 422)
results["parts_422"] = test_endpoint(
    "POST",
    "/parts",
    {},  # Empty payload should trigger validation error
    description="Test 5: POST /api/parts (empty payload)"
)

# Summary
print("\n" + "="*80)
print("SUMMARY OF FINDINGS")
print("="*80 + "\n")

findings = {
    "missing_endpoints": [],
    "validation_errors": [],
    "working_endpoints": []
}

for test_name, result in results.items():
    if result["status"] == 404:
        findings["missing_endpoints"].append(test_name)
    elif result["status"] == 422:
        findings["validation_errors"].append(test_name)
    elif result["status"] == 405:
        findings["missing_endpoints"].append(f"{test_name} (method not allowed)")
    elif result["status"] >= 200 and result["status"] < 300:
        findings["working_endpoints"].append(test_name)

print("❌ MISSING ENDPOINTS (404/405):")
if findings["missing_endpoints"]:
    for endpoint in findings["missing_endpoints"]:
        print(f"  - {endpoint}")
else:
    print("  None")

print("\n⚠️  VALIDATION ERRORS (422):")
if findings["validation_errors"]:
    for endpoint in findings["validation_errors"]:
        print(f"  - {endpoint}")
else:
    print("  None")

print("\n✅ WORKING ENDPOINTS:")
if findings["working_endpoints"]:
    for endpoint in findings["working_endpoints"]:
        print(f"  - {endpoint}")
else:
    print("  None")

print("\n" + "="*80)
print("DETAILED ANALYSIS")
print("="*80 + "\n")

print("1. DELETE /api/templates/{id}:")
if results["delete_template"]["status"] == 404:
    print("   ❌ NOT IMPLEMENTED - Endpoint does not exist in routes_extended.py")
    print("   📝 Only GET and POST /api/templates are implemented")
elif results["delete_template"]["status"] == 405:
    print("   ❌ METHOD NOT ALLOWED - DELETE method not supported")
else:
    print(f"   Status: {results['delete_template']['status']}")

print("\n2. POST /api/templates/{id}/make-default:")
if results["make_default"]["status"] == 404:
    print("   ❌ NOT IMPLEMENTED - Endpoint does not exist")
    print("   📝 Note: /api/invoice-templates/{tid}/make-default exists but not /api/templates/{id}/make-default")
else:
    print(f"   Status: {results['make_default']['status']}")

print("\n3. POST /api/templates/{id}/apply-to-all:")
if results["apply_to_all"]["status"] == 404:
    print("   ❌ NOT IMPLEMENTED - Endpoint does not exist in routes_extended.py")
else:
    print(f"   Status: {results['apply_to_all']['status']}")

print("\n4. POST /api/services:")
if results["services_422"]["status"] == 422:
    print("   ⚠️  VALIDATION ERROR - Endpoint exists but requires valid payload")
    print("   📝 Missing required fields in request body")
    if "error" in results["services_422"]:
        print(f"   Details: {json.dumps(results['services_422']['error'], indent=6)}")
else:
    print(f"   Status: {results['services_422']['status']}")

print("\n5. POST /api/parts:")
if results["parts_422"]["status"] == 422:
    print("   ⚠️  VALIDATION ERROR - Endpoint exists but requires valid payload")
    print("   📝 Missing required fields in request body")
    if "error" in results["parts_422"]:
        print(f"   Details: {json.dumps(results['parts_422']['error'], indent=6)}")
else:
    print(f"   Status: {results['parts_422']['status']}")

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
