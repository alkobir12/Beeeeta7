#!/usr/bin/env python3
"""
Backend Testing for Liquid Builder Expansion
Testing the specific requirements from Arabic request:
1) GET/PUT /api/alkabeer-bot/customization with block_order
2) GET/PUT /api/alkabeer-bot/customization with custom_cards.fields[].source_testid
3) POST /api/alkabeer-bot/chat: rrr then add quick follow-up card then add status field = active then EXIT
"""

import requests
import json
import uuid
from typing import Dict, Any, List

# Backend URL from frontend .env
BACKEND_URL = "https://repair-mgmt-fresh.preview.emergentagent.com/api"

class LiquidBuilderTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.session_id = f"test-session-{uuid.uuid4().hex[:8]}"
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"[{status}] {test_name}: {details}")
    
    def test_get_customization_with_block_order(self) -> bool:
        """Test GET /api/alkabeer-bot/customization with block_order support"""
        try:
            # Test for root page
            response = self.session.get(
                f"{BACKEND_URL}/alkabeer-bot/customization",
                params={"user_id": "manager", "path": "/"}
            )
            
            if response.status_code != 200:
                self.log_result("GET Customization (Root)", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("success"):
                self.log_result("GET Customization (Root)", "FAIL", "Response success=false")
                return False
                
            # Check if block_order field exists in response
            customization_data = data.get("data", {})
            if "block_order" not in customization_data:
                self.log_result("GET Customization (Root)", "FAIL", "block_order field missing")
                return False
                
            self.log_result("GET Customization (Root)", "PASS", f"block_order: {customization_data.get('block_order', [])}")
            return True
            
        except Exception as e:
            self.log_result("GET Customization (Root)", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_put_customization_with_block_order(self) -> bool:
        """Test PUT /api/alkabeer-bot/customization with block_order"""
        try:
            test_block_order = ["header-section", "main-content", "sidebar", "footer"]
            
            payload = {
                "user_id": "manager",
                "path": "/",
                "block_order": test_block_order
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/alkabeer-bot/customization",
                json=payload
            )
            
            if response.status_code != 200:
                self.log_result("PUT Customization (block_order)", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("success"):
                self.log_result("PUT Customization (block_order)", "FAIL", "Response success=false")
                return False
                
            # Verify the block_order was saved
            saved_block_order = data.get("data", {}).get("block_order", [])
            if saved_block_order != test_block_order:
                self.log_result("PUT Customization (block_order)", "FAIL", f"Expected: {test_block_order}, Got: {saved_block_order}")
                return False
                
            self.log_result("PUT Customization (block_order)", "PASS", f"Saved block_order: {saved_block_order}")
            return True
            
        except Exception as e:
            self.log_result("PUT Customization (block_order)", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_get_customization_with_source_testid(self) -> bool:
        """Test GET /api/alkabeer-bot/customization with custom_cards.fields[].source_testid support"""
        try:
            response = self.session.get(
                f"{BACKEND_URL}/alkabeer-bot/customization",
                params={"user_id": "manager", "path": "/customers"}
            )
            
            if response.status_code != 200:
                self.log_result("GET Customization (source_testid)", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("success"):
                self.log_result("GET Customization (source_testid)", "FAIL", "Response success=false")
                return False
                
            # Check if custom_cards field exists and can contain source_testid
            customization_data = data.get("data", {})
            if "custom_cards" not in customization_data:
                self.log_result("GET Customization (source_testid)", "FAIL", "custom_cards field missing")
                return False
                
            self.log_result("GET Customization (source_testid)", "PASS", f"custom_cards structure available")
            return True
            
        except Exception as e:
            self.log_result("GET Customization (source_testid)", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_put_customization_with_source_testid(self) -> bool:
        """Test PUT /api/alkabeer-bot/customization with custom_cards.fields[].source_testid"""
        try:
            test_custom_cards = [
                {
                    "id": "test-card-1",
                    "title": "بطاقة اختبار",
                    "description": "بطاقة للاختبار",
                    "fields": [
                        {
                            "id": "field-1",
                            "label": "اسم العميل",
                            "value": "قيمة افتراضية",
                            "source_testid": "customer-name-input"
                        },
                        {
                            "id": "field-2", 
                            "label": "رقم الهاتف",
                            "value": "",
                            "source_testid": "customer-phone-input"
                        }
                    ]
                }
            ]
            
            payload = {
                "user_id": "manager",
                "path": "/customers",
                "custom_cards": test_custom_cards
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/alkabeer-bot/customization",
                json=payload
            )
            
            if response.status_code != 200:
                self.log_result("PUT Customization (source_testid)", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("success"):
                self.log_result("PUT Customization (source_testid)", "FAIL", "Response success=false")
                return False
                
            # Verify the custom_cards with source_testid were saved
            saved_cards = data.get("data", {}).get("custom_cards", [])
            if not saved_cards:
                self.log_result("PUT Customization (source_testid)", "FAIL", "No custom_cards saved")
                return False
                
            # Check if source_testid fields are preserved
            first_card = saved_cards[0]
            fields = first_card.get("fields", [])
            source_testids = [field.get("source_testid") for field in fields if field.get("source_testid")]
            
            if len(source_testids) < 2:
                self.log_result("PUT Customization (source_testid)", "FAIL", f"source_testid fields not preserved: {source_testids}")
                return False
                
            self.log_result("PUT Customization (source_testid)", "PASS", f"source_testid fields saved: {source_testids}")
            return True
            
        except Exception as e:
            self.log_result("PUT Customization (source_testid)", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_chat_rrr_command(self) -> bool:
        """Test POST /api/alkabeer-bot/chat with 'rrr' command"""
        try:
            payload = {
                "message": "rrr",
                "sessionId": self.session_id,
                "role": "manager",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": []
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/alkabeer-bot/chat",
                json=payload
            )
            
            if response.status_code != 200:
                self.log_result("Chat RRR Command", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("sessionId"):
                self.log_result("Chat RRR Command", "FAIL", "No sessionId in response")
                return False
                
            # Check if response indicates developer mode activation
            response_text = data.get("response", "")
            if "وضع المطور" not in response_text and "Developer" not in response_text:
                self.log_result("Chat RRR Command", "FAIL", f"Developer mode not activated: {response_text}")
                return False
                
            self.log_result("Chat RRR Command", "PASS", "Developer mode activated")
            return True
            
        except Exception as e:
            self.log_result("Chat RRR Command", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_chat_add_quick_followup_card(self) -> bool:
        """Test adding quick follow-up card via chat"""
        try:
            payload = {
                "message": "اضف كرت متابعة سريعة",
                "sessionId": self.session_id,
                "role": "manager", 
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": []
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/alkabeer-bot/chat",
                json=payload
            )
            
            if response.status_code != 200:
                self.log_result("Chat Add Quick Follow-up Card", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("sessionId"):
                self.log_result("Chat Add Quick Follow-up Card", "FAIL", "No sessionId in response")
                return False
                
            # Check if actions were returned for adding card
            actions = data.get("actions", [])
            customization = data.get("customization", {})
            
            # Look for add_card action or customization with new card
            card_added = False
            if actions:
                for action in actions:
                    if action.get("type") == "add_card" and "متابعة" in action.get("title", ""):
                        card_added = True
                        break
            
            if customization and customization.get("custom_cards"):
                for card in customization.get("custom_cards", []):
                    if "متابعة" in card.get("title", ""):
                        card_added = True
                        break
            
            if not card_added:
                self.log_result("Chat Add Quick Follow-up Card", "FAIL", f"Card not added. Actions: {actions}")
                return False
                
            self.log_result("Chat Add Quick Follow-up Card", "PASS", "Quick follow-up card added")
            return True
            
        except Exception as e:
            self.log_result("Chat Add Quick Follow-up Card", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_chat_add_status_field(self) -> bool:
        """Test adding status field to quick follow-up card"""
        try:
            payload = {
                "message": "اضف حقل حالة = نشط في كرت متابعة سريعة",
                "sessionId": self.session_id,
                "role": "manager",
                "userId": "manager", 
                "currentPath": "/",
                "uiSnapshot": []
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/alkabeer-bot/chat",
                json=payload
            )
            
            if response.status_code != 200:
                self.log_result("Chat Add Status Field", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("sessionId"):
                self.log_result("Chat Add Status Field", "FAIL", "No sessionId in response")
                return False
                
            # Check if field was added
            actions = data.get("actions", [])
            customization = data.get("customization", {})
            
            field_added = False
            if actions:
                for action in actions:
                    if action.get("type") == "add_field" and "حالة" in action.get("field_label", ""):
                        field_added = True
                        break
            
            if customization and customization.get("custom_cards"):
                for card in customization.get("custom_cards", []):
                    if "متابعة" in card.get("title", ""):
                        for field in card.get("fields", []):
                            if "حالة" in field.get("label", "") and "نشط" in field.get("value", ""):
                                field_added = True
                                break
            
            if not field_added:
                self.log_result("Chat Add Status Field", "FAIL", f"Status field not added. Actions: {actions}")
                return False
                
            self.log_result("Chat Add Status Field", "PASS", "Status field added with value 'نشط'")
            return True
            
        except Exception as e:
            self.log_result("Chat Add Status Field", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_chat_exit_command(self) -> bool:
        """Test EXIT command to exit developer mode"""
        try:
            payload = {
                "message": "EXIT",
                "sessionId": self.session_id,
                "role": "manager",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": []
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/alkabeer-bot/chat",
                json=payload
            )
            
            if response.status_code != 200:
                self.log_result("Chat EXIT Command", "FAIL", f"Status: {response.status_code}")
                return False
                
            data = response.json()
            if not data.get("sessionId"):
                self.log_result("Chat EXIT Command", "FAIL", "No sessionId in response")
                return False
                
            # Check if response indicates exit from developer mode
            response_text = data.get("response", "")
            mode = data.get("mode", "")
            
            if mode != "user" and "خروج" not in response_text and "exit" not in response_text.lower():
                self.log_result("Chat EXIT Command", "FAIL", f"Developer mode not exited: {response_text}")
                return False
                
            self.log_result("Chat EXIT Command", "PASS", "Successfully exited developer mode")
            return True
            
        except Exception as e:
            self.log_result("Chat EXIT Command", "FAIL", f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return summary"""
        print(f"🧪 Starting Liquid Builder Expansion Backend Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Session ID: {self.session_id}")
        print("=" * 60)
        
        # Test 1: GET/PUT customization with block_order
        test1_get = self.test_get_customization_with_block_order()
        test1_put = self.test_put_customization_with_block_order()
        
        # Test 2: GET/PUT customization with source_testid
        test2_get = self.test_get_customization_with_source_testid()
        test2_put = self.test_put_customization_with_source_testid()
        
        # Test 3: Chat flow - rrr -> add card -> add field -> EXIT
        test3_rrr = self.test_chat_rrr_command()
        test3_card = self.test_chat_add_quick_followup_card()
        test3_field = self.test_chat_add_status_field()
        test3_exit = self.test_chat_exit_command()
        
        # Calculate results
        all_tests = [test1_get, test1_put, test2_get, test2_put, test3_rrr, test3_card, test3_field, test3_exit]
        passed_tests = sum(all_tests)
        total_tests = len(all_tests)
        
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Identify broken endpoints
        broken_endpoints = []
        if not test1_get or not test1_put:
            broken_endpoints.append("GET/PUT /api/alkabeer-bot/customization (block_order)")
        if not test2_get or not test2_put:
            broken_endpoints.append("GET/PUT /api/alkabeer-bot/customization (source_testid)")
        if not (test3_rrr and test3_card and test3_field and test3_exit):
            broken_endpoints.append("POST /api/alkabeer-bot/chat (developer mode flow)")
        
        result = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "broken_endpoints": broken_endpoints,
            "all_passed": passed_tests == total_tests,
            "test_details": self.test_results
        }
        
        if broken_endpoints:
            print(f"❌ BROKEN ENDPOINTS:")
            for endpoint in broken_endpoints:
                print(f"   - {endpoint}")
        else:
            print(f"✅ ALL ENDPOINTS WORKING")
        
        return result

def main():
    """Main test execution"""
    tester = LiquidBuilderTester()
    results = tester.run_all_tests()
    
    # Print final verdict in Arabic as requested
    print("\n" + "=" * 60)
    print("🏁 FINAL VERDICT (النتيجة النهائية)")
    print("=" * 60)
    
    if results["all_passed"]:
        print("✅ PASS - جميع الاختبارات نجحت")
        print("✅ لا توجد endpoints مكسورة")
    else:
        print("❌ FAIL - بعض الاختبارات فشلت")
        if results["broken_endpoints"]:
            print("❌ Endpoints مكسورة:")
            for endpoint in results["broken_endpoints"]:
                print(f"   - {endpoint}")
    
    print(f"📈 معدل النجاح: {results['success_rate']:.1f}%")
    print(f"📊 {results['passed_tests']}/{results['total_tests']} اختبارات نجحت")
    
    return results

if __name__ == "__main__":
    main()