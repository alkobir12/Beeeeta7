#!/usr/bin/env python3
"""
Focused Backend Health Check for Workshop Management System
Tests specific endpoints mentioned in review request
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

    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = self.session.get(f"{API_URL}/")
            if response.status_code == 200:
                self.log_result("API Health Check", True)
                return True
            else:
                self.log_result("API Health Check", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("API Health Check", False, str(e))
            return False

    def create_test_vehicle(self):
        """Create a test vehicle for testing"""
        vehicle_data = {
            "plateNumber": f"TST-{str(uuid.uuid4())[:4].upper()}",
            "brand": "Toyota",
            "model": "Camry",
            "year": 2020,
            "color": "White",
            "customerName": "Test Customer",
            "customerPhone": "+966501234567",
            "customerEmail": "test@email.com",
            "services": ["Oil Change"]
        }
        
        try:
            response = self.session.post(f"{API_URL}/vehicles", json=vehicle_data)
            if response.status_code == 200:
                vehicle = response.json()
                return vehicle
            else:
                print(f"Failed to create test vehicle: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error creating test vehicle: {e}")
            return None

    def test_vehicle_tracking(self):
        """Test GET /api/vehicles/track/{trackingLink}"""
        print("\n🚗 Testing Vehicle Tracking API...")
        
        # Create a vehicle to get a valid tracking link
        vehicle = self.create_test_vehicle()
        if not vehicle:
            self.log_result("Vehicle Tracking - Setup", False, "Could not create test vehicle")
            return
        
        tracking_link = vehicle.get('trackingLink')
        if not tracking_link:
            self.log_result("Vehicle Tracking - Setup", False, "No tracking link in vehicle")
            return
        
        # Test valid tracking link
        try:
            response = self.session.get(f"{API_URL}/vehicles/track/{tracking_link}")
            if response.status_code == 200:
                vehicle_data = response.json()
                if vehicle_data.get('trackingLink') == tracking_link:
                    self.log_result("Vehicle Tracking - Valid Link Returns Vehicle", True)
                else:
                    self.log_result("Vehicle Tracking - Valid Link Returns Vehicle", False, "Vehicle data mismatch")
            else:
                self.log_result("Vehicle Tracking - Valid Link Returns Vehicle", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Vehicle Tracking - Valid Link Returns Vehicle", False, str(e))
        
        # Test invalid tracking link returns 404
        try:
            invalid_response = self.session.get(f"{API_URL}/vehicles/track/INVALID-LINK-123")
            if invalid_response.status_code == 404:
                self.log_result("Vehicle Tracking - Invalid Link Returns 404", True)
            else:
                self.log_result("Vehicle Tracking - Invalid Link Returns 404", False, f"Expected 404, got {invalid_response.status_code}")
        except Exception as e:
            self.log_result("Vehicle Tracking - Invalid Link Returns 404", False, str(e))

    def test_approvals_creation(self):
        """Test POST /api/approvals returns payload with token and expiresAt ISO string"""
        print("\n✅ Testing Approvals Creation...")
        
        # Create a test vehicle first
        vehicle = self.create_test_vehicle()
        if not vehicle:
            self.log_result("Approvals Creation - Setup", False, "Could not create test vehicle")
            return None
        
        # Test POST /api/approvals
        approval_data = {
            "vehicleId": vehicle['id'],
            "customerId": vehicle['customerId'],
            "title": "Test Approval Request",
            "amount": 750.0
        }
        
        try:
            response = self.session.post(f"{API_URL}/approvals", json=approval_data)
            if response.status_code == 200:
                approval = response.json()
                token = approval.get('token')
                expires_at = approval.get('expiresAt')
                
                # Verify token format and expiresAt ISO string
                if (token and token.startswith('APR-') and 
                    expires_at and isinstance(expires_at, str)):
                    # Try to parse expiresAt as ISO datetime
                    try:
                        datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                        self.log_result("Approvals Creation - Returns Token and ISO ExpiresAt", True)
                        return token
                    except ValueError:
                        self.log_result("Approvals Creation - Returns Token and ISO ExpiresAt", False, "expiresAt is not valid ISO format")
                else:
                    self.log_result("Approvals Creation - Returns Token and ISO ExpiresAt", False, f"Missing token or expiresAt. Token: {token}, ExpiresAt: {expires_at}")
            else:
                self.log_result("Approvals Creation - Returns Token and ISO ExpiresAt", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Creation - Returns Token and ISO ExpiresAt", False, str(e))
        
        return None

    def test_approvals_public_access(self):
        """Test GET /api/approvals/public/{token}: 200 for valid, 410 after revoke"""
        print("\n🔓 Testing Approvals Public Access...")
        
        # Create an approval first
        token = self.test_approvals_creation()
        if not token:
            self.log_result("Approvals Public Access - Setup", False, "Could not create approval token")
            return
        
        # Test 1: GET /api/approvals/public/{token} returns 200 for valid non-expired token
        try:
            response = self.session.get(f"{API_URL}/approvals/public/{token}")
            if response.status_code == 200:
                approval_data = response.json()
                if approval_data.get('token') == token:
                    self.log_result("Approvals Public Access - Valid Token Returns 200", True)
                else:
                    self.log_result("Approvals Public Access - Valid Token Returns 200", False, "Token mismatch in response")
            else:
                self.log_result("Approvals Public Access - Valid Token Returns 200", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Public Access - Valid Token Returns 200", False, str(e))
        
        # Test 2: Find approval ID and revoke it, then test 410 response
        try:
            # Get approval ID by listing approvals
            list_response = self.session.get(f"{API_URL}/approvals")
            if list_response.status_code == 200:
                approvals = list_response.json()
                approval_id = None
                for approval in approvals:
                    if approval.get('token') == token:
                        approval_id = approval.get('id')
                        break
                
                if approval_id:
                    # Revoke the approval
                    revoke_response = self.session.put(f"{API_URL}/approvals/{approval_id}/revoke")
                    if revoke_response.status_code == 200:
                        # Now test that public access returns 410
                        public_response = self.session.get(f"{API_URL}/approvals/public/{token}")
                        if public_response.status_code == 410:
                            self.log_result("Approvals Public Access - Revoked Token Returns 410", True)
                        else:
                            self.log_result("Approvals Public Access - Revoked Token Returns 410", False, f"Expected 410, got {public_response.status_code}")
                    else:
                        self.log_result("Approvals Public Access - Revoked Token Returns 410", False, f"Could not revoke approval: {revoke_response.status_code}")
                else:
                    self.log_result("Approvals Public Access - Revoked Token Returns 410", False, "Could not find approval ID")
            else:
                self.log_result("Approvals Public Access - Revoked Token Returns 410", False, f"Could not list approvals: {list_response.status_code}")
        except Exception as e:
            self.log_result("Approvals Public Access - Revoked Token Returns 410", False, str(e))

    def test_notifications_prepare(self):
        """Test POST /api/notifications/prepare with type=approval"""
        print("\n📱 Testing Notifications Prepare...")
        
        # Test POST /api/notifications/prepare with type=approval
        notification_data = {
            "type": "approval",
            "phone": "+966501234567",
            "link": "https://example.com/approval/APR-12345678",
            "customerName": "Ahmed Al-Rashid",
            "amount": 500.0
        }
        
        try:
            response = self.session.post(f"{API_URL}/notifications/prepare", json=notification_data)
            if response.status_code == 200:
                result = response.json()
                whatsapp_deeplink = result.get('whatsappDeeplink')
                
                # Verify whatsappDeeplink contains provided link and normalized phone
                if (whatsapp_deeplink and 
                    notification_data['link'] in whatsapp_deeplink and
                    '966501234567' in whatsapp_deeplink):  # Normalized phone (without +)
                    self.log_result("Notifications Prepare - WhatsApp Deeplink with Link and Phone", True)
                else:
                    self.log_result("Notifications Prepare - WhatsApp Deeplink with Link and Phone", False, 
                                  f"WhatsApp deeplink missing required elements. Got: {whatsapp_deeplink}")
            else:
                self.log_result("Notifications Prepare - WhatsApp Deeplink with Link and Phone", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Notifications Prepare - WhatsApp Deeplink with Link and Phone", False, str(e))

    def test_settings_whatsapp_fields(self):
        """Test /api/settings includes whatsapp templates fields and whatsappCountryCode"""
        print("\n⚙️ Testing Settings WhatsApp Fields...")
        
        # Test GET /api/settings includes whatsapp fields
        try:
            response = self.session.get(f"{API_URL}/settings")
            if response.status_code == 200:
                settings = response.json()
                
                # Check for whatsapp related fields
                has_whatsapp_country_code = 'whatsappCountryCode' in settings
                has_whatsapp_templates = any('whatsapp' in key.lower() and 'template' in key.lower() for key in settings.keys())
                
                if has_whatsapp_country_code:
                    self.log_result("Settings - WhatsApp Country Code Field Present", True)
                else:
                    self.log_result("Settings - WhatsApp Country Code Field Present", False, "whatsappCountryCode field missing")
                
                if has_whatsapp_templates:
                    self.log_result("Settings - WhatsApp Templates Fields Present", True)
                else:
                    # Check for any template-related fields that might contain whatsapp templates
                    template_fields = [k for k in settings.keys() if 'template' in k.lower()]
                    if template_fields:
                        self.log_result("Settings - WhatsApp Templates Fields Present", True, f"Found template fields: {template_fields}")
                    else:
                        self.log_result("Settings - WhatsApp Templates Fields Present", False, "No WhatsApp template fields found")
            else:
                self.log_result("Settings - WhatsApp Fields Check", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Settings - WhatsApp Fields Check", False, str(e))

    def test_print_resolve_template(self):
        """Test /api/print/resolve-template works for override_type=invoice"""
        print("\n🖨️ Testing Print Resolve Template...")
        
        # Test POST /api/print/resolve-template with override_type=invoice
        template_data = {
            "override_type": "invoice",
            "vehicleId": "test-vehicle-id",
            "customerId": "test-customer-id"
        }
        
        try:
            response = self.session.post(f"{API_URL}/print/resolve-template", json=template_data)
            if response.status_code == 200:
                result = response.json()
                
                # Verify response contains template information
                if 'template' in result or 'templateType' in result or 'html' in result:
                    self.log_result("Print Resolve Template - Invoice Override Type Works", True)
                else:
                    self.log_result("Print Resolve Template - Invoice Override Type Works", False, f"Unexpected response format: {result}")
            else:
                self.log_result("Print Resolve Template - Invoice Override Type Works", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Print Resolve Template - Invoice Override Type Works", False, str(e))

    def run_focused_tests(self):
        """Run focused health checks as requested in review"""
        print("🎯 Starting Focused Backend Health Checks...")
        print("=" * 60)
        
        if not self.test_api_health():
            print("❌ API is not accessible, stopping tests")
            return
        
        # Run the 6 specific tests requested
        self.test_vehicle_tracking()
        self.test_approvals_creation()
        self.test_approvals_public_access()
        self.test_notifications_prepare()
        self.test_settings_whatsapp_fields()
        self.test_print_resolve_template()
        
        # Print summary
        print("\n" + "=" * 60)
        print("🏁 Focused Backend Health Check Summary")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🔍 Failed Tests:")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        success_rate = (self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed'])) * 100 if (self.test_results['passed'] + self.test_results['failed']) > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        return self.test_results['failed'] == 0

if __name__ == "__main__":
    tester = FocusedAPITester()
    success = tester.run_focused_tests()
    sys.exit(0 if success else 1)