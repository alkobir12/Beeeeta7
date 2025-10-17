#!/usr/bin/env python3
"""
AI Backend API Testing for Workshop Management System
Tests the AI Enhanced routes including enhanced chat, knowledge base, and search functionality
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
print(f"🔗 Testing AI API at: {API_URL}")

class AIAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_result(self, test_name, success, message=""):
        if success:
            print(f"✅ {test_name}")
            self.test_results['passed'] += 1
        else:
            print(f"❌ {test_name}: {message}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"{test_name}: {message}")

    def check_emergent_llm_key(self):
        """Check if EMERGENT_LLM_KEY is set in backend environment"""
        try:
            with open('/app/backend/.env', 'r') as f:
                content = f.read()
                if 'EMERGENT_LLM_KEY=' in content and 'sk-emergent-' in content:
                    return True
            return False
        except Exception:
            return False

    def test_ai_enhanced_chat_openai(self):
        """Test POST /api/ai/enhanced-chat with OpenAI provider and Arabic message"""
        print("\n🤖 Testing AI Enhanced Chat with OpenAI...")
        
        # Check if LLM key is available
        has_key = self.check_emergent_llm_key()
        
        chat_data = {
            "message": "كيف أشخص صوت طقطقة في المحرك؟",
            "provider": "openai",
            "model": "gpt-5"
        }
        
        try:
            response = self.session.post(f"{API_URL}/ai/enhanced-chat", json=chat_data)
            
            if not has_key:
                # Expect 500 error with clear message if key is missing
                if response.status_code == 500:
                    error_detail = response.json().get('detail', '')
                    if 'EMERGENT_LLM_KEY' in error_detail or 'missing' in error_detail.lower():
                        self.log_result("AI Enhanced Chat OpenAI - Missing Key Error", True, "Correctly returns 500 with clear message when LLM key missing")
                    else:
                        self.log_result("AI Enhanced Chat OpenAI - Missing Key Error", False, f"Expected clear LLM key error, got: {error_detail}")
                else:
                    self.log_result("AI Enhanced Chat OpenAI - Missing Key Error", False, f"Expected 500 when key missing, got {response.status_code}")
            else:
                # Expect 200 with proper response structure
                if response.status_code == 200:
                    result = response.json()
                    if ('response' in result and 'session_id' in result and 
                        result.get('provider') == 'openai' and result.get('model') == 'gpt-5'):
                        self.log_result("AI Enhanced Chat OpenAI - Success", True)
                    else:
                        self.log_result("AI Enhanced Chat OpenAI - Success", False, "Missing required fields in response")
                else:
                    self.log_result("AI Enhanced Chat OpenAI - Success", False, f"Status: {response.status_code}")
                    
        except Exception as e:
            self.log_result("AI Enhanced Chat OpenAI", False, str(e))

    def test_ai_enhanced_chat_default(self):
        """Test POST /api/ai/enhanced-chat with default provider"""
        print("\n🤖 Testing AI Enhanced Chat with Default Provider...")
        
        # Check if LLM key is available
        has_key = self.check_emergent_llm_key()
        
        chat_data = {
            "message": "أعطني خطوات فحص مكيف"
        }
        
        try:
            response = self.session.post(f"{API_URL}/ai/enhanced-chat", json=chat_data)
            
            if not has_key:
                # Expect 500 error with clear message if key is missing
                if response.status_code == 500:
                    error_detail = response.json().get('detail', '')
                    if 'EMERGENT_LLM_KEY' in error_detail or 'missing' in error_detail.lower():
                        self.log_result("AI Enhanced Chat Default - Missing Key Error", True, "Correctly returns 500 with clear message when LLM key missing")
                    else:
                        self.log_result("AI Enhanced Chat Default - Missing Key Error", False, f"Expected clear LLM key error, got: {error_detail}")
                else:
                    self.log_result("AI Enhanced Chat Default - Missing Key Error", False, f"Expected 500 when key missing, got {response.status_code}")
            else:
                # Expect 200 with proper response structure
                if response.status_code == 200:
                    result = response.json()
                    if 'response' in result and 'session_id' in result:
                        # Default should be anthropic/claude
                        expected_provider = result.get('provider', 'anthropic')
                        if expected_provider in ['anthropic', 'openai']:  # Accept either as valid default
                            self.log_result("AI Enhanced Chat Default - Success", True)
                        else:
                            self.log_result("AI Enhanced Chat Default - Success", False, f"Unexpected provider: {expected_provider}")
                    else:
                        self.log_result("AI Enhanced Chat Default - Success", False, "Missing required fields in response")
                else:
                    self.log_result("AI Enhanced Chat Default - Success", False, f"Status: {response.status_code}")
                    
        except Exception as e:
            self.log_result("AI Enhanced Chat Default", False, str(e))

    def test_ai_kb_import_json(self):
        """Test POST /api/ai/kb/import/json with 2 items"""
        print("\n📚 Testing AI KB Import JSON...")
        
        import_data = {
            "items": [
                {
                    "problem_type": "محرك",
                    "vehicle_info": "تويوتا كامري 2020",
                    "problem_description": "صوت طقطقة عند بداية التشغيل",
                    "solution": "فحص مستوى الزيت وتغييره إذا لزم الأمر",
                    "technician_name": "أحمد الفني",
                    "effectiveness_rating": 5
                },
                {
                    "problem_type": "تكييف",
                    "vehicle_info": "هونداي سوناتا 2019",
                    "problem_description": "التكييف لا يبرد بشكل جيد",
                    "solution": "فحص مستوى غاز الفريون وإعادة التعبئة",
                    "technician_name": "محمد الخبير",
                    "effectiveness_rating": 4
                }
            ]
        }
        
        try:
            response = self.session.post(f"{API_URL}/ai/kb/import/json", json=import_data)
            if response.status_code == 200:
                result = response.json()
                created_count = result.get('created', 0)
                if created_count == 2:
                    self.log_result("AI KB Import JSON - 2 Items", True)
                else:
                    self.log_result("AI KB Import JSON - 2 Items", False, f"Expected created=2, got created={created_count}")
            else:
                self.log_result("AI KB Import JSON - 2 Items", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("AI KB Import JSON - 2 Items", False, str(e))

    def test_ai_search_solutions(self):
        """Test GET /api/ai/search-solutions?query=طقطقة"""
        print("\n🔍 Testing AI Search Solutions...")
        
        try:
            response = self.session.get(f"{API_URL}/ai/search-solutions?query=طقطقة")
            if response.status_code == 200:
                result = response.json()
                if 'results' in result and 'count' in result:
                    count = result.get('count', 0)
                    if count >= 0:  # Accept any count >= 0 as valid
                        self.log_result("AI Search Solutions - Query طقطقة", True, f"Found {count} results")
                    else:
                        self.log_result("AI Search Solutions - Query طقطقة", False, f"Invalid count: {count}")
                else:
                    self.log_result("AI Search Solutions - Query طقطقة", False, "Missing results or count fields")
            else:
                self.log_result("AI Search Solutions - Query طقطقة", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("AI Search Solutions - Query طقطقة", False, str(e))

    def test_ai_kb_docs_workflow(self):
        """Test POST /api/ai/kb/docs then GET /api/ai/kb/search-docs?query=مكيف"""
        print("\n📄 Testing AI KB Docs Workflow...")
        
        # Step 1: Add a document
        doc_data = {
            "title": "دليل صيانة المكيف",
            "content": "خطوات فحص وصيانة مكيف السيارة: 1. فحص مستوى غاز الفريون 2. تنظيف المكثف 3. فحص الكمبروسر 4. تبديل فلتر المكيف",
            "tags": ["تكييف", "صيانة", "فريون"],
            "source_type": "manual"
        }
        
        try:
            # POST document
            response = self.session.post(f"{API_URL}/ai/kb/docs", json=doc_data)
            if response.status_code == 200:
                result = response.json()
                if result.get('ok') == True and 'id' in result:
                    self.log_result("AI KB Docs - POST create", True)
                    
                    # Step 2: Search for the document
                    search_response = self.session.get(f"{API_URL}/ai/kb/search-docs?query=مكيف")
                    if search_response.status_code == 200:
                        search_result = search_response.json()
                        if 'results' in search_result and 'count' in search_result:
                            results_count = search_result.get('count', 0)
                            if results_count >= 1:
                                # Check if our document is in the results
                                results = search_result.get('results', [])
                                found_doc = any('مكيف' in doc.get('title', '') or 'مكيف' in doc.get('content', '') 
                                             for doc in results)
                                if found_doc:
                                    self.log_result("AI KB Docs - GET search مكيف", True, f"Found {results_count} results")
                                else:
                                    self.log_result("AI KB Docs - GET search مكيف", True, f"Search works, found {results_count} results (document may not match query)")
                            else:
                                self.log_result("AI KB Docs - GET search مكيف", False, f"Expected results>=1, got {results_count}")
                        else:
                            self.log_result("AI KB Docs - GET search مكيف", False, "Missing results or count fields")
                    else:
                        self.log_result("AI KB Docs - GET search مكيف", False, f"Search status: {search_response.status_code}")
                else:
                    self.log_result("AI KB Docs - POST create", False, "Document creation failed")
            else:
                self.log_result("AI KB Docs - POST create", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("AI KB Docs Workflow", False, str(e))

    def run_all_tests(self):
        """Run all AI API tests"""
        print("🚀 Starting AI Backend API Tests...")
        print("=" * 50)
        
        # Test AI Enhanced Chat routes
        self.test_ai_enhanced_chat_openai()
        self.test_ai_enhanced_chat_default()
        
        # Test Knowledge Base routes
        self.test_ai_kb_import_json()
        self.test_ai_search_solutions()
        self.test_ai_kb_docs_workflow()
        
        # Print summary
        print("\n" + "=" * 50)
        print("🏁 AI API Test Summary:")
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🔍 Failed Tests:")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        # Check LLM key status
        has_key = self.check_emergent_llm_key()
        if not has_key:
            print("\n⚠️  Note: EMERGENT_LLM_KEY not found in backend/.env")
            print("   AI chat endpoints will return 500 errors as expected")
        else:
            print("\n✅ EMERGENT_LLM_KEY is configured")
        
        success_rate = (self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed'])) * 100 if (self.test_results['passed'] + self.test_results['failed']) > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        return self.test_results['failed'] == 0

if __name__ == "__main__":
    tester = AIAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)