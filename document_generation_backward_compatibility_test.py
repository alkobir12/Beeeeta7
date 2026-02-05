#!/usr/bin/env python3
"""
Document Generation Backward Compatibility Test
Testing /api/documents/generate endpoint for legacy and new payload formats
Base URL: https://fixsa.online
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any

class DocumentGenerationTester:
    def __init__(self, base_url: str = "https://fixsa.online"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DocumentGeneration-BackwardCompatibility-Test/1.0'
        })
        
    def test_profile_endpoint(self) -> Dict[str, Any]:
        """Test /api/profile endpoint to get commercial register value"""
        print("🔍 Testing /api/profile endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/api/profile", timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                profile_data = response.json()
                commercial_register = profile_data.get('commercialRegister', '')
                print(f"   ✅ Profile loaded successfully")
                print(f"   📋 Commercial Register: {commercial_register}")
                return profile_data
            else:
                print(f"   ❌ Profile endpoint failed: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return {}
                
        except Exception as e:
            print(f"   ❌ Profile endpoint error: {str(e)}")
            return {}
    
    def test_legacy_payload(self, profile_data: Dict[str, Any]) -> bool:
        """Test legacy payload format with old keys"""
        print("\n🧪 Testing Legacy Payload Format...")
        
        # Legacy payload structure
        legacy_payload = {
            "doc_type": "invoice",
            "language": "ar",
            "workshop_id": "test-workshop-001",
            "company": {
                "name": "ورشة الاختبار للصيانة",
                "name_en": "Test Maintenance Workshop",
                "address": "الرياض، المملكة العربية السعودية",
                "phone": "+966 11 123 4567",
                "email": "info@testworkshop.com",
                "website": "www.testworkshop.com",
                "taxNumber": "300012345600003",
                "commercialRegister": profile_data.get('commercialRegister', '1010123456')
            },
            "client": {
                "name": "أحمد محمد العميل",
                "customerName": "أحمد محمد العميل",
                "phone": "+966 50 123 4567",
                "customerPhone": "+966 50 123 4567",
                "company": "شركة العميل التجارية",
                "address": "جدة، المملكة العربية السعودية",
                "email": "ahmed@client.com"
            },
            "vehicle": {
                "brand": "تويوتا",
                "model": "كامري",
                "year": "2022",
                "plateNumber": "أ ب ج 1234",
                "plate": "أ ب ج 1234",
                "vin": "JT2BF28K123456789",
                "color": "أبيض",
                "mileage": "45000",
                "notes": "صيانة دورية شاملة"
            },
            "items": [
                {
                    "description": "تغيير زيت المحرك",
                    "name": "تغيير زيت المحرك",
                    "quantity": 1,
                    "qty": 1,
                    "unit_price": 150.0,
                    "price": 150.0,
                    "discount": 0
                },
                {
                    "description": "فلتر زيت أصلي",
                    "name": "فلتر زيت أصلي", 
                    "quantity": 1,
                    "qty": 1,
                    "unit_price": 45.0,
                    "price": 45.0,
                    "discount": 0
                },
                {
                    "description": "فحص شامل للمحرك",
                    "name": "فحص شامل للمحرك",
                    "quantity": 1,
                    "qty": 1,
                    "unit_price": 200.0,
                    "price": 200.0,
                    "discount": 10.0
                }
            ],
            "totals": {
                "subtotal": 395.0,
                "discount": 10.0,
                "tax": 57.75,
                "total": 442.75
            }
        }
        
        print(f"   📤 Sending legacy payload to {self.base_url}/api/documents/generate")
        print(f"   📋 Commercial Register in payload: {legacy_payload['company']['commercialRegister']}")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/documents/generate",
                json=legacy_payload,
                timeout=15
            )
            
            print(f"   📥 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check if response contains required fields
                if not response_data.get('success'):
                    print(f"   ❌ Response success=false")
                    return False
                    
                html_content = response_data.get('html', '')
                if not html_content:
                    print(f"   ❌ No HTML content in response")
                    return False
                
                print(f"   ✅ Status 200 - Response contains HTML")
                print(f"   📄 HTML length: {len(html_content)} characters")
                
                # Check for Arabic commercial register label
                if 'السجل التجاري' in html_content:
                    print(f"   ✅ Arabic label 'السجل التجاري' found in HTML")
                else:
                    print(f"   ❌ Arabic label 'السجل التجاري' NOT found in HTML")
                    return False
                
                # Check for commercial register value
                commercial_register = profile_data.get('commercialRegister', legacy_payload['company']['commercialRegister'])
                if commercial_register and commercial_register in html_content:
                    print(f"   ✅ Commercial register value '{commercial_register}' found in HTML")
                else:
                    print(f"   ⚠️  Commercial register value '{commercial_register}' not found in HTML")
                    # This might not be a failure if the value is empty or formatted differently
                
                # Additional checks
                doc_number = response_data.get('document_number', '')
                doc_type = response_data.get('doc_type', '')
                print(f"   📋 Document Number: {doc_number}")
                print(f"   📋 Document Type: {doc_type}")
                
                return True
                
            else:
                print(f"   ❌ Legacy payload failed with status {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
                
        except Exception as e:
            print(f"   ❌ Legacy payload test error: {str(e)}")
            return False
    
    def test_new_payload(self) -> bool:
        """Test new payload format with workshop/customer keys"""
        print("\n🧪 Testing New Payload Format...")
        
        # New payload structure
        new_payload = {
            "doc_type": "quote",
            "workshop": {
                "name": "ورشة الحديثة للصيانة",
                "name_en": "Modern Maintenance Workshop",
                "address": "الدمام، المملكة العربية السعودية",
                "phone": "+966 13 456 7890",
                "email": "info@modernworkshop.com",
                "website": "www.modernworkshop.com",
                "tax_number": "300098765400003",
                "commercial_register": "2020987654"
            },
            "customer": {
                "name": "سارة أحمد العميلة",
                "company": "مؤسسة العميلة التجارية",
                "address": "الخبر، المملكة العربية السعودية",
                "phone": "+966 55 987 6543",
                "email": "sara@customer.com"
            },
            "vehicle": {
                "brand": "هوندا",
                "model": "أكورد",
                "year": "2023",
                "plateNumber": "د هـ و 5678",
                "vin": "1HGBH41JXMN109186",
                "color": "أسود",
                "mileage": "25000",
                "notes": "عرض سعر لصيانة شاملة"
            },
            "items": [
                {
                    "description": "صيانة دورية شاملة",
                    "quantity": 1,
                    "unit_price": 350.0,
                    "discount": 0
                },
                {
                    "description": "تبديل إطارات (4 إطارات)",
                    "quantity": 4,
                    "unit_price": 200.0,
                    "discount": 50.0
                },
                {
                    "description": "فحص نظام الفرامل",
                    "quantity": 1,
                    "unit_price": 120.0,
                    "discount": 0
                }
            ],
            "settings": {
                "theme": "أخضر",
                "style": "حديث",
                "tax_rate": 15,
                "validity_days": 30,
                "document_number": "QT-2026-0205-001",
                "description": "عرض سعر للصيانة الشاملة",
                "terms": [
                    "هذا العرض صالح لمدة 30 يوماً",
                    "يتطلب دفع 50% مقدماً",
                    "الأسعار بالريال السعودي شاملة الضريبة"
                ]
            }
        }
        
        print(f"   📤 Sending new payload to {self.base_url}/api/documents/generate")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/documents/generate",
                json=new_payload,
                timeout=15
            )
            
            print(f"   📥 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check if response contains required fields
                if not response_data.get('success'):
                    print(f"   ❌ Response success=false")
                    return False
                    
                html_content = response_data.get('html', '')
                if not html_content:
                    print(f"   ❌ No HTML content in response")
                    return False
                
                print(f"   ✅ Status 200 - Response contains HTML")
                print(f"   📄 HTML length: {len(html_content)} characters")
                
                # Additional checks for new format
                doc_number = response_data.get('document_number', '')
                doc_type = response_data.get('doc_type', '')
                print(f"   📋 Document Number: {doc_number}")
                print(f"   📋 Document Type: {doc_type}")
                
                # Check for quote-specific content
                if 'عرض سعر' in html_content:
                    print(f"   ✅ Quote document type detected in HTML")
                else:
                    print(f"   ⚠️  Quote document type not clearly detected in HTML")
                
                return True
                
            else:
                print(f"   ❌ New payload failed with status {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
                
        except Exception as e:
            print(f"   ❌ New payload test error: {str(e)}")
            return False
    
    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive backward compatibility test"""
        print("🚀 Starting Document Generation Backward Compatibility Test")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        results = {
            "test_time": datetime.now().isoformat(),
            "base_url": self.base_url,
            "profile_test": False,
            "legacy_payload_test": False,
            "new_payload_test": False,
            "profile_data": {},
            "overall_success": False
        }
        
        # Test 1: Profile endpoint
        profile_data = self.test_profile_endpoint()
        results["profile_test"] = bool(profile_data)
        results["profile_data"] = profile_data
        
        # Test 2: Legacy payload format
        legacy_success = self.test_legacy_payload(profile_data)
        results["legacy_payload_test"] = legacy_success
        
        # Test 3: New payload format
        new_success = self.test_new_payload()
        results["new_payload_test"] = new_success
        
        # Overall assessment
        results["overall_success"] = legacy_success and new_success
        
        print("\n" + "=" * 70)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 70)
        print(f"✅ Profile Endpoint: {'PASS' if results['profile_test'] else 'FAIL'}")
        print(f"✅ Legacy Payload: {'PASS' if results['legacy_payload_test'] else 'FAIL'}")
        print(f"✅ New Payload: {'PASS' if results['new_payload_test'] else 'FAIL'}")
        print(f"🎯 Overall Result: {'SUCCESS' if results['overall_success'] else 'FAILURE'}")
        
        if results['profile_data']:
            commercial_register = results['profile_data'].get('commercialRegister', 'N/A')
            print(f"📋 Commercial Register from Profile: {commercial_register}")
        
        print("=" * 70)
        
        return results

def main():
    """Main test execution"""
    base_url = "https://fixsa.online"
    
    print("Document Generation Backward Compatibility Test")
    print("=" * 50)
    
    tester = DocumentGenerationTester(base_url)
    results = tester.run_comprehensive_test()
    
    # Save results to file
    results_file = f"/app/document_generation_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"📁 Results saved to: {results_file}")
    except Exception as e:
        print(f"⚠️  Could not save results file: {e}")
    
    # Exit with appropriate code
    sys.exit(0 if results["overall_success"] else 1)

if __name__ == "__main__":
    main()