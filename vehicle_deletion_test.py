#!/usr/bin/env python3
"""
Vehicle Deletion Impact Testing - اختبار حذف المركبة وتأثيره على الفواتير والعمليات
Tests vehicle deletion and its impact on file-based invoices and operations
"""

import requests
import json
import sys
import os
from datetime import datetime
import uuid

# Get backend URL from frontend/.env
FRONTEND_ENV_PATH = "/app/frontend/.env"
BACKEND_URL = None

# Read REACT_APP_BACKEND_URL from frontend/.env
try:
    with open(FRONTEND_ENV_PATH, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
except Exception as e:
    print(f"❌ Error reading frontend/.env: {e}")
    sys.exit(1)

if not BACKEND_URL:
    print("❌ REACT_APP_BACKEND_URL not found in frontend/.env")
    sys.exit(1)

API_URL = f"{BACKEND_URL}/api"
print(f"🔗 API URL: {API_URL}")

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "total": 0
}

def log_test(name, passed, details=""):
    """Log test result"""
    test_results["total"] += 1
    if passed:
        test_results["passed"].append(name)
        print(f"✅ {name}")
        if details:
            print(f"   {details}")
    else:
        test_results["failed"].append(name)
        print(f"❌ {name}")
        if details:
            print(f"   {details}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY - ملخص الاختبار")
    print("="*80)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {len(test_results['passed'])} ✅")
    print(f"Failed: {len(test_results['failed'])} ❌")
    
    if test_results['failed']:
        print("\nFailed Tests:")
        for test in test_results['failed']:
            print(f"  - {test}")
    
    print("="*80)

