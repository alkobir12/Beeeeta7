#!/usr/bin/env python3
"""
اختبار مسارات خبير الديزل الخلفية
Testing Diesel Expert Backend Routes

Tests:
1. POST /api/diesel-expert - Text chat route
2. POST /api/diesel-expert/analyze-media - Media analysis route  
3. File size limit testing (25MB limit)
4. Error handling verification
"""

import requests
import json
import io
import os
from pathlib import Path

# Get backend URL from frontend .env
def get_backend_url():
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

BASE_URL = get_backend_url()
API_BASE = f"{BASE_URL}/api"

print(f"🔧 Testing Diesel Expert Backend Routes")
print(f"📍 Backend URL: {BASE_URL}")
print(f"📍 API Base: {API_BASE}")
print("=" * 60)

def test_diesel_expert_text_chat():
    """اختبار مسار الدردشة النصية: POST /api/diesel-expert"""
    print("\n1️⃣ Testing Text Chat Route: POST /api/diesel-expert")
    
    url = f"{API_BASE}/diesel-expert"
    payload = {
        "messages": [
            {
                "role": "user", 
                "content": "سيارة تويوتا ديزل كود العطل P0087، ضعف عزم وتسارع"
            }
        ],
        "sessionId": "test_session_1"
    }
    
    try:
        print(f"📤 Sending request to: {url}")
        print(f"📦 Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS - Response received")
            
            # Check required fields
            required_fields = ['success', 'response', 'ranked_causes', 'dtc_codes_found']
            missing_fields = []
            
            for field in required_fields:
                if field in data:
                    print(f"   ✅ {field}: {type(data[field]).__name__}")
                    if field == 'success':
                        print(f"      Value: {data[field]}")
                    elif field == 'dtc_codes_found':
                        print(f"      Value: {data[field]}")
                    elif field == 'ranked_causes':
                        print(f"      Count: {len(data[field]) if isinstance(data[field], list) else 'Not a list'}")
                else:
                    missing_fields.append(field)
                    print(f"   ❌ {field}: MISSING")
            
            if missing_fields:
                print(f"⚠️  Missing required fields: {missing_fields}")
                return False
            else:
                print("✅ All required fields present")
                return True
                
        else:
            print(f"❌ FAILED - Status: {response.status_code}")
            print(f"📄 Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ FAILED - Request timeout (30s)")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED - Connection error")
        return False
    except Exception as e:
        print(f"❌ FAILED - Exception: {e}")
        return False

def create_test_audio_file():
    """إنشاء ملف صوتي صغير للاختبار"""
    # Create a small WAV file (minimal header + silence)
    wav_header = b'RIFF\x24\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x08\x00\x00'
    silence_data = b'\x00' * 2048  # 2KB of silence
    return wav_header + silence_data

def test_diesel_expert_analyze_media():
    """اختبار مسار تحليل الوسائط: POST /api/diesel-expert/analyze-media"""
    print("\n2️⃣ Testing Media Analysis Route: POST /api/diesel-expert/analyze-media")
    
    url = f"{API_BASE}/diesel-expert/analyze-media"
    
    # Create test audio file
    audio_data = create_test_audio_file()
    
    # Prepare multipart form data
    files = {
        'media_file': ('test_engine_sound.wav', io.BytesIO(audio_data), 'audio/wav')
    }
    
    data = {
        'description': 'اختبار صوت محرك ديزل',
        'vehicle_type': 'Toyota',
        'vehicle_id': 'vehicle-test-123',
        'vehicle_plate': 'TEST 1234'
    }
    
    try:
        print(f"📤 Sending request to: {url}")
        print(f"📦 Form data: {data}")
        print(f"📁 File: test_engine_sound.wav ({len(audio_data)} bytes)")
        
        response = requests.post(url, files=files, data=data, timeout=45)
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data_response = response.json()
            print("✅ SUCCESS - Response received")
            
            # Check required fields
            required_fields = ['success', 'analysis', 'ranked_causes', 'vehicle_id', 'vehicle_plate']
            missing_fields = []
            
            for field in required_fields:
                if field in data_response:
                    print(f"   ✅ {field}: {type(data_response[field]).__name__}")
                    if field in ['success']:
                        print(f"      Value: {data_response[field]}")
                    elif field in ['vehicle_id', 'vehicle_plate']:
                        expected_value = data[field] if field in data else None
                        actual_value = data_response[field]
                        if actual_value == expected_value:
                            print(f"      Value: {actual_value} ✅")
                        else:
                            print(f"      Value: {actual_value} (expected: {expected_value}) ⚠️")
                else:
                    missing_fields.append(field)
                    print(f"   ❌ {field}: MISSING")
            
            if missing_fields:
                print(f"⚠️  Missing required fields: {missing_fields}")
                return False
            else:
                print("✅ All required fields present")
                return True
                
        else:
            print(f"❌ FAILED - Status: {response.status_code}")
            print(f"📄 Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ FAILED - Request timeout (45s)")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED - Connection error")
        return False
    except Exception as e:
        print(f"❌ FAILED - Exception: {e}")
        return False

