#!/usr/bin/env python3
"""
Focused Backend Re-testing for Workshop Management System
Re-run backend focused checks after fixes as requested in review
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
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
print(f"🔗 Testing API at: {API_URL}")

class FocusedAPITester:
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

    def test_notifications_prepare_phone_normalization(self):
        """Test POST /api/notifications/prepare with phone normalization fix"""
        print("\n📱 Testing Notifications Prepare Phone Normalization...")
        
        # Test case from review: phone '+966501234567' should result in whatsappDeeplink with phone 966501234567 (no duplicate country code)
        test_payload = {
            "type": "approval",
            "phone": "+966501234567",
            "link": "https://example.com/a"
        }
        
        try:
            response = self.session.post(f"{API_URL}/notifications/prepare", json=test_payload)
            if response.status_code == 200:
                result = response.json()
                whatsapp_deeplink = result.get('whatsappDeeplink', '')
                
                # Check if the deeplink contains the correct phone number (966501234567, not +966966501234567)
                if 'wa.me/966501234567' in whatsapp_deeplink:
                    self.log_result("Notifications Prepare - Phone normalization fixed", True)
                elif '+966966' in whatsapp_deeplink or 'wa.me/+966966' in whatsapp_deeplink:
                    self.log_result("Notifications Prepare - Phone normalization fixed", False, 
                                  f"Still has duplicate country code: {whatsapp_deeplink}")
                else:
                    # Check what phone number is actually in the deeplink
                    import re
                    phone_match = re.search(r'wa\.me/(\+?\d+)', whatsapp_deeplink)
                    if phone_match:
                        actual_phone = phone_match.group(1)
                        if actual_phone == '966501234567':
                            self.log_result("Notifications Prepare - Phone normalization fixed", True)
                        else:
                            self.log_result("Notifications Prepare - Phone normalization fixed", False, 
                                          f"Expected 966501234567, got {actual_phone}")
                    else:
                        self.log_result("Notifications Prepare - Phone normalization fixed", False, 
                                      f"Could not extract phone from deeplink: {whatsapp_deeplink}")
                
                # Also verify the link is included
                if test_payload['link'] in result.get('text', ''):
                    print("  ✓ Link correctly included in message text")
                else:
                    print("  ⚠️ Link not found in message text")
                    
            else:
                self.log_result("Notifications Prepare - Phone normalization fixed", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Notifications Prepare - Phone normalization fixed", False, str(e))

    def test_print_resolve_template(self):
        """Test POST /api/print/resolve-template with override_type='invoice'"""
        print("\n🖨️ Testing Print Resolve Template...")
        
        # Test case from review: POST /api/print/resolve-template with {override_type:'invoice'} should return 200 with template
        test_payload = {
            "override_type": "invoice"
        }
        
        try:
            response = self.session.post(f"{API_URL}/print/resolve-template", json=test_payload)
            if response.status_code == 200:
                result = response.json()
                if result.get('type') == 'invoice' and 'template' in result:
                    template = result.get('template', {})
                    if template and 'content' in template:
                        self.log_result("Print Resolve Template - Invoice override", True)
                    else:
                        self.log_result("Print Resolve Template - Invoice override", False, 
                                      "Template returned but missing content")
                else:
                    self.log_result("Print Resolve Template - Invoice override", False, 
                                  f"Unexpected response format: {result}")
            elif response.status_code == 404:
                self.log_result("Print Resolve Template - Invoice override", False, 
                              "404 - Invoice template not found, may need to seed templates first")
                # Try to seed templates first
                self.seed_print_templates()
                # Retry the test
                response2 = self.session.post(f"{API_URL}/print/resolve-template", json=test_payload)
                if response2.status_code == 200:
                    result2 = response2.json()
                    if result2.get('type') == 'invoice' and 'template' in result2:
                        self.log_result("Print Resolve Template - After seeding", True)
                    else:
                        self.log_result("Print Resolve Template - After seeding", False, 
                                      f"Still incorrect format after seeding: {result2}")
                else:
                    self.log_result("Print Resolve Template - After seeding", False, 
                                  f"Still failing after seeding: {response2.status_code}")
            else:
                self.log_result("Print Resolve Template - Invoice override", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("Print Resolve Template - Invoice override", False, str(e))

    def seed_print_templates(self):
        """Seed print templates if they don't exist"""
        try:
            response = self.session.post(f"{API_URL}/seed/print-templates")
            if response.status_code == 200:
                print("  ✓ Print templates seeded successfully")
            else:
                print(f"  ⚠️ Failed to seed templates: {response.status_code}")
        except Exception as e:
            print(f"  ⚠️ Error seeding templates: {e}")

    def test_vehicle_tracking_sanity_check(self):
        """Sanity check /api/vehicles/track for a newly created vehicle"""
        print("\n🚗 Testing Vehicle Tracking Sanity Check...")
        
        # Create a new vehicle first
        vehicle_data = {
            "plateNumber": f"TEST-{str(uuid.uuid4())[:4].upper()}",
            "brand": "Toyota",
            "model": "Camry",
            "year": 2020,
            "color": "White",
            "customerName": "Test Customer for Tracking",
            "customerPhone": "+966501111111",
            "customerEmail": "test.tracking@email.com",
            "services": ["Oil Change"]
        }
        
        try:
            # Create vehicle
            response = self.session.post(f"{API_URL}/vehicles", json=vehicle_data)
            if response.status_code == 200:
                vehicle = response.json()
                tracking_link = vehicle.get('trackingLink')
                vehicle_id = vehicle.get('id')
                
                if tracking_link:
                    # Test tracking endpoint
                    track_response = self.session.get(f"{API_URL}/vehicles/track/{tracking_link}")
                    if track_response.status_code == 200:
                        tracked_vehicle = track_response.json()
                        if tracked_vehicle.get('id') == vehicle_id:
                            self.log_result("Vehicle Tracking - Sanity check for new vehicle", True)
                        else:
                            self.log_result("Vehicle Tracking - Sanity check for new vehicle", False, 
                                          "Vehicle ID mismatch in tracking response")
                    else:
                        self.log_result("Vehicle Tracking - Sanity check for new vehicle", False, 
                                      f"Tracking failed with status: {track_response.status_code}")
                    
                    # Clean up - delete the test vehicle
                    try:
                        self.session.delete(f"{API_URL}/vehicles/{vehicle_id}")
                    except:
                        pass  # Cleanup failure is not critical
                        
                else:
                    self.log_result("Vehicle Tracking - Sanity check for new vehicle", False, 
                                  "No tracking link generated for new vehicle")
            else:
                self.log_result("Vehicle Tracking - Sanity check for new vehicle", False, 
                              f"Failed to create test vehicle: {response.status_code}")
        except Exception as e:
            self.log_result("Vehicle Tracking - Sanity check for new vehicle", False, str(e))

    def run_all_tests(self):
        """Run all focused tests"""
        print("🎯 Running Focused Backend Re-tests...")
        print("=" * 60)
        
        self.test_notifications_prepare_phone_normalization()
        self.test_print_resolve_template()
        self.test_vehicle_tracking_sanity_check()
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.test_results['passed']} passed, {self.test_results['failed']} failed")
        
        if self.test_results['errors']:
            print("\n❌ Failed Tests:")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        return self.test_results['failed'] == 0

def main():
    tester = FocusedAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All focused tests passed!")
        sys.exit(0)
    else:
        print(f"\n💥 {tester.test_results['failed']} test(s) failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()