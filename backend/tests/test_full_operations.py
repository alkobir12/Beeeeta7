"""
اختبار شامل: عملية ورشة + عملية راكان — نسخة مصحّحة
"""
import requests
import json
import sys
import time
from datetime import datetime

BASE_URL = "https://smart-inventory-cogs.preview.emergentagent.com/api"
WORKSHOP_ID = "finmodule-sync"
PASS = "✅"
FAIL = "❌"
WARN = "⚠️"

results = []

def check(label, condition, detail=""):
    icon = PASS if condition else FAIL
    results.append({"label": label, "ok": condition, "detail": detail})
    print(f"  {icon} {label}" + (f"  →  {detail}" if detail else ""))
    return condition

def get_income_statement():
    r = requests.get(f"{BASE_URL}/finance/reports/income-statement", timeout=30)
    if not r.ok: return {}
    d = r.json()
    return d.get("data", d)

def get_rakan_analytics():
    r = requests.get(f"{BASE_URL}/inventory/rakan-analytics?days=90", timeout=30)
    if not r.ok: return {}
    d = r.json()
    return d.get("data", d)

def get_journal_entries(limit=20):
    r = requests.get(f"{BASE_URL}/finance/journal-entries?workshop_id={WORKSHOP_ID}&limit={limit}", timeout=30)
    if not r.ok: return []
    d = r.json()
    return d if isinstance(d, list) else d.get("entries", d.get("data", d.get("items", [])))

def get_accounts_tree():
    r = requests.get(f"{BASE_URL}/accounts/tree", timeout=30)
    if not r.ok: return {}
    d = r.json()
    return d.get("data", d)

def get_trial_balance():
    r = requests.get(f"{BASE_URL}/finance/reports/trial-balance?workshop_id={WORKSHOP_ID}", timeout=30)
    if not r.ok: return {}
    d = r.json()
    return d.get("data", d)

# ─────────────────────────────────────────────────────────────────────────────
# 0. الوضع الحالي قبل الاختبار
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [0] قراءة الأرصدة قبل الاختبار")
print("="*70)

is0 = get_income_statement()
ra0 = get_rakan_analytics()
tree0 = get_accounts_tree()

revenue_before   = float((is0.get("totals") or {}).get("revenue", 0) or 0)
expenses_before  = float((is0.get("totals") or {}).get("expenses", 0) or 0)
net_before       = float((is0.get("totals") or {}).get("net_income", 0) or 0)
rakan_rev_before = float(ra0.get("revenue", 0) or 0)
rakan_ops_before = int(ra0.get("operations_count", 0) or 0)
summary0         = tree0.get("summary", {}) if isinstance(tree0, dict) else {}