def test_file_size_limit():
    """اختبار حد الحجم في مسار analyze-media (25MB)"""
    print("\n3️⃣ Testing File Size Limit (25MB)")
    
    url = f"{API_BASE}/diesel-expert/analyze-media"
    
    # Create a file larger than 25MB (simulate)
    # We'll create a smaller file but test the logic
    large_data = b'0' * (26 * 1024 * 1024)  # 26MB of zeros
    
    files = {
        'media_file': ('large_test_file.wav', io.BytesIO(large_data), 'audio/wav')
    }
    
    data = {
        'description': 'اختبار ملف كبير',
        'vehicle_type': 'Toyota',
        'vehicle_id': 'vehicle-test-large',
        'vehicle_plate': 'LARGE 123'
    }
    
    try:
        print(f"📤 Sending large file request to: {url}")
        print(f"📁 File size: {len(large_data)} bytes ({len(large_data)/(1024*1024):.1f}MB)")
        
        response = requests.post(url, files=files, data=data, timeout=60)
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 413:
            response_text = response.text
            print("✅ SUCCESS - File size limit enforced")
            print(f"📄 Response: {response_text}")
            
            # Check if Arabic error message is present
            if "الملف أكبر من الحد المسموح به لتحليل الذكاء الاصطناعي (25MB)" in response_text:
                print("✅ Correct Arabic error message found")
                return True
            else:
                print("⚠️  Arabic error message not found in response")
                return False
                
        else:
            print(f"❌ FAILED - Expected status 413, got {response.status_code}")
            print(f"📄 Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ FAILED - Request timeout (60s)")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED - Connection error")
        return False
    except Exception as e:
        print(f"❌ FAILED - Exception: {e}")
        return False

def test_error_handling():
    """اختبار عدم وجود أخطاء استثناء غير متوقعة"""
    print("\n4️⃣ Testing Error Handling")
    
    tests = [
        {
            "name": "Empty messages array",
            "url": f"{API_BASE}/diesel-expert",
            "method": "POST",
            "payload": {"messages": [], "sessionId": "test_empty"},
            "expected_status": 400
        },
        {
            "name": "Missing messages field",
            "url": f"{API_BASE}/diesel-expert", 
            "method": "POST",
            "payload": {"sessionId": "test_missing"},
            "expected_status": 400
        },
        {
            "name": "Invalid JSON",
            "url": f"{API_BASE}/diesel-expert",
            "method": "POST", 
            "payload": "invalid json",
            "expected_status": 422
        }
    ]
    
    all_passed = True
    
    for test in tests:
        print(f"\n   🧪 {test['name']}")
        try:
            if test['method'] == 'POST':
                if isinstance(test['payload'], str):
                    # Send invalid JSON as string
                    response = requests.post(
                        test['url'], 
                        data=test['payload'],
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
                else:
                    response = requests.post(test['url'], json=test['payload'], timeout=10)
            
            print(f"      Status: {response.status_code} (expected: {test['expected_status']})")
            
            if response.status_code == test['expected_status']:
                print("      ✅ PASSED")
            else:
                print("      ❌ FAILED")
                print(f"      Response: {response.text[:200]}...")
                all_passed = False
                
        except Exception as e:
            print(f"      ❌ FAILED - Exception: {e}")
            all_passed = False
    
    return all_passed

def main():
    """تشغيل جميع الاختبارات"""
    print("🚀 Starting Diesel Expert Backend Tests")
    print("=" * 60)
    
    results = []
    
    # Test 1: Text Chat
    results.append(("Text Chat Route", test_diesel_expert_text_chat()))
    
    # Test 2: Media Analysis
    results.append(("Media Analysis Route", test_diesel_expert_analyze_media()))
    
    # Test 3: File Size Limit
    results.append(("File Size Limit", test_file_size_limit()))
    
    # Test 4: Error Handling
    results.append(("Error Handling", test_error_handling()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:25} {status}")
        if result:
            passed += 1
    
    print("-" * 60)
    print(f"Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Diesel Expert routes are working correctly!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED - Check the details above")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)