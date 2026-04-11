#!/usr/bin/env python3
"""
Backend Testing Script for Liquid Builder Integration
Testing AlKabeer Bot endpoints after Liquid Builder addition
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://repair-mgmt-fresh.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        self.results.append({
            'test': test_name,
            'status': status,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"  Details: {details}")
    
    def test_get_customization(self) -> bool:
        """Test GET /api/alkabeer-bot/customization?user_id=manager&path=/ai-financial"""
        try:
            url = f"{BACKEND_URL}/alkabeer-bot/customization"
            params = {
                'user_id': 'manager',
                'path': '/ai-financial'
            }
            
            response = self.session.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    self.log_result(
                        "GET /api/alkabeer-bot/customization", 
                        "PASS", 
                        f"Status: {response.status_code}, Success: {data.get('success')}"
                    )
                    return True
                else:
                    self.log_result(
                        "GET /api/alkabeer-bot/customization", 
                        "FAIL", 
                        f"Invalid response structure: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "GET /api/alkabeer-bot/customization", 
                    "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "GET /api/alkabeer-bot/customization", 
                "FAIL", 
                f"Exception: {str(e)}"
            )
            return False
    
    def test_put_customization(self) -> bool:
        """Test PUT /api/alkabeer-bot/customization with labels/hidden/contents/custom_cards"""
        try:
            url = f"{BACKEND_URL}/alkabeer-bot/customization"
            
            # Test data with all required fields
            test_data = {
                "user_id": "manager",
                "path": "/ai-financial",
                "labels": {
                    "test-element": "تسمية اختبار"
                },
                "hidden": {
                    "test-hidden-element": True
                },
                "contents": {
                    "test-content": "محتوى اختبار"
                },
                "custom_cards": [
                    {
                        "id": "test-card-1",
                        "title": "كرت اختبار",
                        "content": "محتوى كرت الاختبار"
                    }
                ]
            }
            
            response = self.session.put(url, json=test_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    # Verify the data was saved correctly
                    saved_data = data['data']
                    if (saved_data.get('labels', {}).get('test-element') == "تسمية اختبار" and
                        saved_data.get('hidden', {}).get('test-hidden-element') == True and
                        saved_data.get('contents', {}).get('test-content') == "محتوى اختبار" and
                        len(saved_data.get('custom_cards', [])) > 0):
                        
                        self.log_result(
                            "PUT /api/alkabeer-bot/customization", 
                            "PASS", 
                            f"Status: {response.status_code}, Data saved correctly"
                        )
                        return True
                    else:
                        self.log_result(
                            "PUT /api/alkabeer-bot/customization", 
                            "FAIL", 
                            f"Data not saved correctly: {saved_data}"
                        )
                        return False
                else:
                    self.log_result(
                        "PUT /api/alkabeer-bot/customization", 
                        "FAIL", 
                        f"Invalid response structure: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "PUT /api/alkabeer-bot/customization", 
                    "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "PUT /api/alkabeer-bot/customization", 
                "FAIL", 
                f"Exception: {str(e)}"
            )
            return False
    
    def test_get_customization_verify(self) -> bool:
        """Test GET /api/alkabeer-bot/customization again to verify PUT worked"""
        try:
            url = f"{BACKEND_URL}/alkabeer-bot/customization"
            params = {
                'user_id': 'manager',
                'path': '/ai-financial'
            }
            
            response = self.session.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    saved_data = data['data']
                    # Verify our test data is still there
                    if (saved_data.get('labels', {}).get('test-element') == "تسمية اختبار" and
                        saved_data.get('hidden', {}).get('test-hidden-element') == True and
                        saved_data.get('contents', {}).get('test-content') == "محتوى اختبار" and
                        len(saved_data.get('custom_cards', [])) > 0):
                        
                        self.log_result(
                            "GET /api/alkabeer-bot/customization (verify)", 
                            "PASS", 
                            "PUT data verified successfully"
                        )
                        return True
                    else:
                        self.log_result(
                            "GET /api/alkabeer-bot/customization (verify)", 
                            "FAIL", 
                            f"PUT data not persisted: {saved_data}"
                        )
                        return False
                else:
                    self.log_result(
                        "GET /api/alkabeer-bot/customization (verify)", 
                        "FAIL", 
                        f"Invalid response structure: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "GET /api/alkabeer-bot/customization (verify)", 
                    "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "GET /api/alkabeer-bot/customization (verify)", 
                "FAIL", 
                f"Exception: {str(e)}"
            )
            return False
    
    def test_chat_rrr(self) -> bool:
        """Test POST /api/alkabeer-bot/chat with message 'rrr' as manager"""
        try:
            url = f"{BACKEND_URL}/alkabeer-bot/chat"
            
            chat_data = {
                "message": "rrr",
                "sessionId": "test-session-123",
                "role": "manager",
                "userId": "manager",
                "currentPath": "/ai-financial"
            }
            
            response = self.session.post(url, json=chat_data)
            
            if response.status_code == 200:
                data = response.json()
                if ('response' in data and 
                    'sessionId' in data and 
                    'وضع المطور' in data.get('response', '') and
                    data.get('mode') == 'dev'):
                    
                    self.log_result(
                        "POST /api/alkabeer-bot/chat (rrr)", 
                        "PASS", 
                        f"Developer mode activated successfully"
                    )
                    return True
                else:
                    self.log_result(
                        "POST /api/alkabeer-bot/chat (rrr)", 
                        "FAIL", 
                        f"Unexpected response: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "POST /api/alkabeer-bot/chat (rrr)", 
                    "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "POST /api/alkabeer-bot/chat (rrr)", 
                "FAIL", 
                f"Exception: {str(e)}"
            )
            return False
    
    def test_chat_exit(self) -> bool:
        """Test POST /api/alkabeer-bot/chat with message 'EXIT' on same session"""
        try:
            url = f"{BACKEND_URL}/alkabeer-bot/chat"
            
            chat_data = {
                "message": "EXIT",
                "sessionId": "test-session-123",  # Same session as rrr test
                "role": "manager",
                "userId": "manager",
                "currentPath": "/ai-financial"
            }
            
            response = self.session.post(url, json=chat_data)
            
            if response.status_code == 200:
                data = response.json()
                if ('response' in data and 
                    'sessionId' in data and 
                    'الخروج من وضع المطور' in data.get('response', '') and
                    data.get('mode') == 'user'):
                    
                    self.log_result(
                        "POST /api/alkabeer-bot/chat (EXIT)", 
                        "PASS", 
                        f"Developer mode exited successfully"
                    )
                    return True
                else:
                    self.log_result(
                        "POST /api/alkabeer-bot/chat (EXIT)", 
                        "FAIL", 
                        f"Unexpected response: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "POST /api/alkabeer-bot/chat (EXIT)", 
                    "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text[:200]}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "POST /api/alkabeer-bot/chat (EXIT)", 
                "FAIL", 
                f"Exception: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("=== Backend Testing: Liquid Builder Integration ===")
        print(f"Backend URL: {BACKEND_URL}")
        print()
        
        tests = [
            ("1. GET Customization", self.test_get_customization),
            ("2. PUT Customization", self.test_put_customization),
            ("3. GET Customization (Verify)", self.test_get_customization_verify),
            ("4. Chat RRR (Manager)", self.test_chat_rrr),
            ("5. Chat EXIT (Same Session)", self.test_chat_exit),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n--- {test_name} ---")
            if test_func():
                passed += 1
            else:
                failed += 1
        
        print(f"\n=== SUMMARY ===")
        print(f"PASSED: {passed}")
        print(f"FAILED: {failed}")
        print(f"TOTAL: {passed + failed}")
        
        if failed > 0:
            print("\nBROKEN ENDPOINTS:")
            for result in self.results:
                if result['status'] == 'FAIL':
                    print(f"- {result['test']}: {result['details']}")
        
        return failed == 0

def main():
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()