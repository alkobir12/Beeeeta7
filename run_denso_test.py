import sys
import os
sys.path.append(os.path.abspath('/app/backend'))

from denso_complete_single_file import CompleteDensoSystem

# إنشاء النظام (مفتاح Google مُدمج)
system = CompleteDensoSystem()

print(f"System Initialized. Google Key: {system.google_api_key[:10]}...")

# 1. اختبار VL Mode
print("\n--- Test 1: VL Mode Validation ---")
vl_result = system.validate_vl_reading(
    "Toyota_1VD-FTV", 
    pressure=1800, 
    duration=1500, 
    return_qty=1.5
)
print(f"Engine: Toyota_1VD-FTV")
print(f"Inputs: P=1800, D=1500, R=1.5")
print(f"Result: {'صحيح' if vl_result['valid'] else 'خطأ'}")
print(f"Details: {vl_result['details']}")

# 2. البحث برقم القطعة
print("\n--- Test 2: Part Number Search ---")
target_part = "095000-9780"
search_result = system.search_by_part_number(target_part)
if search_result['found']:
    print(f"Part Number: {target_part}")
    print(f"Engine Found: {search_result['results'][0]['engine_name']}")
    print(f"Specs: {search_result['results'][0]['specs']}")
else:
    print("Part not found.")
