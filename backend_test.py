#!/usr/bin/env python3
"""
Workshop Bot Backend API Testing
Testing the workshop bot endpoints as requested in Arabic.
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://repair-mgmt-fresh.preview.emergentagent.com/api"

def test_workshop_bot_endpoints():
    """Test workshop bot endpoints as requested"""
    print("=== Workshop Bot Backend API Testing ===")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now()}")
    print()
    
    results = []
    session_id = None
    
    # Test 1: GET /api/workshop-bot/catalog/summary
    print("1) Testing GET /api/workshop-bot/catalog/summary")
    try:
        response = requests.get(f"{BASE_URL}/workshop-bot/catalog/summary", timeout=30)
        if response.status_code == 200:
            print("   ✅ PASS - Status 200")
            results.append("✅ GET /api/workshop-bot/catalog/summary - PASS")
        else:
            print(f"   ❌ FAIL - Status {response.status_code}")
            results.append(f"❌ GET /api/workshop-bot/catalog/summary - FAIL (Status {response.status_code})")
    except Exception as e:
        print(f"   ❌ FAIL - Error: {e}")
        results.append(f"❌ GET /api/workshop-bot/catalog/summary - FAIL (Error: {e})")
    
    # Test 2: GET /api/workshop-bot/skills?query=agent&limit=5
    print("\n2) Testing GET /api/workshop-bot/skills?query=agent&limit=5")
    try:
        response = requests.get(f"{BASE_URL}/workshop-bot/skills?query=agent&limit=5", timeout=30)
        if response.status_code == 200:
            print("   ✅ PASS - Status 200")
            results.append("✅ GET /api/workshop-bot/skills?query=agent&limit=5 - PASS")
        else:
            print(f"   ❌ FAIL - Status {response.status_code}")
            results.append(f"❌ GET /api/workshop-bot/skills?query=agent&limit=5 - FAIL (Status {response.status_code})")
    except Exception as e:
        print(f"   ❌ FAIL - Error: {e}")
        results.append(f"❌ GET /api/workshop-bot/skills?query=agent&limit=5 - FAIL (Error: {e})")
    
    # Test 3: GET /api/workshop-bot/conversations
    print("\n3) Testing GET /api/workshop-bot/conversations")
    try:
        response = requests.get(f"{BASE_URL}/workshop-bot/conversations", timeout=30)
        if response.status_code == 200:
            print("   ✅ PASS - Status 200")
            results.append("✅ GET /api/workshop-bot/conversations - PASS")
        else:
            print(f"   ❌ FAIL - Status {response.status_code}")
            results.append(f"❌ GET /api/workshop-bot/conversations - FAIL (Status {response.status_code})")
    except Exception as e:
        print(f"   ❌ FAIL - Error: {e}")
        results.append(f"❌ GET /api/workshop-bot/conversations - FAIL (Error: {e})")
    
    # Test 4: POST /api/workshop-bot/respond with model=kb
    print("\n4) Testing POST /api/workshop-bot/respond with model=kb")
    try:
        payload = {
            "message": "test message for kb model",
            "model": "kb"
        }
        response = requests.post(f"{BASE_URL}/workshop-bot/respond", 
                               json=payload, 
                               headers={"Content-Type": "application/json"},
                               timeout=30)
        if response.status_code == 200:
            print("   ✅ PASS - Status 200")
            results.append("✅ POST /api/workshop-bot/respond (model=kb) - PASS")
            # Try to extract session_id for later deletion test
            try:
                response_data = response.json()
                if 'session_id' in response_data:
                    session_id = response_data['session_id']
                    print(f"   📝 Session ID captured: {session_id}")
            except:
                pass
        else:
            print(f"   ❌ FAIL - Status {response.status_code}")
            results.append(f"❌ POST /api/workshop-bot/respond (model=kb) - FAIL (Status {response.status_code})")
    except Exception as e:
        print(f"   ❌ FAIL - Error: {e}")
        results.append(f"❌ POST /api/workshop-bot/respond (model=kb) - FAIL (Error: {e})")
    
    # Test 5: POST /api/workshop-bot/respond with model=gpt-5.1
    print("\n5) Testing POST /api/workshop-bot/respond with model=gpt-5.1")
    try:
        payload = {
            "message": "test message for gpt-5.1 model",
            "model": "gpt-5.1"
        }
        response = requests.post(f"{BASE_URL}/workshop-bot/respond", 
                               json=payload, 
                               headers={"Content-Type": "application/json"},
                               timeout=30)
        if response.status_code == 200:
            print("   ✅ PASS - Status 200")
            results.append("✅ POST /api/workshop-bot/respond (model=gpt-5.1) - PASS")
            # Try to extract session_id for later deletion test if not already captured
            if not session_id:
                try:
                    response_data = response.json()
                    if 'session_id' in response_data:
                        session_id = response_data['session_id']
                        print(f"   📝 Session ID captured: {session_id}")
                except:
                    pass
        else:
            print(f"   ❌ FAIL - Status {response.status_code}")
            results.append(f"❌ POST /api/workshop-bot/respond (model=gpt-5.1) - FAIL (Status {response.status_code})")
    except Exception as e:
        print(f"   ❌ FAIL - Error: {e}")
        results.append(f"❌ POST /api/workshop-bot/respond (model=gpt-5.1) - FAIL (Error: {e})")
    
    # Test 6: DELETE /api/workshop-bot/conversations/{session_id}
    print("\n6) Testing DELETE /api/workshop-bot/conversations/{session_id}")
    if session_id:
        try:
            response = requests.delete(f"{BASE_URL}/workshop-bot/conversations/{session_id}", timeout=30)
            if response.status_code in [200, 204]:
                print(f"   ✅ PASS - Status {response.status_code}")
                results.append(f"✅ DELETE /api/workshop-bot/conversations/{session_id} - PASS")
            else:
                print(f"   ❌ FAIL - Status {response.status_code}")
                results.append(f"❌ DELETE /api/workshop-bot/conversations/{session_id} - FAIL (Status {response.status_code})")
        except Exception as e:
            print(f"   ❌ FAIL - Error: {e}")
            results.append(f"❌ DELETE /api/workshop-bot/conversations/{session_id} - FAIL (Error: {e})")
    else:
        print("   ⚠️ SKIP - No session_id available from previous tests")
        results.append("⚠️ DELETE /api/workshop-bot/conversations/{session_id} - SKIP (No session_id)")
    
    # Summary
    print("\n" + "="*60)
    print("WORKSHOP BOT API TEST RESULTS:")
    print("="*60)
    
    failed_endpoints = []
    for result in results:
        print(result)
        if "❌" in result:
            failed_endpoints.append(result)
    
    print(f"\nTotal Tests: {len(results)}")
    print(f"Passed: {len([r for r in results if '✅' in r])}")
    print(f"Failed: {len(failed_endpoints)}")
    print(f"Skipped: {len([r for r in results if '⚠️' in r])}")
    
    if failed_endpoints:
        print("\n🚨 BROKEN ENDPOINTS DETECTED:")
        for endpoint in failed_endpoints:
            print(f"   {endpoint}")
        return False
    else:
        print("\n✅ ALL ENDPOINTS WORKING CORRECTLY")
        return True

if __name__ == "__main__":
    success = test_workshop_bot_endpoints()
    sys.exit(0 if success else 1)