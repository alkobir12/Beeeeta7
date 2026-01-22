#!/usr/bin/env python3
"""
Backend API Testing Script for Workshop Management System
Tests: Enhanced Approval System & Chart of Accounts
"""

import requests
import json
import sys
from datetime import datetime
import base64

# Get backend URL from environment
BACKEND_URL = "https://fincleanup-deploy.preview.emergentagent.com/api"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "total": 0
}

def log_test(name, passed, details=""):
    """Log test result"""
    test_results["total"] += 1
    if passed:
        test_results["passed"].append(name)
        print(f"✅ {name}")
        if details:
            print(f"   {details}")
    else:
        test_results["failed"].append(name)
        print(f"❌ {name}")
        if details:
            print(f"   {details}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {len(test_results['passed'])} ✅")
    print(f"Failed: {len(test_results['failed'])} ❌")
    
    if test_results['failed']:
        print("\nFailed Tests:")
        for test in test_results['failed']:
            print(f"  - {test}")
    
    print("="*80)

# ============================================================================
# CHART OF ACCOUNTS TESTS
# ============================================================================

def test_chart_of_accounts():
    """Test Chart of Accounts APIs"""
    print("\n" + "="*80)
    print("TESTING CHART OF ACCOUNTS (شجرة الحسابات)")
    print("="*80)
    
    # Test 1: Initialize default accounts
    print("\n[1] Testing POST /api/accounts/init-defaults")
    try:
        response = requests.post(f"{BACKEND_URL}/accounts/init-defaults", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_test("Initialize default accounts", True, 
                    f"Message: {data.get('message', 'N/A')}, Count: {data.get('count', 0)}")
        else:
            log_test("Initialize default accounts", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Initialize default accounts", False, f"Error: {str(e)}")
    
    # Test 2: Get all accounts
    print("\n[2] Testing GET /api/accounts")
    try:
        response = requests.get(f"{BACKEND_URL}/accounts", timeout=10)
        if response.status_code == 200:
            accounts = response.json()
            log_test("Get all accounts", True, 
                    f"Retrieved {len(accounts)} accounts")
            
            # Display sample accounts
            if accounts:
                print("\n   Sample accounts:")
                for acc in accounts[:5]:
                    print(f"   - {acc.get('code')}: {acc.get('name')} (Type: {acc.get('type')}, System: {acc.get('isSystem')})")
        else:
            log_test("Get all accounts", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Get all accounts", False, f"Error: {str(e)}")
    
    # Test 3: Create new account
    print("\n[3] Testing POST /api/accounts (Create new account)")
    new_account = {
        "code": "6000",
        "name": "حساب تجريبي",
        "nameEn": "Test Account",
        "type": "expense",
        "parentId": "exp-main",
        "isSystem": False
    }
    
    created_account_id = None
    try:
        response = requests.post(f"{BACKEND_URL}/accounts", 
                                json=new_account, 
                                timeout=10)
        if response.status_code == 200:
            data = response.json()
            created_account_id = data.get('id')
            log_test("Create new account", True, 
                    f"Created account ID: {created_account_id}, Code: {data.get('code')}")
        else:
            log_test("Create new account", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create new account", False, f"Error: {str(e)}")
    
    # Test 4: Update account
    if created_account_id:
        print("\n[4] Testing PUT /api/accounts/{account_id} (Update account)")
        update_data = {
            "name": "حساب تجريبي محدث",
            "nameEn": "Updated Test Account"
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/accounts/{created_account_id}", 
                                   json=update_data, 
                                   timeout=10)
            if response.status_code == 200:
                data = response.json()
                log_test("Update account", True, 
                        f"Updated name: {data.get('name')}")
            else:
                log_test("Update account", False, 
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test("Update account", False, f"Error: {str(e)}")
    else:
        log_test("Update account", False, "Skipped - no account created")
    
    # Test 5: Try to delete system account (should fail)
    print("\n[5] Testing DELETE /api/accounts/{account_id} (System account - should fail)")
    try:
        # Try to delete a system account (e.g., exp-main)
        response = requests.delete(f"{BACKEND_URL}/accounts/exp-main", timeout=10)
        if response.status_code == 400:
            log_test("Prevent deleting system account", True, 
                    f"Correctly prevented: {response.json().get('detail', 'N/A')}")
        elif response.status_code == 404:
            log_test("Prevent deleting system account", False, 
                    "System account not found - may need to run init-defaults first")
        else:
            log_test("Prevent deleting system account", False, 
                    f"Unexpected status: {response.status_code}")
    except Exception as e:
        log_test("Prevent deleting system account", False, f"Error: {str(e)}")
    
    # Test 6: Create child account
    print("\n[6] Testing POST /api/accounts (Create child account)")
    parent_account_id = None
    child_account_id = None
    
    parent_account = {
        "code": "7000",
        "name": "حساب رئيسي للاختبار",
        "nameEn": "Parent Test Account",
        "type": "expense",
        "parentId": None,
        "isSystem": False
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/accounts", 
                                json=parent_account, 
                                timeout=10)
        if response.status_code == 200:
            data = response.json()
            parent_account_id = data.get('id')
            log_test("Create parent account", True, 
                    f"Created parent ID: {parent_account_id}")
        else:
            log_test("Create parent account", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("Create parent account", False, f"Error: {str(e)}")
    
    if parent_account_id:
        child_account = {
            "code": "7100",
            "name": "حساب فرعي للاختبار",
            "nameEn": "Child Test Account",
            "type": "expense",
            "parentId": parent_account_id,
            "isSystem": False
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/accounts", 
                                    json=child_account, 
                                    timeout=10)
            if response.status_code == 200:
                data = response.json()
                child_account_id = data.get('id')
                log_test("Create child account", True, 
                        f"Created child ID: {child_account_id}")
            else:
                log_test("Create child account", False, 
                        f"Status: {response.status_code}")
        except Exception as e:
            log_test("Create child account", False, f"Error: {str(e)}")
    
    # Test 7: Try to delete parent account with children (should fail)
    if parent_account_id and child_account_id:
        print("\n[7] Testing DELETE /api/accounts/{account_id} (Parent with children - should fail)")
        try:
            response = requests.delete(f"{BACKEND_URL}/accounts/{parent_account_id}", timeout=10)
            if response.status_code == 400:
                log_test("Prevent deleting account with children", True, 
                        f"Correctly prevented: {response.json().get('detail', 'N/A')}")
            else:
                log_test("Prevent deleting account with children", False, 
                        f"Unexpected status: {response.status_code}")
        except Exception as e:
            log_test("Prevent deleting account with children", False, f"Error: {str(e)}")
    else:
        log_test("Prevent deleting account with children", False, "Skipped - no parent/child created")
    
    # Test 8: Delete child account (should succeed)
    if child_account_id:
        print("\n[8] Testing DELETE /api/accounts/{account_id} (Child account - should succeed)")
        try:
            response = requests.delete(f"{BACKEND_URL}/accounts/{child_account_id}", timeout=10)
            if response.status_code == 200:
                log_test("Delete child account", True, 
                        f"Successfully deleted child account")
            else:
                log_test("Delete child account", False, 
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test("Delete child account", False, f"Error: {str(e)}")
    
    # Test 9: Delete parent account (should succeed now)
    if parent_account_id:
        print("\n[9] Testing DELETE /api/accounts/{account_id} (Parent account - should succeed)")
        try:
            response = requests.delete(f"{BACKEND_URL}/accounts/{parent_account_id}", timeout=10)
            if response.status_code == 200:
                log_test("Delete parent account", True, 
                        f"Successfully deleted parent account")
            else:
                log_test("Delete parent account", False, 
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test("Delete parent account", False, f"Error: {str(e)}")
    
    # Cleanup: Delete test account if created
    if created_account_id:
        print("\n[Cleanup] Deleting test account")
        try:
            response = requests.delete(f"{BACKEND_URL}/accounts/{created_account_id}", timeout=10)
            if response.status_code == 200:
                print("   ✓ Test account cleaned up")
        except Exception as e:
            print(f"   ⚠ Cleanup failed: {str(e)}")

# ============================================================================
# APPROVAL SYSTEM TESTS
# ============================================================================

def test_approval_system():
    """Test Enhanced Approval System APIs"""
    print("\n" + "="*80)
    print("TESTING ENHANCED APPROVAL SYSTEM (نظام الاعتماد المحسّن)")
    print("="*80)
    
    # First, we need to create a vehicle and customer for testing
    print("\n[Setup] Creating test customer and vehicle")
    
    # Create test customer
    customer_data = {
        "name": "عميل اختبار الاعتماد",
        "phone": "0501234567",
        "email": "test@example.com"
    }
    
    customer_id = None
    try:
        response = requests.post(f"{BACKEND_URL}/customers", json=customer_data, timeout=10)
        if response.status_code == 200:
            customer_id = response.json().get('id')
            print(f"   ✓ Created test customer: {customer_id}")
        else:
            print(f"   ⚠ Failed to create customer: {response.status_code}")
    except Exception as e:
        print(f"   ⚠ Error creating customer: {str(e)}")
    
    # Create test vehicle
    vehicle_data = {
        "plateNumber": "ABC-1234",
        "brand": "تويوتا",
        "model": "كامري",
        "year": 2020,
        "color": "أبيض",
        "customerName": "عميل اختبار الاعتماد",
        "customerPhone": "0501234567",
        "customerEmail": "test@example.com",
        "status": "diagnosis"
    }
    
    vehicle_id = None
    try:
        response = requests.post(f"{BACKEND_URL}/vehicles", json=vehicle_data, timeout=10)
        if response.status_code == 200:
            vehicle_id = response.json().get('id')
            print(f"   ✓ Created test vehicle: {vehicle_id}")
        else:
            print(f"   ⚠ Failed to create vehicle: {response.status_code}")
    except Exception as e:
        print(f"   ⚠ Error creating vehicle: {str(e)}")
    
    if not vehicle_id or not customer_id:
        print("\n⚠ Skipping approval tests - failed to create test data")
        return
    
    # Test 1: Create approval with default expiry (7 days)
    print("\n[1] Testing POST /api/approvals (Default expiry: 7 days)")
    approval_data = {
        "vehicleId": vehicle_id,
        "customerId": customer_id,
        "title": "طلب اعتماد إصلاح",
        "amount": 1500.0,
        "serviceItems": [
            {"name": "تغيير زيت", "price": 500},
            {"name": "فحص كمبيوتر", "price": 1000}
        ],
        "serviceItemsText": "تغيير زيت - 500 ريال\nفحص كمبيوتر - 1000 ريال"
    }
    
    approval_token_default = None
    try:
        response = requests.post(f"{BACKEND_URL}/approvals", json=approval_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            approval_token_default = data.get('token')
            log_test("Create approval (default 7 days)", True, 
                    f"Token: {approval_token_default}, Expires: {data.get('expiresAt', 'N/A')}")
        else:
            log_test("Create approval (default 7 days)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create approval (default 7 days)", False, f"Error: {str(e)}")
    
    # Test 2: Create approval with custom expiry (3 days)
    print("\n[2] Testing POST /api/approvals (Custom expiry: 3 days)")
    approval_data_3days = {
        **approval_data,
        "expiryDays": 3,
        "title": "طلب اعتماد سريع - 3 أيام"
    }
    
    approval_token_3days = None
    try:
        response = requests.post(f"{BACKEND_URL}/approvals", json=approval_data_3days, timeout=10)
        if response.status_code == 200:
            data = response.json()
            approval_token_3days = data.get('token')
            log_test("Create approval (3 days)", True, 
                    f"Token: {approval_token_3days}, Expires: {data.get('expiresAt', 'N/A')}")
        else:
            log_test("Create approval (3 days)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create approval (3 days)", False, f"Error: {str(e)}")
    
    # Test 3: Create approval with custom expiry (14 days)
    print("\n[3] Testing POST /api/approvals (Custom expiry: 14 days)")
    approval_data_14days = {
        **approval_data,
        "expiryDays": 14,
        "title": "طلب اعتماد ممتد - 14 يوم"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/approvals", json=approval_data_14days, timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_test("Create approval (14 days)", True, 
                    f"Token: {data.get('token')}, Expires: {data.get('expiresAt', 'N/A')}")
        else:
            log_test("Create approval (14 days)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create approval (14 days)", False, f"Error: {str(e)}")
    
    # Test 4: Create approval with custom expiry (30 days)
    print("\n[4] Testing POST /api/approvals (Custom expiry: 30 days)")
    approval_data_30days = {
        **approval_data,
        "expiryDays": 30,
        "title": "طلب اعتماد شهري - 30 يوم"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/approvals", json=approval_data_30days, timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_test("Create approval (30 days)", True, 
                    f"Token: {data.get('token')}, Expires: {data.get('expiresAt', 'N/A')}")
        else:
            log_test("Create approval (30 days)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create approval (30 days)", False, f"Error: {str(e)}")
    
    # Test 5: Create approval with custom expiry (365 days)
    print("\n[5] Testing POST /api/approvals (Custom expiry: 365 days)")
    approval_data_365days = {
        **approval_data,
        "expiryDays": 365,
        "title": "طلب اعتماد سنوي - 365 يوم"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/approvals", json=approval_data_365days, timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_test("Create approval (365 days)", True, 
                    f"Token: {data.get('token')}, Expires: {data.get('expiresAt', 'N/A')}")
        else:
            log_test("Create approval (365 days)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create approval (365 days)", False, f"Error: {str(e)}")
    
    # Test 6: Create approval with images
    print("\n[6] Testing POST /api/approvals (With images)")
    
    # Create a simple base64 test image (1x1 red pixel PNG)
    test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    
    approval_data_with_images = {
        **approval_data,
        "title": "طلب اعتماد مع صور",
        "images": [
            f"data:image/png;base64,{test_image_base64}",
            f"data:image/png;base64,{test_image_base64}"
        ]
    }
    
    approval_token_with_images = None
    try:
        response = requests.post(f"{BACKEND_URL}/approvals", json=approval_data_with_images, timeout=10)
        if response.status_code == 200:
            data = response.json()
            approval_token_with_images = data.get('token')
            images_count = len(data.get('images', []))
            log_test("Create approval with images", True, 
                    f"Token: {approval_token_with_images}, Images: {images_count}")
        else:
            log_test("Create approval with images", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create approval with images", False, f"Error: {str(e)}")
    
    # Test 7: Get public approval (default token)
    if approval_token_default:
        print("\n[7] Testing GET /api/approvals/public/{token}")
        try:
            response = requests.get(f"{BACKEND_URL}/approvals/public/{approval_token_default}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                log_test("Get public approval", True, 
                        f"Title: {data.get('title')}, Amount: {data.get('amount')}, Status: {data.get('status')}")
            else:
                log_test("Get public approval", False, 
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test("Get public approval", False, f"Error: {str(e)}")
    else:
        log_test("Get public approval", False, "Skipped - no approval token")
    
    # Test 8: Get public approval with images
    if approval_token_with_images:
        print("\n[8] Testing GET /api/approvals/public/{token} (With images)")
        try:
            response = requests.get(f"{BACKEND_URL}/approvals/public/{approval_token_with_images}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                images = data.get('images', [])
                log_test("Get public approval with images", True, 
                        f"Images count: {len(images)}, First image length: {len(images[0]) if images else 0}")
                
                # Verify images are base64 encoded
                if images:
                    for i, img in enumerate(images):
                        if img.startswith('data:image'):
                            print(f"   ✓ Image {i+1} is properly formatted")
                        else:
                            print(f"   ⚠ Image {i+1} format issue")
            else:
                log_test("Get public approval with images", False, 
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test("Get public approval with images", False, f"Error: {str(e)}")
    else:
        log_test("Get public approval with images", False, "Skipped - no approval with images")
    
    # Test 9: Get all approvals
    print("\n[9] Testing GET /api/approvals")
    try:
        response = requests.get(f"{BACKEND_URL}/approvals", timeout=10)
        if response.status_code == 200:
            approvals = response.json()
            log_test("Get all approvals", True, 
                    f"Retrieved {len(approvals)} approvals")
        else:
            log_test("Get all approvals", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Get all approvals", False, f"Error: {str(e)}")
    
    # Test 10: Get approvals filtered by vehicle
    if vehicle_id:
        print("\n[10] Testing GET /api/approvals?vehicle_id={vehicle_id}")
        try:
            response = requests.get(f"{BACKEND_URL}/approvals?vehicle_id={vehicle_id}", timeout=10)
            if response.status_code == 200:
                approvals = response.json()
                log_test("Get approvals by vehicle", True, 
                        f"Retrieved {len(approvals)} approvals for vehicle {vehicle_id}")
            else:
                log_test("Get approvals by vehicle", False, 
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test("Get approvals by vehicle", False, f"Error: {str(e)}")
    
    # Cleanup
    print("\n[Cleanup] Deleting test data")
    if vehicle_id:
        try:
            requests.delete(f"{BACKEND_URL}/vehicles/{vehicle_id}", timeout=10)
            print(f"   ✓ Deleted test vehicle")
        except Exception as e:
            print(f"   ⚠ Failed to delete vehicle: {str(e)}")
    
    if customer_id:
        try:
            requests.delete(f"{BACKEND_URL}/customers/{customer_id}", timeout=10)
            print(f"   ✓ Deleted test customer")
        except Exception as e:
            print(f"   ⚠ Failed to delete customer: {str(e)}")

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("WORKSHOP MANAGEMENT SYSTEM - BACKEND API TESTING")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Run tests
    test_chart_of_accounts()
    test_approval_system()
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    if test_results['failed']:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
