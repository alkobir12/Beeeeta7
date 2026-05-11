"""Pre-deletion audit script — counts Rakan-linked records before purge."""
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import os
from supabase import create_client

supa = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

# Rakan accounts to be deleted
RAKAN_ACCOUNT_CODES = ["043", "044", "053", "054", "055", "056", "057", "058", "21010001"]

print("=" * 65)
print("📊 RAKAN AUDIT — Pre-Deletion Snapshot")
print("=" * 65)

print("\n🔹 Accounts to be DELETED:")
accs = supa.table("accounts").select("*").in_("code", RAKAN_ACCOUNT_CODES).execute().data or []
for a in accs:
    bal = a.get("balance") or 0
    print(f"  [{a.get('code'):>10}] {a.get('name'):<35} type={a.get('type'):<10} balance={bal}")

print(f"\nTotal accounts to delete: {len(accs)}")

# Find journal entries that reference these account codes
print("\n🔹 Journal entries referencing Rakan accounts:")
je = supa.table("journal_entries").select("*").limit(5000).execute().data or []
rakan_je = []
for j in je:
    lines = j.get("lines") or []
    for ln in lines:
        if str(ln.get("account") or "") in RAKAN_ACCOUNT_CODES:
            rakan_je.append(j)
            break
print(f"  Total journal entries to delete: {len(rakan_je)}")
for j in rakan_je[:10]:
    desc = (j.get("description") or "")[:60]
    print(f"    • {j.get('id')[:8]} | {desc} | total={j.get('total')}")
if len(rakan_je) > 10:
    print(f"    ... and {len(rakan_je) - 10} more")

# Find operations referencing Rakan supplier or in description
print("\n🔹 Operations referencing Rakan:")
ops = supa.table("operations").select("*").limit(5000).execute().data or []
rakan_ops = []
for o in ops:
    hay = " ".join([
        str(o.get("partnerName") or ""),
        str(o.get("partnerId") or ""),
        str(o.get("notes") or ""),
        str(o.get("invoiceNumber") or ""),
        str(o.get("supplier_id") or ""),
    ]).lower()
    if "راكان" in hay or "rakan" in hay or "21010001" in hay:
        rakan_ops.append(o)
print(f"  Total operations to delete: {len(rakan_ops)}")
for o in rakan_ops[:5]:
    print(f"    • {o.get('id')[:8]} | partner={o.get('partnerName')} | type={o.get('type')} | total={o.get('total')}")
if len(rakan_ops) > 5:
    print(f"    ... and {len(rakan_ops) - 5} more")

# Find invoices linked to Rakan
print("\n🔹 Invoices referencing Rakan:")
try:
    inv = supa.table("invoices").select("*").limit(5000).execute().data or []
    rakan_inv = []
    for i in inv:
        hay = " ".join([
            str(i.get("partnerName") or ""),
            str(i.get("supplier") or ""),
            str(i.get("notes") or ""),
        ]).lower()
        if "راكان" in hay or "rakan" in hay:
            rakan_inv.append(i)
    print(f"  Total invoices to delete: {len(rakan_inv)}")
    for i in rakan_inv[:5]:
        print(f"    • {i.get('id')[:8]} | {i.get('partnerName')} | total={i.get('total')}")
except Exception as e:
    print(f"  Error: {e}")

# Find parts with Rakan in name
print("\n🔹 Parts mentioning Rakan:")
parts = supa.table("parts").select("*").limit(5000).execute().data or []
rakan_parts = [
    p for p in parts
    if "راكان" in str(p.get("name") or "")
    or "rakan" in str(p.get("name") or "").lower()
    or "راكان" in str(p.get("supplier") or "")
]
print(f"  Total parts referencing Rakan: {len(rakan_parts)}")
for p in rakan_parts[:5]:
    print(f"    • {p.get('id')[:8]} | {p.get('name')} | supplier={p.get('supplier')}")

# Customers
print("\n🔹 Customers named Rakan:")
custs = supa.table("customers").select("*").limit(5000).execute().data or []
rakan_custs = [
    c for c in custs
    if "راكان" in str(c.get("name") or "")
    or "rakan" in str(c.get("name") or "").lower()
]
print(f"  Total customers named Rakan: {len(rakan_custs)}")
for c in rakan_custs[:5]:
    print(f"    • {c.get('id')[:8]} | {c.get('name')} | phone={c.get('phone')}")