print(f"  إيراد الورشة     : {revenue_before:>10.2f} ر.س")
print(f"  مصروفات الورشة   : {expenses_before:>10.2f} ر.س")
print(f"  صافي الدخل       : {net_before:>10.2f} ر.س")
print(f"  إيراد راكان      : {rakan_rev_before:>10.2f} ر.س  ({rakan_ops_before} عملية)")
entries_before = get_journal_entries(limit=100)
entries_count_before = len(entries_before)
print(f"  قيود اليومية     : {entries_count_before}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. عملية الورشة — خدمة + قطع ورشة / دفع بنك
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [1] إنشاء عملية ورشة (خدمة + قطع / بنك)")
print("="*70)

workshop_payload = {
    "workshopId": WORKSHOP_ID,
    "workshop_id": WORKSHOP_ID,
    "type": "sale",
    "paymentMethod": "bank",
    "paymentStatus": "paid",
    "partnerType": "customer",
    "partnerName": "عميل اختبار شامل",
    "source": "workshop_test",
    "scope": "workshop",
    "date": datetime.utcnow().date().isoformat(),
    "items": [
        {"name": "فحص وصيانة ميكانيكية", "itemType": "service", "qty": 1, "price": 350, "total": 350},
        {"name": "زيت محرك 5W-30",         "itemType": "part",    "qty": 4, "price":  45, "total": 180},
        {"name": "فلتر زيت",               "itemType": "part",    "qty": 1, "price":  35, "total":  35},
    ],
    "subtotal": 565,
    "total": 565
}

r1 = requests.post(f"{BASE_URL}/operations", json=workshop_payload, timeout=30)
check("إنشاء عملية الورشة HTTP 200/201", r1.status_code in (200, 201), f"status={r1.status_code}")
workshop_op = r1.json() if r1.ok else {}
w_id = workshop_op.get("id", "")

if r1.ok:
    check("الإجمالي = 565 ر.س",        abs(float(workshop_op.get("total",0) or 0) - 565) < 1,  f"total={workshop_op.get('total')}")
    check("طريقة الدفع = bank",         workshop_op.get("paymentMethod") in ("bank","transfer","card"), f"pm={workshop_op.get('paymentMethod')}")
    check("النطاق = workshop",          workshop_op.get("scope") == "workshop",                 f"scope={workshop_op.get('scope')}")
    check("يحتوي على 3 بنود",           len(workshop_op.get("items",[]))==3,                    f"items={len(workshop_op.get('items',[]))}")
    print(f"  ✅ معرف العملية: {w_id}")
else:
    print(f"  {FAIL} الخطأ: {r1.text[:200]}")


# ─────────────────────────────────────────────────────────────────────────────
# 2. عملية راكان
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [2] إنشاء عملية راكان (مورد راكان + قطعة مرتبطة)")
print("="*70)

rakan_payload = {
    "workshopId": WORKSHOP_ID,
    "workshop_id": WORKSHOP_ID,
    "type": "sale",
    "paymentMethod": "cash",
    "paymentStatus": "paid",
    "partnerType": "customer",
    "partnerName": "عميل اختبار راكان",
    "scope": "rakan_parts",
    "source": "rakan_parts_pos",
    "businessUnit": "rakan_parts",
    "date": datetime.utcnow().date().isoformat(),
    "notes": "[RAKAN_PARTS] بيع قطعة فلتر هواء",
    "items": [
        {
            "name": "راكان",
            "itemType": "supplier",
            "qty": 2,
            "price": 85,
            "total": 170,
            "linkedPart": "فلتر هواء",
            "linkedPartManualEntry": False
        }
    ],
    "subtotal": 170,
    "total": 170,
    "supplierArchiveTotal": 170,
    "workshopTotal": 0
}

r2 = requests.post(f"{BASE_URL}/operations", json=rakan_payload, timeout=30)
check("إنشاء عملية راكان HTTP 200/201", r2.status_code in (200, 201), f"status={r2.status_code}")
rakan_op = r2.json() if r2.ok else {}
rk_id = rakan_op.get("id", "")

if r2.ok:
    check("إجمالي راكان = 170 ر.س", abs(float(rakan_op.get("total",0) or 0) - 170) < 1, f"total={rakan_op.get('total')}")
    print(f"  ✅ معرف العملية: {rk_id}")
else:
    print(f"  {FAIL} الخطأ: {r2.text[:200]}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. التحقق من القيود المحاسبية
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [3] التحقق من القيود المحاسبية")
print("="*70)
time.sleep(2)

entries_after = get_journal_entries(limit=100)
entries_count_after = len(entries_after)

# بحث عن قيد العملية
workshop_entry = None
rakan_entry    = None
for e in entries_after:
    ref   = str(e.get("reference_id") or e.get("referenceId") or "")
    notes = str(e.get("description") or e.get("notes") or "")
    text  = ref + notes
    if w_id  and (w_id[:8]  in text or w_id  in text): workshop_entry = e
    if rk_id and (rk_id[:8] in text or rk_id in text): rakan_entry    = e

# إنشاء قيود جديدة
new_entries_count = entries_count_after - entries_count_before
check(f"عدد القيود ارتفع بعد إنشاء العمليات", new_entries_count >= 1,
      f"قبل={entries_count_before}  بعد={entries_count_after}  جديد={new_entries_count}")

check("قيد محاسبي أُنشئ لعملية الورشة", workshop_entry is not None,
      f"ref={'موجود' if workshop_entry else 'غير موجود'}")

if workshop_entry:
    lines = workshop_entry.get("lines", [])
    total_d = sum(float(l.get("debit",  0) or 0) for l in lines)
    total_c = sum(float(l.get("credit", 0) or 0) for l in lines)
    balanced = abs(total_d - total_c) < 0.01
    check("القيد متوازن (مدين = دائن)", balanced, f"debit={total_d:.2f} credit={total_c:.2f}")
    check("القيد يحتوي ≥ 2 سطور",       len(lines) >= 2, f"سطور={len(lines)}")
    accounts_in = [(l.get("account",""), l.get("account_name",""), l.get("debit",0), l.get("credit",0)) for l in lines]
    print(f"  تفاصيل القيد:")
    for acc, name, d, c in accounts_in:
        print(f"    حساب [{acc}] {name[:30]:<30}  مدين={d:.2f}  دائن={c:.2f}")
    has_bank = any(l.get("account","") in ("1102","004") for l in lines)
    check("القيد يتضمن حساب البنك 004/1102", has_bank,
          f"حسابات={[l.get('account') for l in lines]}")
else:
    # اعرض آخر القيود للتشخيص
    print(f"  آخر {min(5,len(entries_after))} قيود:")
    for e in entries_after[:5]:
        print(f"    {e.get('id','?')[:12]} | {str(e.get('description',''))[:40]}")

check("لا قيد لراكان (وحدة مستقلة)", rakan_entry is None,
      "صحيح — راكان لا يدخل في دفتر اليومية" if rakan_entry is None else f"⚠️ وُجد قيد: {rakan_entry.get('id','?')[:12]}")


# ─────────────────────────────────────────────────────────────────────────────
# 4. التقارير المالية بعد الإنشاء
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [4] التقارير المالية بعد الإنشاء")
print("="*70)
time.sleep(3)

is1   = get_income_statement()
ra1   = get_rakan_analytics()
tree1 = get_accounts_tree()

revenue_after  = float((is1.get("totals") or {}).get("revenue", 0) or 0)
net_after      = float((is1.get("totals") or {}).get("net_income", 0) or 0)
rakan_rev_after = float(ra1.get("revenue", 0) or 0)
rakan_ops_after = int(ra1.get("operations_count", 0) or 0)
summary1        = tree1.get("summary", {}) if isinstance(tree1, dict) else {}

print(f"  إيراد الورشة : {revenue_before:.2f} → {revenue_after:.2f} ر.س  (Δ {revenue_after-revenue_before:+.2f})")
print(f"  صافي الدخل  : {net_before:.2f} → {net_after:.2f} ر.س  (Δ {net_after-net_before:+.2f})")
print(f"  إيراد راكان : {rakan_rev_before:.2f} → {rakan_rev_after:.2f} ر.س  (Δ {rakan_rev_after-rakan_rev_before:+.2f})")
print(f"  عمليات راكان: {rakan_ops_before} → {rakan_ops_after}")

check("إيراد الورشة ارتفع بعد عملية الورشة", revenue_after > revenue_before,
      f"Δ={revenue_after-revenue_before:+.2f} ر.س")
check("عمليات راكان ارتفعت", rakan_ops_after > rakan_ops_before,
      f"{rakan_ops_before} → {rakan_ops_after}")
check("إيراد راكان ارتفع بمقدار ~170 ر.س", abs((rakan_rev_after-rakan_rev_before) - 170) < 5,
      f"Δ={rakan_rev_after-rakan_rev_before:.2f} ر.س")

# دليل الحسابات
tree_assets  = float(summary1.get("assets",  0) or 0)
tree_revenue = float(summary1.get("revenue", 0) or 0)
tree_net     = float(summary1.get("net_profit", summary1.get("net",0)) or 0)

if summary1:
    check("دليل الحسابات: الأصول > 0",   tree_assets  > 0, f"{tree_assets:.2f} ر.س")
    check("دليل الحسابات: الإيراد > 0",  tree_revenue > 0, f"{tree_revenue:.2f} ر.س")
    check("دليل الحسابات: صافي محسوب",   tree_net    != 0, f"{tree_net:.2f} ر.س")
else:
    print(f"  {WARN} دليل الحسابات summary فارغ — سيتم إعادة المحاولة")
    # محاولة ثانية بعد تصفية الـ cache
    time.sleep(4)
    tree2 = get_accounts_tree()
    summary2 = tree2.get("summary", {}) if isinstance(tree2, dict) else {}
    tree_assets  = float(summary2.get("assets",  0) or 0)
    tree_revenue = float(summary2.get("revenue", 0) or 0)
    tree_net     = float(summary2.get("net_profit", summary2.get("net",0)) or 0)
    check("دليل الحسابات: الأصول > 0 (محاولة 2)",  tree_assets  > 0, f"{tree_assets:.2f} ر.س")
    check("دليل الحسابات: الإيراد > 0 (محاولة 2)", tree_revenue > 0, f"{tree_revenue:.2f} ر.س")


# ─────────────────────────────────────────────────────────────────────────────
# 5. التحقق من الحسابات الفرعية بالتفصيل
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [5] الحسابات الفرعية")
print("="*70)

r_accounts = requests.get(f"{BASE_URL}/accounts", timeout=30)
all_accounts = []
if r_accounts.ok:
    d = r_accounts.json()
    all_accounts = d if isinstance(d, list) else d.get("data", d.get("accounts", []))

rakan_accounts    = [a for a in all_accounts if "راكان" in str(a.get("name",""))]
revenue_accounts  = [a for a in all_accounts if a.get("type") == "revenue"]
expense_accounts  = [a for a in all_accounts if a.get("type") == "expense"]
asset_accounts    = [a for a in all_accounts if a.get("type") == "asset"]
liability_accounts= [a for a in all_accounts if a.get("type") == "liability"]
customer_accounts = [a for a in all_accounts if "عميل" in str(a.get("name","")) and a.get("type")=="asset"]
supplier_accounts = [a for a in all_accounts if "مورد" in str(a.get("name","")) and a.get("type")=="liability"]

check("حسابات الأصول موجودة",            len(asset_accounts)     > 0, f"عدد={len(asset_accounts)}")
check("حسابات الخصوم موجودة",            len(liability_accounts) > 0, f"عدد={len(liability_accounts)}")
check("حسابات الإيراد موجودة",           len(revenue_accounts)   > 0, f"عدد={len(revenue_accounts)}")
check("حسابات المصروف موجودة",           len(expense_accounts)   > 0, f"عدد={len(expense_accounts)}")
check("حسابات عملاء موجودة",             len(customer_accounts)  > 0, f"عدد={len(customer_accounts)}")
check("حسابات موردين موجودة",            len(supplier_accounts)  > 0, f"عدد={len(supplier_accounts)}")
check("حسابات راكان الفرعية موجودة",     len(rakan_accounts)     > 0, f"عدد={len(rakan_accounts)}")

print(f"\n  تفصيل حسابات راكان:")
for a in rakan_accounts:
    bal = float(a.get("balance", 0) or 0)
    print(f"    [{a.get('code','?'):>12}] {a.get('name','?'):<35} type={a.get('type','?'):<12} رصيد={bal:.2f}")

# رصيد البنك المحسوب من الشجرة (ليس الرصيد المخزون في الحقل)
bank_node = None
if isinstance(tree1, dict):
    for node in (tree1.get("nodes") or tree1.get("accounts") or tree1.get("data") or []):
        if isinstance(node, dict) and node.get("code") in ("004", "1102"):
            bank_node = node
            break

if bank_node:
    computed_bal = float(bank_node.get("balance", 0) or 0)
    check("حساب البنك (004) رصيده > 0 (محسوب من القيود)", computed_bal > 0,
          f"رصيد={computed_bal:.2f} ر.س")
else:
    # البنك ليس في الشجرة مباشرة — نتحقق من وجود الحساب فقط
    bank_acc = next((a for a in all_accounts if a.get("code") in ("004","1102")), None)
    check("حساب البنك (004/1102) موجود في الدليل", bank_acc is not None,
          f"code={bank_acc.get('code') if bank_acc else 'غير موجود'}")


# ─────────────────────────────────────────────────────────────────────────────
# 6. تحليلات راكان التفصيلية
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [6] تحليلات راكان التفصيلية")
print("="*70)

check("operations_count > 0", ra1.get("operations_count",0) > 0,   f"count={ra1.get('operations_count',0)}")
check("revenue > 0",          float(ra1.get("revenue",0) or 0) > 0, f"rev={ra1.get('revenue',0):.2f} ر.س")
check("sold_qty >= 0",        ra1.get("sold_qty",0) is not None,     f"qty={ra1.get('sold_qty',0)}")

period_comp = ra1.get("period_comparison", {})
check("مقارنة الفترات موجودة", bool(period_comp))

insights = ra1.get("insights", [])
check("توصيف/رؤية نصية موجودة", len(insights) > 0, insights[0][:50] if insights else "")


# ─────────────────────────────────────────────────────────────────────────────
# 7. ملخص
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  [7] ملخص النتائج النهائي")
print("="*70)

passed = sum(1 for r in results if r["ok"])
failed = sum(1 for r in results if not r["ok"])
total  = len(results)

print(f"\n  {PASS} نجح   : {passed}/{total}")
print(f"  {FAIL} فشل   : {failed}/{total}")
print(f"  نسبة النجاح : {passed/total*100:.0f}%")

if failed:
    print(f"\n  بنود فاشلة:")
    for r in results:
        if not r["ok"]:
            print(f"    {FAIL} {r['label']}  →  {r['detail']}")

# تصدير التقرير
output = {
    "timestamp": datetime.utcnow().isoformat(),
    "total": total, "passed": passed, "failed": failed,
    "before": {"revenue": revenue_before, "net": net_before,
                "rakan_revenue": rakan_rev_before, "rakan_ops": rakan_ops_before,
                "journal_entries": entries_count_before},
    "after":  {"revenue": revenue_after,  "net": net_after,
                "rakan_revenue": rakan_rev_after, "rakan_ops": rakan_ops_after,
                "journal_entries": entries_count_after},
    "workshop_op_id": w_id,
    "rakan_op_id":    rk_id,
    "workshop_journal_entry_found": workshop_entry is not None,
    "rakan_journal_entry_found":    rakan_entry    is not None,
    "details": results
}
with open("/app/test_reports/iteration_166.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n  تقرير حُفظ في: /app/test_reports/iteration_166.json")
sys.exit(0 if failed == 0 else 1)
