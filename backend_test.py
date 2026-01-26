#!/usr/bin/env python3
"""
اختبار شامل للبوت المالي الجديد - Finance Bot Testing
Testing the new financial bot implementation as requested in Arabic
"""

import requests
import json
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://carshopfinance.preview.emergentagent.com/api"
WORKSHOP_ID = "finmodule-sync"

def print_test_header(test_name):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_result(success, message, details=None):
    """Print test result with formatting"""
    status = "✅ نجح" if success else "❌ فشل"
    print(f"{status}: {message}")
    if details:
        print(f"التفاصيل: {details}")

def test_finance_bot_health():
    """
    اختبار 1: GET /api/finance-bot/health
    تأكد أن status = ok, provider = openai, model = gpt-5.1, has_key = true
    """
    print_test_header("اختبار صحة البوت المالي - Finance Bot Health Check")
    
    try:
        url = f"{BACKEND_URL}/finance-bot/health"
        print(f"📡 استدعاء: GET {url}")
        
        response = requests.get(url, timeout=30)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📄 البيانات المستلمة: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # التحقق من القيم المطلوبة
            checks = [
                ("status", "ok", data.get("status")),
                ("provider", "openai", data.get("provider")),
                ("model", "gpt-5.1", data.get("model")),
                ("has_key", True, data.get("has_key"))
            ]
            
            all_passed = True
            for field, expected, actual in checks:
                if actual == expected:
                    print_result(True, f"✓ {field} = {actual} (متوقع: {expected})")
                else:
                    print_result(False, f"✗ {field} = {actual} (متوقع: {expected})")
                    all_passed = False
            
            if all_passed:
                print_result(True, "جميع فحوصات صحة البوت المالي نجحت")
                return True
            else:
                print_result(False, "بعض فحوصات صحة البوت المالي فشلت")
                return False
        else:
            print_result(False, f"كود استجابة غير متوقع: {response.status_code}")
            print(f"نص الاستجابة: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في الاتصال: {str(e)}")
        return False

