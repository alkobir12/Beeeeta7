#!/usr/bin/env python3
"""
Smoke Test for Invoice Template APIs - Quick Re-run After Fixes
Testing the 5 specific requirements from review request:
1) GET /api/settings contains /ceo and /invoice-templates in menuConfig
2) GET /api/biz-accounts returns 200 array
3) POST /api/invoice-templates/import-url with the Excel URL, expect 200 and template id
4) POST /api/invoice-templates/{id}/make-default expect 200
5) POST /api/print/invoice-xlsx with that id and sample data expect 200 XLSX
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from environment
BACKEND_URL = "https://autoworkshopai.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(test_name: str, status: str, details: str = "", response_time: float = 0):
    """Log test results with colors"""
    color = Colors.GREEN if status == "PASS" else Colors.RED if status == "FAIL" else Colors.YELLOW
    print(f"{color}[{status}]{Colors.RESET} {test_name}")
    if details:
        print(f"  {details}")
    if response_time > 0:
        print(f"  ⏱️  Response Time: {response_time:.3f}s")
    print()

def test_settings_menuconfig():
    """Test 1: GET /api/settings contains /ceo and /invoice-templates in menuConfig"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 1: Settings MenuConfig Verification")
    print(f"{'='*80}{Colors.RESET}\n")
    
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/settings", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            menu_config = data.get('menuConfig', {})
            items = menu_config.get('items', [])
            
            # Check for /ceo path
            ceo_found = False
            invoice_templates_found = False
            
            for item in items:
                if item.get('path') == '/ceo':
                    ceo_found = True
                elif item.get('path') == '/invoice-templates':
                    invoice_templates_found = True
                # Check children for grouped items
                elif item.get('children'):
                    for child in item.get('children', []):
                        if child.get('path') == '/ceo':
                            ceo_found = True
                        elif child.get('path') == '/invoice-templates':
                            invoice_templates_found = True
            
            if ceo_found and invoice_templates_found:
                log_test("Settings MenuConfig Check", "PASS", 
                        f"✅ Found both /ceo and /invoice-templates in menuConfig (total items: {len(items)})", 
                        response_time)
                return True
            else:
                missing = []
                if not ceo_found:
                    missing.append('/ceo')
                if not invoice_templates_found:
                    missing.append('/invoice-templates')
                log_test("Settings MenuConfig Check", "FAIL", 
                        f"❌ Missing paths in menuConfig: {missing}", 
                        response_time)
                return False
        else:
            log_test("Settings MenuConfig Check", "FAIL", 
                    f"❌ HTTP {response.status_code}: {response.text}", 
                    response_time)
            return False
            
    except Exception as e:
        log_test("Settings MenuConfig Check", "FAIL", f"❌ Exception: {str(e)}")
        return False

def test_biz_accounts():
    """Test 2: GET /api/biz-accounts returns 200 array"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 2: Business Accounts API")
    print(f"{'='*80}{Colors.RESET}\n")
    
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/biz-accounts", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("Business Accounts API", "PASS", 
                        f"✅ Returns array with {len(data)} accounts", 
                        response_time)
                return True, data
            else:
                log_test("Business Accounts API", "FAIL", 
                        f"❌ Expected array, got {type(data)}", 
                        response_time)
                return False, None
        else:
            log_test("Business Accounts API", "FAIL", 
                    f"❌ HTTP {response.status_code}: {response.text}", 
                    response_time)
            return False, None
            
    except Exception as e:
        log_test("Business Accounts API", "FAIL", f"❌ Exception: {str(e)}")
        return False, None

def test_invoice_template_import():
    """Test 3: POST /api/invoice-templates/import-url with Excel URL"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 3: Invoice Template Import from URL")
    print(f"{'='*80}{Colors.RESET}\n")
    
    # Excel URL from the review request
    excel_url = "https://customer-assets.emergentagent.com/job_autoworkshopai/artifacts/l3knvrsj_%D9%86%D9%85%D9%88%D8%B0%D8%AC%20%D8%A7.xlsx"
    
    try:
        start_time = time.time()
        payload = {"url": excel_url}
        response = requests.post(f"{BACKEND_URL}/invoice-templates/import-url", 
                               json=payload, timeout=30)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            template_id = data.get('id')
            if template_id:
                log_test("Invoice Template Import", "PASS", 
                        f"✅ Template imported successfully with ID: {template_id}", 
                        response_time)
                return True, template_id
            else:
                log_test("Invoice Template Import", "FAIL", 
                        f"❌ No template ID in response: {data}", 
                        response_time)
                return False, None
        else:
            log_test("Invoice Template Import", "FAIL", 
                    f"❌ HTTP {response.status_code}: {response.text}", 
                    response_time)
            return False, None
            
    except Exception as e:
        log_test("Invoice Template Import", "FAIL", f"❌ Exception: {str(e)}")
        return False, None

