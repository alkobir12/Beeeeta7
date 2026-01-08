#!/usr/bin/env python3
"""
Backend Test for Vehicle-Operations Integration
Testing the auto-sync feature between vehicle parts and operations
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://mechanic-dashboard-15.preview.emergentagent.com/api"

# Test data
VEHICLE_ID = "641b1f96-6a55-46db-80e7-a76e3d1f394d"
CUSTOMER_NAME = "صالح"
PLATE_NUMBER = "ب ر ع"

class VehicleOperationsTest:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_get_vehicle_operations(self):
        """Test 1: Get operations for specific vehicle"""
        try:
            url = f"{BACKEND_URL}/operations?vehicle_id={VEHICLE_ID}"
            response = self.session.get(url)
            
            if response.status_code == 200:
                operations = response.json()
                if isinstance(operations, list):
                    self.log_test(
                        "Get Vehicle Operations", 
                        True, 
                        f"Retrieved {len(operations)} operations for vehicle {VEHICLE_ID}",
                        {"operations_count": len(operations), "operations": operations}
                    )
                    return operations
                else:
                    self.log_test(
                        "Get Vehicle Operations", 
                        False, 
                        f"Expected list, got {type(operations)}",
                        {"response": operations}
                    )
                    return []
            else:
                self.log_test(
                    "Get Vehicle Operations", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return []
        except Exception as e:
            self.log_test(
                "Get Vehicle Operations", 
                False, 
                f"Exception: {str(e)}",
                {"exception": str(e)}
            )
            return []
    
    def test_get_vehicle_details(self):
        """Test: Get vehicle details to check parts field"""
        try:
            url = f"{BACKEND_URL}/vehicles/{VEHICLE_ID}"
            response = self.session.get(url)
            
            if response.status_code == 200:
                vehicle = response.json()
                parts = vehicle.get('parts', [])
                self.log_test(
                    "Get Vehicle Details", 
                    True, 
                    f"Vehicle has {len(parts)} parts",
                    {"vehicle": vehicle, "parts": parts}
                )
                return vehicle
            else:
                self.log_test(
                    "Get Vehicle Details", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
        except Exception as e:
            self.log_test(
                "Get Vehicle Details", 
                False, 
                f"Exception: {str(e)}",
                {"exception": str(e)}
            )
            return None
    
    def test_update_vehicle_with_parts(self):
        """Test: Update vehicle with new parts to trigger operation creation"""
        try:
            # First get current vehicle
            vehicle = self.test_get_vehicle_details()
            if not vehicle:
                return None
                
            # Add a new part to the vehicle
            new_part = {
                "itemType": "service",
                "name": "اختبار ربط البنود",
                "quantity": 1,
                "price": 75.0,
                "total": 75.0,
                "addedAt": datetime.now().isoformat()
            }
            
            current_parts = vehicle.get('parts', [])
            updated_parts = current_parts + [new_part]
            
            # Update vehicle with new parts
            url = f"{BACKEND_URL}/vehicles/{VEHICLE_ID}"
            update_data = {
                "parts": updated_parts
            }
            
            response = self.session.put(url, json=update_data)
            
            if response.status_code == 200:
                updated_vehicle = response.json()
                self.log_test(
                    "Update Vehicle Parts", 
                    True, 
                    f"Vehicle updated with {len(updated_vehicle.get('parts', []))} parts",
                    {"updated_vehicle": updated_vehicle, "new_part": new_part}
                )
                return updated_vehicle
            else:
                self.log_test(
                    "Update Vehicle Parts", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
        except Exception as e:
            self.log_test(
                "Update Vehicle Parts", 
                False, 
                f"Exception: {str(e)}",
                {"exception": str(e)}
            )
            return None
    
    def test_create_operation(self):
        """Test 3: Create new operation"""
        try:
            operation_data = {
                "vehicleId": VEHICLE_ID,
                "type": "sale",
                "partnerType": "customer",
                "partnerName": "عميل اختبار",
                "items": [
                    {
                        "itemType": "service",
                        "name": "خدمة اختبار",
                        "quantity": 1,
                        "price": 100,
                        "total": 100
                    }
                ],
                "paymentMethod": "cash",
                "notes": "اختبار إنشاء عملية"
            }
            
            url = f"{BACKEND_URL}/operations"
            response = self.session.post(url, json=operation_data)
            
            if response.status_code == 200:
                operation = response.json()
                self.log_test(
                    "Create Operation", 
                    True, 
                    f"Operation created with ID: {operation.get('id')}",
                    {"operation": operation}
                )
                return operation
            else:
                self.log_test(
                    "Create Operation", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
        except Exception as e:
            self.log_test(
                "Create Operation", 
                False, 
                f"Exception: {str(e)}",
                {"exception": str(e)}
            )
            return None
    
    def test_update_operation(self, operation_id):
        """Test 2: Update existing operation"""
        try:
            update_data = {
                "vehicleId": VEHICLE_ID,
                "type": "sale",
                "partnerType": "customer",
                "partnerName": CUSTOMER_NAME,
                "items": [
                    {
                        "itemType": "service",
                        "name": "اختبار تحديث",
                        "quantity": 1,
                        "price": 50,
                        "total": 50
                    }
                ],
                "paymentMethod": "cash",
                "notes": "اختبار تحديث العملية"
            }
            
            url = f"{BACKEND_URL}/operations/{operation_id}"
            response = self.session.put(url, json=update_data)
            
            if response.status_code == 200:
                operation = response.json()
                self.log_test(
                    "Update Operation", 
                    True, 
                    f"Operation {operation_id} updated successfully",
                    {"operation": operation}
                )
                return operation
            else:
                self.log_test(
                    "Update Operation", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
        except Exception as e:
            self.log_test(
                "Update Operation", 
                False, 
                f"Exception: {str(e)}",
                {"exception": str(e)}
            )
            return None
    
    def test_auto_sync_feature(self):
        """Test the main feature: Auto-sync between vehicle parts and operations"""
        print("\n=== Testing Vehicle-Operations Auto-Sync Feature ===")
        
        # Step 1: Get initial state
        print("\n1. Getting initial state...")
        initial_operations = self.test_get_vehicle_operations()
        initial_vehicle = self.test_get_vehicle_details()
        
        # Step 2: Update vehicle with new parts (should trigger operation creation/update)
        print("\n2. Testing vehicle parts update...")
        updated_vehicle = self.test_update_vehicle_with_parts()
        
        # Step 3: Check if operation was created/updated
        print("\n3. Checking for auto-created/updated operations...")
        updated_operations = self.test_get_vehicle_operations()
        
        # Step 4: Analyze the auto-sync behavior
        if len(updated_operations) > len(initial_operations):
            self.log_test(
                "Auto-Sync: Operation Creation", 
                True, 
                f"New operation created automatically ({len(updated_operations)} vs {len(initial_operations)})",
                {"initial_count": len(initial_operations), "updated_count": len(updated_operations)}
            )
        elif len(updated_operations) == len(initial_operations) and len(updated_operations) > 0:
            # Check if existing operation was updated
            latest_op = updated_operations[0] if updated_operations else None
            if latest_op and latest_op.get('date'):
                try:
                    op_date = datetime.fromisoformat(latest_op['date'].replace('Z', '+00:00'))
                    if (datetime.now() - op_date.replace(tzinfo=None)).total_seconds() < 300:  # Updated in last 5 minutes
                        self.log_test(
                            "Auto-Sync: Operation Update", 
                            True, 
                            "Existing operation updated automatically",
                            {"updated_operation": latest_op}
                        )
                    else:
                        self.log_test(
                            "Auto-Sync: No Recent Update", 
                            False, 
                            "No recent operation update detected",
                            {"latest_operation_date": latest_op.get('date')}
                        )
                except:
                    self.log_test(
                        "Auto-Sync: Date Parse Error", 
                        False, 
                        "Could not parse operation date",
                        {"latest_operation": latest_op}
                    )
            else:
                self.log_test(
                    "Auto-Sync: No Operation Found", 
                    False, 
                    "No operations found for vehicle",
                    {"operations": updated_operations}
                )
        else:
            self.log_test(
                "Auto-Sync: No Auto-Creation", 
                False, 
                "No automatic operation creation detected",
                {"initial_count": len(initial_operations), "updated_count": len(updated_operations)}
            )
    
    def test_manual_operations(self):
        """Test manual operation creation and update"""
        print("\n=== Testing Manual Operations ===")
        
        # Test creating a new operation
        print("\n1. Creating new operation...")
        new_operation = self.test_create_operation()
        
        if new_operation and new_operation.get('id'):
            # Test updating the operation
            print("\n2. Updating operation...")
            self.test_update_operation(new_operation['id'])
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Vehicle-Operations Integration Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Vehicle ID: {VEHICLE_ID}")
        print(f"Customer: {CUSTOMER_NAME}")
        print(f"Plate: {PLATE_NUMBER}")
        
        try:
            # Test the auto-sync feature (main requirement)
            self.test_auto_sync_feature()
            
            # Test manual operations
            self.test_manual_operations()
            
        except Exception as e:
            print(f"❌ Test suite failed with exception: {e}")
            self.log_test("Test Suite", False, f"Exception: {str(e)}", {"exception": str(e)})
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%" if self.test_results else "0%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n📝 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"  {status} {result['test']}: {result['message']}")
        
        # Save results to file
        with open('/app/test_results_vehicle_operations.json', 'w', encoding='utf-8') as f:
            json.dump(self.test_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 Detailed results saved to: /app/test_results_vehicle_operations.json")

if __name__ == "__main__":
    tester = VehicleOperationsTest()
    tester.run_all_tests()