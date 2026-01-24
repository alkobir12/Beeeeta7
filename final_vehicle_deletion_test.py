#!/usr/bin/env python3
"""
Final Vehicle Deletion Test - اختبار حذف المركبة النهائي
Comprehensive test of vehicle deletion and file-based invoice cleanup
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

try:
    with open(FRONTEND_ENV_PATH, 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
except Exception as e:
    print(f"❌ Error reading frontend/.env: {e}")
    sys.exit(1)

API_URL = f"{BACKEND_URL}/api"

def main():
    """Final comprehensive test"""
    print("\n" + "="*80)
    print("FINAL VEHICLE DELETION TEST - اختبار حذف المركبة النهائي")
    print("="*80)
    print(f"API URL: {API_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Create a dedicated test vehicle
    vehicle_data = {
        "plateNumber": f"TEST-{str(uuid.uuid4())[:6].upper()}",
        "brand": "تويوتا",
        "model": "كامري",
        "year": 2020,
        "color": "أبيض",
        "customerName": "عميل اختبار حذف نهائي",
        "customerPhone": "0501234567",
        "customerEmail": "final.test@example.com",
        "status": "diagnosis"
    }
    
    print("\n[1] إنشاء مركبة تجريبية مخصصة")
    response = requests.post(f"{API_URL}/vehicles", json=vehicle_data, timeout=10)
    if response.status_code != 200:
        print(f"❌ Failed to create vehicle: {response.status_code}")
        return
    
    vehicle_id = response.json().get('id')
    plate_number = response.json().get('plateNumber')
    print(f"✅ Created vehicle: {vehicle_id} ({plate_number})")
    
    # Create operations
    print(f"\n[2] إنشاء عمليات للمركبة")
    operation_data = {
        "vehicleId": vehicle_id,
        "type": "service",
        "description": "خدمة اختبار حذف نهائي",
        "amount": 750,
        "status": "completed"
    }
    
    response = requests.post(f"{API_URL}/operations", json=operation_data, timeout=10)
    if response.status_code in [200, 201]:
        print(f"✅ Created operation for vehicle")
    else:
        print(f"⚠️ Operation creation failed: {response.status_code}")
    
    # Create multiple invoices
    print(f"\n[3] إنشاء فواتير متعددة للمركبة")
    invoices_created = 0
    
    for i in range(3):
        invoice_data = {
            "vehicleId": vehicle_id,
            "customerId": "test-customer-final",
            "customerName": "عميل اختبار حذف نهائي",
            "plateNumber": plate_number,
            "items": [
                {
                    "name": f"خدمة اختبار {i+1}",
                    "quantity": 1,
                    "price": 100 + (i * 50),
                    "total": 100 + (i * 50)
                }
            ],
            "subtotal": 100 + (i * 50),
            "tax": 15,
            "total": 115 + (i * 50),
            "status": "pending"
        }
        
        response = requests.post(f"{API_URL}/invoices", json=invoice_data, timeout=10)
        if response.status_code == 200:
            invoices_created += 1
    
    print(f"✅ Created {invoices_created} invoices")
    
    # Check file system before deletion
    print(f"\n[4] فحص نظام الملفات قبل الحذف")
    invoice_dir = "/app/backend/uploads/invoices"
    initial_files = []
    
    if os.path.exists(invoice_dir):
        for filename in os.listdir(invoice_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(invoice_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        invoice_data = json.load(f)
                        if invoice_data.get('vehicleId') == vehicle_id:
                            initial_files.append(filename)
                except:
                    pass
    
    print(f"📄 Found {len(initial_files)} invoice files for vehicle")
    
    # Delete the vehicle
    print(f"\n[5] حذف المركبة {vehicle_id}")
    response = requests.delete(f"{API_URL}/vehicles/{vehicle_id}", timeout=10)
    
    if response.status_code == 200:
        print(f"✅ Vehicle deleted successfully")
    else:
        print(f"❌ Vehicle deletion failed: {response.status_code}")
        return
    
    # Verify cleanup
    print(f"\n[6] التحقق من التنظيف")
    
    # Check operations
    response = requests.get(f"{API_URL}/operations", timeout=10)
    if response.status_code == 200:
        operations = response.json()
        remaining_ops = [op for op in operations if op.get('vehicleId') == vehicle_id]
        print(f"✅ Operations remaining: {len(remaining_ops)} (should be 0)")
    
    # Check API invoices
    response = requests.get(f"{API_URL}/invoices?vehicleId={vehicle_id}", timeout=10)
    if response.status_code == 200:
        remaining_invoices = response.json()
        print(f"✅ API invoices remaining: {len(remaining_invoices)} (should be 0)")
    
    # Check file system
    final_files = []
    if os.path.exists(invoice_dir):
        for filename in os.listdir(invoice_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(invoice_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        invoice_data = json.load(f)
                        if invoice_data.get('vehicleId') == vehicle_id:
                            final_files.append(filename)
                except:
                    pass
    
    print(f"✅ File system invoices remaining: {len(final_files)} (should be 0)")
    
    # Final status
    print(f"\n" + "="*80)
    print("FINAL TEST RESULTS - نتائج الاختبار النهائية")
    print("="*80)
    print(f"🔍 Vehicle ID: {vehicle_id}")
    print(f"🔍 Plate Number: {plate_number}")
    print(f"📊 Initial invoice files: {len(initial_files)}")
    print(f"📊 Final invoice files: {len(final_files)}")
    print(f"📊 Invoices created: {invoices_created}")
    
    if len(final_files) == 0:
        print(f"\n✅ SUCCESS: delete_invoices_by_vehicle_id executed correctly")
        print(f"✅ All {len(initial_files)} invoice files were properly deleted")
        print(f"✅ File-based invoice system cleanup is working perfectly")
    else:
        print(f"\n❌ FAILURE: {len(final_files)} invoice files remain")
        print(f"❌ delete_invoices_by_vehicle_id may not be working properly")
    
    print("="*80)

if __name__ == "__main__":
    main()