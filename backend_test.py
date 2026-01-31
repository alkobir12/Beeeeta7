#!/usr/bin/env python3
"""
اختبار شامل للنظام المالي - Comprehensive Financial System Testing
Testing the Arabic financial management system with operations, reports, and alerts
"""

import requests
import json
import os
import uuid
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "https://finex-manager.preview.emergentagent.com/api"
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

def test_operations_create_with_vehicle():
    """
    اختبار 1: إنشاء عملية جديدة مرتبطة بمركبة مع إنشاء قيد يومية تلقائيًا
    """
    print_test_header("اختبار إنشاء عملية مرتبطة بمركبة مع قيد يومية تلقائي")
    
    try:
        # First, get available vehicles
        vehicles_url = f"{BACKEND_URL}/vehicles"
        vehicles_response = requests.get(vehicles_url, timeout=30)
        
        if vehicles_response.status_code != 200:
            print_result(False, f"فشل في جلب المركبات: {vehicles_response.status_code}")
            return False
            
        vehicles = vehicles_response.json()
        if not vehicles:
            print_result(False, "لا توجد مركبات متاحة للاختبار")
            return False
            
        vehicle_id = vehicles[0].get('id')
        print(f"🚗 استخدام المركبة: {vehicle_id}")
        
        # Create operation with vehicle
        operation_data = {
            "type": "sale",
            "vehicleId": vehicle_id,
            "workshopId": WORKSHOP_ID,
            "partnerType": "customer",
            "partnerName": "عميل تجريبي",
            "items": [
                {
                    "itemType": "service",
                    "name": "خدمة صيانة",
                    "quantity": 1,
                    "price": 500.0
                }
            ],
            "paymentMethod": "cash",
            "notes": "عملية اختبار مع قيد تلقائي"
        }
        
        url = f"{BACKEND_URL}/operations"
        print(f"📡 استدعاء: POST {url}")
        print(f"📤 البيانات المرسلة: {json.dumps(operation_data, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, json=operation_data, timeout=30)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            operation_id = data.get("id")
            print_result(True, f"تم إنشاء العملية بنجاح: {operation_id}")
            
            # Check if journal entry was created automatically
            journal_url = f"{BACKEND_URL}/finance/journal-entries"
            journal_params = {"workshop_id": WORKSHOP_ID}
            journal_response = requests.get(journal_url, params=journal_params, timeout=30)
            
            if journal_response.status_code == 200:
                journal_data = journal_response.json()
                entries = journal_data.get("data", [])
                
                # Look for entry with reference to our operation
                operation_entry = None
                for entry in entries:
                    if entry.get("reference_id") == operation_id or entry.get("source") == "operation":
                        operation_entry = entry
                        break
                
                if operation_entry:
                    print_result(True, f"تم إنشاء قيد يومية تلقائي: {operation_entry.get('id')}")
                    return True
                else:
                    print_result(False, "لم يتم إنشاء قيد يومية تلقائي للعملية")
                    return False
            else:
                print_result(False, f"فشل في جلب القيود اليومية: {journal_response.status_code}")
                return False
        else:
            print_result(False, f"فشل في إنشاء العملية: {response.status_code}")
            print(f"نص الاستجابة: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في الاختبار: {str(e)}")
        return False

def test_operations_by_vehicle():
    """
    اختبار 2: جلب العمليات بالمركبة عبر vehicle_id
    """
    print_test_header("اختبار جلب العمليات بالمركبة")
    
    try:
        # Get vehicles first
        vehicles_url = f"{BACKEND_URL}/vehicles"
        vehicles_response = requests.get(vehicles_url, timeout=30)
        
        if vehicles_response.status_code != 200:
            print_result(False, f"فشل في جلب المركبات: {vehicles_response.status_code}")
            return False
            
        vehicles = vehicles_response.json()
        if not vehicles:
            print_result(False, "لا توجد مركبات متاحة للاختبار")
            return False
            
        vehicle_id = vehicles[0].get('id')
        
        # Get operations for specific vehicle
        url = f"{BACKEND_URL}/operations"
        params = {"vehicle_id": vehicle_id}
        
        print(f"📡 استدعاء: GET {url}")
        print(f"📤 المعاملات: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code == 200:
            operations = response.json()
            print(f"📄 عدد العمليات المرتبطة بالمركبة: {len(operations)}")
            
            # Check if operations are properly linked to vehicle
            vehicle_operations = [op for op in operations if op.get("vehicleId") == vehicle_id]
            
            if len(vehicle_operations) == len(operations):
                print_result(True, f"جميع العمليات ({len(operations)}) مرتبطة بالمركبة الصحيحة")
                return True
            else:
                print_result(False, f"بعض العمليات غير مرتبطة بالمركبة الصحيحة")
                return False
        else:
            print_result(False, f"فشل في جلب العمليات: {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في الاختبار: {str(e)}")
        return False

def test_financial_reports():
    """
    اختبار 3: التقارير المالية (Trial Balance, Balance Sheet, Income Statement, Cash Flow)
    """
    print_test_header("اختبار التقارير المالية")
    
    reports = [
        ("Trial Balance", f"{BACKEND_URL}/finance/reports/trial-balance"),
        ("Balance Sheet", f"{BACKEND_URL}/finance/reports/balance-sheet"),
        ("Income Statement", f"{BACKEND_URL}/finance/reports/income-statement"),
        ("Cash Flow", f"{BACKEND_URL}/finance/reports/cash-flow")
    ]
    
    all_passed = True
    
    for report_name, url in reports:
        try:
            print(f"\n🧪 اختبار {report_name}")
            
            params = {"workshop_id": WORKSHOP_ID}
            
            # Add date parameters for reports that need them
            if "income-statement" in url or "cash-flow" in url:
                end_date = datetime.now().strftime("%Y-%m-%d")
                start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
                params.update({"start_date": start_date, "end_date": end_date})
            
            print(f"📡 استدعاء: GET {url}")
            print(f"📤 المعاملات: {params}")
            
            response = requests.get(url, params=params, timeout=30)
            print(f"📊 كود الاستجابة: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success"):
                    report_data = data.get("data", {})
                    print_result(True, f"{report_name} يعمل بنجاح")
                    
                    # Check for specific data structure
                    if "trial-balance" in url:
                        accounts = report_data.get("accounts", [])
                        totals = report_data.get("totals", {})
                        print(f"  📊 عدد الحسابات: {len(accounts)}")
                        print(f"  💰 إجمالي مدين: {totals.get('total_debit', 0)}")
                        print(f"  💰 إجمالي دائن: {totals.get('total_credit', 0)}")
                    
                    elif "balance-sheet" in url:
                        totals = report_data.get("totals", {})
                        print(f"  🏢 إجمالي الأصول: {totals.get('assets', 0)}")
                        print(f"  📋 إجمالي الخصوم: {totals.get('liabilities', 0)}")
                        print(f"  👤 حقوق الملكية: {totals.get('equity', 0)}")
                    
                    elif "income-statement" in url:
                        totals = report_data.get("totals", {})
                        print(f"  📈 إجمالي الإيرادات: {totals.get('revenue', 0)}")
                        print(f"  📉 إجمالي المصروفات: {totals.get('expenses', 0)}")
                        print(f"  💵 صافي الدخل: {totals.get('net_income', 0)}")
                    
                    elif "cash-flow" in url:
                        operating = report_data.get("operating_activities", {})
                        print(f"  💸 صافي النقد التشغيلي: {operating.get('net_operating_cash', 0)}")
                        print(f"  💰 رصيد النقد النهائي: {report_data.get('ending_cash', 0)}")
                        
                else:
                    print_result(False, f"{report_name} فشل: {data.get('message', 'خطأ غير محدد')}")
                    all_passed = False
            else:
                print_result(False, f"{report_name} فشل: كود {response.status_code}")
                all_passed = False
                
        except Exception as e:
            print_result(False, f"{report_name} خطأ: {str(e)}")
            all_passed = False
    
    return all_passed

def test_finance_alerts():
    """
    اختبار 4: تنبيهات المراقبة الدائمة
    """
    print_test_header("اختبار تنبيهات المراقبة المالية")
    
    try:
        url = f"{BACKEND_URL}/finance/alerts"
        params = {"workshop_id": WORKSHOP_ID}
        
        print(f"📡 استدعاء: GET {url}")
        print(f"📤 المعاملات: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("success"):
                alerts = data.get("data", {}).get("alerts", [])
                print_result(True, f"تم جلب التنبيهات بنجاح: {len(alerts)} تنبيه")
                
                # Display alerts by severity
                severity_counts = {"high": 0, "medium": 0, "low": 0}
                for alert in alerts:
                    severity = alert.get("severity", "unknown")
                    if severity in severity_counts:
                        severity_counts[severity] += 1
                    
                    print(f"  🚨 {alert.get('title', 'تنبيه')} ({severity})")
                    print(f"     {alert.get('message', '')}")
                
                print(f"📊 ملخص التنبيهات: عالية={severity_counts['high']}, متوسطة={severity_counts['medium']}, منخفضة={severity_counts['low']}")
                return True
            else:
                print_result(False, f"فشل في جلب التنبيهات: {data.get('message', 'خطأ غير محدد')}")
                return False
        else:
            print_result(False, f"فشل في جلب التنبيهات: كود {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في اختبار التنبيهات: {str(e)}")
        return False

def test_stitch_api_error():
    """
    اختبار 5: Google Stitch API (متوقع أن يفشل بسبب عدم وجود API key)
    """
    print_test_header("اختبار Google Stitch API (متوقع فشل)")
    
    try:
        url = f"{BACKEND_URL}/stitch/generate"
        payload = {
            "prompt": "صفحة تسجيل دخول بسيطة",
            "design_style": "modern",
            "color_scheme": "blue"
        }
        
        print(f"📡 استدعاء: POST {url}")
        print(f"📤 البيانات المرسلة: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, json=payload, timeout=30)
        print(f"📊 كود الاستجابة: {response.status_code}")
        
        # We expect this to fail with 500 or 520 due to missing API key
        if response.status_code in [500, 520]:
            error_data = response.json()
            error_detail = error_data.get("detail", "")
            
            if "GOOGLE_STITCH_API_KEY" in error_detail or "configuration missing" in error_detail:
                print_result(True, "فشل متوقع: مفتاح Google Stitch API غير مضبوط")
                return True
            else:
                print_result(False, f"فشل غير متوقع: {error_detail}")
                return False
        else:
            print_result(False, f"كود استجابة غير متوقع: {response.status_code}")
            print(f"نص الاستجابة: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"خطأ في اختبار Stitch: {str(e)}")
        return False

def run_backend_tests():
    """تشغيل جميع اختبارات الباك إند"""
    print("🚀 بدء اختبار النظام المالي الشامل")
    print(f"🌐 رابط الخادم: {BACKEND_URL}")
    print(f"🏪 معرف الورشة: {WORKSHOP_ID}")
    print(f"⏰ وقت الاختبار: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # اختبار 1: إنشاء عملية مع مركبة وقيد تلقائي
    results.append(("إنشاء عملية مع مركبة وقيد تلقائي", test_operations_create_with_vehicle()))
    
    # اختبار 2: جلب العمليات بالمركبة
    results.append(("جلب العمليات بالمركبة", test_operations_by_vehicle()))
    
    # اختبار 3: التقارير المالية
    results.append(("التقارير المالية", test_financial_reports()))
    
    # اختبار 4: تنبيهات المراقبة
    results.append(("تنبيهات المراقبة المالية", test_finance_alerts()))
    
    # اختبار 5: Google Stitch API (متوقع فشل)
    results.append(("Google Stitch API (متوقع فشل)", test_stitch_api_error()))
    
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