#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://finance-auditor-bot.preview.emergentagent.com/api"

def test_alkabeer_bot_editor_endpoints():
    """Test the specific AlKabeer Bot editor endpoints mentioned in the review request"""
    
    print("=== Testing AlKabeer Bot Editor Endpoints ===")
    
    results = {"history": False, "comments": False}
    
    # Test 1: GET /api/alkabeer-bot/editor/history
    print("\n1. Testing GET /api/alkabeer-bot/editor/history")
    try:
        url = f"{BACKEND_URL}/alkabeer-bot/editor/history"
        params = {
            "user_id": "local-admin",
            "path": "/operations"
        }
        response = requests.get(url, params=params, timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ SUCCESS: Response received")
            print(f"   Response keys: {list(data.keys())}")
            if 'success' in data and data['success']:
                print(f"   Success flag: {data['success']}")
                results["history"] = True
            if 'data' in data:
                print(f"   Data type: {type(data['data'])}")
                if isinstance(data['data'], list):
                    print(f"   Data length: {len(data['data'])}")
        else:
            print(f"   ❌ FAILED: HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ❌ ERROR: {str(e)}")
    
    # Test 2: GET /api/alkabeer-bot/editor/comments
    print("\n2. Testing GET /api/alkabeer-bot/editor/comments")
    try:
        url = f"{BACKEND_URL}/alkabeer-bot/editor/comments"
        params = {
            "path": "/operations"
        }
        response = requests.get(url, params=params, timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ SUCCESS: Response received")
            print(f"   Response keys: {list(data.keys())}")
            if 'success' in data and data['success']:
                print(f"   Success flag: {data['success']}")
                results["comments"] = True
            if 'data' in data:
                print(f"   Data type: {type(data['data'])}")
                if isinstance(data['data'], list):
                    print(f"   Data length: {len(data['data'])}")
        else:
            print(f"   ❌ FAILED: HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ❌ ERROR: {str(e)}")
    
    return results

def test_backend_health():
    """Test basic backend connectivity"""
    print("\n=== Testing Backend Health ===")
    
    try:
        # Try to hit a basic endpoint to verify backend is running
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        print(f"Health check status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Backend is responding")
            return True
        else:
            print("⚠️ Backend responding but not healthy")
            return False
    except Exception as e:
        print(f"❌ Backend health check failed: {str(e)}")
        
        # Try alternative endpoint
        try:
            response = requests.get(f"{BACKEND_URL}/", timeout=5)
            print(f"Root endpoint status: {response.status_code}")
            if response.status_code in [200, 404]:
                print("✅ Backend is reachable")
                return True
            else:
                print("⚠️ Backend reachable but unexpected response")
                return False
        except Exception as e2:
            print(f"❌ Backend completely unreachable: {str(e2)}")
            return False

def main():
    print(f"Testing backend at: {BACKEND_URL}")
    print(f"Test time: {datetime.now().isoformat()}")
    
    # Test backend health first
    backend_healthy = test_backend_health()
    
    # Test specific endpoints
    endpoint_results = test_alkabeer_bot_editor_endpoints()
    
    print("\n=== Test Summary ===")
    print(f"Backend Health: {'✅ PASS' if backend_healthy else '❌ FAIL'}")
    print(f"History Endpoint: {'✅ PASS' if endpoint_results['history'] else '❌ FAIL'}")
    print(f"Comments Endpoint: {'✅ PASS' if endpoint_results['comments'] else '❌ FAIL'}")
    
    # Overall result
    all_passed = backend_healthy and endpoint_results['history'] and endpoint_results['comments']
    print(f"\nOverall Backend Test Result: {'✅ PASS' if all_passed else '❌ FAIL'}")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)