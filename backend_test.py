#!/usr/bin/env python3
"""
Backend API Testing Script for Arabic Request
Testing specific endpoints on https://repair-mgmt-fresh.preview.emergentagent.com
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://repair-mgmt-fresh.preview.emergentagent.com/api"
WORKSHOP_ID = "finmodule-sync"

def test_finance_audit_logs():
    """Test GET /api/finance/audit-logs endpoint"""
    print("1. Testing Finance Audit Logs...")
    
    url = f"{BASE_URL}/finance/audit-logs"
    params = {
        "workshop_id": WORKSHOP_ID,
        "limit": 5
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response Keys: {list(data.keys())}")
                
                # Check for required structure: success/data/rows/count
                has_success = 'success' in data
                has_data = 'data' in data
                has_rows = 'data' in data and 'rows' in data.get('data', {})
                has_count = 'data' in data and 'count' in data.get('data', {})
                
                print(f"   Has 'success': {has_success}")
                print(f"   Has 'data': {has_data}")
                print(f"   Has 'rows': {has_rows}")
                print(f"   Has 'count': {has_count}")
                
                if has_success and has_data and has_rows and has_count:
                    print("   ✅ PASS - Correct structure (success/data/rows/count)")
                    return True
                else:
                    print("   ❌ FAIL - Missing required structure")
                    return False
                    
            except json.JSONDecodeError:
                print("   ❌ FAIL - Invalid JSON response")
                return False
        else:
            print(f"   ❌ FAIL - Expected 200, got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL - Request error: {e}")
        return False

def test_finance_ledger_export():
    """Test GET /api/finance/ar/ledger/export endpoint"""
    print("2. Testing Finance Ledger Export...")
    
    url = f"{BASE_URL}/finance/ar/ledger/export"
    params = {
        "workshop_id": WORKSHOP_ID,
        "start_date": "2026-04-01",
        "end_date": "2026-04-11",
        "as_of": "2026-04-11"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '').lower()
            content_length = len(response.content)
            
            print(f"   Content-Type: {content_type}")
            print(f"   Content Length: {content_length} bytes")
            
            # Check for xlsx content type and non-empty file
            is_xlsx = 'xlsx' in content_type or 'spreadsheet' in content_type
            is_non_empty = content_length > 0
            
            print(f"   Is XLSX: {is_xlsx}")
            print(f"   Is Non-Empty: {is_non_empty}")
            
            if is_xlsx and is_non_empty:
                print("   ✅ PASS - XLSX file with content")
                return True
            else:
                print("   ❌ FAIL - Not XLSX or empty file")
                return False
        else:
            print(f"   ❌ FAIL - Expected 200, got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL - Request error: {e}")
        return False

def test_alkabeer_bot_health():
    """Test GET /api/alkabeer-bot/health endpoint"""
    print("3. Testing AlKabeer Bot Health...")
    
    url = f"{BASE_URL}/alkabeer-bot/health"
    
    try:
        response = requests.get(url, timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS - Health check successful")
            return True
        else:
            print(f"   ❌ FAIL - Expected 200, got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL - Request error: {e}")
        return False

def test_alkabeer_bot_chat():
    """Test POST /api/alkabeer-bot/chat endpoint"""
    print("4. Testing AlKabeer Bot Chat...")
    
    url = f"{BASE_URL}/alkabeer-bot/chat"
    
    # Test payload with message "rrr" as admin
    payload = {
        "message": "rrr",
        "user_role": "admin"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        # Check for successful response (not necessarily 200, could be 201, etc.)
        if 200 <= response.status_code < 300:
            try:
                data = response.json()
                print(f"   Response received: {len(str(data))} chars")
                print("   ✅ PASS - Chat endpoint not broken")
                return True
            except json.JSONDecodeError:
                # Even if JSON decode fails, if status is 2xx, endpoint is not broken
                print("   ✅ PASS - Chat endpoint not broken (non-JSON response)")
                return True
        else:
            print(f"   ❌ FAIL - Chat endpoint broken, status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ FAIL - Request error: {e}")
        return False

def main():
    """Run all tests and provide summary"""
    print("=" * 60)
    print("BACKEND API TESTING - ARABIC REQUEST")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Workshop ID: {WORKSHOP_ID}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Run all tests
    results = []
    
    results.append(("Finance Audit Logs", test_finance_audit_logs()))
    results.append(("Finance Ledger Export", test_finance_ledger_export()))
    results.append(("AlKabeer Bot Health", test_alkabeer_bot_health()))
    results.append(("AlKabeer Bot Chat", test_alkabeer_bot_chat()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        emoji = "✅" if result else "❌"
        print(f"{emoji} {test_name}: {status}")
        
        if result:
            passed += 1
        else:
            failed += 1
    
    print("=" * 60)
    print(f"TOTAL: {passed} PASSED, {failed} FAILED")
    
    if failed > 0:
        print("\nBROKEN ENDPOINTS:")
        for test_name, result in results:
            if not result:
                print(f"- {test_name}")
    else:
        print("\n🎉 ALL ENDPOINTS WORKING CORRECTLY")
    
    print("=" * 60)
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)