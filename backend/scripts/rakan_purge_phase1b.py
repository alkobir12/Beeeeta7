"""Phase 1b: Finish Rakan account removal + create cost account."""
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import os
from supabase import create_client

supa = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

print("=" * 65)
print("🔥 RAKAN REMOVAL — Phase 1b (FK cleanup + Cost account)")
print("=" * 65)

# Step 1: Delete account 048 (child of Rakan 044)
print("\n[1] Deleting 048 (قطع غيار مستخدم - tied to Rakan)...")
try:
    rows = supa.table("accounts").select("*").eq("code", "048").execute().data or []
    for r in rows:
        # Verify balance == 0
        bal = r.get("balance") or 0
        if abs(float(bal)) > 0.01:
            print(f"  ⚠️ 048 balance is {bal}, skipping delete")
            continue
        supa.table("accounts").delete().eq("id", r["id"]).execute()
        print(f"  ✅ Deleted [{r['code']}] {r['name']}")
except Exception as e:
    print(f"  ❌ {e}")

# Step 2: Now delete 043 and 044 (no more children)
print("\n[2] Deleting Rakan parent accounts 043 and 044...")
for code in ["043", "044"]:
    try:
        rows = supa.table("accounts").select("*").eq("code", code).execute().data or []
        for r in rows:
            supa.table("accounts").delete().eq("id", r["id"]).execute()
            print(f"  ✅ Deleted [{r['code']}] {r['name']}")
    except Exception as e:
        print(f"  ❌ [{code}]: {e}")

# Step 3: Create new account 0421 (Workshop Parts Cost — mirror of 042)
print("\n[3] Creating new account 0421 'تكلفة قطع الورشة' (expense)...")
try:
    existing = supa.table("accounts").select("*").eq("code", "0421").execute().data or []
    if existing:
        print(f"  ⚠️ Already exists: {existing[0]}")
    else:
        new_acc = {
            "code": "0421",
            "name": "تكلفة قطع الورشة",
            "name_ar": "تكلفة قطع الورشة",
            "type": "expense",
            "balance": 0,
        }
        res = supa.table("accounts").insert(new_acc).execute()
        if res.data:
            print(f"  ✅ Created 0421 — تكلفة قطع الورشة (expense), id={res.data[0]['id'][:12]}")
        else:
            print(f"  ❌ Insert returned no data: {res}")
except Exception as e:
    print(f"  ❌ {e}")

# Verify final state
print("\n" + "=" * 65)
print("📊 FINAL STATE")
print("=" * 65)
remaining_rakan = (
    supa.table("accounts").select("code, name").or_(
        "name.ilike.%راكان%,name.ilike.%rakan%"
    ).execute().data or []
)
print(f"\nRemaining Rakan-named accounts: {len(remaining_rakan)}")
for r in remaining_rakan:
    print(f"  ⚠️ {r}")

# Show 042 and 0421 (Revenue + Cost pair)
pair = supa.table("accounts").select("code, name, type, balance").in_("code", ["042", "0421"]).execute().data or []
print("\n42 ↔ 0421 PAIR:")
for p in pair:
    print(f"  [{p['code']:>5}] {p['name']:<35} type={p['type']:<10} balance={p.get('balance')}")
