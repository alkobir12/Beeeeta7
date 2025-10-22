#!/usr/bin/env python3
"""
Mechanic Template Testing for Workshop Management System
Tests the specific mechanic template functionality as requested in the review
"""

import requests
import json
import sys
import os

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

BASE_URL = get_backend_url()
if not BASE_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

API_URL = f"{BASE_URL}/api"
print(f"🔗 Testing Mechanic Template API at: {API_URL}")

class MechanicTemplateAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_result(self, test_name, success, message=""):
        if success:
            print(f"✅ {test_name}")
            self.test_results['passed'] += 1
        else:
            print(f"❌ {test_name}: {message}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"{test_name}: {message}")

    def test_step_1_apply_mechanic_template(self):
        """Step 1: Apply mechanic template to all report types"""
        print("\n🔧 STEP 1: Apply mechanic template to all report types")
        
        try:
            response = self.session.post(f"{API_URL}/templates/seed-mechanic-apply-all")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok' and 'applied_types' in data:
                    self.log_result("POST /api/templates/seed-mechanic-apply-all", True, 
                                  f"Applied to types: {data['applied_types']}")
                    return True
                else:
                    self.log_result("POST /api/templates/seed-mechanic-apply-all", False, 
                                  f"Invalid response format: {data}")
                    return False
            else:
                self.log_result("POST /api/templates/seed-mechanic-apply-all", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST /api/templates/seed-mechanic-apply-all", False, str(e))
            return False

    def test_step_2_verify_templates(self):
        """Step 2: Verify templates have been applied correctly"""
        print("\n📋 STEP 2: Verify templates")
        
        try:
            response = self.session.get(f"{API_URL}/templates")
            
            if response.status_code == 200:
                templates = response.json()
                
                # Check for required types
                required_types = ['invoice', 'diagnosis', 'quote', 'receipt']
                found_types = {}
                
                for template in templates:
                    template_type = template.get('type')
                    if template_type in required_types:
                        # For invoice type, only consider active templates
                        if template_type == 'invoice':
                            if template.get('isActive', False):
                                found_types[template_type] = template
                        else:
                            # For other types, find active templates or use the first one
                            if template.get('isActive', False) or template_type not in found_types:
                                found_types[template_type] = template
                
                # Verify all 4 types are present
                missing_types = [t for t in required_types if t not in found_types]
                if missing_types:
                    self.log_result("GET /api/templates - Required types", False, 
                                  f"Missing types: {missing_types}")
                    return False
                
                # Verify each template has required properties
                all_valid = True
                for template_type, template in found_types.items():
                    # Check isActive
                    if not template.get('isActive', False):
                        self.log_result(f"Template {template_type} isActive", False, 
                                      "Template is not active")
                        all_valid = False
                        continue
                    
                    # Check name contains mechanic template text
                    name = template.get('name', '')
                    if 'قالب الميكانيكا الافتراضي' not in name and 'mechanic' not in name.lower() and 'ميكانيكا' not in name:
                        self.log_result(f"Template {template_type} name", False, 
                                      f"Name doesn't contain mechanic template reference: {name}")
                        all_valid = False
                        continue
                    
                    # Check HTML length > 500
                    html_content = template.get('html', '') or template.get('content', '')
                    if len(html_content) <= 500:
                        self.log_result(f"Template {template_type} HTML length", False, 
                                      f"HTML length {len(html_content)} <= 500")
                        all_valid = False
                        continue
                    
                    self.log_result(f"Template {template_type} validation", True, 
                                  f"Active: {template.get('isActive')}, HTML length: {len(html_content)}")
                
                if all_valid:
                    self.log_result("GET /api/templates - All validations", True, 
                                  "All 4 types present with correct properties")
                    return True
                else:
                    return False
                    
            else:
                self.log_result("GET /api/templates", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET /api/templates", False, str(e))
            return False

    def test_step_3_resolve_and_render_invoice(self):
        """Step 3: Resolve & render invoice template"""
        print("\n🧾 STEP 3: Resolve & render invoice")
        
        # Test resolve template
        try:
            resolve_payload = {"override_type": "invoice"}
            response = self.session.post(f"{API_URL}/print/resolve-template", 
                                       json=resolve_payload)
            
            if response.status_code == 200:
                template_data = response.json()
                if 'template' in template_data:
                    self.log_result("POST /api/print/resolve-template (invoice)", True, 
                                  "Template resolved successfully")
                else:
                    self.log_result("POST /api/print/resolve-template (invoice)", False, 
                                  f"No template in response: {template_data}")
                    return False
            else:
                self.log_result("POST /api/print/resolve-template (invoice)", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST /api/print/resolve-template (invoice)", False, str(e))
            return False

        # Test render with Arabic data
        try:
            render_payload = {
                "override_type": "invoice",
                "data": {
                    "WORKSHOP_NAME": "ورشة الاختبار",
                    "WORKSHOP_ADDRESS": "الرياض",
                    "WORKSHOP_PHONE": "0500000000",
                    "WORKSHOP_CITY": "الرياض",
                    "TAX_NUMBER": "1234567890",
                    "CUSTOMER_NAME": "عميل تجربة",
                    "DATE": "2025-10-22",
                    "INVOICE_NO": "INV-TEST-001",
                    "DISCOUNT": "10",
                    "CUSTOMER_BALANCE": "0.00",
                    "FOOTER_NOTES": "شكراً لثقتكم",
                    "items": [
                        {
                            "name": "زيت محرك",
                            "quantity": 1,
                            "price": 100,
                            "total": 100
                        }
                    ]
                }
            }
            
            response = self.session.post(f"{API_URL}/print/render", json=render_payload)
            
            if response.status_code == 200:
                html_content = response.text
                
                # Check for Arabic headers and content
                arabic_checks = [
                    ("المادة", "Arabic item header"),
                    ("ورشة الاختبار", "Workshop name"),
                    ("عميل تجربة", "Customer name"),
                    ("زيت محرك", "Item name")
                ]
                
                all_arabic_found = True
                for arabic_text, description in arabic_checks:
                    if arabic_text in html_content:
                        self.log_result(f"Render invoice - {description}", True, 
                                      f"Found: {arabic_text}")
                    else:
                        self.log_result(f"Render invoice - {description}", False, 
                                      f"Missing: {arabic_text}")
                        all_arabic_found = False
                
                if all_arabic_found:
                    self.log_result("POST /api/print/render (invoice)", True, 
                                  "HTML contains all required Arabic content")
                    return True
                else:
                    return False
                    
            else:
                self.log_result("POST /api/print/render (invoice)", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST /api/print/render (invoice)", False, str(e))
            return False

    def test_step_4_resolve_and_render_diagnosis_quote(self):
        """Step 4: Resolve & render diagnosis and quote templates"""
        print("\n🔍 STEP 4: Resolve & render diagnosis and quote")
        
        test_types = ['diagnosis', 'quote']
        all_success = True
        
        for template_type in test_types:
            print(f"\n  Testing {template_type}...")
            
            # Test resolve template
            try:
                resolve_payload = {"override_type": template_type}
                response = self.session.post(f"{API_URL}/print/resolve-template", 
                                           json=resolve_payload)
                
                if response.status_code == 200:
                    template_data = response.json()
                    if 'template' in template_data:
                        self.log_result(f"POST /api/print/resolve-template ({template_type})", True, 
                                      "Template resolved successfully")
                    else:
                        self.log_result(f"POST /api/print/resolve-template ({template_type})", False, 
                                      f"No template in response: {template_data}")
                        all_success = False
                        continue
                else:
                    self.log_result(f"POST /api/print/resolve-template ({template_type})", False, 
                                  f"HTTP {response.status_code}: {response.text}")
                    all_success = False
                    continue
                    
            except Exception as e:
                self.log_result(f"POST /api/print/resolve-template ({template_type})", False, str(e))
                all_success = False
                continue

            # Test render with minimal data
            try:
                render_payload = {
                    "override_type": template_type,
                    "data": {
                        "WORKSHOP_NAME": "ورشة الاختبار",
                        "CUSTOMER_NAME": "عميل تجربة",
                        "DATE": "2025-10-22"
                    }
                }
                
                response = self.session.post(f"{API_URL}/print/render", json=render_payload)
                
                if response.status_code == 200:
                    html_content = response.text
                    
                    # Check for Arabic content
                    if "ورشة الاختبار" in html_content and "عميل تجربة" in html_content:
                        self.log_result(f"POST /api/print/render ({template_type})", True, 
                                      "HTML contains Arabic content")
                    else:
                        self.log_result(f"POST /api/print/render ({template_type})", False, 
                                      "Missing Arabic content in HTML")
                        all_success = False
                        
                else:
                    self.log_result(f"POST /api/print/render ({template_type})", False, 
                                  f"HTTP {response.status_code}: {response.text}")
                    all_success = False
                    
            except Exception as e:
                self.log_result(f"POST /api/print/render ({template_type})", False, str(e))
                all_success = False
        
        return all_success

    def run_all_tests(self):
        """Run all mechanic template tests in sequence"""
        print("🚀 Starting Mechanic Template API Tests")
        print("=" * 60)
        
        # Step 1: Apply mechanic template to all
        step1_success = self.test_step_1_apply_mechanic_template()
        
        # Step 2: Verify templates
        step2_success = self.test_step_2_verify_templates()
        
        # Step 3: Resolve & render invoice
        step3_success = self.test_step_3_resolve_and_render_invoice()
        
        # Step 4: Resolve & render diagnosis and quote
        step4_success = self.test_step_4_resolve_and_render_diagnosis_quote()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 MECHANIC TEMPLATE TEST SUMMARY")
        print("=" * 60)
        
        steps = [
            ("Step 1: Apply mechanic template to all", step1_success),
            ("Step 2: Verify templates", step2_success),
            ("Step 3: Resolve & render invoice", step3_success),
            ("Step 4: Resolve & render diagnosis and quote", step4_success)
        ]
        
        for step_name, success in steps:
            status = "PASS" if success else "FAIL"
            print(f"{status:>4} | {step_name}")
        
        print(f"\n✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print(f"\n🚨 Errors encountered:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        overall_success = all([step1_success, step2_success, step3_success, step4_success])
        print(f"\n🎯 Overall Result: {'SUCCESS' if overall_success else 'FAILURE'}")
        
        return overall_success

if __name__ == "__main__":
    tester = MechanicTemplateAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)