def test_make_default_template(template_id: str):
    """Test 4: POST /api/invoice-templates/{id}/make-default"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 4: Make Template Default")
    print(f"{'='*80}{Colors.RESET}\n")
    
    try:
        start_time = time.time()
        response = requests.post(f"{BACKEND_URL}/invoice-templates/{template_id}/make-default", 
                               timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            log_test("Make Template Default", "PASS", 
                    f"✅ Template set as default successfully", 
                    response_time)
            return True
        else:
            log_test("Make Template Default", "FAIL", 
                    f"❌ HTTP {response.status_code}: {response.text}", 
                    response_time)
            return False
            
    except Exception as e:
        log_test("Make Template Default", "FAIL", f"❌ Exception: {str(e)}")
        return False

def test_print_invoice_xlsx(template_id: str):
    """Test 5: POST /api/print/invoice-xlsx with template id and sample data"""
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"TEST 5: Print Invoice XLSX")
    print(f"{'='*80}{Colors.RESET}\n")
    
    # Sample invoice data
    sample_data = {
        "templateId": template_id,
        "invoiceNumber": "INV-20250115-001",
        "customerName": "أحمد محمد الراشد",
        "customerPhone": "+966501234567",
        "vehicleInfo": "تويوتا كامري 2022 - ABC-1234",
        "items": [
            {
                "name": "تغيير زيت المحرك",
                "quantity": 1,
                "price": 150.0,
                "total": 150.0
            },
            {
                "name": "فلتر الهواء",
                "quantity": 1,
                "price": 80.0,
                "total": 80.0
            }
        ],
        "subtotal": 230.0,
        "tax": 34.5,
        "total": 264.5,
        "date": datetime.now().isoformat()
    }
    
    try:
        start_time = time.time()
        response = requests.post(f"{BACKEND_URL}/print/invoice-xlsx", 
                               json=sample_data, timeout=30)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            # Check if response is XLSX (binary content)
            content_type = response.headers.get('content-type', '')
            content_length = len(response.content)
            
            if 'xlsx' in content_type or 'spreadsheet' in content_type or content_length > 1000:
                log_test("Print Invoice XLSX", "PASS", 
                        f"✅ XLSX file generated successfully (size: {content_length} bytes, type: {content_type})", 
                        response_time)
                return True
            else:
                log_test("Print Invoice XLSX", "FAIL", 
                        f"❌ Response doesn't appear to be XLSX (size: {content_length}, type: {content_type})", 
                        response_time)
                return False
        else:
            log_test("Print Invoice XLSX", "FAIL", 
                    f"❌ HTTP {response.status_code}: {response.text}", 
                    response_time)
            return False
            
    except Exception as e:
        log_test("Print Invoice XLSX", "FAIL", f"❌ Exception: {str(e)}")
        return False

def main():
    """Run all smoke tests"""
    print(f"{Colors.BLUE}{'='*80}")
    print(f"🔥 SMOKE TEST - Invoice Template APIs Quick Re-run")
    print(f"{'='*80}{Colors.RESET}")
    
    start_time = time.time()
    results = []
    
    # Test 1: Settings MenuConfig
    result1 = test_settings_menuconfig()
    results.append(("Settings MenuConfig", result1))
    
    # Test 2: Business Accounts
    result2, accounts = test_biz_accounts()
    results.append(("Business Accounts API", result2))
    
    # Test 3: Import Template
    result3, template_id = test_invoice_template_import()
    results.append(("Invoice Template Import", result3))
    
    # Test 4: Make Default (only if import succeeded)
    if result3 and template_id:
        result4 = test_make_default_template(template_id)
        results.append(("Make Template Default", result4))
        
        # Test 5: Print XLSX (only if make default succeeded)
        if result4:
            result5 = test_print_invoice_xlsx(template_id)
            results.append(("Print Invoice XLSX", result5))
        else:
            results.append(("Print Invoice XLSX", False))
    else:
        results.append(("Make Template Default", False))
        results.append(("Print Invoice XLSX", False))
    
    # Summary
    total_time = time.time() - start_time
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n{Colors.BLUE}{'='*80}")
    print(f"📊 SMOKE TEST SUMMARY")
    print(f"{'='*80}{Colors.RESET}")
    
    for test_name, result in results:
        status_color = Colors.GREEN if result else Colors.RED
        status_text = "✅ PASS" if result else "❌ FAIL"
        print(f"{status_color}{status_text}{Colors.RESET} {test_name}")
    
    print(f"\n{Colors.BLUE}Overall Result: {passed}/{total} tests passed")
    print(f"Total Time: {total_time:.2f}s{Colors.RESET}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}🎉 ALL SMOKE TESTS PASSED! System ready for production.{Colors.RESET}")
        return True
    else:
        print(f"\n{Colors.RED}⚠️  {total - passed} test(s) failed. Issues need to be addressed.{Colors.RESET}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)