def check_file_system_invoices(vehicle_id):
    """Check if invoice files exist for a vehicle in /app/backend/uploads/invoices"""
    invoice_dir = "/app/backend/uploads/invoices"
    if not os.path.exists(invoice_dir):
        return []
    
    invoice_files = []
    for filename in os.listdir(invoice_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(invoice_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    invoice_data = json.load(f)
                    if invoice_data.get('vehicleId') == vehicle_id:
                        invoice_files.append(filename)
            except Exception as e:
                print(f"   ⚠️ Error reading {filename}: {e}")
    
    return invoice_files

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("اختبار حذف المركبة وتأثيره على الفواتير والعمليات")
    print("VEHICLE DELETION IMPACT TESTING")
    print("="*80)
    print(f"API URL: {API_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Step 1: Get or create a test vehicle
    print("\n[1] إنشاء أو الحصول على مركبة تجريبية - Creating or getting test vehicle")
    
    vehicle_id = None
    
    # First, try to get existing vehicles
    try:
        response = requests.get(f"{API_URL}/vehicles", timeout=10)
        if response.status_code == 200:
            vehicles = response.json()
            if vehicles:
                # Use the first vehicle for testing
                vehicle_id = vehicles[0].get('id')
                plate_number = vehicles[0].get('plateNumber', 'N/A')
                log_test("Get existing vehicle", True, f"Using vehicle ID: {vehicle_id}, Plate: {plate_number}")
            else:
                print("   No existing vehicles found, will create new one")
        else:
            print(f"   ⚠️ Failed to get vehicles: {response.status_code}")
    except Exception as e:
        print(f"   ⚠️ Error getting vehicles: {e}")
    
    # If no existing vehicle, create a new one
    if not vehicle_id:
        vehicle_data = {
            "plateNumber": f"DEL-{str(uuid.uuid4())[:6].upper()}",
            "brand": "تويوتا",
            "model": "كامري",
            "year": 2020,
            "color": "أبيض",
            "customerName": "عميل حذف تجريبي",
            "customerPhone": "0501234567",
            "customerEmail": "delete.test@example.com",
            "status": "diagnosis"
        }
        
        try:
            response = requests.post(f"{API_URL}/vehicles", json=vehicle_data, timeout=10)
            if response.status_code == 200:
                vehicle_data_response = response.json()
                vehicle_id = vehicle_data_response.get('id')
                log_test("Create test vehicle", True, f"Created vehicle ID: {vehicle_id}")
            else:
                log_test("Create test vehicle", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
                print("❌ Cannot proceed without a vehicle")
                return
        except Exception as e:
            log_test("Create test vehicle", False, f"Error: {str(e)}")
            print("❌ Cannot proceed without a vehicle")
            return
    
    # Step 2: Check if operations endpoint exists and create operations
    print(f"\n[2] إنشاء عمليات مرتبطة بالمركبة - Creating operations for vehicle {vehicle_id}")
    
    operations_created = False
    try:
        # Try to get existing operations first
        response = requests.get(f"{API_URL}/operations", timeout=10)
        if response.status_code == 200:
            operations = response.json()
            existing_ops = [op for op in operations if op.get('vehicleId') == vehicle_id]
            if existing_ops:
                log_test("Check existing operations", True, f"Found {len(existing_ops)} existing operations for vehicle")
                operations_created = True
            else:
                print("   No existing operations found for this vehicle")
        else:
            print(f"   Operations endpoint returned: {response.status_code}")
    except Exception as e:
        print(f"   Operations endpoint error: {e}")
    
    # Try to create new operations if none exist
    if not operations_created:
        operation_data = {
            "vehicleId": vehicle_id,
            "type": "service",
            "description": "خدمة حذف تجريبية",
            "amount": 500,
            "status": "completed"
        }
        
        try:
            response = requests.post(f"{API_URL}/operations", json=operation_data, timeout=10)
            if response.status_code in [200, 201]:
                log_test("Create operation", True, f"Created operation for vehicle {vehicle_id}")
                operations_created = True
            else:
                log_test("Create operation", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("Create operation", False, f"Error: {str(e)}")
    
    # Step 3: Create file-based invoice
    print(f"\n[3] إنشاء فاتورة ملفية للمركبة - Creating file-based invoice for vehicle {vehicle_id}")
    
    invoice_data = {
        "vehicleId": vehicle_id,
        "customerId": "test-customer",
        "customerName": "عميل حذف تجريبي",
        "plateNumber": "DEL-123",
        "items": [
            {
                "name": "خدمة حذف",
                "quantity": 1,
                "price": 100,
                "total": 100
            }
        ],
        "subtotal": 100,
        "tax": 15,
        "total": 115,
        "status": "pending"
    }
    
    invoice_id = None
    try:
        response = requests.post(f"{API_URL}/invoices", json=invoice_data, timeout=10)
        if response.status_code == 200:
            invoice_response = response.json()
            invoice_id = invoice_response.get('id')
            log_test("Create file-based invoice", True, f"Created invoice ID: {invoice_id}")
            
            # Check if JSON file was created
            invoice_files = check_file_system_invoices(vehicle_id)
            if invoice_files:
                log_test("Verify invoice file creation", True, f"Found {len(invoice_files)} invoice files: {invoice_files}")
            else:
                log_test("Verify invoice file creation", False, "No invoice files found in /app/backend/uploads/invoices")
        else:
            log_test("Create file-based invoice", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("Create file-based invoice", False, f"Error: {str(e)}")
    
    # Step 4: Record initial state before deletion
    print(f"\n[4] تسجيل الحالة الأولية قبل الحذف - Recording initial state before deletion")
    
    initial_operations_count = 0
    initial_invoice_files = []
    
    # Count operations for this vehicle
    try:
        response = requests.get(f"{API_URL}/operations", timeout=10)
        if response.status_code == 200:
            operations = response.json()
            vehicle_operations = [op for op in operations if op.get('vehicleId') == vehicle_id]
            initial_operations_count = len(vehicle_operations)
            print(f"   Initial operations count: {initial_operations_count}")
        else:
            print(f"   Could not get operations: {response.status_code}")
    except Exception as e:
        print(f"   Error getting operations: {e}")
    
    # Count invoice files
    initial_invoice_files = check_file_system_invoices(vehicle_id)
    print(f"   Initial invoice files: {len(initial_invoice_files)} files")
    
    # Step 5: Delete the vehicle
    print(f"\n[5] حذف المركبة - Deleting vehicle {vehicle_id}")
    
    try:
        response = requests.delete(f"{API_URL}/vehicles/{vehicle_id}", timeout=10)
        if response.status_code == 200:
            delete_response = response.json()
            log_test("Delete vehicle", True, f"Vehicle deleted successfully: {delete_response}")
        else:
            log_test("Delete vehicle", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            print("❌ Cannot proceed with verification - vehicle deletion failed")
            return
    except Exception as e:
        log_test("Delete vehicle", False, f"Error: {str(e)}")
        print("❌ Cannot proceed with verification - vehicle deletion failed")
        return
    
    # Step 6: Verify operations are deleted/reduced
    print(f"\n[6] التحقق من حذف العمليات المرتبطة - Verifying operations deletion")
    
    try:
        response = requests.get(f"{API_URL}/operations", timeout=10)
        if response.status_code == 200:
            operations = response.json()
            remaining_vehicle_operations = [op for op in operations if op.get('vehicleId') == vehicle_id]
            final_operations_count = len(remaining_vehicle_operations)
            
            if final_operations_count < initial_operations_count:
                log_test("Verify operations deletion", True, 
                        f"Operations reduced from {initial_operations_count} to {final_operations_count}")
            elif initial_operations_count == 0 and final_operations_count == 0:
                log_test("Verify operations deletion", True, "No operations existed, none remain")
            else:
                log_test("Verify operations deletion", False, 
                        f"Operations count unchanged: {initial_operations_count} -> {final_operations_count}")
        else:
            log_test("Verify operations deletion", False, f"Could not verify operations: {response.status_code}")
    except Exception as e:
        log_test("Verify operations deletion", False, f"Error: {str(e)}")
    
    # Step 7: Verify invoice files are deleted from file system
    print(f"\n[7] التحقق من حذف ملفات الفواتير - Verifying invoice files deletion")
    
    final_invoice_files = check_file_system_invoices(vehicle_id)
    
    if len(final_invoice_files) < len(initial_invoice_files):
        log_test("Verify invoice files deletion", True, 
                f"Invoice files reduced from {len(initial_invoice_files)} to {len(final_invoice_files)}")
    elif len(initial_invoice_files) == 0 and len(final_invoice_files) == 0:
        log_test("Verify invoice files deletion", True, "No invoice files existed, none remain")
    else:
        log_test("Verify invoice files deletion", False, 
                f"Invoice files count unchanged: {len(initial_invoice_files)} -> {len(final_invoice_files)}")
        if final_invoice_files:
            print(f"   Remaining files: {final_invoice_files}")
    
    # Step 8: Verify via API that invoices are deleted
    print(f"\n[8] التحقق عبر API من حذف الفواتير - Verifying invoice deletion via API")
    
    try:
        response = requests.get(f"{API_URL}/invoices?vehicleId={vehicle_id}", timeout=10)
        if response.status_code == 200:
            remaining_invoices = response.json()
            if isinstance(remaining_invoices, list) and len(remaining_invoices) == 0:
                log_test("Verify API invoice deletion", True, "No invoices returned for deleted vehicle")
            else:
                log_test("Verify API invoice deletion", False, 
                        f"Still found {len(remaining_invoices)} invoices for deleted vehicle")
        else:
            log_test("Verify API invoice deletion", False, f"API error: {response.status_code}")
    except Exception as e:
        log_test("Verify API invoice deletion", False, f"Error: {str(e)}")
    
    # Step 9: Verify delete_invoices_by_vehicle_id function execution
    print(f"\n[9] التحقق من تنفيذ delete_invoices_by_vehicle_id - Verifying delete_invoices_by_vehicle_id execution")
    
    # Check backend logs for confirmation
    try:
        import subprocess
        result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.out.log'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            log_content = result.stdout
            if f"delete_invoices_by_vehicle_id" in log_content or f"cleanup" in log_content.lower():
                log_test("Verify cleanup function execution", True, "Found cleanup references in backend logs")
            else:
                log_test("Verify cleanup function execution", False, "No cleanup references found in logs")
        else:
            log_test("Verify cleanup function execution", False, "Could not read backend logs")
    except Exception as e:
        log_test("Verify cleanup function execution", False, f"Error checking logs: {str(e)}")
    
    # Print summary
    print_summary()
    
    # Final status report
    print("\n" + "="*80)
    print("FINAL STATUS REPORT - تقرير الحالة النهائية")
    print("="*80)
    
    print(f"🔍 Vehicle ID tested: {vehicle_id}")
    print(f"📊 Initial operations: {initial_operations_count}")
    print(f"📄 Initial invoice files: {len(initial_invoice_files)}")
    print(f"📄 Final invoice files: {len(final_invoice_files)}")
    
    if len(test_results['failed']) == 0:
        print("\n✅ SUCCESS: Vehicle deletion and cleanup working correctly")
        print("✅ delete_invoices_by_vehicle_id function executed properly")
        print("✅ No invoices remain for the deleted vehicle")
    else:
        print(f"\n❌ ISSUES FOUND: {len(test_results['failed'])} tests failed")
        print("❌ Vehicle deletion cleanup may not be working properly")
    
    print("="*80)
    
    # Exit with appropriate code
    if test_results['failed']:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()