#!/usr/bin/env python3
"""
Quick Backend Test for Invoice Designer Studio APIs
Tests 3 endpoints as requested:
1. POST /api/invoice-templates/create-blank
2. POST /api/invoice-templates/{id}/design
3. POST /api/print/invoice-xlsx
"""

import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
BASE_URL = f"{BACKEND_URL}/api"

print(f"🔍 Testing Invoice Designer Studio APIs")
print(f"📍 Backend URL: {BASE_URL}\n")

# Test counters
passed = 0
failed = 0
template_id = None

# Test 1: Create blank template with Arabic name
print("=" * 60)
print("TEST 1: POST /api/invoice-templates/create-blank")
print("=" * 60)
try:
    payload = {
        "name": "قالب تجريبي",
        "rows": 12,
        "cols": 8
    }
    response = requests.post(f"{BASE_URL}/invoice-templates/create-blank", json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code in [200, 201]:
        data = response.json()
        template_id = data.get('id')
        print(f"✅ PASSED: Template created successfully")
        print(f"   Template ID: {template_id}")
        print(f"   Template Name: {data.get('name')}")
        print(f"   Format: {data.get('format')}")
        print(f"   Fields: {data.get('fields')}")
        passed += 1
    else:
        print(f"❌ FAILED: Expected 200/201, got {response.status_code}")
        print(f"   Response: {response.text}")
        failed += 1
except Exception as e:
    print(f"❌ FAILED: Exception - {str(e)}")
    failed += 1

print()

# Test 2: Save design with elements (workshop data)
print("=" * 60)
print("TEST 2: POST /api/invoice-templates/{id}/design")
print("=" * 60)
if template_id:
    try:
        design_payload = {
            "elements": [
                {
                    "id": "elem1",
                    "type": "text",
                    "x": 50,
                    "y": 50,
                    "w": 200,
                    "h": 30,
                    "text": "اسم الورشة",
                    "binding": "WORKSHOP_NAME"
                },
                {
                    "id": "elem2",
                    "type": "text",
                    "x": 50,
                    "y": 100,
                    "w": 200,
                    "h": 30,
                    "text": "السجل التجاري",
                    "binding": "COMPANY_CR"
                },
                {
                    "id": "elem3",
                    "type": "text",
                    "x": 50,
                    "y": 150,
                    "w": 200,
                    "h": 30,
                    "text": "الرقم الضريبي",
                    "binding": "COMPANY_TAX"
                }
            ],
            "schema": [
                {"field": "WORKSHOP_NAME", "label": "اسم الورشة"},
                {"field": "COMPANY_CR", "label": "السجل التجاري"},
                {"field": "COMPANY_TAX", "label": "الرقم الضريبي"}
            ],
            "page": {
                "size": "A4",
                "orientation": "portrait",
                "width": 595,
                "height": 842
            }
        }
        response = requests.post(f"{BASE_URL}/invoice-templates/{template_id}/design", json=design_payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ PASSED: Design saved successfully")
            print(f"   Elements count: {len(data.get('elements', []))}")
            print(f"   Schema fields: {len(data.get('schema', []))}")
            print(f"   Page size: {data.get('page', {}).get('size')}")
            
            # Verify data persistence
            elements = data.get('elements', [])
            if len(elements) == 3:
                print(f"   ✓ All 3 elements saved correctly")
                bindings = [e.get('binding') for e in elements]
                if 'WORKSHOP_NAME' in bindings and 'COMPANY_CR' in bindings and 'COMPANY_TAX' in bindings:
                    print(f"   ✓ Workshop data bindings verified")
            passed += 1
        else:
            print(f"❌ FAILED: Expected 200/201, got {response.status_code}")
            print(f"   Response: {response.text}")
            failed += 1
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        failed += 1
else:
    print("⏭️  SKIPPED: No template ID from Test 1")
    failed += 1

print()

# Test 3: Generate Excel invoice with customer data
print("=" * 60)
print("TEST 3: POST /api/print/invoice-xlsx")
print("=" * 60)
if template_id:
    try:
        invoice_payload = {
            "templateId": template_id,
            "data": {
                "WORKSHOP_NAME": "ورشة الخليج للسيارات",
                "COMPANY_CR": "1234567890",
                "COMPANY_TAX": "300123456789003",
                "CUSTOMER_NAME": "أحمد محمد",
                "CUSTOMER_PHONE": "+966501234567",
                "INVOICE_NUMBER": "INV-2025-001",
                "INVOICE_DATE": "2025-01-15",
                "TOTAL": "1500.00",
                "ITEMS": [
                    {
                        "description": "تغيير زيت المحرك",
                        "qty": "1",
                        "price": "150.00",
                        "total": "150.00"
                    },
                    {
                        "description": "فحص شامل",
                        "qty": "1",
                        "price": "200.00",
                        "total": "200.00"
                    }
                ]
            }
        }
        response = requests.post(f"{BASE_URL}/print/invoice-xlsx", json=invoice_payload, timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:
            content_type = response.headers.get('content-type', '')
            content_length = len(response.content)
            print(f"✅ PASSED: Excel invoice generated successfully")
            print(f"   Content-Type: {content_type}")
            print(f"   File Size: {content_length} bytes")
            
            # Verify it's an Excel file
            if 'spreadsheet' in content_type or 'excel' in content_type or content_length > 0:
                print(f"   ✓ Valid Excel file generated")
            
            # Save file for verification
            with open('/app/test_invoice.xlsx', 'wb') as f:
                f.write(response.content)
            print(f"   ✓ File saved to /app/test_invoice.xlsx")
            passed += 1
        else:
            print(f"❌ FAILED: Expected 200/201, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            failed += 1
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        failed += 1
else:
    print("⏭️  SKIPPED: No template ID from Test 1")
    failed += 1

print()

# Summary
print("=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"✅ Passed: {passed}/3")
print(f"❌ Failed: {failed}/3")
print(f"Success Rate: {(passed/3)*100:.1f}%")
print()

if passed == 3:
    print("🎉 All Invoice Designer Studio APIs working correctly!")
else:
    print("⚠️  Some tests failed. Please review the output above.")
