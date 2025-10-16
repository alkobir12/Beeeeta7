#!/usr/bin/env python3
"""
Backend Index Creation Test for Workshop Management System
Tests the POST /api/admin/create-indexes endpoint for production readiness
"""

import requests
import json
import sys

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

class IndexCreationTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def test_api_health(self):
        """Test if API is accessible"""
        try:
            response = self.session.get(f"{API_URL}/")
            if response.status_code == 200:
                print("✅ API Health Check")
                return True
            else:
                print(f"❌ API Health Check: Status {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ API Health Check: {str(e)}")
            return False

    def test_create_indexes(self):
        """Test POST /api/admin/create-indexes endpoint"""
        print("\n🔧 Testing Database Index Creation...")
        
        try:
            response = self.session.post(f"{API_URL}/admin/create-indexes")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('status') == 'ok':
                    print("✅ Database indexes created successfully")
                    print("   📋 Indexes created for:")
                    print("      • approval_requests.token (unique)")
                    print("      • approval_requests.vehicleId")
                    print("      • transactions.date")
                    print("      • transactions.accountId")
                    print("      • vehicles.customerId")
                    print("      • quotes.customerId")
                    print("      • sales_orders.customerId")
                    print("      • vendor_bills.supplierId")
                    print("      • document_dependencies.fromDoc.docId")
                    print("      • document_dependencies.toDoc.docId")
                    return True
                else:
                    print(f"❌ Index creation failed: Unexpected response format - {result}")
                    return False
            else:
                print(f"❌ Index creation failed: HTTP {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Index creation failed: {str(e)}")
            return False

    def run_test(self):
        """Run the index creation test"""
        print("🚀 Starting Database Index Creation Test")
        print("=" * 60)
        
        # Check API health first
        if not self.test_api_health():
            print("\n❌ API is not accessible. Cannot proceed with index creation test.")
            return False
        
        # Test index creation
        success = self.test_create_indexes()
        
        print("\n" + "=" * 60)
        if success:
            print("🎉 DATABASE INDEX CREATION TEST PASSED")
            print("✅ Production database indexes are ready")
        else:
            print("❌ DATABASE INDEX CREATION TEST FAILED")
            print("⚠️  Production database indexes may not be properly configured")
        print("=" * 60)
        
        return success

if __name__ == "__main__":
    tester = IndexCreationTester()
    success = tester.run_test()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)