#!/usr/bin/env python3
"""
Test only the approvals lifecycle functionality
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

# Test data
TEST_VEHICLE_DATA = {
    "plateNumber": "ABC-1234",
    "brand": "Toyota",
    "model": "Camry",
    "year": 2020,
    "color": "White",
    "customerName": "Ahmed Al-Rashid",
    "customerPhone": "+966501234567",
    "customerEmail": "ahmed.rashid@email.com",
    "services": ["Oil Change", "Brake Inspection"]
}

class ApprovalsOnlyTester:
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

    def create_test_vehicle(self):
        """Create a test vehicle for testing"""
        try:
            response = self.session.post(f"{API_URL}/vehicles", json=TEST_VEHICLE_DATA)
            if response.status_code == 200:
                vehicle = response.json()
                return vehicle
            else:
                print(f"Failed to create test vehicle: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error creating test vehicle: {e}")
            return None

    def test_approvals_lifecycle_comprehensive(self):
        """Test comprehensive approvals lifecycle as requested in review"""
        print("\n🔐 Testing Approvals Lifecycle (Comprehensive)...")
        
        # Create test vehicle and customer first
        vehicle = self.create_test_vehicle()
        if not vehicle:
            self.log_result("Approvals Lifecycle - Setup", False, "Failed to create test vehicle")
            return
        
        vehicle_id = vehicle['id']
        customer_id = vehicle['customerId']
        
        # Test 1: Create approval with 7-day expiry
        approval_data = {
            "vehicleId": vehicle_id,
            "customerId": customer_id,
            "title": "Engine Repair Approval",
            "amount": 1500.0
        }
        approval_token = None
        approval_id = None
        
        try:
            response = self.session.post(f"{API_URL}/approvals", json=approval_data)
            if response.status_code == 200:
                approval = response.json()
                approval_token = approval.get('token')
                approval_id = approval.get('id')
                expires_at = approval.get('expiresAt')
                
                if (approval_token and approval_token.startswith('APR-') and 
                    expires_at and approval.get('amount') == 1500.0):
                    # Verify expiry is ~7 days ahead (ISO format)
                    try:
                        from datetime import datetime
                        expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                        now = datetime.utcnow()
                        days_diff = (expires_dt - now).days
                        if 6 <= days_diff <= 7:  # Allow some tolerance
                            self.log_result("Approvals Lifecycle - Create with 7-day expiry", True)
                        else:
                            self.log_result("Approvals Lifecycle - Create with 7-day expiry", False, f"Expiry is {days_diff} days, expected ~7")
                    except Exception as e:
                        self.log_result("Approvals Lifecycle - Create with 7-day expiry", False, f"Date parsing error: {e}")
                else:
                    self.log_result("Approvals Lifecycle - Create with 7-day expiry", False, "Missing token, ID, or incorrect data")
            else:
                self.log_result("Approvals Lifecycle - Create with 7-day expiry", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Lifecycle - Create with 7-day expiry", False, str(e))
        
        if not approval_token:
            return
        
        # Test 2: Public fetch before respond
        try:
            response = self.session.get(f"{API_URL}/approvals/public/{approval_token}")
            if response.status_code == 200:
                public_approval = response.json()
                if (public_approval.get('token') == approval_token and 
                    public_approval.get('amount') == 1500.0 and
                    public_approval.get('title') == "Engine Repair Approval"):
                    self.log_result("Approvals Lifecycle - Public fetch before respond", True)
                else:
                    self.log_result("Approvals Lifecycle - Public fetch before respond", False, "Data mismatch")
            else:
                self.log_result("Approvals Lifecycle - Public fetch before respond", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Lifecycle - Public fetch before respond", False, str(e))
        
        # Test 3: Public respond with status=approved
        try:
            params = {
                "status": "approved",
                "name": "Ahmed Al-Rashid", 
                "phone": "0551234567",
                "notes": "Approved for engine repair"
            }
            response = self.session.post(f"{API_URL}/approvals/public/{approval_token}/respond", params=params)
            if response.status_code == 200:
                responded_approval = response.json()
                if (responded_approval.get('status') == 'approved' and 
                    'respondedAt' in responded_approval and
                    responded_approval.get('responderName') == 'Ahmed Al-Rashid'):
                    self.log_result("Approvals Lifecycle - Respond approved", True)
                else:
                    self.log_result("Approvals Lifecycle - Respond approved", False, f"Response not saved correctly: {responded_approval}")
            else:
                self.log_result("Approvals Lifecycle - Respond approved", False, f"Status: {response.status_code} - {response.text}")
        except Exception as e:
            self.log_result("Approvals Lifecycle - Respond approved", False, str(e))
        
        # Test 4: Repeat respond (idempotency check)
        try:
            params = {
                "status": "approved",
                "name": "Ahmed Al-Rashid", 
                "phone": "0551234567",
                "notes": "Second response attempt"
            }
            response = self.session.post(f"{API_URL}/approvals/public/{approval_token}/respond", params=params)
            if response.status_code == 200:
                self.log_result("Approvals Lifecycle - Repeat respond idempotency", True)
            else:
                self.log_result("Approvals Lifecycle - Repeat respond idempotency", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Lifecycle - Repeat respond idempotency", False, str(e))
        
        # Test 5: Create and test other statuses (deferred, requote, rejected)
        statuses_to_test = ["deferred", "requote", "rejected"]
        for status in statuses_to_test:
            # Create new approval for each status
            new_approval_data = {
                "vehicleId": vehicle_id,
                "customerId": customer_id,
                "title": f"Test {status.title()} Status",
                "amount": 800.0
            }
            
            try:
                response = self.session.post(f"{API_URL}/approvals", json=new_approval_data)
                if response.status_code == 200:
                    new_approval = response.json()
                    new_token = new_approval.get('token')
                    
                    if new_token:
                        # Respond with the status
                        params = {
                            "status": status,
                            "name": "Test Responder",
                            "phone": "0551111111",
                            "notes": f"Testing {status} status"
                        }
                        response = self.session.post(f"{API_URL}/approvals/public/{new_token}/respond", params=params)
                        if response.status_code == 200:
                            responded = response.json()
                            if responded.get('status') == status:
                                self.log_result(f"Approvals Lifecycle - Status {status}", True)
                            else:
                                self.log_result(f"Approvals Lifecycle - Status {status}", False, f"Status not set correctly: {responded}")
                        else:
                            self.log_result(f"Approvals Lifecycle - Status {status}", False, f"Respond failed: {response.status_code}")
                    else:
                        self.log_result(f"Approvals Lifecycle - Status {status}", False, "No token returned")
                else:
                    self.log_result(f"Approvals Lifecycle - Status {status}", False, f"Create failed: {response.status_code}")
            except Exception as e:
                self.log_result(f"Approvals Lifecycle - Status {status}", False, str(e))
        
        # Test 6: Revocation flow
        if approval_id:
            try:
                # Revoke the approval
                response = self.session.put(f"{API_URL}/approvals/{approval_id}/revoke")
                if response.status_code == 200:
                    self.log_result("Approvals Lifecycle - Revoke approval", True)
                    
                    # Try to access revoked approval
                    response = self.session.get(f"{API_URL}/approvals/public/{approval_token}")
                    if response.status_code == 410:
                        self.log_result("Approvals Lifecycle - Access revoked returns 410", True)
                    else:
                        self.log_result("Approvals Lifecycle - Access revoked returns 410", False, f"Expected 410, got {response.status_code}")
                else:
                    self.log_result("Approvals Lifecycle - Revoke approval", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Approvals Lifecycle - Revoke approval", False, str(e))
        
        # Test 7: Expiry check with expiresInDays=0
        expired_approval_data = {
            "vehicleId": vehicle_id,
            "customerId": customer_id,
            "title": "Expired Approval Test",
            "amount": 500.0,
            "expiresInDays": 0
        }
        
        try:
            response = self.session.post(f"{API_URL}/approvals", json=expired_approval_data)
            if response.status_code == 200:
                expired_approval = response.json()
                expired_token = expired_approval.get('token')
                
                if expired_token:
                    # Try to access expired approval
                    response = self.session.get(f"{API_URL}/approvals/public/{expired_token}")
                    if response.status_code == 410:
                        self.log_result("Approvals Lifecycle - Expired approval returns 410", True)
                    else:
                        self.log_result("Approvals Lifecycle - Expired approval returns 410", False, f"Expected 410, got {response.status_code}")
                else:
                    self.log_result("Approvals Lifecycle - Expired approval returns 410", False, "No token returned")
            else:
                self.log_result("Approvals Lifecycle - Expired approval returns 410", False, f"Create failed: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Lifecycle - Expired approval returns 410", False, str(e))
        
        # Test 8: Listing approvals with vehicle_id filter
        try:
            response = self.session.get(f"{API_URL}/approvals?vehicle_id={vehicle_id}")
            if response.status_code == 200:
                approvals_list = response.json()
                if isinstance(approvals_list, list) and len(approvals_list) > 0:
                    # Check that all approvals have the correct vehicle_id
                    all_correct_vehicle = all(a.get('vehicleId') == vehicle_id for a in approvals_list)
                    # Check ISO format dates and no _id field
                    has_iso_dates = all('respondedAt' not in a or isinstance(a.get('respondedAt'), str) for a in approvals_list)
                    has_iso_expires = all('expiresAt' not in a or isinstance(a.get('expiresAt'), str) for a in approvals_list)
                    no_id_fields = all('_id' not in a for a in approvals_list)
                    
                    if all_correct_vehicle and has_iso_dates and has_iso_expires and no_id_fields:
                        self.log_result("Approvals Lifecycle - List by vehicle_id with ISO dates", True)
                    else:
                        self.log_result("Approvals Lifecycle - List by vehicle_id with ISO dates", False, f"Filter or serialization issues. Sample: {approvals_list[0] if approvals_list else 'None'}")
                else:
                    self.log_result("Approvals Lifecycle - List by vehicle_id with ISO dates", False, "No approvals returned")
            else:
                self.log_result("Approvals Lifecycle - List by vehicle_id with ISO dates", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Approvals Lifecycle - List by vehicle_id with ISO dates", False, str(e))

    def run_test(self):
        """Run the approvals test"""
        print("🚀 Starting Approvals Lifecycle Test...")
        print("=" * 60)
        
        self.test_approvals_lifecycle_comprehensive()
        
        # Print summary
        print("\n" + "=" * 60)
        print("🏁 Approvals Test Summary")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🔍 Failed Tests:")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        success_rate = (self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed'])) * 100 if (self.test_results['passed'] + self.test_results['failed']) > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")

if __name__ == "__main__":
    tester = ApprovalsOnlyTester()
    tester.run_test()