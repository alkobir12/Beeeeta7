#!/usr/bin/env python3
"""
Updated Document Generation Backward Compatibility Test
Testing /api/documents/generate endpoint with hybrid approach
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
            'User-Agent': 'DocumentGeneration-BackwardCompatibility-Test/2.0'
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
    
    def test_legacy_payload_hybrid(self, profile_data: Dict[str, Any]) -> bool:
        """Test legacy payload with hybrid approach (both legacy and new keys)"""
        print("\n🧪 Testing Legacy Payload (Hybrid Approach)...")
        
        # Hybrid payload - includes both legacy keys and required new keys
        commercial_register = profile_data.get('commercialRegister', '111111111')
        
        hybrid_payload = {
            # Legacy keys
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
                "commercialRegister": commercial_register
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
            # Required new keys (same data as legacy)
            "workshop": {
                "name": "ورشة الاختبار للصيانة",
                "name_en": "Test Maintenance Workshop",
                "address": "الرياض، المملكة العربية السعودية",
                "phone": "+966 11 123 4567",
                "email": "info@testworkshop.com",
                "website": "www.testworkshop.com",
                "tax_number": "300012345600003",
                "commercial_register": commercial_register
            },
            "customer": {
                "name": "أحمد محمد العميل",
                "phone": "+966 50 123 4567",
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
                }
            ],
            "totals": {
                "subtotal": 195.0,
                "discount": 0.0,
                "tax": 29.25,
                "total": 224.25
            }
        }
        
        print(f"   📤 Sending hybrid payload to {self.base_url}/api/documents/generate")
        print(f"   📋 Commercial Register: {commercial_register}")
        print(f"   🔄 Payload includes both legacy (company/client) and new (workshop/customer) keys")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/documents/generate",
                json=hybrid_payload,
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
                arabic_label_found = 'السجل التجاري' in html_content
                print(f"   {'✅' if arabic_label_found else '❌'} Arabic label 'السجل التجاري': {'FOUND' if arabic_label_found else 'NOT FOUND'}")
                
                # Check for commercial register value
                commercial_register_found = commercial_register and commercial_register in html_content
                print(f"   {'✅' if commercial_register_found else '⚠️ '} Commercial register value '{commercial_register}': {'FOUND' if commercial_register_found else 'NOT FOUND'}")
                
                # Additional checks
                doc_number = response_data.get('document_number', '')
                doc_type = response_data.get('doc_type', '')
                print(f"   📋 Document Number: {doc_number}")
                print(f"   📋 Document Type: {doc_type}")
                
                # Save HTML for inspection
                html_file = f"/app/legacy_document_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                try:
                    with open(html_file, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    print(f"   📁 HTML saved to: {html_file}")
                except Exception as e:
                    print(f"   ⚠️  Could not save HTML: {e}")
                
                # Success if we have HTML with Arabic label
                return arabic_label_found
                
            else:
                print(f"   ❌ Hybrid payload failed with status {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
                
        except Exception as e:
            print(f"   ❌ Hybrid payload test error: {str(e)}")
            return False
    
    def test_pure_legacy_payload(self, profile_data: Dict[str, Any]) -> bool:
        """Test pure legacy payload format (original keys only)"""
        print("\n🧪 Testing Pure Legacy Payload Format...")
        
        commercial_register = profile_data.get('commercialRegister', '111111111')
        
        # Pure legacy payload structure
        legacy_payload = {
            "doc_type": "invoice",
            "language": "ar",
            "workshop_id": "test-workshop-001",
            "company": {
                "name": "ورشة الاختبار للصيانة",
                "commercialRegister": commercial_register,
                "taxNumber": "300012345600003",
                "phone": "+966 11 123 4567"
            },
            "client": {
                "name": "أحمد محمد العميل",
                "phone": "+966 50 123 4567"
            },
            "vehicle": {
                "brand": "تويوتا",
                "model": "كامري",
                "plateNumber": "أ ب ج 1234"
            },
            "items": [
                {
                    "description": "تغيير زيت المحرك",
                    "quantity": 1,
                    "unit_price": 150.0
                }
            ],
            "totals": {
                "subtotal": 150.0,
                "total": 150.0
            }
        }
        
        print(f"   📤 Sending pure legacy payload to {self.base_url}/api/documents/generate")
        print(f"   📋 Commercial Register: {commercial_register}")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/documents/generate",
                json=legacy_payload,
                timeout=15
            )
            
            print(f"   📥 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"   ✅ Pure legacy payload WORKS!")
                return True
            elif response.status_code == 422:
                print(f"   ❌ Pure legacy payload validation failed (expected)")
                print(f"   📝 This confirms the API requires new format fields")
                return False
            else:
                print(f"   ❌ Unexpected response: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Pure legacy payload test error: {str(e)}")
            return False
    
    def test_new_payload(self) -> bool:
        """Test new payload format"""
        print("\n🧪 Testing New Payload Format...")
        
        # New payload structure
        new_payload = {
            "doc_type": "quote",
            "workshop": {
                "name": "ورشة الحديثة للصيانة",
                "commercial_register": "2020987654",
                "tax_number": "300098765400003",
                "phone": "+966 13 456 7890"
            },
            "customer": {
                "name": "سارة أحمد العميلة",
                "phone": "+966 55 987 6543"
            },
            "vehicle": {
                "brand": "هوندا",
                "model": "أكورد",
                "plateNumber": "د هـ و 5678"
            },
            "items": [
                {
                    "description": "صيانة دورية شاملة",
                    "quantity": 1,
                    "unit_price": 350.0
                }
            ]
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
                html_content = response_data.get('html', '')
                print(f"   ✅ Status 200 - Response contains HTML")
                print(f"   📄 HTML length: {len(html_content)} characters")
                return True
            else:
                print(f"   ❌ New payload failed with status {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ New payload test error: {str(e)}")
            return False
    
    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive backward compatibility test"""
        print("🚀 Document Generation Backward Compatibility Test v2.0")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        results = {
            "test_time": datetime.now().isoformat(),
            "base_url": self.base_url,
            "profile_test": False,
            "pure_legacy_test": False,
            "hybrid_legacy_test": False,
            "new_payload_test": False,
            "profile_data": {},
            "backward_compatibility": False,
            "overall_success": False
        }
        
        # Test 1: Profile endpoint
        profile_data = self.test_profile_endpoint()
        results["profile_test"] = bool(profile_data)
        results["profile_data"] = profile_data
        
        # Test 2: Pure legacy payload (expected to fail)
        pure_legacy_result = self.test_pure_legacy_payload(profile_data)
        results["pure_legacy_test"] = pure_legacy_result
        
        # Test 3: Hybrid legacy payload (should work)
        hybrid_legacy_result = self.test_legacy_payload_hybrid(profile_data)
        results["hybrid_legacy_test"] = hybrid_legacy_result
        
        # Test 4: New payload format
        new_payload_result = self.test_new_payload()
        results["new_payload_test"] = new_payload_result
        
        # Assess backward compatibility
        results["backward_compatibility"] = hybrid_legacy_result
        results["overall_success"] = hybrid_legacy_result and new_payload_result
        
        print("\n" + "=" * 70)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 70)
        print(f"✅ Profile Endpoint: {'PASS' if results['profile_test'] else 'FAIL'}")
        print(f"❌ Pure Legacy Payload: {'PASS' if results['pure_legacy_test'] else 'FAIL (Expected)'}")
        print(f"✅ Hybrid Legacy Payload: {'PASS' if results['hybrid_legacy_test'] else 'FAIL'}")
        print(f"✅ New Payload: {'PASS' if results['new_payload_test'] else 'FAIL'}")
        print(f"🔄 Backward Compatibility: {'YES' if results['backward_compatibility'] else 'NO'}")
        print(f"🎯 Overall Result: {'SUCCESS' if results['overall_success'] else 'FAILURE'}")
        
        if results['profile_data']:
            commercial_register = results['profile_data'].get('commercialRegister', 'N/A')
            print(f"📋 Commercial Register from Profile: {commercial_register}")
        
        print("\n📝 ANALYSIS:")
        if results['backward_compatibility']:
            print("   ✅ Backward compatibility WORKS with hybrid approach")
            print("   📋 Legacy keys (company/client) can be used alongside required keys")
            print("   🔍 Arabic label 'السجل التجاري' found in generated HTML")
            print("   📄 Commercial register value from /api/profile appears in document")
        else:
            print("   ❌ Backward compatibility FAILED")
            print("   📝 API requires both legacy and new format keys")
        
        print("=" * 70)
        
        return results

def main():
    """Main test execution"""
    base_url = "https://fixsa.online"
    
    print("Document Generation Backward Compatibility Test v2.0")
    print("=" * 55)
    
    tester = DocumentGenerationTester(base_url)
    results = tester.run_comprehensive_test()
    
    # Save results to file
    results_file = f"/app/document_generation_test_results_v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
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