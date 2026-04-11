"""
Iteration 112 - Test Data Cleanup Verification
Verifies that test/demo/sample/اختبار/تجريب data has been removed from Preview
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data patterns to search for (case-insensitive)
TEST_PATTERNS = [
    r'\btest\b',
    r'\bdemo\b', 
    r'\bsample\b',
    r'اختبار',
    r'تجريب',
    r'تجريبي',
    r'اختباري',
]

def contains_test_data(text: str) -> tuple:
    """Check if text contains any test data patterns. Returns (bool, matched_pattern)"""
    if not text:
        return False, None
    text_lower = str(text).lower()
    for pattern in TEST_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True, pattern
    return False, None


class TestEndpointsHealth:
    """Verify basic endpoints are working after cleanup"""
    
    def test_customers_endpoint_works(self):
        """GET /api/customers returns 200"""
        response = requests.get(f"{BASE_URL}/api/customers", timeout=30)
        assert response.status_code == 200, f"Customers endpoint failed: {response.status_code}"
        print(f"✅ GET /api/customers - Status: {response.status_code}")
    
    def test_suppliers_endpoint_works(self):
        """GET /api/suppliers returns 200"""
        response = requests.get(f"{BASE_URL}/api/suppliers", timeout=30)
        assert response.status_code == 200, f"Suppliers endpoint failed: {response.status_code}"
        print(f"✅ GET /api/suppliers - Status: {response.status_code}")
    
    def test_parts_endpoint_works(self):
        """GET /api/parts returns 200"""
        response = requests.get(f"{BASE_URL}/api/parts", timeout=30)
        assert response.status_code == 200, f"Parts endpoint failed: {response.status_code}"
        print(f"✅ GET /api/parts - Status: {response.status_code}")
    
    def test_services_endpoint_works(self):
        """GET /api/services returns 200"""
        response = requests.get(f"{BASE_URL}/api/services", timeout=30)
        assert response.status_code == 200, f"Services endpoint failed: {response.status_code}"
        print(f"✅ GET /api/services - Status: {response.status_code}")
    
    def test_biz_accounts_endpoint_works(self):
        """GET /api/biz-accounts returns 200"""
        response = requests.get(f"{BASE_URL}/api/biz-accounts", timeout=30)
        assert response.status_code == 200, f"Biz-accounts endpoint failed: {response.status_code}"
        print(f"✅ GET /api/biz-accounts - Status: {response.status_code}")
    
    def test_operations_endpoint_works(self):
        """GET /api/operations returns 200"""
        response = requests.get(f"{BASE_URL}/api/operations", timeout=30)
        assert response.status_code == 200, f"Operations endpoint failed: {response.status_code}"
        print(f"✅ GET /api/operations - Status: {response.status_code}")
    
    def test_vehicles_endpoint_works(self):
        """GET /api/vehicles returns 200"""
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200, f"Vehicles endpoint failed: {response.status_code}"
        print(f"✅ GET /api/vehicles - Status: {response.status_code}")


class TestCustomersNoTestData:
    """Verify customers table has no test data"""
    
    def test_no_test_customers(self):
        """Customers should not contain test/demo/sample/اختبار/تجريب"""
        response = requests.get(f"{BASE_URL}/api/customers", timeout=30)
        assert response.status_code == 200
        customers = response.json()
        
        test_customers = []
        for customer in customers:
            name = customer.get('name', '')
            phone = customer.get('phone', '')
            email = customer.get('email', '')
            address = customer.get('address', '')
            
            for field_name, field_value in [('name', name), ('phone', phone), ('email', email), ('address', address)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_customers.append({
                        'id': customer.get('id'),
                        'field': field_name,
                        'value': field_value,
                        'pattern': pattern
                    })
        
        if test_customers:
            print(f"❌ Found {len(test_customers)} test customers:")
            for tc in test_customers[:5]:
                print(f"   - ID: {tc['id']}, Field: {tc['field']}, Value: {tc['value']}, Pattern: {tc['pattern']}")
        else:
            print(f"✅ No test data found in {len(customers)} customers")
        
        assert len(test_customers) == 0, f"Found {len(test_customers)} customers with test data"


class TestSuppliersNoTestData:
    """Verify suppliers table has no test data"""
    
    def test_no_test_suppliers(self):
        """Suppliers should not contain test/demo/sample/اختبار/تجريب"""
        response = requests.get(f"{BASE_URL}/api/suppliers", timeout=30)
        assert response.status_code == 200
        suppliers = response.json()
        
        test_suppliers = []
        for supplier in suppliers:
            name = supplier.get('name', '')
            phone = supplier.get('phone', '')
            email = supplier.get('email', '')
            address = supplier.get('address', '')
            
            for field_name, field_value in [('name', name), ('phone', phone), ('email', email), ('address', address)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_suppliers.append({
                        'id': supplier.get('id'),
                        'field': field_name,
                        'value': field_value,
                        'pattern': pattern
                    })
        
        if test_suppliers:
            print(f"❌ Found {len(test_suppliers)} test suppliers:")
            for ts in test_suppliers[:5]:
                print(f"   - ID: {ts['id']}, Field: {ts['field']}, Value: {ts['value']}, Pattern: {ts['pattern']}")
        else:
            print(f"✅ No test data found in {len(suppliers)} suppliers")
        
        assert len(test_suppliers) == 0, f"Found {len(test_suppliers)} suppliers with test data"


class TestPartsNoTestData:
    """Verify parts table has no test data"""
    
    def test_no_test_parts(self):
        """Parts should not contain test/demo/sample/اختبار/تجريب"""
        response = requests.get(f"{BASE_URL}/api/parts", timeout=30)
        assert response.status_code == 200
        parts = response.json()
        
        test_parts = []
        for part in parts:
            name = part.get('name', '')
            part_number = part.get('partNumber', '')
            category = part.get('category', '')
            supplier = part.get('supplier', '')
            
            for field_name, field_value in [('name', name), ('partNumber', part_number), ('category', category), ('supplier', supplier)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_parts.append({
                        'id': part.get('id'),
                        'field': field_name,
                        'value': field_value,
                        'pattern': pattern
                    })
        
        if test_parts:
            print(f"❌ Found {len(test_parts)} test parts:")
            for tp in test_parts[:5]:
                print(f"   - ID: {tp['id']}, Field: {tp['field']}, Value: {tp['value']}, Pattern: {tp['pattern']}")
        else:
            print(f"✅ No test data found in {len(parts)} parts")
        
        assert len(test_parts) == 0, f"Found {len(test_parts)} parts with test data"


class TestServicesNoTestData:
    """Verify services table has no test data"""
    
    def test_no_test_services(self):
        """Services should not contain test/demo/sample/اختبار/تجريب"""
        response = requests.get(f"{BASE_URL}/api/services", timeout=30)
        assert response.status_code == 200
        services = response.json()
        
        test_services = []
        for service in services:
            name = service.get('name', '')
            category = service.get('category', '')
            
            for field_name, field_value in [('name', name), ('category', category)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_services.append({
                        'id': service.get('id'),
                        'field': field_name,
                        'value': field_value,
                        'pattern': pattern
                    })
        
        if test_services:
            print(f"❌ Found {len(test_services)} test services:")
            for ts in test_services[:5]:
                print(f"   - ID: {ts['id']}, Field: {ts['field']}, Value: {ts['value']}, Pattern: {ts['pattern']}")
        else:
            print(f"✅ No test data found in {len(services)} services")
        
        assert len(test_services) == 0, f"Found {len(test_services)} services with test data"


class TestAccountsNoTestData:
    """Verify business accounts table has no test data"""
    
    def test_no_test_accounts(self):
        """Business accounts should not contain test/demo/sample/اختبار/تجريب"""
        response = requests.get(f"{BASE_URL}/api/biz-accounts", timeout=30)
        assert response.status_code == 200
        accounts = response.json()
        
        test_accounts = []
        for account in accounts:
            name = account.get('name', '')
            code = account.get('code', '')
            
            for field_name, field_value in [('name', name), ('code', code)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_accounts.append({
                        'id': account.get('id'),
                        'field': field_name,
                        'value': field_value,
                        'pattern': pattern
                    })
        
        if test_accounts:
            print(f"❌ Found {len(test_accounts)} test accounts:")
            for ta in test_accounts[:5]:
                print(f"   - ID: {ta['id']}, Field: {ta['field']}, Value: {ta['value']}, Pattern: {ta['pattern']}")
        else:
            print(f"✅ No test data found in {len(accounts)} business accounts")
        
        assert len(test_accounts) == 0, f"Found {len(test_accounts)} accounts with test data"


class TestOperationsNoTestData:
    """Verify operations table has no test data"""
    
    def test_no_test_operations(self):
        """Operations should not contain test/demo/sample/اختبار/تجريب in notes/partnerName"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=500", timeout=30)
        assert response.status_code == 200
        operations = response.json()
        
        test_operations = []
        for op in operations:
            notes = op.get('notes', '')
            partner_name = op.get('partnerName', '')
            
            for field_name, field_value in [('notes', notes), ('partnerName', partner_name)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_operations.append({
                        'id': op.get('id'),
                        'field': field_name,
                        'value': str(field_value)[:100],
                        'pattern': pattern
                    })
        
        if test_operations:
            print(f"❌ Found {len(test_operations)} test operations:")
            for to in test_operations[:5]:
                print(f"   - ID: {to['id']}, Field: {to['field']}, Value: {to['value'][:50]}..., Pattern: {to['pattern']}")
        else:
            print(f"✅ No test data found in {len(operations)} operations")
        
        assert len(test_operations) == 0, f"Found {len(test_operations)} operations with test data"


class TestVehicleVisitsNoTestData:
    """Verify vehicle visits/notes have no test data"""
    
    def test_no_test_vehicle_visits(self):
        """Vehicle visits should not contain test/demo/sample/اختبار/تجريب in notes"""
        response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert response.status_code == 200
        vehicles = response.json()
        
        test_vehicles = []
        for vehicle in vehicles:
            notes = vehicle.get('notes', '')
            customer_name = vehicle.get('customerName', '')
            plate_number = vehicle.get('plateNumber', '')
            
            for field_name, field_value in [('notes', notes), ('customerName', customer_name), ('plateNumber', plate_number)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_vehicles.append({
                        'id': vehicle.get('id'),
                        'field': field_name,
                        'value': str(field_value)[:100],
                        'pattern': pattern
                    })
        
        # Also check vehicle visits endpoint if available
        visits_response = requests.get(f"{BASE_URL}/api/vehicle-visits?limit=200", timeout=30)
        if visits_response.status_code == 200:
            visits = visits_response.json()
            if isinstance(visits, list):
                for visit in visits:
                    notes = visit.get('notes', '')
                    if notes:
                        has_test, pattern = contains_test_data(str(notes))
                        if has_test:
                            test_vehicles.append({
                                'id': visit.get('id'),
                                'field': 'visit_notes',
                                'value': str(notes)[:100],
                                'pattern': pattern
                            })
        
        if test_vehicles:
            print(f"❌ Found {len(test_vehicles)} test vehicle/visit entries:")
            for tv in test_vehicles[:5]:
                print(f"   - ID: {tv['id']}, Field: {tv['field']}, Value: {tv['value'][:50]}..., Pattern: {tv['pattern']}")
        else:
            print(f"✅ No test data found in {len(vehicles)} vehicles")
        
        assert len(test_vehicles) == 0, f"Found {len(test_vehicles)} vehicles/visits with test data"


class TestChartOfAccountsNoTestData:
    """Verify chart of accounts has no test data"""
    
    def test_no_test_chart_accounts(self):
        """Chart of accounts should not contain test/demo/sample/اختبار/تجريب"""
        response = requests.get(f"{BASE_URL}/api/chart-of-accounts", timeout=30)
        if response.status_code != 200:
            print(f"⚠️ Chart of accounts endpoint returned {response.status_code}, skipping")
            pytest.skip("Chart of accounts endpoint not available")
            return
        
        accounts = response.json()
        if not isinstance(accounts, list):
            accounts = accounts.get('accounts', []) if isinstance(accounts, dict) else []
        
        test_accounts = []
        for account in accounts:
            name = account.get('name', '') or account.get('name_ar', '')
            code = account.get('code', '')
            
            for field_name, field_value in [('name', name), ('code', code)]:
                has_test, pattern = contains_test_data(field_value)
                if has_test:
                    test_accounts.append({
                        'id': account.get('id'),
                        'field': field_name,
                        'value': field_value,
                        'pattern': pattern
                    })
        
        if test_accounts:
            print(f"❌ Found {len(test_accounts)} test chart accounts:")
            for ta in test_accounts[:5]:
                print(f"   - ID: {ta['id']}, Field: {ta['field']}, Value: {ta['value']}, Pattern: {ta['pattern']}")
        else:
            print(f"✅ No test data found in {len(accounts)} chart accounts")
        
        assert len(test_accounts) == 0, f"Found {len(test_accounts)} chart accounts with test data"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