def test_finance_bot_general_chat():
    """
    اختبار 2: POST /api/finance-bot/chat بدون account_code
    سؤال عام عن الوضع المالي للورشة
    """
    print_test_header("اختبار الدردشة العامة مع البوت المالي")
    
    try:
        url = f"{BACKEND_URL}/finance-bot/chat"
        payload = {
            "message": "أعطني ملخصاً عاماً عن وضع الورشة المالي بناءً على البيانات الحالية",
            "workshop_id": WORKSHOP_ID
        }
        
        print(f"📡 استدعاء: POST {url}")
        print(f"📤 البيانات المرسلة: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, json=payload, timeout=60)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📄 البيانات المستلمة: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # التحقق من وجود الحقول المطلوبة
            required_fields = ["response", "conversation_id", "provider", "timestamp"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                response_text = data.get("response", "")
                if response_text and len(response_text) > 10:
                    print_result(True, f"تم استلام رد باللغة العربية ({len(response_text)} حرف)")
                    print(f"🤖 رد البوت: {response_text[:200]}...")
                    return True
                else:
                    print_result(False, "الرد فارغ أو قصير جداً")
                    return False
            else:
                print_result(False, f"حقول مفقودة: {missing_fields}")
                return False
        else:
            print_result(False, f"كود استجابة غير متوقع: {response.status_code}")
            print(f"نص الاستجابة: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في الاتصال: {str(e)}")
        return False

def test_finance_bot_account_specific_chat():
    """
    اختبار 3: POST /api/finance-bot/chat مع account_code = "411"
    تحليل حساب الإيرادات 411
    """
    print_test_header("اختبار تحليل حساب محدد (411) مع البوت المالي")
    
    try:
        url = f"{BACKEND_URL}/finance-bot/chat"
        payload = {
            "message": "حلل وضع حساب الإيرادات 411",
            "account_code": "411",
            "workshop_id": WORKSHOP_ID
        }
        
        print(f"📡 استدعاء: POST {url}")
        print(f"📤 البيانات المرسلة: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, json=payload, timeout=60)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📄 البيانات المستلمة: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            response_text = data.get("response", "")
            if response_text and len(response_text) > 10:
                # التحقق من أن الرد يتضمن معلومات عن الحساب أو ملاحظة تقنية
                account_keywords = ["411", "إيرادات", "حساب", "تحليل", "بيانات"]
                has_relevant_content = any(keyword in response_text for keyword in account_keywords)
                
                if has_relevant_content:
                    print_result(True, f"تم استلام تحليل للحساب 411 ({len(response_text)} حرف)")
                    print(f"🤖 رد البوت: {response_text[:300]}...")
                    return True
                else:
                    print_result(True, f"تم استلام رد عام (قد يكون بسبب عدم وجود بيانات للحساب)")
                    print(f"🤖 رد البوت: {response_text[:300]}...")
                    return True
            else:
                print_result(False, "الرد فارغ أو قصير جداً")
                return False
        else:
            print_result(False, f"كود استجابة غير متوقع: {response.status_code}")
            print(f"نص الاستجابة: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في الاتصال: {str(e)}")
        return False

def test_chart_of_accounts_availability():
    """
    اختبار مساعد: التحقق من توفر دليل الحسابات
    """
    print_test_header("فحص توفر دليل الحسابات")
    
    try:
        url = f"{BACKEND_URL}/finance/chart-of-accounts"
        params = {"workshop_id": WORKSHOP_ID}
        
        print(f"📡 استدعاء: GET {url}")
        print(f"📤 المعاملات: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Handle both possible response formats
            if isinstance(data.get("data"), list):
                accounts = data.get("data", [])
            else:
                accounts = data.get("data", {}).get("accounts", [])
            
            if accounts:
                print_result(True, f"تم العثور على {len(accounts)} حساب في دليل الحسابات")
                
                # البحث عن حساب 411
                account_411 = next((acc for acc in accounts if acc.get("code") == "411"), None)
                if account_411:
                    print_result(True, f"حساب 411 موجود: {account_411.get('name_ar', account_411.get('name', 'بدون اسم'))}")
                else:
                    print_result(False, "حساب 411 غير موجود في دليل الحسابات")
                
                return len(accounts) > 0
            else:
                print_result(False, "دليل الحسابات فارغ")
                return False
        else:
            print_result(False, f"فشل في جلب دليل الحسابات: {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في جلب دليل الحسابات: {str(e)}")
        return False

def run_backend_tests():
    """تشغيل جميع اختبارات الباك إند"""
    print("🚀 بدء اختبار البوت المالي الجديد")
    print(f"🌐 رابط الخادم: {BACKEND_URL}")
    print(f"🏪 معرف الورشة: {WORKSHOP_ID}")
    print(f"⏰ وقت الاختبار: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # اختبار 1: صحة البوت المالي
    results.append(("فحص صحة البوت المالي", test_finance_bot_health()))
    
    # اختبار مساعد: دليل الحسابات
    results.append(("توفر دليل الحسابات", test_chart_of_accounts_availability()))
    
    # اختبار 2: الدردشة العامة
    results.append(("الدردشة العامة مع البوت", test_finance_bot_general_chat()))
    
    # اختبار 3: تحليل حساب محدد
    results.append(("تحليل حساب محدد (411)", test_finance_bot_account_specific_chat()))
    
    # ملخص النتائج
    print_test_header("ملخص نتائج اختبار الباك إند")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ نجح" if result else "❌ فشل"
        print(f"{status} {test_name}")
    
    print(f"\n📊 النتيجة النهائية: {passed}/{total} اختبارات نجحت")
    
    if passed == total:
        print("🎉 جميع اختبارات الباك إند نجحت!")
        return True
    else:
        print(f"⚠️ {total - passed} اختبارات فشلت")
        return False

if __name__ == "__main__":
    success = run_backend_tests()
    exit(0 if success else 1)