#!/usr/bin/env python3
"""
Settings API Testing for Workshop Management System
Tests the specific requirements from review request:
1. GET /api/settings returns structure with menuConfig.items (>=10 items)
2. POST /api/settings can update language to 'ar' and persists
3. Print/render endpoint returns valid HTML
"""

import requests
import json
import uuid
from datetime import datetime
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
print(f"🔗 Testing Settings API at: {API_URL}")

def test_get_settings_structure():
    """Test 1: GET /api/settings returns structure with menuConfig.items (>=10 items)"""
    print("\n📋 Test 1: GET /api/settings structure verification")
    
    try:
        response = requests.get(f"{API_URL}/settings")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check if menuConfig exists
        if 'menuConfig' not in data:
            print("❌ FAIL: menuConfig not found in response")
            return False
        
        menu_config = data['menuConfig']
        print(f"MenuConfig keys: {list(menu_config.keys())}")
        
        # Check if items exists
        if 'items' not in menu_config:
            print("❌ FAIL: items not found in menuConfig")
            return False
        
        items = menu_config['items']
        items_count = len(items)
        print(f"MenuConfig items count: {items_count}")
        
        # Check if items count >= 10
        if items_count < 10:
            print(f"❌ FAIL: Expected >=10 items, got {items_count}")
            return False
        
        # Print first few items for verification
        print("First 3 menu items:")
        for i, item in enumerate(items[:3]):
            print(f"  {i+1}. {item}")
        
        print(f"✅ PASS: GET /api/settings returns menuConfig with {items_count} items (>=10 required)")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_post_settings_language_persistence():
    """Test 2: POST /api/settings can update language to 'ar' and persists"""
    print("\n🌐 Test 2: POST /api/settings language update and persistence")
    
    try:
        # First, get current settings
        response = requests.get(f"{API_URL}/settings")
        if response.status_code != 200:
            print(f"❌ FAIL: Could not get current settings: {response.status_code}")
            return False
        
        current_settings = response.json()
        print(f"Current language: {current_settings.get('language', 'not set')}")
        
        # Update language to 'ar'
        update_payload = {
            "language": "ar"
        }
        
        print(f"Updating language to 'ar'...")
        response = requests.post(f"{API_URL}/settings", json=update_payload)
        print(f"POST Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: POST request failed with status {response.status_code}")
            if response.text:
                print(f"Error response: {response.text}")
            return False
        
        post_data = response.json()
        print(f"POST response language: {post_data.get('language', 'not set')}")
        
        # Verify language was updated in POST response
        if post_data.get('language') != 'ar':
            print(f"❌ FAIL: POST response language is {post_data.get('language')}, expected 'ar'")
            return False
        
        # Verify persistence by getting settings again
        print("Verifying persistence with GET request...")
        response = requests.get(f"{API_URL}/settings")
        if response.status_code != 200:
            print(f"❌ FAIL: Could not verify persistence: {response.status_code}")
            return False
        
        persisted_data = response.json()
        persisted_language = persisted_data.get('language')
        print(f"Persisted language: {persisted_language}")
        
        if persisted_language != 'ar':
            print(f"❌ FAIL: Language not persisted correctly. Expected 'ar', got '{persisted_language}'")
            return False
        
        print("✅ PASS: Language successfully updated to 'ar' and persisted")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_print_render_html():
    """Test 3: Print/render endpoint returns valid HTML"""
    print("\n🖨️  Test 3: POST /api/print/render returns valid HTML")
    
    try:
        # Test data for rendering
        test_data = {
            "override_type": "invoice",
            "data": {
                "CUSTOMER_NAME": "أحمد الراشد",
                "INVOICE_NUMBER": "INV-20250109-ABC123",
                "DATE": "2025-01-09",
                "TOTAL": "1,250.00",
                "items": [
                    {
                        "name": "تغيير زيت المحرك",
                        "qty": 1,
                        "price": 150.00,
                        "total": 150.00
                    },
                    {
                        "name": "فحص الفرامل",
                        "qty": 1,
                        "price": 100.00,
                        "total": 100.00
                    }
                ]
            }
        }
        
        print(f"Sending render request with Arabic data...")
        response = requests.post(f"{API_URL}/print/render", json=test_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            if response.text:
                print(f"Error response: {response.text}")
            return False
        
        result = response.json()
        print(f"Response keys: {list(result.keys())}")
        
        # Check if html key exists
        if 'html' not in result:
            print("❌ FAIL: 'html' key not found in response")
            return False
        
        html_content = result['html']
        html_length = len(html_content)
        print(f"HTML content length: {html_length} characters")
        
        # Basic HTML validation
        if not html_content:
            print("❌ FAIL: HTML content is empty")
            return False
        
        # Check for basic HTML structure
        html_lower = html_content.lower()
        has_html_tag = '<html' in html_lower
        has_body_tag = '<body' in html_lower
        has_closing_html = '</html>' in html_lower
        
        print(f"HTML structure check:")
        print(f"  - Has <html> tag: {has_html_tag}")
        print(f"  - Has <body> tag: {has_body_tag}")
        print(f"  - Has </html> tag: {has_closing_html}")
        
        if not (has_html_tag and has_body_tag and has_closing_html):
            print("❌ FAIL: HTML structure is incomplete")
            print(f"HTML preview (first 200 chars): {html_content[:200]}...")
            return False
        
        # Check if Arabic content is preserved
        arabic_customer = "أحمد الراشد" in html_content
        arabic_service = "تغيير زيت المحرك" in html_content
        
        print(f"Arabic content check:")
        print(f"  - Customer name preserved: {arabic_customer}")
        print(f"  - Service name preserved: {arabic_service}")
        
        if not (arabic_customer or arabic_service):
            print("⚠️  WARNING: Arabic content may not be preserved properly")
            print(f"HTML preview: {html_content[:300]}...")
        
        print("✅ PASS: Print/render endpoint returns valid HTML structure")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def main():
    """Run all settings tests"""
    print("🧪 Starting Settings API Tests")
    print("=" * 50)
    
    tests = [
        ("GET /api/settings structure", test_get_settings_structure),
        ("POST /api/settings language persistence", test_post_settings_language_persistence),
        ("POST /api/print/render HTML", test_print_render_html)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ CRITICAL ERROR in {test_name}: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)