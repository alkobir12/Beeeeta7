#!/usr/bin/env python3
"""
Test only the diagnosis report functionality
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

class DiagnosisOnlyTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

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

    def test_diagnosis_report(self):
        """Test Diagnosis Report & Public View"""
        print("\n📋 Testing Diagnosis Report API...")
        
        # Create a test vehicle first for the report
        vehicle = self.create_test_vehicle()
        if not vehicle:
            print("❌ Failed to create test vehicle")
            return

        # Test 1: POST /api/reports/diagnosis (create report)
        report_data = {
            "vehicleId": vehicle['id'],
            "customerId": vehicle['customerId'],
            "title": "Engine Diagnosis Report",
            "summary": "Engine needs oil change and filter replacement",
            "items": [
                {"name": "Oil Change", "qty": 1, "price": 150.0, "total": 150.0},
                {"name": "Oil Filter", "qty": 1, "price": 50.0, "total": 50.0}
            ],
            "subtotal": 200.0,
            "total": 200.0
        }
        report_token = None
        
        try:
            response = self.session.post(f"{API_URL}/reports/diagnosis", json=report_data)
            if response.status_code == 200:
                report = response.json()
                report_token = report.get('token')
                if (report_token and report_token.startswith('REP-') and 
                    report.get('title') == report_data['title']):
                    print("✅ Diagnosis Report API - POST create")
                else:
                    print("❌ Diagnosis Report API - POST create: Report not created correctly")
            else:
                print(f"❌ Diagnosis Report API - POST create: Status: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Diagnosis Report API - POST create: {str(e)}")

        # Test 2: GET /api/reports/public/{token} (retrieve report)
        if report_token:
            try:
                response = self.session.get(f"{API_URL}/reports/public/{report_token}")
                if response.status_code == 200:
                    public_report = response.json()
                    if (public_report.get('token') == report_token and 
                        public_report.get('title') == report_data['title']):
                        print("✅ Diagnosis Report API - GET public")
                    else:
                        print("❌ Diagnosis Report API - GET public: Report data mismatch")
                else:
                    print(f"❌ Diagnosis Report API - GET public: Status: {response.status_code}")
            except Exception as e:
                print(f"❌ Diagnosis Report API - GET public: {str(e)}")

if __name__ == "__main__":
    tester = DiagnosisOnlyTester()
    tester.test_diagnosis_report()