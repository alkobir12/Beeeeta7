#!/usr/bin/env python3
"""
Backend Health Checks for Workshop Management System
Tests the specific sequence requested in the review
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
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
print(f"🔗 Testing API at: {API_URL}")

class HealthCheckTester:
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

    def test_1_electrical_seed_diagram_guide(self):
        """1) POST /api/ai/kb/electrical/seed-diagram-guide -> expect ok true"""
        print("\n🔌 Testing Electrical Seed Diagram Guide...")
        
        try:
            response = self.session.post(f"{API_URL}/ai/kb/electrical/seed-diagram-guide")
            if response.status_code == 200:
                result = response.json()
                if result.get('ok') == True:
                    self.log_result("Electrical Seed Diagram Guide", True)
                else:
                    self.log_result("Electrical Seed Diagram Guide", False, f"Expected ok=true, got {result}")
            else:
                self.log_result("Electrical Seed Diagram Guide", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Electrical Seed Diagram Guide", False, str(e))

    def test_2_seed_print_templates(self):
        """2) POST /api/seed/print-templates -> add any missing templates"""
        print("\n📄 Testing Seed Print Templates...")
        
        try:
            response = self.session.post(f"{API_URL}/seed/print-templates")
            if response.status_code == 200:
                result = response.json()
                if 'added' in result and isinstance(result['added'], list):
                    self.log_result("Seed Print Templates", True, f"Added templates: {result['added']}")
                else:
                    self.log_result("Seed Print Templates", False, f"Unexpected response format: {result}")
            else:
                self.log_result("Seed Print Templates", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Seed Print Templates", False, str(e))

    def test_3_print_resolve_template(self):
        """3) POST /api/print/resolve-template {override_type:'invoice'} -> 200 template"""
        print("\n🧾 Testing Print Resolve Template...")
        
        try:
            payload = {"override_type": "invoice"}
            response = self.session.post(f"{API_URL}/print/resolve-template", json=payload)
            if response.status_code == 200:
                result = response.json()
                if 'type' in result and 'template' in result and result['type'] == 'invoice':
                    self.log_result("Print Resolve Template", True)
                else:
                    self.log_result("Print Resolve Template", False, f"Missing type/template fields or wrong type: {result}")
            else:
                self.log_result("Print Resolve Template", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Print Resolve Template", False, str(e))

    def test_4_print_render(self):
        """4) POST /api/print/render {override_type:'invoice', data:{CUSTOMER_NAME:'اختبار', TOTAL:123.45, ITEMS:[{name:'زيت',qty:1,price:100,total:100}]}} -> returns html containing 'اختبار' and '123.45'"""
        print("\n🖨️ Testing Print Render...")
        
        try:
            payload = {
                "override_type": "invoice",
                "data": {
                    "CUSTOMER_NAME": "اختبار",
                    "TOTAL": 123.45,
                    "ITEMS": [
                        {
                            "name": "زيت",
                            "qty": 1,
                            "price": 100,
                            "total": 100
                        }
                    ]
                }
            }
            response = self.session.post(f"{API_URL}/print/render", json=payload)
            if response.status_code == 200:
                result = response.json()
                if 'html' in result:
                    html_content = result['html']
                    if 'اختبار' in html_content and '123.45' in html_content:
                        self.log_result("Print Render", True)
                    else:
                        self.log_result("Print Render", False, f"HTML missing required content. Contains 'اختبار': {'اختبار' in html_content}, Contains '123.45': {'123.45' in html_content}")
                else:
                    self.log_result("Print Render", False, f"Missing html field: {result}")
            else:
                self.log_result("Print Render", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Print Render", False, str(e))

    def test_5_notifications_prepare(self):
        """5) POST /api/notifications/prepare {type:'approval', phone:'+966501234567', link:'https://example.com'} -> whatsappDeeplink ok"""
        print("\n📱 Testing Notifications Prepare...")
        
        try:
            payload = {
                "type": "approval",
                "phone": "+966501234567",
                "link": "https://example.com"
            }
            response = self.session.post(f"{API_URL}/notifications/prepare", json=payload)
            if response.status_code == 200:
                result = response.json()
                if 'whatsappDeeplink' in result and result['whatsappDeeplink'].startswith('https://wa.me/'):
                    # Check if phone normalization is working correctly
                    deeplink = result['whatsappDeeplink']
                    if '966501234567' in deeplink and 'https://example.com' in deeplink:
                        self.log_result("Notifications Prepare", True)
                    else:
                        self.log_result("Notifications Prepare", False, f"WhatsApp deeplink missing expected content: {deeplink}")
                else:
                    self.log_result("Notifications Prepare", False, f"Missing or invalid whatsappDeeplink: {result}")
            else:
                self.log_result("Notifications Prepare", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Notifications Prepare", False, str(e))

    def test_6_media_upload_roundtrip(self):
        """6) Media upload roundtrip: init (size small), one chunk, complete -> returns ok true (audio may be null)"""
        print("\n📹 Testing Media Upload Roundtrip...")
        
        # Step 1: Initialize upload
        try:
            init_payload = {
                "filename": "test_video.mp4",
                "size": 1024,  # Small size
                "mimeType": "video/mp4"
            }
            init_response = self.session.post(f"{API_URL}/media/upload/init", json=init_payload)
            if init_response.status_code != 200:
                self.log_result("Media Upload - Init", False, f"Status: {init_response.status_code}")
                return
            
            upload_id = init_response.json().get('uploadId')
            if not upload_id:
                self.log_result("Media Upload - Init", False, "No uploadId returned")
                return
            
            self.log_result("Media Upload - Init", True)
            
            # Step 2: Upload one chunk
            import io
            fake_video_data = b"fake video content for testing" * 32  # Make it 1024 bytes
            
            files = {'chunk': ('chunk.bin', io.BytesIO(fake_video_data), 'application/octet-stream')}
            data = {'uploadId': upload_id, 'index': 0}
            
            chunk_response = self.session.post(f"{API_URL}/media/upload/chunk", files=files, data=data)
            if chunk_response.status_code != 200:
                self.log_result("Media Upload - Chunk", False, f"Status: {chunk_response.status_code}")
                return
            
            chunk_result = chunk_response.json()
            if chunk_result.get('ok') == True and chunk_result.get('index') == 0:
                self.log_result("Media Upload - Chunk", True)
            else:
                self.log_result("Media Upload - Chunk", False, f"Unexpected response: {chunk_result}")
                return
            
            # Step 3: Complete upload
            complete_payload = {
                "uploadId": upload_id,
                "totalChunks": 1
            }
            complete_response = self.session.post(f"{API_URL}/media/upload/complete", json=complete_payload)
            if complete_response.status_code == 200:
                complete_result = complete_response.json()
                if complete_result.get('ok') == True:
                    # Audio may be null, that's acceptable
                    self.log_result("Media Upload - Complete", True, f"Video: {complete_result.get('video')}, Audio: {complete_result.get('audio', 'null')}")
                else:
                    self.log_result("Media Upload - Complete", False, f"Expected ok=true: {complete_result}")
            else:
                self.log_result("Media Upload - Complete", False, f"Status: {complete_response.status_code}")
                
        except Exception as e:
            self.log_result("Media Upload Roundtrip", False, str(e))

    def test_7_electrical_kb_and_enhanced_chat(self):
        """7) Electrical KB ingest from sample text and search; enhanced-chat basic call and handle missing LLM key gracefully (expect 500 if key missing)"""
        print("\n🧠 Testing Electrical KB and Enhanced Chat...")
        
        # Step 1: Ingest sample electrical text
        try:
            ingest_payload = {
                "title": "أساسيات الكهرباء للاختبار",
                "content": "هذا نص تجريبي عن أساسيات كهرباء السيارات. يتضمن معلومات عن الفيوزات والريلايات والأرضي. الفولت الطبيعي للبطارية 12.6 فولت. المولد يعطي 13.8-14.4 فولت عند التشغيل. يجب فحص الأرضي بالملتيميتر.",
                "tags": ["electrical", "basic", "test"]
            }
            ingest_response = self.session.post(f"{API_URL}/ai/kb/electrical/ingest", json=ingest_payload)
            if ingest_response.status_code == 200:
                ingest_result = ingest_response.json()
                if ingest_result.get('ok') == True:
                    self.log_result("Electrical KB - Ingest", True)
                else:
                    self.log_result("Electrical KB - Ingest", False, f"Expected ok=true: {ingest_result}")
            else:
                self.log_result("Electrical KB - Ingest", False, f"Status: {ingest_response.status_code}")
        except Exception as e:
            self.log_result("Electrical KB - Ingest", False, str(e))
        
        # Step 2: Search electrical KB
        try:
            search_response = self.session.get(f"{API_URL}/ai/kb/electrical/search?query=أساسيات")
            if search_response.status_code == 200:
                search_result = search_response.json()
                if 'results' in search_result and 'count' in search_result:
                    count = search_result['count']
                    if count >= 1:
                        self.log_result("Electrical KB - Search", True, f"Found {count} results")
                    else:
                        self.log_result("Electrical KB - Search", False, f"Expected >=1 results, got {count}")
                else:
                    self.log_result("Electrical KB - Search", False, f"Missing results/count fields: {search_result}")
            else:
                self.log_result("Electrical KB - Search", False, f"Status: {search_response.status_code}")
        except Exception as e:
            self.log_result("Electrical KB - Search", False, str(e))
        
        # Step 3: Enhanced chat basic call - handle missing LLM key gracefully
        try:
            chat_payload = {
                "message": "كيف أفحص بطارية السيارة؟",
                "provider": "openai",
                "model": "gpt-5"
            }
            chat_response = self.session.post(f"{API_URL}/ai/enhanced-chat", json=chat_payload)
            
            # Check if we have LLM key configured
            if chat_response.status_code == 200:
                chat_result = chat_response.json()
                if 'response' in chat_result and 'session_id' in chat_result:
                    self.log_result("Enhanced Chat - With LLM Key", True, "LLM key is configured and working")
                else:
                    self.log_result("Enhanced Chat - Response Format", False, f"Missing response/session_id: {chat_result}")
            elif chat_response.status_code == 500:
                # This is expected if LLM key is missing
                error_detail = chat_response.json().get('detail', '')
                if 'EMERGENT_LLM_KEY' in error_detail or 'missing' in error_detail.lower():
                    self.log_result("Enhanced Chat - Missing LLM Key", True, "Gracefully handled missing LLM key (500 expected)")
                else:
                    self.log_result("Enhanced Chat - Unexpected 500", False, f"500 error but not LLM key related: {error_detail}")
            else:
                self.log_result("Enhanced Chat - Unexpected Status", False, f"Status: {chat_response.status_code}")
                
        except Exception as e:
            self.log_result("Enhanced Chat", False, str(e))

    def run_all_health_checks(self):
        """Run all health checks in sequence"""
        print("🏥 Starting Backend Health Checks Sequence...")
        print("=" * 60)
        
        self.test_1_electrical_seed_diagram_guide()
        self.test_2_seed_print_templates()
        self.test_3_print_resolve_template()
        self.test_4_print_render()
        self.test_5_notifications_prepare()
        self.test_6_media_upload_roundtrip()
        self.test_7_electrical_kb_and_enhanced_chat()
        
        print("\n" + "=" * 60)
        print("🏥 HEALTH CHECK SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🔍 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        success_rate = (self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed'])) * 100
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        return self.test_results['failed'] == 0

if __name__ == "__main__":
    tester = HealthCheckTester()
    success = tester.run_all_health_checks()
    sys.exit(0 if success else 1)