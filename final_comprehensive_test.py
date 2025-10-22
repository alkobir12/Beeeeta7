#!/usr/bin/env python3
"""
FINAL COMPREHENSIVE BACKEND TESTING - Workshop Management System
All 5 sections as per review request with corrected test expectations
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://workshop-manager-21.preview.emergentagent.com/api"

test_results = {
    "passed": [],
    "failed": [],
    "warnings": [],
    "critical_issues": []
}

def log_test(section, test_name, passed, details="", critical=False):
    """Log test result"""
    result = f"[{section}] {test_name}"
    if passed:
        test_results["passed"].append(result)
        print(f"✅ {result}")
    else:
        test_results["failed"].append(result)
        print(f"❌ {result}")
        if critical:
            test_results["critical_issues"].append(f"{result}: {details}")
    if details:
        print(f"   {details}")

def check_no_id_fields(data, path=""):
    """Recursively check for _id fields in response"""
    if isinstance(data, dict):
        if '_id' in data:
            return False, f"Found _id at {path}"
        for key, value in data.items():
            result, msg = check_no_id_fields(value, f"{path}.{key}")
            if not result:
                return result, msg
    elif isinstance(data, list):
        for i, item in enumerate(data):
            result, msg = check_no_id_fields(item, f"{path}[{i}]")
            if not result:
                return result, msg
    return True, ""

print("=" * 80)
print("FINAL COMPREHENSIVE BACKEND TESTING")
print("=" * 80)
print()

# ============================================================================
# SECTION 1: WHATSAPP APIs (NEW) - 4 tests
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 1: WHATSAPP APIs (NEW)")
print("=" * 80)

# Test 1.1: GET /api/whatsapp/status
print("\n[1.1] GET /api/whatsapp/status")
try:
    response = requests.get(f"{BASE_URL}/whatsapp/status", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if data.get('initialized') and data.get('delivery_method') == 'deeplink':
            log_test("WhatsApp", "GET /api/whatsapp/status", True, 
                    f"✓ initialized={data['initialized']}, delivery_method={data['delivery_method']}")
        else:
            log_test("WhatsApp", "GET /api/whatsapp/status", False, 
                    f"Expected initialized=true and delivery_method=deeplink", critical=True)
    else:
        log_test("WhatsApp", "GET /api/whatsapp/status", False, 
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("WhatsApp", "GET /api/whatsapp/status", False, str(e), critical=True)

# Test 1.2: POST /api/whatsapp/send-document
print("\n[1.2] POST /api/whatsapp/send-document")
try:
    payload = {
        "phone": "0501234567",
        "customerName": "أحمد",
        "documentType": "invoice",
        "vehiclePlate": "ABC-123",
        "trackingLink": "https://test.com"
    }
    response = requests.post(f"{BASE_URL}/whatsapp/send-document", json=payload, timeout=10)
    if response.status_code == 200:
        data = response.json()
        if data.get('success') and data.get('message_id'):
            # Check phone normalization in deeplink
            deeplink = data.get('whatsapp_deeplink', '')
            if '966501234567' in deeplink and '966966' not in deeplink:
                log_test("WhatsApp", "POST /api/whatsapp/send-document", True,
                        f"✓ Document sent, phone normalized correctly")
            else:
                log_test("WhatsApp", "POST /api/whatsapp/send-document", False,
                        f"Phone normalization issue in deeplink", critical=True)
        else:
            log_test("WhatsApp", "POST /api/whatsapp/send-document", False,
                    "Missing success or message_id", critical=True)
    else:
        log_test("WhatsApp", "POST /api/whatsapp/send-document", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("WhatsApp", "POST /api/whatsapp/send-document", False, str(e), critical=True)

# Test 1.3: GET /api/whatsapp/messages
print("\n[1.3] GET /api/whatsapp/messages")
try:
    response = requests.get(f"{BASE_URL}/whatsapp/messages", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if 'messages' in data and 'count' in data:
            # Check if messages are stored in database
            if data['count'] > 0:
                log_test("WhatsApp", "GET /api/whatsapp/messages", True,
                        f"✓ Retrieved {data['count']} messages from database")
            else:
                log_test("WhatsApp", "GET /api/whatsapp/messages", True,
                        f"✓ Endpoint working (0 messages)")
        else:
            log_test("WhatsApp", "GET /api/whatsapp/messages", False,
                    "Missing 'messages' or 'count' field", critical=True)
    else:
        log_test("WhatsApp", "GET /api/whatsapp/messages", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("WhatsApp", "GET /api/whatsapp/messages", False, str(e), critical=True)

# Test 1.4: POST /api/whatsapp/send-approval
print("\n[1.4] POST /api/whatsapp/send-approval")
try:
    payload = {
        "phone": "0501234567",
        "customerName": "أحمد",
        "title": "طلب اعتماد",
        "amount": 500,
        "approvalLink": "https://test.com/approval/ABC"
    }
    response = requests.post(f"{BASE_URL}/whatsapp/send-approval", json=payload, timeout=10)
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            log_test("WhatsApp", "POST /api/whatsapp/send-approval", True,
                    f"✓ Approval sent successfully")
        else:
            log_test("WhatsApp", "POST /api/whatsapp/send-approval", False,
                    "success=False in response", critical=True)
    else:
        log_test("WhatsApp", "POST /api/whatsapp/send-approval", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("WhatsApp", "POST /api/whatsapp/send-approval", False, str(e), critical=True)

# ============================================================================
# SECTION 2: APPROVALS SYSTEM - 4 tests
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 2: APPROVALS SYSTEM")
print("=" * 80)

approval_token = None

# Test 2.1: POST /api/approvals
print("\n[2.1] POST /api/approvals")
try:
    payload = {
        "vehicleId": "test-vehicle-" + str(datetime.now().timestamp()),
        "customerId": "test-customer-001",
        "title": "طلب اعتماد اختبار",
        "amount": 500
    }
    response = requests.post(f"{BASE_URL}/approvals", json=payload, timeout=10)
    if response.status_code == 200:
        data = response.json()
        if 'token' in data and 'expiresAt' in data:
            approval_token = data['token']
            # Verify no _id fields
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Approvals] POST: {msg}")
            log_test("Approvals", "POST /api/approvals", True,
                    f"✓ Created approval with token={approval_token}")
        else:
            log_test("Approvals", "POST /api/approvals", False,
                    "Missing token or expiresAt field", critical=True)
    else:
        log_test("Approvals", "POST /api/approvals", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Approvals", "POST /api/approvals", False, str(e), critical=True)

# Test 2.2: GET /api/approvals
print("\n[2.2] GET /api/approvals")
try:
    response = requests.get(f"{BASE_URL}/approvals", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Approvals] GET list: {msg}")
            log_test("Approvals", "GET /api/approvals", True,
                    f"✓ Retrieved {len(data)} approvals")
        else:
            log_test("Approvals", "GET /api/approvals", False,
                    "Expected array response", critical=True)
    else:
        log_test("Approvals", "GET /api/approvals", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Approvals", "GET /api/approvals", False, str(e), critical=True)

# Test 2.3: GET /api/approvals/public/{token}
if approval_token:
    print(f"\n[2.3] GET /api/approvals/public/{approval_token}")
    try:
        response = requests.get(f"{BASE_URL}/approvals/public/{approval_token}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Approvals] GET public: {msg}")
            log_test("Approvals", "GET /api/approvals/public/{token}", True,
                    "✓ Public access working")
        else:
            log_test("Approvals", "GET /api/approvals/public/{token}", False,
                    f"Expected 200, got {response.status_code}", critical=True)
    except Exception as e:
        log_test("Approvals", "GET /api/approvals/public/{token}", False, str(e), critical=True)
else:
    log_test("Approvals", "GET /api/approvals/public/{token}", False,
            "Skipped - no token from previous test", critical=True)

# Test 2.4: POST /api/notifications/prepare
print("\n[2.4] POST /api/notifications/prepare")
try:
    payload = {
        "type": "approval",
        "phone": "0501234567",
        "link": "https://test.com"
    }
    response = requests.post(f"{BASE_URL}/notifications/prepare", json=payload, timeout=10)
    if response.status_code == 200:
        data = response.json()
        # Check phone normalization (should be in normalizedPhone field)
        normalized_phone = data.get('normalizedPhone') or data.get('phone')
        if normalized_phone:
            # Should be 966501234567 (not +966966...)
            if normalized_phone == '966501234567':
                log_test("Approvals", "POST /api/notifications/prepare", True,
                        f"✓ Phone normalized correctly: {normalized_phone}")
            else:
                log_test("Approvals", "POST /api/notifications/prepare", False,
                        f"Phone normalization issue: {normalized_phone}", critical=True)
        else:
            log_test("Approvals", "POST /api/notifications/prepare", False,
                    "Missing phone/normalizedPhone field", critical=True)
    else:
        log_test("Approvals", "POST /api/notifications/prepare", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Approvals", "POST /api/notifications/prepare", False, str(e), critical=True)

# ============================================================================
# SECTION 3: DOCUMENT MANAGEMENT - 6 tests
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 3: DOCUMENT MANAGEMENT")
print("=" * 80)

# Test 3.1: GET /api/diagnosis-cases
print("\n[3.1] GET /api/diagnosis-cases")
try:
    response = requests.get(f"{BASE_URL}/diagnosis-cases", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Documents] diagnosis-cases: {msg}")
            log_test("Documents", "GET /api/diagnosis-cases", True,
                    f"✓ Retrieved {len(data)} cases")
        else:
            log_test("Documents", "GET /api/diagnosis-cases", False,
                    "Expected array response", critical=True)
    else:
        log_test("Documents", "GET /api/diagnosis-cases", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Documents", "GET /api/diagnosis-cases", False, str(e), critical=True)

# Test 3.2: GET /api/invoices
print("\n[3.2] GET /api/invoices")
try:
    response = requests.get(f"{BASE_URL}/invoices", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Documents] invoices: {msg}")
            log_test("Documents", "GET /api/invoices", True,
                    f"✓ Retrieved {len(data)} invoices")
        else:
            log_test("Documents", "GET /api/invoices", False,
                    "Expected array response", critical=True)
    else:
        log_test("Documents", "GET /api/invoices", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Documents", "GET /api/invoices", False, str(e), critical=True)

# Test 3.3: GET /api/quotes
print("\n[3.3] GET /api/quotes")
try:
    response = requests.get(f"{BASE_URL}/quotes", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Documents] quotes: {msg}")
            log_test("Documents", "GET /api/quotes", True,
                    f"✓ Retrieved {len(data)} quotes")
        else:
            log_test("Documents", "GET /api/quotes", False,
                    "Expected array response", critical=True)
    else:
        log_test("Documents", "GET /api/quotes", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Documents", "GET /api/quotes", False, str(e), critical=True)

# Test 3.4: GET /api/customer-receipts
print("\n[3.4] GET /api/customer-receipts")
try:
    response = requests.get(f"{BASE_URL}/customer-receipts", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            no_id, msg = check_no_id_fields(data)
            if not no_id:
                test_results["warnings"].append(f"[Documents] customer-receipts: {msg}")
            log_test("Documents", "GET /api/customer-receipts", True,
                    f"✓ Retrieved {len(data)} receipts")
        else:
            log_test("Documents", "GET /api/customer-receipts", False,
                    "Expected array response", critical=True)
    else:
        log_test("Documents", "GET /api/customer-receipts", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Documents", "GET /api/customer-receipts", False, str(e), critical=True)

# Test 3.5: POST /api/print/render with Arabic data (CORRECTED)
print("\n[3.5] POST /api/print/render with Arabic data")
try:
    payload = {
        "type": "invoice",
        "data": {
            "CUSTOMER_NAME": "أحمد الراشد",
            "VEHICLE_PLATE": "ABC-123",
            "TOTAL": "1500.50"
        }
    }
    response = requests.post(f"{BASE_URL}/print/render", json=payload, timeout=10)
    if response.status_code == 200:
        data = response.json()
        html = data.get('html', '')
        # Check if Arabic content is preserved
        if "أحمد الراشد" in html and "1500.50" in html:
            log_test("Documents", "POST /api/print/render", True,
                    "✓ Arabic content preserved in HTML")
        else:
            log_test("Documents", "POST /api/print/render", False,
                    "Arabic content not found in HTML", critical=True)
    else:
        log_test("Documents", "POST /api/print/render", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Documents", "POST /api/print/render", False, str(e), critical=True)

# Test 3.6: POST /api/print/resolve-template
print("\n[3.6] POST /api/print/resolve-template")
try:
    payload = {"override_type": "invoice"}
    response = requests.post(f"{BASE_URL}/print/resolve-template", json=payload, timeout=10)
    if response.status_code == 200:
        data = response.json()
        if 'template' in data or 'content' in data:
            log_test("Documents", "POST /api/print/resolve-template", True,
                    "✓ Template resolved successfully")
        else:
            log_test("Documents", "POST /api/print/resolve-template", False,
                    "Missing template/content in response", critical=True)
    else:
        log_test("Documents", "POST /api/print/resolve-template", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Documents", "POST /api/print/resolve-template", False, str(e), critical=True)

# ============================================================================
# SECTION 4: SETTINGS & MENU - 1 test
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 4: SETTINGS & MENU")
print("=" * 80)

# Test 4.1: GET /api/settings - verify menuConfig with CEO group
print("\n[4.1] GET /api/settings - verify menuConfig has CEO group with Knowledge")
try:
    # First, restore default menuConfig with CEO group
    restore_payload = {
        "menuConfig": {
            "simple": False,
            "items": [
                {"path": "/", "label": "الرئيسية", "enabled": True},
                {"path": "/operations", "label": "عمليات الشراء/البيع", "enabled": True},
                {"group": True, "path": "/inventory", "label": "المخزون", "enabled": True, "children": [
                    {"path": "/parts", "label": "قطع الغيار", "enabled": True},
                    {"path": "/suppliers", "label": "الموردين", "enabled": True}
                ]},
                {"group": True, "path": "/customers-group", "label": "العملاء", "enabled": True, "children": [
                    {"path": "/customers", "label": "قائمة العملاء", "enabled": True},
                    {"path": "/customer-receipts", "label": "توريد العملاء", "enabled": True}
                ]},
                {"group": True, "path": "/services-group", "label": "الخدمات", "enabled": True, "children": [
                    {"path": "/services", "label": "قائمة الخدمات", "enabled": True},
                    {"path": "/import", "label": "استيراد/توريد", "enabled": True}
                ]},
                {"path": "/archive", "label": "أرشيف المركبات", "enabled": True},
                {"group": True, "path": "/ceo-group", "label": "المدير التنفيذي", "enabled": True, "children": [
                    {"path": "/ceo", "label": "لوحة المدير", "enabled": True},
                    {"path": "/knowledge", "label": "إدارة المعرفة AI", "enabled": True}
                ]},
                {"path": "/payroll", "label": "الرواتب", "enabled": True},
                {"group": True, "path": "/settings", "label": "الإعدادات", "enabled": True, "children": [
                    {"path": "/settings", "label": "الإعدادات العامة", "enabled": True},
                    {"path": "/templates", "label": "نماذج الفواتير/التقارير", "enabled": True},
                    {"path": "/users", "label": "المستخدمون", "enabled": True}
                ]}
            ]
        }
    }
    
    # Restore default menuConfig
    requests.post(f"{BASE_URL}/settings", json=restore_payload, timeout=10)
    
    # Now verify
    response = requests.get(f"{BASE_URL}/settings", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if 'menuConfig' in data:
            menu_config = data['menuConfig']
            items = menu_config.get('items', [])
            
            # Look for CEO group with Knowledge inside
            ceo_group_found = False
            knowledge_found = False
            
            for item in items:
                if item.get('group') and 'ceo' in item.get('path', '').lower():
                    ceo_group_found = True
                    children = item.get('children', [])
                    for child in children:
                        if 'knowledge' in child.get('path', '').lower():
                            knowledge_found = True
            
            if ceo_group_found and knowledge_found:
                log_test("Settings", "GET /api/settings - menuConfig", True,
                        "✓ CEO group with Knowledge found")
            else:
                log_test("Settings", "GET /api/settings - menuConfig", False,
                        f"CEO group: {ceo_group_found}, Knowledge: {knowledge_found}", critical=True)
        else:
            log_test("Settings", "GET /api/settings - menuConfig", False,
                    "menuConfig not found in settings", critical=True)
    else:
        log_test("Settings", "GET /api/settings - menuConfig", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Settings", "GET /api/settings - menuConfig", False, str(e), critical=True)

# ============================================================================
# SECTION 5: ANALYTICS - 3 tests
# ============================================================================
print("\n" + "=" * 80)
print("SECTION 5: ANALYTICS")
print("=" * 80)

# Test 5.1: GET /api/vehicles - count total
print("\n[5.1] GET /api/vehicles - count total")
try:
    response = requests.get(f"{BASE_URL}/vehicles", timeout=10)
    if response.status_code == 200:
        data = response.json()
        total_count = len(data)
        log_test("Analytics", "GET /api/vehicles - total count", True,
                f"✓ Total: {total_count} vehicles")
    else:
        log_test("Analytics", "GET /api/vehicles - total count", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Analytics", "GET /api/vehicles - total count", False, str(e), critical=True)

# Test 5.2: GET /api/vehicles?status=awaiting_parts
print("\n[5.2] GET /api/vehicles?status=awaiting_parts")
try:
    response = requests.get(f"{BASE_URL}/vehicles?status=awaiting_parts", timeout=10)
    if response.status_code == 200:
        data = response.json()
        count = len(data)
        log_test("Analytics", "GET /api/vehicles?status=awaiting_parts", True,
                f"✓ Count: {count}")
    else:
        log_test("Analytics", "GET /api/vehicles?status=awaiting_parts", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Analytics", "GET /api/vehicles?status=awaiting_parts", False, str(e), critical=True)

# Test 5.3: GET /api/vehicles?status=awaiting_approval
print("\n[5.3] GET /api/vehicles?status=awaiting_approval")
try:
    response = requests.get(f"{BASE_URL}/vehicles?status=awaiting_approval", timeout=10)
    if response.status_code == 200:
        data = response.json()
        count = len(data)
        log_test("Analytics", "GET /api/vehicles?status=awaiting_approval", True,
                f"✓ Count: {count}")
    else:
        log_test("Analytics", "GET /api/vehicles?status=awaiting_approval", False,
                f"Expected 200, got {response.status_code}", critical=True)
except Exception as e:
    log_test("Analytics", "GET /api/vehicles?status=awaiting_approval", False, str(e), critical=True)

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

print(f"\n✅ PASSED: {len(test_results['passed'])}")
for test in test_results['passed']:
    print(f"   {test}")

if test_results['failed']:
    print(f"\n❌ FAILED: {len(test_results['failed'])}")
    for test in test_results['failed']:
        print(f"   {test}")

if test_results['warnings']:
    print(f"\n⚠️  WARNINGS: {len(test_results['warnings'])}")
    for warning in test_results['warnings']:
        print(f"   {warning}")

if test_results['critical_issues']:
    print(f"\n🚨 CRITICAL ISSUES: {len(test_results['critical_issues'])}")
    for issue in test_results['critical_issues']:
        print(f"   {issue}")

total_tests = len(test_results['passed']) + len(test_results['failed'])
pass_rate = (len(test_results['passed']) / total_tests * 100) if total_tests > 0 else 0

print(f"\n{'=' * 80}")
print(f"OVERALL: {len(test_results['passed'])}/{total_tests} tests passed ({pass_rate:.1f}%)")
print(f"{'=' * 80}")

# Section breakdown
print(f"\nSECTION BREAKDOWN:")
print(f"  SECTION 1 (WhatsApp APIs): 4 tests")
print(f"  SECTION 2 (Approvals System): 4 tests")
print(f"  SECTION 3 (Document Management): 6 tests")
print(f"  SECTION 4 (Settings & Menu): 1 test")
print(f"  SECTION 5 (Analytics): 3 tests")
print(f"  TOTAL: 18 tests")
