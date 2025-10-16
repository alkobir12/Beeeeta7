#!/usr/bin/env python3
"""
Backend API Testing for NEW Business Accounts and Operations APIs
Tests the new Business Accounts and Operations APIs as requested
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
print(f"🔗 Testing NEW APIs at: {API_URL}")

class NewAPITester:
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

    def test_business_accounts_api(self):
        """Test Business Accounts CRUD operations"""
        print("\n🏢 Testing Business Accounts API...")
        
        # Test 1: POST /api/biz-accounts (create account)
        account_data = {
            "name": "Main Workshop Branch",
            "code": "MWB001",
            "currency": "SAR",
            "isActive": True
        }
        account_id = None
        
        try:
            response = self.session.post(f"{API_URL}/biz-accounts", json=account_data)
            if response.status_code == 200:
                account = response.json()
                account_id = account.get('id')
                if (account.get('name') == account_data['name'] and 
                    account.get('code') == account_data['code']):
                    self.log_result("Business Accounts API - POST create", True)
                else:
                    self.log_result("Business Accounts API - POST create", False, "Account data not saved correctly")
            else:
                self.log_result("Business Accounts API - POST create", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Business Accounts API - POST create", False, str(e))

        # Test 2: GET /api/biz-accounts (list returns it)
        try:
            response = self.session.get(f"{API_URL}/biz-accounts")
            if response.status_code == 200:
                accounts = response.json()
                if isinstance(accounts, list):
                    found_account = any(a.get('name') == account_data['name'] for a in accounts)
                    if found_account:
                        self.log_result("Business Accounts API - GET list", True)
                    else:
                        self.log_result("Business Accounts API - GET list", False, "Created account not found in list")
                else:
                    self.log_result("Business Accounts API - GET list", False, "Response is not a list")
            else:
                self.log_result("Business Accounts API - GET list", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Business Accounts API - GET list", False, str(e))

        # Test 3: PUT /api/biz-accounts/{id} (updates name)
        if account_id:
            update_data = {
                "name": "Updated Workshop Branch"
            }
            try:
                response = self.session.put(f"{API_URL}/biz-accounts/{account_id}", json=update_data)
                if response.status_code == 200:
                    updated_account = response.json()
                    if updated_account.get('name') == update_data['name']:
                        self.log_result("Business Accounts API - PUT update name", True)
                    else:
                        self.log_result("Business Accounts API - PUT update name", False, f"Name not updated correctly")
                else:
                    self.log_result("Business Accounts API - PUT update name", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result("Business Accounts API - PUT update name", False, str(e))

        return account_id

    def test_operations_api(self):
        """Test Operations API with parts inventory management"""
        print("\n⚙️ Testing Operations API...")
        
        # First create a business account for operations
        account_id = self.test_business_accounts_api()
        if not account_id:
            self.log_result("Operations API - Setup", False, "Failed to create business account")
            return

        # Test 1: Seed a part first via POST /api/parts
        part_data = {
            "partNumber": "OIL-FILTER-001",
            "name": "Oil Filter Premium",
            "category": "Filters",
            "quantity": 10,
            "minQuantity": 5,
            "purchasePrice": 35.0,
            "sellingPrice": 45.0,
            "supplier": "Auto Parts Co"
        }
        part_id = None
        
        try:
            response = self.session.post(f"{API_URL}/parts", json=part_data)
            if response.status_code == 200:
                part = response.json()
                part_id = part.get('id')
                initial_quantity = part.get('quantity', 0)
                if part_id and initial_quantity == 10:
                    self.log_result("Operations API - Seed part", True)
                else:
                    self.log_result("Operations API - Seed part", False, "Part not created correctly")
            else:
                self.log_result("Operations API - Seed part", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Operations API - Seed part", False, str(e))

        if not part_id:
            return

        # Test 2: POST /api/operations create purchase with parts items -> increases part qty
        purchase_data = {
            "accountId": account_id,
            "type": "purchase",
            "partnerType": "supplier",
            "partnerName": "Auto Parts Supplier",
            "items": [
                {
                    "itemType": "part",
                    "itemId": part_id,
                    "name": "Oil Filter Premium",
                    "quantity": 5,
                    "price": 40.0,
                    "total": 200.0
                }
            ],
            "paymentMethod": "cash",
            "notes": "Stock replenishment"
        }
        
        try:
            response = self.session.post(f"{API_URL}/operations", json=purchase_data)
            if response.status_code == 200:
                operation = response.json()
                if (operation.get('type') == 'purchase' and 
                    operation.get('accountId') == account_id):
                    self.log_result("Operations API - POST purchase", True)
                    
                    # Verify part quantity increased
                    part_response = self.session.get(f"{API_URL}/parts/{part_id}")
                    if part_response.status_code == 200:
                        updated_part = part_response.json()
                        new_quantity = updated_part.get('quantity', 0)
                        if new_quantity == 15:  # 10 + 5
                            self.log_result("Operations API - Purchase increases part qty", True)
                        else:
                            self.log_result("Operations API - Purchase increases part qty", False, f"Expected 15, got {new_quantity}")
                    else:
                        self.log_result("Operations API - Purchase increases part qty", False, "Could not verify part quantity")
                else:
                    self.log_result("Operations API - POST purchase", False, "Purchase operation not created correctly")
            else:
                self.log_result("Operations API - POST purchase", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Operations API - POST purchase", False, str(e))

        # Test 3: POST /api/operations create sale with parts items -> decreases part qty
        sale_data = {
            "accountId": account_id,
            "type": "sale",
            "partnerType": "customer",
            "partnerName": "Walk-in Customer",
            "items": [
                {
                    "itemType": "part",
                    "itemId": part_id,
                    "name": "Oil Filter Premium",
                    "quantity": 3,
                    "price": 50.0,
                    "total": 150.0
                }
            ],
            "paymentMethod": "cash",
            "notes": "Retail sale"
        }
        
        try:
            response = self.session.post(f"{API_URL}/operations", json=sale_data)
            if response.status_code == 200:
                operation = response.json()
                if (operation.get('type') == 'sale' and 
                    operation.get('accountId') == account_id):
                    self.log_result("Operations API - POST sale", True)
                    
                    # Verify part quantity decreased
                    part_response = self.session.get(f"{API_URL}/parts/{part_id}")
                    if part_response.status_code == 200:
                        updated_part = part_response.json()
                        new_quantity = updated_part.get('quantity', 0)
                        if new_quantity == 12:  # 15 - 3
                            self.log_result("Operations API - Sale decreases part qty", True)
                        else:
                            self.log_result("Operations API - Sale decreases part qty", False, f"Expected 12, got {new_quantity}")
                    else:
                        self.log_result("Operations API - Sale decreases part qty", False, "Could not verify part quantity")
                else:
                    self.log_result("Operations API - POST sale", False, "Sale operation not created correctly")
            else:
                self.log_result("Operations API - POST sale", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Operations API - POST sale", False, str(e))

        # Test 4: GET /api/operations filters by accountId and type
        try:
            # Filter by accountId
            response = self.session.get(f"{API_URL}/operations?account_id={account_id}")
            if response.status_code == 200:
                operations = response.json()
                if isinstance(operations, list) and len(operations) >= 2:
                    all_same_account = all(op.get('accountId') == account_id for op in operations)
                    if all_same_account:
                        self.log_result("Operations API - GET filter by accountId", True)
                    else:
                        self.log_result("Operations API - GET filter by accountId", False, "Filter not working correctly")
                else:
                    self.log_result("Operations API - GET filter by accountId", False, f"Expected >=2 operations, got {len(operations) if isinstance(operations, list) else 'not a list'}")
            else:
                self.log_result("Operations API - GET filter by accountId", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Operations API - GET filter by accountId", False, str(e))

        try:
            # Filter by type
            response = self.session.get(f"{API_URL}/operations?type=purchase")
            if response.status_code == 200:
                operations = response.json()
                if isinstance(operations, list) and len(operations) >= 1:
                    all_purchases = all(op.get('type') == 'purchase' for op in operations)
                    if all_purchases:
                        self.log_result("Operations API - GET filter by type", True)
                    else:
                        self.log_result("Operations API - GET filter by type", False, "Type filter not working correctly")
                else:
                    self.log_result("Operations API - GET filter by type", False, f"Expected >=1 purchase operations, got {len(operations) if isinstance(operations, list) else 'not a list'}")
            else:
                self.log_result("Operations API - GET filter by type", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Operations API - GET filter by type", False, str(e))

    def test_services_count(self):
        """Test services count >150 after seeding"""
        print("\n🔧 Testing Services Count...")
        
        # Test: GET /api/services to check count
        try:
            response = self.session.get(f"{API_URL}/services")
            if response.status_code == 200:
                services = response.json()
                if isinstance(services, list):
                    service_count = len(services)
                    if service_count > 150:
                        self.log_result("Services Count - >150 services", True, f"Found {service_count} services")
                    else:
                        self.log_result("Services Count - >150 services", False, f"Found only {service_count} services, need to run seed script")
                        # Try to run seed script
                        self.run_seed_script()
                        # Re-check after seeding
                        response2 = self.session.get(f"{API_URL}/services")
                        if response2.status_code == 200:
                            services2 = response2.json()
                            service_count2 = len(services2)
                            if service_count2 > 150:
                                self.log_result("Services Count - After seeding", True, f"Found {service_count2} services after seeding")
                            else:
                                self.log_result("Services Count - After seeding", False, f"Still only {service_count2} services after seeding")
                        else:
                            self.log_result("Services Count - After seeding", False, f"Status: {response2.status_code}")
                else:
                    self.log_result("Services Count - >150 services", False, "Response is not a list")
            else:
                self.log_result("Services Count - >150 services", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Services Count - >150 services", False, str(e))

    def run_seed_script(self):
        """Run the seed script to populate services"""
        try:
            import subprocess
            import sys
            result = subprocess.run([sys.executable, "/app/backend/seed_database.py"], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Seed script executed successfully")
            else:
                print(f"❌ Seed script failed: {result.stderr}")
        except Exception as e:
            print(f"❌ Error running seed script: {e}")

    def run_new_api_tests(self):
        """Run NEW API tests only"""
        print("🚀 Starting NEW Business Accounts and Operations API Tests")
        print("=" * 60)
        
        # Test API health first
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return
        
        # Run NEW API tests
        self.test_business_accounts_api()
        self.test_operations_api()
        self.test_services_count()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 NEW API TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        print(f"📈 Success Rate: {(self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed']) * 100):.1f}%")
        
        if self.test_results['errors']:
            print("\n🚨 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        return self.test_results

if __name__ == "__main__":
    tester = NewAPITester()
    results = tester.run_new_api_tests()
    
    # Exit with error code if tests failed
    if results['failed'] > 0:
        sys.exit(1)
    else:
        print("\n🎉 All NEW API tests passed!")
        sys.exit(0)