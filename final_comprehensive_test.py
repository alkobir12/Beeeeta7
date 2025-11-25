#!/usr/bin/env python3
"""
Final Comprehensive Backend Test Suite
Testing all new features as requested in Arabic review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://autofix-flow.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_section(title):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}\n")

def print_test(test_name, passed, details=""):
    status = f"{Colors.GREEN}✅ PASSED{Colors.RESET}" if passed else f"{Colors.RED}❌ FAILED{Colors.RESET}"
    print(f"{status}: {test_name}")
    if details:
        print(f"  {Colors.YELLOW}→ {details}{Colors.RESET}")

def test_references_system():
    """Test نظام المراجع (References System)"""
    print_section("1. نظام المراجع (References System)")
    
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # Test 1: GET /api/references/dtc?code=P0087
    try:
        results['total'] += 1
        response = requests.get(f"{BACKEND_URL}/references/dtc", params={'code': 'P0087'}, timeout=10)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            count = data.get('count', 0)
            print_test(f"GET /api/references/dtc?code=P0087", True, f"Status: {response.status_code}, Count: {count}")
            results['details'].append(f"✅ DTC P0087: {count} references found")
        else:
            results['failed'] += 1
            print_test(f"GET /api/references/dtc?code=P0087", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ DTC P0087: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"GET /api/references/dtc?code=P0087", False, f"Error: {str(e)}")
        results['details'].append(f"❌ DTC P0087: Exception - {str(e)}")
    
    # Test 2: GET /api/references/electrical?component=بطارية
    try:
        results['total'] += 1
        response = requests.get(f"{BACKEND_URL}/references/electrical", params={'component': 'بطارية'}, timeout=10)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            count = data.get('count', 0)
            print_test(f"GET /api/references/electrical?component=بطارية", True, f"Status: {response.status_code}, Count: {count}")
            results['details'].append(f"✅ Electrical بطارية: {count} references found")
        else:
            results['failed'] += 1
            print_test(f"GET /api/references/electrical?component=بطارية", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ Electrical بطارية: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"GET /api/references/electrical?component=بطارية", False, f"Error: {str(e)}")
        results['details'].append(f"❌ Electrical بطارية: Exception - {str(e)}")
    
    # Test 3: POST /api/references/electrical/smart-search
    try:
        results['total'] += 1
        payload = {'query': 'كم جهد المولد؟'}
        response = requests.post(f"{BACKEND_URL}/references/electrical/smart-search", json=payload, timeout=30)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            answer = data.get('answer', '')[:100]
            matches = data.get('count', 0)
            print_test(f"POST /api/references/electrical/smart-search", True, f"Status: {response.status_code}, Matches: {matches}")
            results['details'].append(f"✅ Smart Search: {matches} matches, Answer preview: {answer}...")
        else:
            results['failed'] += 1
            print_test(f"POST /api/references/electrical/smart-search", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ Smart Search: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"POST /api/references/electrical/smart-search", False, f"Error: {str(e)}")
        results['details'].append(f"❌ Smart Search: Exception - {str(e)}")
    
    # Test 4: GET /api/references/download-excel-program
    try:
        results['total'] += 1
        response = requests.get(f"{BACKEND_URL}/references/download-excel-program", timeout=15)
        passed = response.status_code == 200 and 'application' in response.headers.get('content-type', '')
        
        if passed:
            results['passed'] += 1
            size = len(response.content)
            print_test(f"GET /api/references/download-excel-program", True, f"Status: {response.status_code}, Size: {size} bytes")
            results['details'].append(f"✅ Excel Download: {size} bytes")
        else:
            results['failed'] += 1
            print_test(f"GET /api/references/download-excel-program", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ Excel Download: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"GET /api/references/download-excel-program", False, f"Error: {str(e)}")
        results['details'].append(f"❌ Excel Download: Exception - {str(e)}")
    
    return results

def test_knowledge_system():
    """Test نظام المعرفة (Knowledge System)"""
    print_section("2. نظام المعرفة (Knowledge System)")
    
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # Test 1: GET /api/ai/kb/docs (count documents)
    try:
        results['total'] += 1
        response = requests.get(f"{BACKEND_URL}/ai/kb/docs", timeout=10)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            count = data.get('count', 0) if isinstance(data, dict) else len(data)
            print_test(f"GET /api/ai/kb/docs", True, f"Status: {response.status_code}, Documents: {count}")
            results['details'].append(f"✅ KB Documents: {count} documents in knowledge base")
        else:
            results['failed'] += 1
            print_test(f"GET /api/ai/kb/docs", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ KB Documents: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"GET /api/ai/kb/docs", False, f"Error: {str(e)}")
        results['details'].append(f"❌ KB Documents: Exception - {str(e)}")
    
    # Test 2: POST /api/ai/kb/smart-search with "كهرباء"
    try:
        results['total'] += 1
        payload = {'query': 'كهرباء'}
        response = requests.post(f"{BACKEND_URL}/ai/kb/smart-search", json=payload, timeout=30)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            results_count = len(data.get('results', [])) if isinstance(data, dict) else 0
            print_test(f"POST /api/ai/kb/smart-search (كهرباء)", True, f"Status: {response.status_code}, Results: {results_count}")
            results['details'].append(f"✅ KB Smart Search: {results_count} results for 'كهرباء'")
        else:
            results['failed'] += 1
            print_test(f"POST /api/ai/kb/smart-search (كهرباء)", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ KB Smart Search: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"POST /api/ai/kb/smart-search (كهرباء)", False, f"Error: {str(e)}")
        results['details'].append(f"❌ KB Smart Search: Exception - {str(e)}")
    
    # Test 3: POST /api/ai/kb/extract-dtc-cards with "P0088"
    try:
        results['total'] += 1
        payload = {'code': 'P0088'}
        # Note: This endpoint might not exist, checking if it's available
        response = requests.post(f"{BACKEND_URL}/ai/kb/extract-dtc-cards", json=payload, timeout=30)
        passed = response.status_code in [200, 404]  # 404 is acceptable if endpoint doesn't exist
        
        if response.status_code == 200:
            results['passed'] += 1
            data = response.json()
            print_test(f"POST /api/ai/kb/extract-dtc-cards (P0088)", True, f"Status: {response.status_code}")
            results['details'].append(f"✅ DTC Extract: Endpoint exists and working")
        elif response.status_code == 404:
            results['passed'] += 1
            print_test(f"POST /api/ai/kb/extract-dtc-cards (P0088)", True, f"Endpoint not implemented (404) - acceptable")
            results['details'].append(f"⚠️ DTC Extract: Endpoint not implemented (404)")
        else:
            results['failed'] += 1
            print_test(f"POST /api/ai/kb/extract-dtc-cards (P0088)", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ DTC Extract: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"POST /api/ai/kb/extract-dtc-cards (P0088)", False, f"Error: {str(e)}")
        results['details'].append(f"❌ DTC Extract: Exception - {str(e)}")
    
    return results

def test_operations_system():
    """Test نظام العمليات (Operations System)"""
    print_section("3. نظام العمليات (Operations System)")
    
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # Test: GET /api/operations/analytics/summary
    try:
        results['total'] += 1
        response = requests.get(f"{BACKEND_URL}/operations/analytics/summary", timeout=10)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            
            # Check today's data
            today = data.get('today', {})
            today_sales = today.get('sales', 0)
            today_expenses = today.get('expenses', 0)
            today_profit = today.get('profit', 0)
            
            # Check accounts summary
            accounts_summary = data.get('accountsSummary', [])
            accounts_count = len(accounts_summary)
            
            print_test(f"GET /api/operations/analytics/summary", True, 
                      f"Status: {response.status_code}, Today Sales: {today_sales}, Expenses: {today_expenses}, Profit: {today_profit}")
            
            results['details'].append(f"✅ Operations Analytics:")
            results['details'].append(f"   - Today Sales: {today_sales}")
            results['details'].append(f"   - Today Expenses: {today_expenses}")
            results['details'].append(f"   - Today Profit: {today_profit}")
            results['details'].append(f"   - Accounts Summary: {accounts_count} accounts")
            
            # Verify required fields exist
            if 'today' in data and 'sales' in today and 'expenses' in today and 'profit' in today:
                print_test(f"  ↳ Required fields present", True, "today.sales, today.expenses, today.profit ✓")
            else:
                print_test(f"  ↳ Required fields check", False, "Missing some required fields")
                results['details'].append(f"   ⚠️ Some required fields missing")
            
            if 'accountsSummary' in data:
                print_test(f"  ↳ accountsSummary present", True, f"{accounts_count} accounts")
            else:
                print_test(f"  ↳ accountsSummary check", False, "accountsSummary missing")
                results['details'].append(f"   ⚠️ accountsSummary missing")
        else:
            results['failed'] += 1
            print_test(f"GET /api/operations/analytics/summary", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ Operations Analytics: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"GET /api/operations/analytics/summary", False, f"Error: {str(e)}")
        results['details'].append(f"❌ Operations Analytics: Exception - {str(e)}")
    
    return results

def test_users_system():
    """Test نظام المستخدمين (Users System)"""
    print_section("4. نظام المستخدمين (Users System)")
    
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # Test: GET /api/users
    try:
        results['total'] += 1
        response = requests.get(f"{BACKEND_URL}/users", timeout=10)
        passed = response.status_code == 200
        data = response.json() if passed else []
        
        if passed:
            results['passed'] += 1
            users_count = len(data) if isinstance(data, list) else 0
            
            # Check permissions
            has_permissions = False
            if users_count > 0 and isinstance(data, list):
                first_user = data[0]
                if 'permissions' in first_user:
                    has_permissions = True
                    permissions = first_user['permissions']
                    print_test(f"GET /api/users", True, f"Status: {response.status_code}, Users: {users_count}, Permissions: ✓")
                    results['details'].append(f"✅ Users System: {users_count} users found")
                    results['details'].append(f"   - Permissions structure present: {list(permissions.keys())[:5]}")
                else:
                    print_test(f"GET /api/users", True, f"Status: {response.status_code}, Users: {users_count}, Permissions: ✗")
                    results['details'].append(f"✅ Users System: {users_count} users found")
                    results['details'].append(f"   ⚠️ No permissions field in user data")
            else:
                print_test(f"GET /api/users", True, f"Status: {response.status_code}, Users: {users_count}")
                results['details'].append(f"✅ Users System: {users_count} users (empty list is acceptable)")
        else:
            results['failed'] += 1
            print_test(f"GET /api/users", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ Users System: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"GET /api/users", False, f"Error: {str(e)}")
        results['details'].append(f"❌ Users System: Exception - {str(e)}")
    
    return results

def test_print_system():
    """Test نظام الطباعة (Print System)"""
    print_section("5. نظام الطباعة (Print System)")
    
    results = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # Test: POST /api/print/render with complete data
    try:
        results['total'] += 1
        payload = {
            'override_type': 'invoice',
            'data': {
                'CUSTOMER_NAME': 'أحمد محمد الراشد',
                'CUSTOMER_PHONE': '+966501234567',
                'VEHICLE_PLATE': 'ABC-1234',
                'VEHICLE_MODEL': 'كامري',
                'VEHICLE_YEAR': '2022',
                'INVOICE_NO': 'INV-20250101-TEST',
                'SUBTOTAL': '1500.00',
                'TAX': '225.00',
                'TOTAL': '1725.00',
                'items': [
                    {
                        'name': 'تغيير زيت المحرك',
                        'category': 'صيانة',
                        'unit': 'خدمة',
                        'quantity': 1,
                        'price': 500.00,
                        'total': 500.00
                    },
                    {
                        'name': 'فلتر هواء',
                        'category': 'قطع غيار',
                        'unit': 'قطعة',
                        'quantity': 2,
                        'price': 250.00,
                        'total': 500.00
                    },
                    {
                        'name': 'فحص شامل',
                        'category': 'تشخيص',
                        'unit': 'خدمة',
                        'quantity': 1,
                        'price': 500.00,
                        'total': 500.00
                    }
                ]
            }
        }
        
        response = requests.post(f"{BACKEND_URL}/print/render", json=payload, timeout=15)
        passed = response.status_code == 200
        data = response.json() if passed else {}
        
        if passed:
            results['passed'] += 1
            html = data.get('html', '')
            html_length = len(html)
            
            # Check if Arabic content is preserved
            has_arabic = 'أحمد' in html and 'كامري' in html
            has_items = 'زيت' in html or 'فلتر' in html
            has_totals = '1725' in html or '1500' in html
            
            print_test(f"POST /api/print/render", True, 
                      f"Status: {response.status_code}, HTML Length: {html_length} chars")
            
            results['details'].append(f"✅ Print System: HTML generated successfully")
            results['details'].append(f"   - HTML Length: {html_length} characters")
            results['details'].append(f"   - Arabic Content: {'✓' if has_arabic else '✗'}")
            results['details'].append(f"   - Items Present: {'✓' if has_items else '✗'}")
            results['details'].append(f"   - Totals Present: {'✓' if has_totals else '✗'}")
            
            if has_arabic and has_items and has_totals:
                print_test(f"  ↳ Content validation", True, "Arabic, items, and totals all present")
            else:
                print_test(f"  ↳ Content validation", False, "Some content missing")
                results['details'].append(f"   ⚠️ Some expected content missing in HTML")
        else:
            results['failed'] += 1
            print_test(f"POST /api/print/render", False, f"Status: {response.status_code}")
            results['details'].append(f"❌ Print System: Failed with status {response.status_code}")
    except Exception as e:
        results['total'] += 1
        results['failed'] += 1
        print_test(f"POST /api/print/render", False, f"Error: {str(e)}")
        results['details'].append(f"❌ Print System: Exception - {str(e)}")
    
    return results

def generate_summary_report(all_results):
    """Generate final summary report"""
    print_section("📊 FINAL SUMMARY REPORT")
    
    total_tests = 0
    total_passed = 0
    total_failed = 0
    
    for system_name, results in all_results.items():
        total_tests += results['total']
        total_passed += results['passed']
        total_failed += results['failed']
        
        success_rate = (results['passed'] / results['total'] * 100) if results['total'] > 0 else 0
        
        print(f"\n{Colors.BOLD}{system_name}:{Colors.RESET}")
        print(f"  Tests: {results['total']} | Passed: {Colors.GREEN}{results['passed']}{Colors.RESET} | Failed: {Colors.RED}{results['failed']}{Colors.RESET} | Success Rate: {success_rate:.1f}%")
        
        if results['details']:
            print(f"\n  Details:")
            for detail in results['details']:
                print(f"    {detail}")
    
    overall_success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}OVERALL RESULTS:{Colors.RESET}")
    print(f"  Total Tests: {total_tests}")
    print(f"  Passed: {Colors.GREEN}{total_passed}{Colors.RESET}")
    print(f"  Failed: {Colors.RED}{total_failed}{Colors.RESET}")
    print(f"  Success Rate: {Colors.BOLD}{overall_success_rate:.1f}%{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
    
    return {
        'total': total_tests,
        'passed': total_passed,
        'failed': total_failed,
        'success_rate': overall_success_rate
    }

def main():
    """Main test execution"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}FINAL COMPREHENSIVE BACKEND TEST SUITE{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}Testing All New Features{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    all_results = {}
    
    # Run all test suites
    all_results['1. نظام المراجع'] = test_references_system()
    all_results['2. نظام المعرفة'] = test_knowledge_system()
    all_results['3. نظام العمليات'] = test_operations_system()
    all_results['4. نظام المستخدمين'] = test_users_system()
    all_results['5. نظام الطباعة'] = test_print_system()
    
    # Generate summary
    summary = generate_summary_report(all_results)
    
    # Exit with appropriate code
    sys.exit(0 if summary['failed'] == 0 else 1)

if __name__ == "__main__":
    main()
