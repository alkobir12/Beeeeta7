#!/usr/bin/env python3
"""
Backend Testing for Liquid Live Editor Integration
Testing alkabeer-bot endpoints after Liquid Live Editor integration
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend/.env
BACKEND_URL = "https://repair-mgmt-fresh.preview.emergentagent.com/api"

def test_get_customization():
    """Test GET /api/alkabeer-bot/customization"""
    print("🔍 Testing GET /api/alkabeer-bot/customization...")
    
    try:
        url = f"{BACKEND_URL}/alkabeer-bot/customization"
        params = {
            "user_id": "manager",
            "path": "/"
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["contents", "block_order", "positions"]
            data_section = data.get("data", {})
            
            missing_fields = []
            for field in required_fields:
                if field not in data_section:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ FAIL - Missing fields: {missing_fields}")
                return False
            else:
                print(f"✅ PASS - All required fields present: {required_fields}")
                print(f"   Response structure: {list(data_section.keys())}")
                return True
        else:
            print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {str(e)}")
        return False

def test_put_customization():
    """Test PUT /api/alkabeer-bot/customization"""
    print("\n🔍 Testing PUT /api/alkabeer-bot/customization...")
    
    try:
        url = f"{BACKEND_URL}/alkabeer-bot/customization"
        
        # Test data with required fields
        test_data = {
            "user_id": "manager",
            "path": "/test",
            "contents": {"test_element": "test_content"},
            "block_order": ["block1", "block2", "block3"],
            "positions": {"element1": {"x": 100, "y": 200}}
        }
        
        response = requests.put(url, json=test_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("success"):
                print("✅ PASS - PUT request successful")
                print(f"   Saved data: {data.get('data', {}).keys()}")
                return True
            else:
                print(f"❌ FAIL - Success flag false: {data}")
                return False
        else:
            print(f"❌ FAIL - HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {str(e)}")
        return False

def test_draft_publish_workflow():
    """Test draft publish workflow (PUT then GET)"""
    print("\n🔍 Testing draft publish workflow (PUT then GET)...")
    
    try:
        # Step 1: PUT some test data
        put_url = f"{BACKEND_URL}/alkabeer-bot/customization"
        test_data = {
            "user_id": "manager",
            "path": "/workflow_test",
            "contents": {"draft_element": "draft_content_123"},
            "block_order": ["draft_block1", "draft_block2"],
            "positions": {"draft_pos": {"x": 150, "y": 250}}
        }
        
        put_response = requests.put(put_url, json=test_data, timeout=10)
        
        if put_response.status_code != 200:
            print(f"❌ FAIL - PUT failed: HTTP {put_response.status_code}")
            return False
        
        # Step 2: GET the same data back
        get_url = f"{BACKEND_URL}/alkabeer-bot/customization"
        params = {
            "user_id": "manager",
            "path": "/workflow_test"
        }
        
        get_response = requests.get(get_url, params=params, timeout=10)
        
        if get_response.status_code != 200:
            print(f"❌ FAIL - GET failed: HTTP {get_response.status_code}")
            return False
        
        # Step 3: Verify data integrity
        retrieved_data = get_response.json().get("data", {})
        
        # Check if saved data matches retrieved data
        checks = [
            ("contents", test_data["contents"], retrieved_data.get("contents", {})),
            ("block_order", test_data["block_order"], retrieved_data.get("block_order", [])),
            ("positions", test_data["positions"], retrieved_data.get("positions", {}))
        ]
        
        all_passed = True
        for field_name, expected, actual in checks:
            if expected == actual:
                print(f"   ✅ {field_name}: Data integrity maintained")
            else:
                print(f"   ❌ {field_name}: Data mismatch")
                print(f"      Expected: {expected}")
                print(f"      Actual: {actual}")
                all_passed = False
        
        if all_passed:
            print("✅ PASS - Draft publish workflow working correctly")
            return True
        else:
            print("❌ FAIL - Data integrity issues in workflow")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {str(e)}")
        return False

def test_chat_rrr_exit():
    """Test POST /api/alkabeer-bot/chat with rrr then EXIT"""
    print("\n🔍 Testing POST /api/alkabeer-bot/chat (rrr → EXIT)...")
    
    try:
        url = f"{BACKEND_URL}/alkabeer-bot/chat"
        session_id = "test_session_123"
        
        # Step 1: Send "rrr" command
        rrr_data = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "manager",
            "userId": "manager",
            "currentPath": "/",
            "uiSnapshot": []
        }
        
        rrr_response = requests.post(url, json=rrr_data, timeout=10)
        
        if rrr_response.status_code != 200:
            print(f"❌ FAIL - RRR command failed: HTTP {rrr_response.status_code}")
            return False
        
        rrr_result = rrr_response.json()
        
        # Check if developer mode was activated
        if rrr_result.get("mode") != "dev":
            print(f"❌ FAIL - RRR didn't activate dev mode: {rrr_result.get('mode')}")
            return False
        
        print("   ✅ RRR command activated developer mode")
        
        # Step 2: Send "EXIT" command in same session
        exit_data = {
            "message": "EXIT",
            "sessionId": session_id,
            "role": "manager",
            "userId": "manager",
            "currentPath": "/",
            "uiSnapshot": []
        }
        
        exit_response = requests.post(url, json=exit_data, timeout=10)
        
        if exit_response.status_code != 200:
            print(f"❌ FAIL - EXIT command failed: HTTP {exit_response.status_code}")
            return False
        
        exit_result = exit_response.json()
        
        # Check if returned to user mode
        if exit_result.get("mode") != "user":
            print(f"❌ FAIL - EXIT didn't return to user mode: {exit_result.get('mode')}")
            return False
        
        print("   ✅ EXIT command returned to user mode")
        print("✅ PASS - Chat RRR → EXIT workflow working correctly")
        return True
        
    except Exception as e:
        print(f"❌ FAIL - Exception: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting Backend Tests for Liquid Live Editor Integration")
    print("=" * 60)
    
    tests = [
        ("GET /api/alkabeer-bot/customization", test_get_customization),
        ("PUT /api/alkabeer-bot/customization", test_put_customization),
        ("Draft Publish Workflow", test_draft_publish_workflow),
        ("Chat RRR → EXIT", test_chat_rrr_exit)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ FAIL - {test_name}: Unexpected error: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    broken_endpoints = []
    
    for test_name, result in results:
        if result:
            print(f"✅ PASS: {test_name}")
            passed += 1
        else:
            print(f"❌ FAIL: {test_name}")
            failed += 1
            broken_endpoints.append(test_name)
    
    print(f"\nTotal: {passed + failed} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if broken_endpoints:
        print(f"\n🚨 BROKEN ENDPOINTS:")
        for endpoint in broken_endpoints:
            print(f"   - {endpoint}")
    else:
        print(f"\n🎉 ALL ENDPOINTS WORKING")
    
    # Return exit code
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)