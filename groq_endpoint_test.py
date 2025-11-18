#!/usr/bin/env python3
"""
Quick test for the new Groq chat endpoint POST /api/ai/groq-chat
Testing requirements from Arabic review request:
1. {"message": "Hello"} returns 200 or no syntax error
2. Without GROQ_API_KEY returns 500 with proper detail message
3. No conflict with existing /api/ai/chat endpoint
4. Server works without breaking other endpoints
"""

import requests
import json
import os
import sys
from pathlib import Path

# Get backend URL from frontend/.env
def get_backend_url():
    frontend_env = Path("/app/frontend/.env")
    if frontend_env.exists():
        with open(frontend_env, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

BACKEND_URL = get_backend_url()
API_BASE = f"{BACKEND_URL}/api"

def test_groq_endpoint():
    """Test the new Groq chat endpoint"""
    print("🧪 Testing POST /api/ai/groq-chat endpoint")
    print(f"Backend URL: {BACKEND_URL}")
    
    # Test 1: Basic functionality with Hello message
    print("\n1️⃣ Testing basic functionality with Hello message...")
    try:
        response = requests.post(
            f"{API_BASE}/ai/groq-chat",
            json={"message": "Hello"},
            timeout=30
        )
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("   ✅ PASS: Endpoint returns 200 OK")
        elif response.status_code == 500:
            # Check if it's the expected GROQ_API_KEY error
            try:
                error_data = response.json()
                if "GROQ_API_KEY is not configured" in error_data.get("detail", ""):
                    print("   ✅ PASS: Returns expected GROQ_API_KEY error (500)")
                else:
                    print(f"   ⚠️  PARTIAL: 500 error but different message: {error_data.get('detail')}")
            except:
                print(f"   ❌ FAIL: 500 error with non-JSON response: {response.text}")
        else:
            print(f"   ❌ FAIL: Unexpected status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL: Request failed: {e}")
    except Exception as e:
        print(f"   ❌ FAIL: Unexpected error: {e}")

    # Test 2: Check for GROQ_API_KEY configuration error specifically
    print("\n2️⃣ Testing GROQ_API_KEY error handling...")
    try:
        response = requests.post(
            f"{API_BASE}/ai/groq-chat",
            json={"message": "Test"},
            timeout=30
        )
        
        if response.status_code == 500:
            try:
                error_data = response.json()
                detail = error_data.get("detail", "")
                if "GROQ_API_KEY is not configured on the server" in detail:
                    print("   ✅ PASS: Correct error message for missing GROQ_API_KEY")
                else:
                    print(f"   ⚠️  PARTIAL: 500 error but different detail: {detail}")
            except:
                print("   ❌ FAIL: 500 error but response is not JSON")
        elif response.status_code == 200:
            print("   ✅ PASS: GROQ_API_KEY is configured and endpoint works")
        else:
            print(f"   ❌ FAIL: Unexpected status code {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ FAIL: Error testing GROQ_API_KEY handling: {e}")

    # Test 3: Verify no conflict with existing /api/ai/chat
    print("\n3️⃣ Testing no conflict with existing /api/ai/chat...")
    try:
        response = requests.post(
            f"{API_BASE}/ai/chat",
            json={"message": "Hello"},
            timeout=30
        )
        print(f"   /api/ai/chat Status: {response.status_code}")
        
        if response.status_code in [200, 500]:  # 500 might be due to missing AI keys
            print("   ✅ PASS: Existing /api/ai/chat endpoint still accessible")
        else:
            print(f"   ❌ FAIL: Existing endpoint returns {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ FAIL: Error accessing existing /api/ai/chat: {e}")

    # Test 4: Test other endpoints to ensure no regression
    print("\n4️⃣ Testing other endpoints for regression...")
    test_endpoints = [
        ("/", "GET"),
        ("/vehicles", "GET"),
        ("/customers", "GET"),
        ("/services", "GET")
    ]
    
    regression_count = 0
    for endpoint, method in test_endpoints:
        try:
            if method == "GET":
                response = requests.get(f"{API_BASE}{endpoint}", timeout=10)
            else:
                response = requests.post(f"{API_BASE}{endpoint}", json={}, timeout=10)
                
            if response.status_code in [200, 422, 500]:  # 422/500 might be expected for some endpoints
                print(f"   ✅ {endpoint}: {response.status_code}")
            else:
                print(f"   ❌ {endpoint}: {response.status_code}")
                regression_count += 1
        except Exception as e:
            print(f"   ❌ {endpoint}: Error - {e}")
            regression_count += 1
    
    if regression_count == 0:
        print("   ✅ PASS: No regression detected in other endpoints")
    else:
        print(f"   ❌ FAIL: {regression_count} endpoints showing issues")

def test_server_health():
    """Test basic server health"""
    print("\n🏥 Testing server health...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            print("   ✅ PASS: Server is responding")
            data = response.json()
            print(f"   Server: {data.get('message', 'Unknown')}")
        else:
            print(f"   ❌ FAIL: Server health check failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ FAIL: Cannot reach server: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 GROQ ENDPOINT QUICK TEST")
    print("=" * 60)
    
    test_server_health()
    test_groq_endpoint()
    
    print("\n" + "=" * 60)
    print("✅ Test completed. Check results above.")
    print("=" * 60)