from fastapi import APIRouter, HTTPException, Body, Request, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import asyncio
import json
import uuid
import os
import io

# Optional deps used in some endpoints
try:
    import openpyxl
except Exception:
    openpyxl = None
try:
    import xlsxwriter
except Exception:
    xlsxwriter = None
try:
    import pdfplumber
except Exception:
    pdfplumber = None

from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from supabase_service import SupabaseService

from visit_sync import _sync_visit_to_operation
router = APIRouter(prefix="/api")

db = None
templates_bucket: Optional[AsyncIOMotorGridFSBucket] = None
approvals_subscribers: set = set()


# --------------------- Memory Helper ---------------------
def _mem_read(name: str) -> list:
    try:
        p = os.path.join(os.path.dirname(__file__), "uploads", f"{name}.json")
        if not os.path.exists(p):
            return []
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _mem_write(name: str, items: list):
    try:
        d = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, f"{name}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# --------------------- DB bind ---------------------


def set_db(database):
    global db, templates_bucket
    db = database
    # Only initialize GridFS bucket when we have a valid MongoDB database.
    try:
        if db is not None:
            templates_bucket = AsyncIOMotorGridFSBucket(
                db, bucket_name="invoice_templates"
            )
        else:
            templates_bucket = None
    except Exception as e:
        templates_bucket = None
        print(f"GridFS bucket init failed: {e}")


# --------------------- Settings ---------------------
@router.get("/settings")
async def get_settings():
    try:
        DB_PROVIDER = os.environ.get("DB_PROVIDER", "mongo").lower()

        # Default settings
        default_settings = {
            "id": "app_settings",
            "currency": "SAR",
            "taxRate": 0.0,
            "language": "ar",
            "timezone": "Asia/Riyadh",
            "invoicePrefix": "INV",
            "workshopName": "ورشة السيارات",
            "workshopPhone": "",
            "workshopAddress": "",
            "workshopEmail": "",
            "menuConfig": {
                "simple": False,
                "items": [
                    {"path": "/", "label": "الرئيسية", "enabled": True},
                    {"path": "/operations", "label": "العمليات", "enabled": True},
                    {"path": "/services", "label": "الخدمات", "enabled": True},
                    {"path": "/parts", "label": "قطع الغيار", "enabled": True},
                    {"path": "/catalog", "label": "كتالوج القطع", "enabled": True},
                    {"path": "/customers", "label": "العملاء", "enabled": True},
                    {"path": "/technicians", "label": "الفنيون", "enabled": True},
                    {"path": "/business-accounts", "label": "الفروع", "enabled": True},
                    {
                        "path": "/invoice-templates",
                        "label": "مصمم الفواتير",
                        "enabled": True,
                    },
                    {"path": "/analytics", "label": "التحليلات", "enabled": True},
                    {"path": "/settings", "label": "الإعدادات", "enabled": True},
                ],
            },
        }

        # Supabase provider
        if DB_PROVIDER == "supabase":
            from supabase_service import SupabaseService

            supabase = SupabaseService()
            try:
                res = (
                    supabase.client.table("workshop_settings")
                    .select("*")
                    .eq("id", "app_settings")
                    .maybe_single()
                    .execute()
                )
                if res.data:
                    return res.data
                else:
                    # Create default settings
                    supabase.client.table("workshop_settings").insert(
                        default_settings
                    ).execute()
                    return default_settings
            except:
                return default_settings

        # Memory provider fallback
        if DB_PROVIDER == "memory":
            return default_settings

        # MongoDB
        doc = await db.settings.find_one({"id": "app_settings"})
        if not doc:
            doc = default_settings
            await db.settings.insert_one(doc)

        doc.pop("_id", None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/settings")
async def save_settings(payload: Dict[str, Any] = Body(...)):
    try:
        DB_PROVIDER = os.environ.get("DB_PROVIDER", "mongo").lower()

        # Supabase provider
        if DB_PROVIDER == "supabase":
            from supabase_service import SupabaseService
            from datetime import datetime as _dt

            supabase = SupabaseService()
            payload["id"] = "app_settings"
            payload["updatedAt"] = _dt.utcnow().isoformat()
            try:
                # Try update first
                res = (
                    supabase.client.table("workshop_settings")
                    .update(payload)
                    .eq("id", "app_settings")
                    .execute()
                )
                if res.data:
                    return res.data[0]
                else:
                    # Insert if doesn't exist
                    res = (
                        supabase.client.table("workshop_settings")
                        .insert(payload)
                        .execute()
                    )
                    return res.data[0]
            except:
                return payload

        # In memory mode, don't touch MongoDB
        if DB_PROVIDER == "memory":
            from datetime import datetime as _dt

            return {
                **payload,
                "id": "app_settings",
                "updatedAt": _dt.utcnow().isoformat(),
            }

        # MongoDB
        payload = {**payload, "id": "app_settings", "updatedAt": datetime.utcnow()}
        await db.settings.update_one(
            {"id": "app_settings"}, {"$set": payload}, upsert=True
        )
        doc = await db.settings.find_one({"id": "app_settings"})
        doc.pop("_id", None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Workshop Profile ---------------------
@router.get("/profile")
async def get_workshop_profile():
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            # Store workshop profile in the local JSON file to keep it available regardless of DB provider.
            # This avoids missing workshop data on domains where Mongo isn't used.
            rows = _mem_read("workshop_profile")
            if rows:
                return rows[0]
            profile = {
                "id": "workshop_profile",
                "name": "ورشتي",
                "nameEnglish": "My Workshop",
                "phone": "",
                "whatsapp": "",
                "email": "",
                "address": "",
                "city": "",
                "postalCode": "",
                "commercialRegister": "",
                "workingHours": "",
                "invoiceFooter": "",
                "termsAndConditions": "",
                "slogan": "",
                "logo": "",
            }
            _mem_write("workshop_profile", [profile])
            return profile

        if provider == "memory" or db is None:
            # تخزين مبسط في ملف JSON داخل uploads/workshop_profile.json
            rows = _mem_read("workshop_profile")
            if rows:
                return rows[0]
            # قيمة افتراضية
            profile = {
                "id": "workshop_profile",
                "name": "ورشتي",
                "nameEnglish": "My Workshop",
                "phone": "",
                "whatsapp": "",
                "email": "",
                "address": "",
                "city": "",
                "postalCode": "",
                "taxNumber": "",
                "commercialRegister": "",
                "workingHours": "",
                "invoiceFooter": "",
                "termsAndConditions": "",
            }
            _mem_write("workshop_profile", [profile])
            return profile

        doc = await db.workshop_profile.find_one({"id": "workshop_profile"}, {"_id": 0})
        if not doc:
            doc = {
                "id": "workshop_profile",
                "name": "ورشتي",
                "nameEnglish": "My Workshop",
                "phone": "",
                "whatsapp": "",
                "email": "",
                "address": "",
                "city": "",
                "postalCode": "",
                "taxNumber": "",
                "commercialRegister": "",
                "workingHours": "",
                "invoiceFooter": "",
                "termsAndConditions": "",
            }
            await db.workshop_profile.insert_one(doc)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/profile")
async def update_workshop_profile(payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        # For supabase deployments, persist workshop profile in the local JSON file.
        if provider == "supabase":
            rows = _mem_read("workshop_profile")
            profile = {**(rows[0] if rows else {}), **payload, "id": "workshop_profile"}
            _mem_write("workshop_profile", [profile])
            return profile

        if provider == "memory" or db is None:
            rows = _mem_read("workshop_profile")
            profile = {**(rows[0] if rows else {}), **payload, "id": "workshop_profile"}
            _mem_write("workshop_profile", [profile])
            return profile

        payload = {**payload, "id": "workshop_profile", "updatedAt": datetime.utcnow()}
        await db.workshop_profile.update_one(
            {"id": "workshop_profile"}, {"$set": payload}, upsert=True
        )
        doc = await db.workshop_profile.find_one({"id": "workshop_profile"}, {"_id": 0})
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile/upload-logo")
async def upload_workshop_logo(file: UploadFile = File(...)):
    """Upload workshop logo image"""
    try:
        import base64

        # Read file content
        content = await file.read()

        # Check file size (max 2MB)
        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(
                status_code=400, detail="File size must be less than 2MB"
            )

        # Convert to base64
        base64_image = base64.b64encode(content).decode("utf-8")
        content_type = file.content_type or "image/png"
        logo_url = f"data:{content_type};base64,{base64_image}"

        # Update profile with logo
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider in ["supabase", "memory"] or db is None:
            rows = _mem_read("workshop_profile")
            profile = {
                **(rows[0] if rows else {}),
                "logo": logo_url,
                "id": "workshop_profile",
            }
            _mem_write("workshop_profile", [profile])
        else:
            await db.workshop_profile.update_one(
                {"id": "workshop_profile"},
                {"$set": {"logo": logo_url, "updatedAt": datetime.utcnow()}},
                upsert=True,
            )

        return {"success": True, "logo_url": logo_url, "url": logo_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Auth (WhatsApp OTP) ---------------------
@router.post("/auth/request-otp")
async def request_otp(payload: Dict[str, Any] = Body(...)):
    try:
        phone = (payload or {}).get("phone", "")
        otp_type = (payload or {}).get("type", "login")
        if not phone:
            raise HTTPException(status_code=400, detail="phone required")
        # normalize phone (reuse logic similar to notifications/prepare)
        norm = "".join([c for c in phone if c.isdigit() or c == "+"])
        if norm.startswith("00"):
            norm = norm[2:]
        if norm.startswith("+"):
            norm = norm[1:]
        if norm.startswith("05"):
            norm = "966" + norm[1:]
        if norm.startswith("5") and len(norm) == 9:
            norm = "966" + norm
        if not norm.startswith("966"):
            norm = "966" + norm

            norm = "966" + norm
        token = f"OTP-{str(uuid.uuid4())[:6].upper()}"
        doc = {
            "id": str(uuid.uuid4()),
            "phone": norm,
            "token": token,
            "type": otp_type,
            "createdAt": datetime.utcnow(),
            "expiresAt": datetime.utcnow() + timedelta(minutes=10),
            "used": False,
        }
        await db.auth_otps.insert_one(doc)
        import urllib.parse

        msg = f"رمز الدخول الخاص بك: {token} — صالح لمدة 10 دقائق"
        deeplink = f"https://wa.me/{norm}?text={urllib.parse.quote(msg)}"
        ret = {
            "token": token,
            "whatsappDeeplink": deeplink,
            "expiresAt": doc["expiresAt"].isoformat(),
        }
        return ret
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Business Accounts ---------------------
@router.get("/biz-accounts")
async def list_biz_accounts():
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.accounts_list()
        if provider == "memory" or db is None:
            # وضع معاينة بدون قاعدة بيانات حقيقية – الحفظ في ملف JSON داخل uploads
            return _mem_read("business_accounts")

        # استخدام Projection وحد لعدد النتائج لتحسين الأداء
        docs = (
            await db.business_accounts.find(
                {},
                {
                    "_id": 0,
                    "id": 1,
                    "name": 1,
                    "code": 1,
                    "currency": 1,
                    "createdAt": 1,
                },
            )
            .sort("createdAt", -1)
            .limit(500)
            .to_list(500)
        )
        out = []
        for d in docs:
            created_at = d.get("createdAt")
            out.append(
                {
                    "id": d.get("id"),
                    "name": d.get("name"),
                    "code": d.get("code"),
                    "currency": d.get("currency") or "SAR",
                    "createdAt": (
                        created_at.isoformat()
                        if hasattr(created_at, "isoformat")
                        else created_at
                    ),
                }
            )
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/biz-accounts")
async def create_biz_account(payload: Dict[str, Any] = Body(...)):
    try:
        name = (payload or {}).get("name")
        code = (payload or {}).get("code") or (name or "")[:4].upper()
        currency = (payload or {}).get("currency") or "SAR"
        if not name:
            raise HTTPException(status_code=400, detail="name required")

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.accounts_create(name=name, code=code, currency=currency)
        if provider == "memory" or db is None:
            # وضع معاينة: حفظ في ملف JSON داخل uploads/business_accounts.json
            doc = {
                "id": str(uuid.uuid4()),
                "name": name,
                "code": code,
                "currency": currency,
                "createdAt": datetime.utcnow().isoformat(),
            }
            items = _mem_read("business_accounts")
            items.append(doc)
            _mem_write("business_accounts", items)
            return doc

        # ensure unique code if exists (Mongo)
        exist = await db.business_accounts.find_one({"code": code})
        if exist:
            code = f"{code}-{str(uuid.uuid4())[:4].upper()}"
        doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "code": code,
            "currency": currency,
            "createdAt": datetime.utcnow(),
        }
        await db.business_accounts.insert_one(doc)
        doc.pop("_id", None)
        doc["createdAt"] = doc["createdAt"].isoformat()
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Budgets ---------------------
@router.get("/budgets")
async def list_budgets(account_id: Optional[str] = None, period: Optional[str] = None):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.budgets_list(account_id, period)

        q = {}
        if account_id:
            q["accountId"] = account_id
        if period:
            q["period"] = period
        items = await db.budgets.find(q).sort("period", -1).to_list(1000)
        for it in items:
            it.pop("_id", None)
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/budgets")
async def create_budget(payload: Dict[str, Any] = Body(...)):
    try:
        account_id = payload.get("accountId")
        if not account_id:
            raise HTTPException(status_code=400, detail="accountId required")

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.budgets_create(payload)

        doc = {
            "id": str(uuid.uuid4()),
            "accountId": account_id,
            "period": payload.get("period") or datetime.utcnow().strftime("%Y-%m"),
            "incomeTarget": float(payload.get("incomeTarget") or 0),
            "expenseTarget": float(payload.get("expenseTarget") or 0),
            "notes": payload.get("notes") or "",
            "createdAt": datetime.utcnow(),
        }
        await db.budgets.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Branch Cleanup (Keep only 2) ---------------------
@router.post("/biz-accounts/cleanup")
async def cleanup_biz_accounts(keep: int = 2, mode: str = "hard"):
    """Delete all branches and keep only N (default 2) most recent.
    mode: 'hard' = physical delete, 'soft' = set {'archived': True, 'active': False}
    Ensures at least 2 accounts exist by creating defaults if needed.
    """
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        keep = max(0, int(keep or 2))

        if provider == "supabase":
            supa = SupabaseService()
            # لجعل السلوك بسيط في Supabase: نحذف كل شيء ونحتفظ بعدد N الأحدث
            rows = supa.accounts_list()
            to_keep = [r["id"] for r in rows[:keep] if r.get("id")]
            to_drop = [r["id"] for r in rows[keep:] if r.get("id")]
            if to_drop:
                if mode == "soft":
                    # لا يوجد archived في السكيمة الحالية، نستخدم active=False كبديل
                    supa.client.table("business_accounts").update(
                        {"active": False}
                    ).in_("id", to_drop).execute()
                else:
                    supa.client.table("business_accounts").delete().in_(
                        "id", to_drop
                    ).execute()
            # ضمان وجود فرعين على الأقل
            created = []
            remain_count = len(to_keep)
            while remain_count < 2:
                base_code = "ACC" if remain_count == 0 else f"BR{remain_count+1:02d}"
                doc = {
                    "name": (
                        "Main Workshop"
                        if remain_count == 0
                        else f"Branch {remain_count+1}"
                    ),
                    "code": base_code,
                    "currency": "SAR",
                }
                res = supa.client.table("business_accounts").insert(doc).execute()
                row = (res.data or [{}])[0]
                created.append({"id": row.get("id"), "name": row.get("name")})
                to_keep.append(row.get("id"))
                remain_count += 1
            return {"status": "ok", "kept": to_keep, "created": created, "final": []}

        if provider == "memory" or db is None:
            # في وضع المعاينة لا نقوم بأي حذف حقيقي
            return {"status": "ok", "kept": [], "created": [], "final": []}

        # Mongo behavior (قديم)
        # Sort by updatedAt desc then createdAt desc
        docs = (
            await db.business_accounts.find({})
            .sort([("updatedAt", -1), ("createdAt", -1)])
            .to_list(length=5000)
        )
        to_keep = [d.get("id") for d in docs[:keep] if d.get("id")]
        to_drop = [d.get("id") for d in docs[keep:] if d.get("id")]
        if to_drop:
            if mode == "soft":
                await db.business_accounts.update_many(
                    {"id": {"$in": to_drop}},
                    {
                        "$set": {
                            "archived": True,
                            "active": False,
                            "updatedAt": datetime.utcnow(),
                        }
                    },
                )
            else:
                await db.business_accounts.delete_many({"id": {"$in": to_drop}})
        # Ensure at least 2 exist
        remain_count = await db.business_accounts.count_documents(
            {"archived": {"$ne": True}}
        )
        created = []
        while remain_count < 2:
            base_code = "ACC" if remain_count == 0 else f"BR{remain_count+1:02d}"
            doc = {
                "id": str(uuid.uuid4()),
                "name": (
                    "Main Workshop" if remain_count == 0 else f"Branch {remain_count+1}"
                ),
                "code": base_code,
                "currency": "SAR",
                "createdAt": datetime.utcnow(),
            }
            await db.business_accounts.insert_one(doc)
            created.append({"id": doc["id"], "name": doc["name"]})
            remain_count += 1
        # return final state (2 accounts)
        final_docs = (
            await db.business_accounts.find({"archived": {"$ne": True}})
            .sort([("updatedAt", -1), ("createdAt", -1)])
            .to_list(length=10)
        )
        for d in final_docs:
            d.pop("_id", None)
            if d.get("createdAt") and hasattr(d["createdAt"], "isoformat"):
                d["createdAt"] = d["createdAt"].isoformat()
            if d.get("updatedAt") and hasattr(d["updatedAt"], "isoformat"):
                d["updatedAt"] = d["updatedAt"].isoformat()
        return {
            "status": "ok",
            "kept": to_keep,
            "created": created,
            "final": final_docs[:2],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Pending Operations (Vehicles awaiting action) ---------------------
@router.get("/operations/pending")
async def operations_pending(
    status: Optional[str] = None, technician_id: Optional[str] = None
):
    """Return list of vehicles considered 'pending' = not ready/delivered.
    Optional filter by single status or technician_id.
    """
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            vehs = supa.vehicles_list()
            pending_statuses = ["diagnosis", "quotation", "repair"]
            vehs = [v for v in vehs if v.get("status") in pending_statuses]
            if status and status != "all":
                vehs = [v for v in vehs if v.get("status") == status]
            if technician_id:
                vehs = [v for v in vehs if v.get("technicianId") == technician_id]
            return {"count": len(vehs), "items": vehs}

        if provider == "memory" or db is None:
            vrows = _mem_read("vehicles")
            pending = [
                v
                for v in vrows
                if v.get("status") in ["diagnosis", "quotation", "repair"]
            ]
            return {"count": len(pending), "items": pending}

        pending_statuses = ["diagnosis", "quotation", "repair"]
        q: Dict[str, Any] = {"status": {"$in": pending_statuses}}
        if status:
            if status == "all":
                pass
            else:
                q["status"] = status
        if technician_id:
            q["technicianId"] = technician_id
        fields = {
            "_id": 0,
            "id": 1,
            "plateNumber": 1,
            "brand": 1,
            "model": 1,
            "year": 1,
            "status": 1,
            "technicianId": 1,
            "technicianName": 1,
            "entryDate": 1,
            "estimatedCompletion": 1,
            "customerName": 1,
            "customerPhone": 1,
        }
        docs = (
            await db.vehicles.find(q, fields).sort("entryDate", -1).to_list(length=2000)
        )
        for d in docs:
            for k in ("entryDate", "estimatedCompletion"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
        return {"count": len(docs), "items": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/operations/analytics/pending")
async def operations_pending_analytics():
    """Summary counts for pending vehicles and overdue stats."""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            vehs = supa.vehicles_list()
            pending_statuses = ["diagnosis", "quotation", "repair"]
            vehs = [v for v in vehs if v.get("status") in pending_statuses]
            by_status = {s: 0 for s in pending_statuses}
            overdue = 0
            now = datetime.utcnow()
            for v in vehs:
                st = v.get("status")
                if st in by_status:
                    by_status[st] += 1
                est = v.get("estimatedCompletion")
                if est:
                    try:
                        dt = datetime.fromisoformat(est.replace("Z", "+00:00"))
                        if dt.tzinfo:
                            dt = dt.replace(tzinfo=None)
                        if dt < now:
                            overdue += 1
                    except:
                        pass
            return {"total": len(vehs), "byStatus": by_status, "overdue": overdue}

        if provider == "memory" or db is None:
            vrows = _mem_read("vehicles")
            by = {"diagnosis": 0, "quotation": 0, "repair": 0}
            for v in vrows:
                st = v.get("status")
                if st in by:
                    by[st] += 1
            return {"total": sum(by.values()), "byStatus": by, "overdue": 0}

        pending_statuses = ["diagnosis", "quotation", "repair"]
        now = datetime.utcnow()
        fields = {"_id": 0, "status": 1, "estimatedCompletion": 1}
        docs = await db.vehicles.find(
            {"status": {"$in": pending_statuses}}, fields
        ).to_list(length=20000)
        by_status: Dict[str, int] = {s: 0 for s in pending_statuses}
        overdue = 0
        for d in docs:
            st = d.get("status")
            if st in by_status:
                by_status[st] += 1
            est = d.get("estimatedCompletion")
            if est and hasattr(est, "isoformat"):
                # est is datetime
                if est < now:
                    overdue += 1
        total = len(docs)
        return {"total": total, "byStatus": by_status, "overdue": overdue}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/biz-accounts/{aid}")
async def update_biz_account(aid: str, payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            upd = {}
            for k in ("name", "currency", "isActive", "code"):
                if (payload or {}).get(k) is not None:
                    upd[k] = payload[k]

            if not upd:
                return {"status": "no_changes"}

            res = (
                supa.client.table("business_accounts")
                .update(upd)
                .eq("id", aid)
                .execute()
            )
            if not res.data:
                raise HTTPException(status_code=404, detail="not found")

            return res.data[0]

        # MongoDB fallback
        upd = {}
        for k in ("name", "currency"):
            if (payload or {}).get(k) is not None:
                upd[k] = payload[k]
        if not upd:
            return {"status": "no_changes"}
        await db.business_accounts.update_one(
            {"id": aid}, {"$set": {**upd, "updatedAt": datetime.utcnow()}}
        )
        d = await db.business_accounts.find_one({"id": aid})
        if not d:
            raise HTTPException(status_code=404, detail="not found")
        d.pop("_id", None)
        if d.get("createdAt") and hasattr(d["createdAt"], "isoformat"):
            d["createdAt"] = d["createdAt"].isoformat()
        if d.get("updatedAt") and hasattr(d["updatedAt"], "isoformat"):
            d["updatedAt"] = d["updatedAt"].isoformat()
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- COA ---------------------
DEFAULT_COA = {
    "Assets": {"Current Assets": ["Cash", "Bank"], "Fixed Assets": ["Equipment"]},
    "Liabilities": {"Current Liabilities": ["Accounts Payable"]},
    "Equity": {"Owner Equity": []},
    "Income": {"Sales": ["Services Income", "Parts Income"], "Other Income": []},
    "Expenses": {
        "Operating Expenses": [
            "Electricity",
            "Water",
            "Fuel",
            "Rent",
            "Salaries",
            "Utilities",
            "Marketing",
            "Misc",
        ],
        "Personal Expenses": ["Personal"],
    },
}


@router.get("/coa/tree")
async def coa_tree():
    try:
        doc = await db.coa.find_one({"id": "root_tree"})
    except Exception:
        doc = None
    if not doc:
        doc = {"id": "root_tree", "tree": DEFAULT_COA, "createdAt": datetime.utcnow()}
        await db.coa.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/coa/tree")
async def save_coa_tree(payload: Dict[str, Any] = Body(...)):
    try:
        tree = (payload or {}).get("tree")
        if not isinstance(tree, dict):
            raise HTTPException(status_code=400, detail="tree invalid")
        await db.coa.update_one(
            {"id": "root_tree"},
            {"$set": {"tree": tree, "updatedAt": datetime.utcnow()}},
            upsert=True,
        )
        doc = await db.coa.find_one({"id": "root_tree"})
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Operations & Analytics ---------------------
# NOTE: This app uses a modern chart of accounts (e.g., 1101 cash, 1102 bank, 1103 customers, 2101 suppliers).
# Legacy codes (101/113/211/411/514) caused misclassification in reports.
ACCOUNT_NAME_MAP = {
    "1101": "النقد",
    "1102": "البنك",
    "1103": "العملاء (ذمم مدينة)",
    "2101": "الموردون (ذمم دائنة)",
    "4100": "إيرادات الخدمات",
    "6101": "رواتب إدارية",
    "3102": "مسحوبات المالك",
    "1201": "معدات ميكانيكية",
    "6100": "مصروفات عامة وإدارية",
}

# Fallback mapping: if an entry stores account as an internal id like acc-1101, map it to the numeric code.
ACCOUNT_ID_TO_CODE = {
    "acc-1101": "1101",
    "acc-1102": "1102",
    "acc-1103": "1103",
    "acc-2101": "2101",
    "acc-4100": "4100",
    "acc-6101": "6101",
    "acc-3102": "3102",
    "acc-1201": "1201",
    "acc-6100": "6100",
}


def _safe_amount(value: Any) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _build_operation_journal_entry(op: Dict[str, Any], workshop_id: Optional[str]):
    """Build an accrual journal entry for an operation.

    Rules (Accrual basis):
    - Sale (cash):   Dr Cash/Bank,   Cr Revenue
    - Sale (credit): Dr AR,          Cr Revenue
    - Purchase/Expense (cash):   Dr Selected account (or 6100), Cr Cash/Bank
    - Purchase/Expense (credit): Dr Selected account (or 6100), Cr AP

    Note: In this codebase, Operations form provides `accountId` which refers to the *debit* account
    for purchases/expenses (e.g., equipment asset 1201, materials expense 5103, salaries 6101, owner draw 3102).
    """

    if not workshop_id:
        return None

    op_type = (op.get("type") or "").lower()
    payment_method = (op.get("paymentMethod") or op.get("payment_method") or "cash").lower()
    total = _safe_amount(op.get("total"))
    if total <= 0:
        return None

    is_credit = payment_method == "credit"

    # Choose cash/bank code for non-credit payments
    cash_code = "1101"
    if payment_method in ("transfer", "bank"):
        cash_code = "1102"

    def _to_code(account_ref: Optional[str]) -> Optional[str]:
        if not account_ref:
            return None
        v = str(account_ref).strip()
        if not v:
            return None
        # Map acc-XXXX to XXXX when possible
        if v in ACCOUNT_ID_TO_CODE:
            return ACCOUNT_ID_TO_CODE[v]
        # allow numeric codes directly
        return v

    selected_code = _to_code(
        op.get("accountingAccountId")
        or op.get("accounting_account_id")
        or op.get("accountId")
        or op.get("account_id")
    )

    lines = []
    transaction_type = None

    if op_type in ("sale", "service"):
        transaction_type = "sale"
        debit_code = "1103" if is_credit else cash_code
        lines = [
            {
                "account": debit_code,
                "account_name": ACCOUNT_NAME_MAP.get(debit_code, debit_code),
                "debit": total,
                "credit": 0,
            },
            {
                "account": "4100",
                "account_name": ACCOUNT_NAME_MAP.get("4100", "4100"),
                "debit": 0,
                "credit": total,
            },
        ]

    elif op_type in ("purchase", "expense"):
        transaction_type = "purchase" if op_type == "purchase" else "expense"

        # Default for purchases if no account selected: operating expenses (6100)
        debit_code = selected_code or "6100"
        credit_code = "2101" if is_credit else cash_code

        lines = [
            {
                "account": debit_code,
                "account_name": ACCOUNT_NAME_MAP.get(debit_code, debit_code),
                "debit": total,
                "credit": 0,
            },
            {
                "account": credit_code,
                "account_name": ACCOUNT_NAME_MAP.get(credit_code, credit_code),
                "debit": 0,
                "credit": total,
            },
        ]

    else:
        return None

    return {
        "id": str(uuid.uuid4()),
        "workshop_id": workshop_id,
        "date": op.get("date") or op.get("op_date") or datetime.utcnow().isoformat(),
        "description": op.get("notes")
        or f"عملية {transaction_type} - {op.get('partnerName') or op.get('partner_name') or ''}",
        "lines": lines,
        "total": total,
        "source": "operation",
        "transaction_type": transaction_type,
        "reference_id": op.get("id"),
    }


def _safe_insert_journal_entry(supa: SupabaseService, entry: Dict[str, Any]):
    if not entry:
        return None
    try:
        return supa.client.table("journal_entries").insert(entry).execute().data
    except Exception as error:
        print(f"Journal entry insert failed, retry basic fields: {error}")
        basic = {
            k: entry.get(k)
            for k in [
                "id",
                "workshop_id",
                "date",
                "description",
                "lines",
                "total",
            ]
        }
        try:
            return supa.client.table("journal_entries").insert(basic).execute().data
        except Exception as error2:
            print(f"Journal entry insert failed: {error2}")
            return None
@router.get("/operations")
async def list_operations(
    account_id: Optional[str] = None,
    type: Optional[str] = None,
    vehicle_id: Optional[str] = None,
):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            ops = supa.operations_list(
                account_id=account_id, type=type, vehicle_id=vehicle_id
            )
            return ops

        if provider == "memory" or db is None:
            ops = _mem_read("operations")
            if account_id:
                ops = [o for o in ops if o.get("accountId") == account_id]
            if type:
                ops = [o for o in ops if o.get("type") == type]
            if vehicle_id:
                ops = [o for o in ops if o.get("vehicleId") == vehicle_id]
            return ops

        q: Dict[str, Any] = {}
        if account_id:
            q["accountId"] = account_id
        if type:
            q["type"] = type
        if vehicle_id:
            q["vehicleId"] = vehicle_id
        ops = (
            await db.operations.find(
                q,
                {
                    "_id": 0,
                    "id": 1,
                    "type": 1,
                    "partnerName": 1,
                    "total": 1,
                    "items": 1,
                    "date": 1,
                    "vehicleId": 1,
                },
            )
            .sort("date", -1)
            .to_list(length=2000)
        )
        for o in ops:
            o.pop("_id", None)
            if o.get("date") and hasattr(o["date"], "isoformat"):
                o["date"] = o["date"].isoformat()
            # استنتاج نوع العملية (مركبة / ورشة) بناءً على وجود vehicleId
            o["scope"] = "vehicle" if o.get("vehicleId") else "workshop"
        return ops
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/operations/{op_id}")
async def get_operation(op_id: str):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            # TODO: implement get one in supabase service
            supa = SupabaseService()
            o = supa.operations_get(op_id)
            if not o:
                raise HTTPException(status_code=404, detail="not found")
            return o

        if provider == "memory" or db is None:
            ops = _mem_read("operations")
            for o in ops:
                if o.get("id") == op_id:
                    return o
            raise HTTPException(status_code=404, detail="not found")

        o = await db.operations.find_one({"id": op_id})
        if not o:
            raise HTTPException(status_code=404, detail="not found")
        o.pop("_id", None)
        if o.get("date") and hasattr(o["date"], "isoformat"):
            o["date"] = o["date"].isoformat()
        return o
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/operations/{op_id}")
async def update_operation(op_id: str, payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.operations_update(op_id, payload)

        if provider == "memory" or db is None:
            ops = _mem_read("operations")
            for i, o in enumerate(ops):
                if o.get("id") == op_id:
                    ops[i] = {
                        **o,
                        **payload,
                        "updatedAt": datetime.utcnow().isoformat(),
                    }
                    _mem_write("operations", ops)
                    return ops[i]
            raise HTTPException(status_code=404, detail="not found")

        await db.operations.update_one(
            {"id": op_id}, {"$set": {**payload, "updatedAt": datetime.utcnow()}}
        )
        o = await db.operations.find_one({"id": op_id})
        if not o:
            raise HTTPException(status_code=404, detail="not found")
        o.pop("_id", None)
        if o.get("date") and hasattr(o["date"], "isoformat"):
            o["date"] = o["date"].isoformat()
        return o
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/operations/{op_id}")
async def delete_operation(op_id: str):
    """Delete a single operation + cascade delete any linked journal entries (source=operation, reference_id=op_id)."""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()

            # 1) delete linked journal entries first (any source) by reference_id
            try:
                supa.client.table("journal_entries").delete().eq("reference_id", op_id).execute()
            except Exception as e:
                # If schema doesn't have reference_id, ignore to avoid breaking delete operation
                print(f"Cascade journal delete skipped/failed: {e}")

            # 2) delete operation
            supa.operations_delete(op_id)
            return {"success": True}

        if provider == "memory" or db is None:
            ops = _mem_read("operations")
            ops = [o for o in ops if o.get("id") != op_id]
            _mem_write("operations", ops)
            return {"success": True}

        await db.operations.delete_one({"id": op_id})
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/operations")
async def delete_all_operations():
    """Delete all operations - for cleanup/reset"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            # Delete all operations - use gt filter instead of neq
            try:
                # Get all operations first
                all_ops = supa.operations_list()
                # Delete each one
                for op in all_ops:
                    try:
                        supa.client.table("operations").delete().eq(
                            "id", op["id"]
                        ).execute()
                    except:
                        pass
                return {
                    "success": True,
                    "message": f"Deleted {len(all_ops)} operations",
                }
            except Exception as e:
                return {
                    "success": True,
                    "message": "Operations table cleared",
                    "note": str(e),
                }

        if provider == "memory" or db is None:
            _mem_write("operations", [])
            return {"success": True, "message": "All operations deleted"}

        result = await db.operations.delete_many({})
        return {
            "success": True,
            "message": f"Deleted {result.deleted_count} operations",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/operations/{op_id}/confirm-payment")
async def confirm_operation_payment(op_id: str, payload: Dict[str, Any] = Body(None)):
    """تأكيد سداد عملية آجل.

    - الآجل يُسجَّل في operations (Accrual) فقط.
    - عند التحصيل/السداد يتم إنشاء قيد يومية يعكس حركة النقد:
      * بيع: مدين نقدية 101 / دائن ذمم 113
      * شراء: مدين ذمم دائنة 211 / دائن نقدية 101

    يدعم الدفعات الجزئية عبر payload.amount.
    """
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider != "supabase":
            raise HTTPException(status_code=400, detail="confirm-payment supported only for supabase provider")

        supa = SupabaseService()
        workshop_id = (payload or {}).get("workshopId") or (payload or {}).get("workshop_id")
        if not workshop_id:
            raise HTTPException(status_code=400, detail="workshopId required")

        op_rows = (
            supa.client.table("operations").select("*").eq("id", op_id).execute().data
            or []
        )
        if not op_rows:
            raise HTTPException(status_code=404, detail="operation not found")
        op_row = op_rows[0]

        if (op_row.get("payment_method") or "").lower() != "credit":
            return {"success": True, "message": "operation is not credit"}

        op_type = (op_row.get("type") or "").lower()
        total = float(op_row.get("total") or 0)
        if total <= 0:
            raise HTTPException(status_code=400, detail="invalid operation total")

        amount = None
        if (payload or {}).get("amount") is not None:
            try:
                amount = float((payload or {}).get("amount"))
            except Exception:
                raise HTTPException(status_code=400, detail="invalid amount")

        pay_amount = amount if amount is not None else total
        if pay_amount <= 0:
            raise HTTPException(status_code=400, detail="amount must be > 0")

        already_paid = 0.0
        try:
            prev = (
                supa.client.table("journal_entries")
                .select("total")
                .eq("source", "operation_payment")
                .eq("reference_id", op_id)
                .execute()
                .data
                or []
            )
            for je in prev:
                already_paid += float(je.get("total") or 0)
        except Exception as e:
            print(f"Payment lookup failed: {e}")

        remaining = max(0.0, total - already_paid)
        if pay_amount > remaining + 0.0001:
            pay_amount = remaining
        if pay_amount <= 0:
            return {"success": True, "message": "no remaining amount to confirm"}

        # Choose cash/bank account for settlement
        payment_method = (op_row.get("payment_method") or "cash").lower()
        cash_code = "1101"
        if payment_method in ("transfer", "bank"):
            cash_code = "1102"

        if op_type in ("sale", "service"):
            # Dr Cash/Bank, Cr AR
            lines = [
                {
                    "account": cash_code,
                    "account_name": ACCOUNT_NAME_MAP.get(cash_code, cash_code),
                    "debit": pay_amount,
                    "credit": 0,
                },
                {
                    "account": "1103",
                    "account_name": ACCOUNT_NAME_MAP.get("1103", "1103"),
                    "debit": 0,
                    "credit": pay_amount,
                },
            ]
            desc = f"تحصيل آجل - {op_row.get('partner_name') or ''}"
        elif op_type in ("purchase", "expense"):
            # Dr AP, Cr Cash/Bank
            lines = [
                {
                    "account": "2101",
                    "account_name": ACCOUNT_NAME_MAP.get("2101", "2101"),
                    "debit": pay_amount,
                    "credit": 0,
                },
                {
                    "account": cash_code,
                    "account_name": ACCOUNT_NAME_MAP.get(cash_code, cash_code),
                    "debit": 0,
                    "credit": pay_amount,
                },
            ]
            desc = f"سداد آجل - {op_row.get('partner_name') or ''}"
        else:
            raise HTTPException(status_code=400, detail="unsupported operation type")

        pay_date = (payload or {}).get("date")
        entry = {
            "id": str(uuid.uuid4()),
            "workshop_id": workshop_id,
            "date": pay_date or datetime.utcnow().isoformat(),
            "description": desc,
            "lines": lines,
            "total": pay_amount,
            "source": "operation_payment",
            "transaction_type": "payment",
            "reference_id": op_id,
        }
        _safe_insert_journal_entry(supa, entry)

        # Cleanup legacy rows that might have been inserted without workshop_id (fallback insert)
        try:
            supa.client.table("journal_entries").delete().is_("workshop_id", "null").execute()
        except Exception:
            pass

        return {
            "success": True,
            "data": {
                "paid": round(pay_amount, 2),
                "remaining": round(max(0.0, remaining - pay_amount), 2),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ AutoProfit Pro Integration: Apply Accounting Entries ============


@router.post("/operations")
async def create_operation(payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            workshop_id = payload.get("workshopId") or payload.get("workshop_id")
            op = supa.operations_create(payload)

            # Auto-create invoice record linked to this operation (best-effort)
            try:
                if op.get("invoiceNumber"):
                    supa.invoices_create(
                        {
                            "invoiceNumber": op.get("invoiceNumber"),
                            "workshopId": workshop_id,
                            "operationId": op.get("id"),
                            "partnerName": op.get("partnerName"),
                            "vehicleId": op.get("vehicleId"),
                            "items": op.get("items") or [],
                            "subtotal": op.get("subtotal") or 0,
                            "tax": 0,
                            "discount": 0,
                            "total": op.get("total") or 0,
                            "status": "issued",
                            "type": "invoice",
                            "paymentMethod": op.get("paymentMethod"),
                            "notes": f"Linked to operation {op.get('id')}",
                        }
                    )
            except Exception as e:
                print(f"Warning: auto-invoice create failed: {e}")
            # ✅ Accrual basis: always create a journal entry for sale/purchase/expense
            # - Credit operations will hit AR/AP
            # - Cash/transfer operations will hit Cash/Bank
            try:
                entry = _build_operation_journal_entry(op, workshop_id)
                _safe_insert_journal_entry(supa, entry)
            except Exception as je_error:
                print(f"Failed to create journal entry for operation: {je_error}")

            return op

        if provider == "memory" or db is None:
            rows = _mem_read("operations")
            items = payload.get("items") or []
            subtotal = sum(
                (float(it.get("price", 0)) * float(it.get("qty", 1))) for it in items
            )
            doc = {
                "id": str(uuid.uuid4()),
                "type": payload.get("type", "service"),
                "accountId": payload.get("accountId"),
                "vehicleId": payload.get("vehicleId"),
                "partnerType": payload.get("partnerType"),
                "partnerName": payload.get("partnerName"),
                "items": items,
                "subtotal": subtotal,
                "total": subtotal,
                "paymentMethod": payload.get("paymentMethod", "cash"),
                "notes": payload.get("notes"),
                "date": datetime.utcnow().isoformat(),
                "createdAt": datetime.utcnow().isoformat(),
            }
            rows.append(doc)
            _mem_write("operations", rows)
            return doc

        items = payload.get("items", [])
        subtotal = 0.0
        for it in items:
            qty = float(it.get("quantity", 1))
            price = float(it.get("price", 0))
            it["total"] = qty * price
            subtotal += it["total"]
        op = {
            "id": str(uuid.uuid4()),
            "accountId": payload.get("accountId", ""),
            "vehicleId": payload.get("vehicleId"),
            "type": payload.get("type", "purchase"),
            "partnerType": payload.get("partnerType", "supplier"),
            "partnerName": payload.get("partnerName"),
            "items": items,
            "subtotal": subtotal,
            "total": subtotal,
            "paymentMethod": payload.get("paymentMethod", "cash"),
            "paymentStatus": payload.get("paymentStatus", "paid"),
            "notes": payload.get("notes"),
            "date": datetime.utcnow(),
            "createdAt": datetime.utcnow(),
        }
        await db.operations.insert_one(op)

        # inventory adjust for parts
        if op["type"] in ("purchase", "sale"):
            for it in items:
                if it.get("itemType") == "part" and it.get("itemId"):
                    delta = int(float(it.get("quantity", 0)))
                    if op["type"] == "sale":
                        delta = -delta
                    await db.parts.update_one(
                        {"id": it["itemId"]}, {"$inc": {"quantity": delta}}
                    )
        # transaction record (income/expense)
        tx = {
            "id": str(uuid.uuid4()),
            "accountId": op["accountId"],
            "vehicleId": op.get("vehicleId"),
            "type": "income" if op["type"] == "sale" else "expense",
            "category": f"operation_{op['type']}",
            "amount": subtotal,
            "description": f"{op['type']} - {op.get('partnerName') or ''}",
            "date": op["date"],
            "reference": op["id"],
            "createdAt": datetime.utcnow(),
        }
        try:
            await db.transactions.insert_one(tx)
        except Exception:
            pass
        op.pop("_id", None)
        if hasattr(op["date"], "isoformat"):
            op["date"] = op["date"].isoformat()
        return op
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/operations/analytics/summary")
async def operations_analytics(account_id: Optional[str] = None):
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_start = today.replace(day=1)

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        ops = []

        if provider == "supabase":
            supa = SupabaseService()
            ops = supa.operations_list()
            if account_id:
                ops = [o for o in ops if o.get("accountId") == account_id]
        elif provider == "memory" or db is None:
            ops = _mem_read("operations")
            if account_id:
                ops = [o for o in ops if o.get("accountId") == account_id]
        else:
            q: Dict[str, Any] = {}
            if account_id:
                q["accountId"] = account_id
            ops = await db.operations.find(
                q, {"_id": 0, "type": 1, "total": 1, "date": 1}
            ).to_list(length=100000)

        def parse_date(x):
            d = x.get("date")
            if isinstance(d, str):
                try:
                    return datetime.fromisoformat(d.replace("Z", "+00:00"))
                except Exception:
                    return today
            return d or today

            return d or today

        def agg(start):
            sales = 0.0
            expenses = 0.0
            sales_count = 0
            expenses_count = 0
            for o in ops:
                d = parse_date(o)
                # naive comparison fix
                if d.tzinfo is not None and start.tzinfo is None:
                    d = d.replace(tzinfo=None)

                if d >= start:
                    t = float(o.get("total", 0))
                    if o.get("type") == "sale":
                        sales += t
                        sales_count += 1
                    elif o.get("type") == "purchase":
                        expenses += t
                        expenses_count += 1
            return sales, expenses, sales - expenses, sales_count, expenses_count

        tS, tE, tP, tSc, tEc = agg(today)
        wS, wE, wP, wSc, wEc = agg(week_ago)
        mS, mE, mP, mSc, mEc = agg(month_start)
        return {
            "today": {
                "sales": tS,
                "expenses": tE,
                "profit": tP,
                "salesCount": tSc,
                "expensesCount": tEc,
            },
            "week": {
                "sales": wS,
                "expenses": wE,
                "profit": wP,
                "salesCount": wSc,
                "expensesCount": wEc,
            },
            "month": {
                "sales": mS,
                "expenses": mE,
                "profit": mP,
                "salesCount": mSc,
                "expensesCount": mEc,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Transactions & Expenses ---------------------
@router.get("/transactions")
async def list_transactions(
    type: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    account_id: Optional[str] = None,
):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.transactions_list(type=type, account_id=account_id)

        if provider == "memory" or db is None:
            return []

        q: Dict[str, Any] = {}
        if type:
            q["type"] = type
        if vehicle_id:
            q["vehicleId"] = vehicle_id
        if account_id:
            q["accountId"] = account_id
        docs = await db.transactions.find(q).sort("date", -1).to_list(length=5000)
        for d in docs:
            d.pop("_id", None)
            if d.get("date") and hasattr(d["date"], "isoformat"):
                d["date"] = d["date"].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expenses")
async def create_expense(payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            return supa.transactions_create(payload)

        if provider == "memory" or db is None:
            return {
                "id": str(uuid.uuid4()),
                "accountId": payload.get("accountId", ""),
                "vehicleId": payload.get("vehicleId"),
                "type": "expense",
                "category": payload.get("category", "Operating Expenses"),
                "amount": float(payload.get("amount") or 0),
                "description": payload.get("description", ""),
                "date": datetime.utcnow().isoformat(),
                "reference": payload.get("reference"),
                "createdAt": datetime.utcnow().isoformat(),
            }

        tx = {
            "id": str(uuid.uuid4()),
            "accountId": payload.get("accountId", ""),
            "vehicleId": payload.get("vehicleId"),
            "type": "expense",
            "category": payload.get("category", "Operating Expenses"),
            "amount": float(payload.get("amount") or 0),
            "description": payload.get("description", ""),
            "date": datetime.utcnow(),
            "reference": payload.get("reference"),
            "createdAt": datetime.utcnow(),
        }
        await db.transactions.insert_one(tx)
        tx.pop("_id", None)
        if hasattr(tx["date"], "isoformat"):
            tx["date"] = tx["date"].isoformat()
        return tx
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Approvals + Logs + SSE ---------------------
async def _log_approval_event(
    token: str,
    vehicle_id: str,
    customer_id: str,
    title: str,
    amount: float,
    status: str,
    service_items: list = None,
    service_items_text: str = None,
    responded_at: datetime = None,
):
    try:
        doc = await db.customer_approval_logs.find_one({"token": token})
        base = {
            "token": token,
            "vehicleId": vehicle_id,
            "customerId": customer_id,
            "title": title,
            "amount": amount,
            "status": status,
            "serviceItems": service_items or [],
            "serviceItemsText": service_items_text,
        }
        if doc:
            update = {**base, "updatedAt": datetime.utcnow()}
            if responded_at:
                update["respondedAt"] = responded_at
            await db.customer_approval_logs.update_one(
                {"token": token}, {"$set": update}
            )
        else:
            newdoc = {"id": str(uuid.uuid4()), **base, "createdAt": datetime.utcnow()}
            if responded_at:
                newdoc["respondedAt"] = responded_at
            await db.customer_approval_logs.insert_one(newdoc)
    except Exception as e:
        print(f"approval log error: {e}")


@router.get("/customers/{customer_id}/approval-logs")
async def get_customer_approval_logs(customer_id: str):
    try:
        docs = (
            await db.customer_approval_logs.find({"customerId": customer_id})
            .sort("createdAt", -1)
            .to_list(length=1000)
        )
        for d in docs:
            d.pop("_id", None)
            for k in ("createdAt", "updatedAt", "respondedAt"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vehicles/{vehicle_id}/approval-logs")
async def get_vehicle_approval_logs(vehicle_id: str):
    try:
        docs = (
            await db.customer_approval_logs.find({"vehicleId": vehicle_id})
            .sort("createdAt", -1)
            .to_list(length=1000)
        )
        for d in docs:
            d.pop("_id", None)
            for k in ("createdAt", "updatedAt", "respondedAt"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approvals")
async def create_approval(payload: Dict[str, Any] = Body(...)):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        token = f"APR-{str(uuid.uuid4())[:8].upper()}"

        # Get expiry days from payload (default 7)
        expiry_days = int(payload.get("expiryDays", 7))
        images = payload.get("images", [])

        # Supabase implementation
        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            import random

            otp_code = str(random.randint(1000, 9999))

            row = {
                "token": token,
                "otp_code": otp_code,
                "vehicle_id": payload.get("vehicleId"),
                "customer_id": payload.get("customerId"),
                "title": payload.get("title") or "طلب اعتماد",
                "amount": float(payload.get("amount") or 0),
                "service_items": payload.get("serviceItems") or [],
                "service_items_text": payload.get("serviceItemsText"),
                "images": images,
                "status": "pending",
                "expires_at": (
                    datetime.utcnow() + timedelta(days=expiry_days)
                ).isoformat(),
            }
            res = supa.client.table("approval_requests").insert(row).execute()
            r = (res.data or [{}])[0]
            return {
                "id": r.get("id"),
                "token": r.get("token") or token,
                "otp": r.get("otp_code") or otp_code,
                "vehicleId": r.get("vehicle_id"),
                "customerId": r.get("customer_id"),
                "title": r.get("title"),
                "amount": r.get("amount"),
                "serviceItems": r.get("service_items") or [],
                "serviceItemsText": r.get("service_items_text"),
                "images": r.get("images") or [],
                "status": r.get("status"),
                "createdAt": r.get("created_at"),
                "expiresAt": r.get("expires_at"),
            }

        # MongoDB implementation (legacy)
        token = f"APR-{str(uuid.uuid4())[:8].upper()}"
        doc = {
            "id": str(uuid.uuid4()),
            "token": token,
            "vehicleId": payload.get("vehicleId"),
            "customerId": payload.get("customerId"),
            "title": payload.get("title") or "طلب اعتماد",
            "amount": float(payload.get("amount") or 0),
            "serviceItems": payload.get("serviceItems") or [],
            "serviceItemsText": payload.get("serviceItemsText"),
            "images": images,
            "status": "pending",
            "createdAt": datetime.utcnow(),
            "expiresAt": datetime.utcnow() + timedelta(days=expiry_days),
        }
        await db.approval_requests.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/approvals")
async def list_approvals(vehicle_id: Optional[str] = None, visit_id: Optional[str] = None):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        # Supabase implementation
        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            q = supa.client.table("approval_requests").select("*")
            if visit_id:
                q = q.eq("visit_id", visit_id)
            elif vehicle_id:
                q = q.eq("vehicle_id", vehicle_id)
            res = q.order("created_at", desc=True).execute()
            rows = res.data or []
            out = []
            for r in rows:
                out.append(
                    {
                        "id": r.get("id"),
                        "token": r.get("token"),
                        "vehicleId": r.get("vehicle_id"),
                        "customerId": r.get("customer_id"),
                        "title": r.get("title"),
                        "amount": r.get("amount"),
                        "serviceItems": r.get("service_items") or [],
                        "serviceItemsText": r.get("service_items_text"),
                        "status": r.get("status"),
                        "createdAt": r.get("created_at"),
                        "expiresAt": r.get("expires_at"),
                        "respondedAt": r.get("responded_at"),
                        "responderName": r.get("responder_name"),
                        "responderPhone": r.get("responder_phone"),
                    }
                )
            return out

        # MongoDB implementation (legacy)
        q = {}
        if visit_id:
            q["visitId"] = visit_id
        elif vehicle_id:
            q["vehicleId"] = vehicle_id
        docs = (
            await db.approval_requests.find(q)
            .sort("createdAt", -1)
            .to_list(length=1000)
        )
        for d in docs:
            d.pop("_id", None)
            for k in ("createdAt", "expiresAt", "respondedAt"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/approvals/public/{token}")
async def public_approval(token: str):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            res = (
                supa.client.table("approval_requests")
                .select("*")
                .eq("token", token)
                .execute()
            )
            if not res.data:
                raise HTTPException(status_code=404, detail="رابط غير صحيح")

            d = res.data[0]
            if d.get("revoked"):
                raise HTTPException(status_code=410, detail="تم إلغاء الطلب")

            # Check expiry
            if d.get("expires_at"):
                from datetime import datetime, timezone

                expires_str = d["expires_at"]
                if isinstance(expires_str, str):
                    # Parse ISO string with timezone
                    if expires_str.endswith("Z"):
                        expires_str = expires_str[:-1] + "+00:00"
                    expires_at = datetime.fromisoformat(expires_str)
                else:
                    expires_at = expires_str

                # Compare with timezone-aware datetime
                now_utc = datetime.now(timezone.utc)
                if expires_at.tzinfo is None:
                    # Make timezone-aware
                    expires_at = expires_at.replace(tzinfo=timezone.utc)

                if expires_at < now_utc:
                    raise HTTPException(status_code=410, detail="انتهت صلاحية الرابط")

            return {
                "id": d.get("id"),
                "token": d.get("token"),
                "vehicleId": d.get("vehicle_id"),
                "customerId": d.get("customer_id"),
                "title": d.get("title"),
                "amount": d.get("amount"),
                "serviceItems": d.get("service_items") or [],
                "serviceItemsText": d.get("service_items_text"),
                "images": d.get("images") or [],
                "status": d.get("status"),
                "createdAt": d.get("created_at"),
                "expiresAt": d.get("expires_at"),
                "respondedAt": d.get("responded_at"),
                "signature": d.get("signature"),
                "clientIp": d.get("client_ip"),
            }

        # MongoDB fallback
        d = await db.approval_requests.find_one({"token": token})
        if not d:
            raise HTTPException(status_code=404, detail="رابط غير صحيح")
        if d.get("revoked"):
            raise HTTPException(status_code=410, detail="تم إلغاء الطلب")
        if d.get("expiresAt") and d["expiresAt"] < datetime.utcnow():
            raise HTTPException(status_code=410, detail="انتهت صلاحية الرابط")
        d.pop("_id", None)
        d.pop("otp", None)
        d.pop("otp_code", None)
        for k in ("createdAt", "expiresAt", "respondedAt"):
            if d.get(k) and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _approvals_broadcast(event: Dict[str, Any]):
    dead = []
    for q in list(approvals_subscribers):
        try:
            q.put_nowait(event)
        except Exception:
            dead.append(q)
    for q in dead:
        approvals_subscribers.discard(q)


@router.post("/approvals/public/{token}/respond")
async def respond_public_approval(token: str, request: Request):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        # Parse form data manually
        form_data = await request.form()
        status = form_data.get("status", "approved")
        name = form_data.get("name", "")
        phone = form_data.get("phone", "")
        notes = form_data.get("notes", "")
        otp = form_data.get("otp", "")

        # ---------- Supabase implementation ----------
        if provider == "supabase":
            from supabase_service import SupabaseService
            import hashlib
            from datetime import datetime as _dt, timezone as _tz

            supa = SupabaseService()

            # Fetch approval by token
            res = (
                supa.client.table("approval_requests")
                .select("*")
                .eq("token", token)
                .execute()
            )
            if not res.data:
                raise HTTPException(status_code=404, detail="رابط غير صحيح")

            d = res.data[0]

            # Check revoked
            if d.get("revoked"):
                raise HTTPException(status_code=410, detail="تم إلغاء الطلب")

            # Check expiry similar to public_approval
            expires_str = d.get("expires_at")
            if expires_str:
                if isinstance(expires_str, str):
                    if expires_str.endswith("Z"):
                        expires_str = expires_str[:-1] + "+00:00"
                    expires_at = _dt.fromisoformat(expires_str)
                else:
                    expires_at = expires_str

                now_utc = _dt.now(_tz.utc)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=_tz.utc)

                if expires_at < now_utc:
                    raise HTTPException(status_code=410, detail="انتهت صلاحية الرابط")

            # Digital Signature Logic
            client_ip = request.client.host
            user_agent = request.headers.get("user-agent", "unknown")
            timestamp = _dt.utcnow().isoformat()

            raw_data = f"{token}:{status}:{timestamp}:{client_ip}:{user_agent}"
            signature = hashlib.sha256(raw_data.encode()).hexdigest()

            # الحد الأدنى من الحقول لضمان توافق الجدول الحالي في Supabase
            # ملاحظة: جدول approval_requests لا يحتوي أعمدة signature أو notes،
            # لذلك نخزن هذه المعلومات داخل service_items_text أو نتجاهلها حتى لا يحدث خطأ سكيمة.
            meta_parts = []
            if notes:
                meta_parts.append(f"notes={notes}")
            meta_parts.append(f"ip={client_ip}")
            meta_parts.append(f"ua={user_agent[:120]}")

            # OTP validation
            stored_otp = str(d.get("otp_code") or "").strip()
            if stored_otp:
                if not otp or str(otp).strip() != stored_otp:
                    raise HTTPException(status_code=400, detail="رمز OTP غير صحيح")

            upd = {
                "status": status,
                "responded_at": timestamp,
                "responder_name": name,
                "responder_phone": phone,
                "otp_verified_at": timestamp,
                "service_items_text": (
                    " | ".join(meta_parts)
                    if meta_parts
                    else d.get("service_items_text")
                ),
            }

            supa.client.table("approval_requests").update(upd).eq(
                "token", token
            ).execute()

            # Re-fetch updated row
            res2 = (
                supa.client.table("approval_requests")
                .select("*")
                .eq("token", token)
                .execute()
            )
            nd = (res2.data or [d])[0]

            # Broadcast SSE update (without relying on MongoDB)
            try:
                await _approvals_broadcast(
                    {
                        "type": "approval_updated",
                        "token": nd.get("token"),
                        "vehicleId": nd.get("vehicle_id"),
                        "customerId": nd.get("customer_id"),
                        "status": nd.get("status"),
                        "respondedAt": nd.get("responded_at"),
                    }
                )
            except Exception:
                pass

            # Normalize response shape to match public_approval
            return {
                "id": nd.get("id"),
                "token": nd.get("token"),
                "vehicleId": nd.get("vehicle_id"),
                "customerId": nd.get("customer_id"),
                "title": nd.get("title"),
                "amount": nd.get("amount"),
                "serviceItems": nd.get("service_items") or [],
                "serviceItemsText": nd.get("service_items_text"),
                "images": nd.get("images") or [],
                "status": nd.get("status"),
                "createdAt": nd.get("created_at"),
                "expiresAt": nd.get("expires_at"),
                "respondedAt": nd.get("responded_at"),
                "responderName": nd.get("responder_name"),
                "responderPhone": nd.get("responder_phone"),
                "signature": nd.get("signature"),
                "clientIp": nd.get("client_ip"),
            }

        # ---------- MongoDB / legacy implementation ----------
        d = await db.approval_requests.find_one({"token": token})
        if not d:
            raise HTTPException(status_code=404, detail="رابط غير صحيح")
        if d.get("revoked"):
            raise HTTPException(status_code=410, detail="تم إلغاء الطلب")
        if d.get("expiresAt") and d["expiresAt"] < datetime.utcnow():
            raise HTTPException(status_code=410, detail="انتهت صلاحية الرابط")

        # Digital Signature Logic
        import hashlib

        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "unknown")
        timestamp = datetime.utcnow().isoformat()

        # Create a hash of the approval data
        raw_data = f"{token}:{status}:{timestamp}:{client_ip}:{user_agent}"
        signature = hashlib.sha256(raw_data.encode()).hexdigest()

        upd = {
            "status": status,
            "respondedAt": datetime.utcnow(),
            "responderName": name,
            "responderPhone": phone,
            "notes": notes,
            "clientIp": client_ip,
            "userAgent": user_agent,
            "signature": signature,
        }

        await db.approval_requests.update_one({"token": token}, {"$set": upd})

        # Append to customer history
        if d.get("customerId"):
            history_entry = {
                "token": token,
                "vehicleId": d.get("vehicleId"),
                "status": status,
                "respondedAt": timestamp,
                "clientIp": client_ip,
                "signature": signature,
                "title": d.get("title"),
            }
            await db.customers.update_one(
                {"id": d.get("customerId")},
                {"$push": {"approvalsHistory": history_entry}},
            )

        nd = await db.approval_requests.find_one({"token": token})
        nd.pop("_id", None)
        for k in ("createdAt", "expiresAt", "respondedAt"):
            if nd.get(k) and hasattr(nd[k], "isoformat"):
                nd[k] = nd[k].isoformat()
        # log
        try:
            await _log_approval_event(
                token,
                nd.get("vehicleId"),
                nd.get("customerId"),
                nd.get("title", "طلب اعتماد"),
                float(nd.get("amount") or 0),
                nd.get("status"),
                nd.get("serviceItems") or [],
                nd.get("serviceItemsText"),
                datetime.utcnow(),
            )
        except Exception as le:
            print(f"log approval error: {le}")
        # broadcast SSE
        await _approvals_broadcast(
            {
                "type": "approval_updated",
                "token": token,
                "vehicleId": nd.get("vehicleId"),
                "customerId": nd.get("customerId"),
                "status": nd.get("status"),
                "respondedAt": nd.get("respondedAt"),
            }
        )
        return nd
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/approvals/stream")
async def approvals_stream(request: Request):
    async def gen():
        q: asyncio.Queue = asyncio.Queue()
        approvals_subscribers.add(q)
        try:
            while True:
                if await request.is_disconnected():
                    break
                ev = await q.get()
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        finally:
            approvals_subscribers.discard(q)

    return StreamingResponse(gen(), media_type="text/event-stream")


# --------------------- WhatsApp Deeplink ---------------------
@router.post("/notifications/prepare")
async def prepare_notification(payload: Dict[str, Any] = Body(...)):
    try:
        phone = (payload or {}).get("phone", "")
        link = (payload or {}).get("link", "")
        msg = (payload or {}).get(
            "message"
        ) or f"مرحباً، نأمل اعتماد الطلب عبر الرابط: {link}"
        norm = "".join([c for c in phone if c.isdigit()])
        if norm.startswith("00"):
            norm = norm[2:]
        if norm.startswith("+"):
            norm = norm[1:]
        if norm.startswith("05"):
            norm = "966" + norm[1:]
        if norm.startswith("5") and len(norm) == 9:
            norm = "966" + norm
        if not norm.startswith("966"):
            norm = "966" + norm
        import urllib.parse

        encoded_msg = urllib.parse.quote(msg)
        # نستخدم endpoint الرسمي الأقدم والأكثر توافقاً
        whatsapp_url = f"https://api.whatsapp.com/send?phone={norm}&text={encoded_msg}"
        return {"whatsappUrl": whatsapp_url, "phone": norm, "message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Visits APIs ---------------------


def _parse_notes_json(notes: Any) -> Dict[str, Any]:
    if not notes:
        return {}
    if isinstance(notes, dict):
        return notes
    if isinstance(notes, str):
        s = notes.strip()
        if s.startswith('{') and s.endswith('}'):
            try:
                import json

                return json.loads(s)
            except Exception:
                return {}
    return {}


def _calc_visit_financial(parsed_notes: Dict[str, Any]) -> Dict[str, Any]:
    items = parsed_notes.get('items') or []
    payments = parsed_notes.get('payments') or []

    def _num(x, default=0.0):
        try:
            return float(x)
        except Exception:
            return default

    total_workshop = 0.0
    total_suppliers = 0.0
    for it in items:
        # Backward compatibility: default to workshop


@router.get("/vehicles/{vehicle_id}/financial-summary")
async def vehicle_financial_summary(vehicle_id: str):
    """Aggregate financial totals for a vehicle across all visits.

    Reads visit items/payments from visit.notes JSON (no schema changes).
    Returns workshop/suppliers/paid/balance + advance_paid.
    """
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        total_workshop = 0.0
        total_suppliers = 0.0
        total_paid = 0.0
        total_advance = 0.0

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            res = (
                supa.client.table("vehicle_visits")
                .select("id, notes")
                .eq("vehicle_id", vehicle_id)
                .execute()
            )
            for r in (res.data or []):
                parsed = _parse_notes_json(r.get('notes'))
                fin = _calc_visit_financial(parsed)
                total_workshop += fin['total_workshop']
                total_suppliers += fin['total_suppliers']
                total_paid += fin['total_paid']
                total_advance += fin['advance_paid']

        else:
            docs = await db.vehicle_visits.find({"vehicleId": vehicle_id}, {"_id": 0, "notes": 1}).to_list(2000)
            for d in docs:
                parsed = _parse_notes_json(d.get('notes'))
                fin = _calc_visit_financial(parsed)
                total_workshop += fin['total_workshop']
                total_suppliers += fin['total_suppliers']
                total_paid += fin['total_paid']
                total_advance += fin['advance_paid']

        total_amount = total_workshop + total_suppliers
        balance = total_amount - total_paid

        return {
            "total_workshop": round(total_workshop, 2),
            "total_suppliers": round(total_suppliers, 2),
            "total_paid": round(total_paid, 2),
            "advance_paid": round(total_advance, 2),
            "balance": round(balance, 2),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

        billing_type = (it.get('billingType') or it.get('type') or 'workshop').lower()
        qty = _num(it.get('quantity', 1), 1.0)
        price = _num(it.get('price', it.get('unit_price', 0)), 0.0)
        line_total = _num(it.get('total'), qty * price)
        if billing_type == 'supplier':
            total_suppliers += line_total
        else:
            total_workshop += line_total

    advance_paid = 0.0
    total_paid = 0.0
    for p in payments:
        amt = _num(p.get('amount'), 0.0)
        total_paid += amt
        kind = (p.get('kind') or '').lower()
        if kind == 'advance':
            advance_paid += amt

    total_amount = total_workshop + total_suppliers
    balance = total_amount - total_paid

    # Payment status
    if total_paid == 0:
        payment_status = 'unpaid'
    elif balance > 0:
        payment_status = 'partial'
    elif balance == 0:
        payment_status = 'paid_full'
    else:
        payment_status = 'credit'

    return {
        'items': items,
        'payments': payments,
        'total_workshop': round(total_workshop, 2),
        'total_suppliers': round(total_suppliers, 2),
        'total_amount': round(total_amount, 2),
        'total_paid': round(total_paid, 2),
        'advance_paid': round(advance_paid, 2),
        'balance': round(balance, 2),
        'payment_status': payment_status,
    }

@router.get("/vehicles/{vehicle_id}/visits")
async def get_vehicle_visits(vehicle_id: str):
    """Get all visits for a vehicle"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            res = (
                supa.client.table("vehicle_visits")
                .select("*")
                .eq("vehicle_id", vehicle_id)
                .order("entry_date", desc=True)
                .execute()
            )
            rows = res.data or []
            enriched = []
            for r in rows:
                parsed = _parse_notes_json(r.get('notes'))
                fin = _calc_visit_financial(parsed)

                out = {
                    "id": r.get("id"),
                    "vehicleId": r.get("vehicle_id"),
                    "entryDate": r.get("entry_date"),
                    "exitDate": r.get("exit_date"),
                    "status": r.get("status"),
                    "mileage": r.get("mileage"),
                    "notes": r.get("notes"),
                    "technicianId": r.get("technician_id"),
                    "createdAt": r.get("created_at"),
                    **fin,
                }
                enriched.append(out)
            return enriched

        # MongoDB fallback
        docs = (
            await db.vehicle_visits.find({"vehicleId": vehicle_id}, {"_id": 0})
            .sort("entryDate", -1)
            .to_list(length=1000)
        )
        enriched = []
        for d in docs:
            for k in ("entryDate", "exitDate", "createdAt"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            parsed = _parse_notes_json(d.get('notes'))
            fin = _calc_visit_financial(parsed)
            d.update(fin)

            # previous unpaid (older open visit with positive balance)
            try:
                vn = int(d.get('visitNumber') or d.get('visit_number') or 0)
            except Exception:
                vn = 0
            if vn:
                prev = await db.vehicle_visits.find_one(
                    {
                        "vehicleId": vehicle_id,
                        "$expr": {"$lt": ["$visitNumber", vn]},
                    },
                    {"_id": 0},
                )
                if prev:
                    prev_parsed = _parse_notes_json(prev.get('notes'))
                    prev_fin = _calc_visit_financial(prev_parsed)
                    if prev_fin.get('balance', 0) > 0:
                        d['previous_unpaid'] = {
                            'visit_number': prev.get('visitNumber') or prev.get('visit_number'),
                            'balance': prev_fin.get('balance'),
                        }
            enriched.append(d)

        return enriched
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vehicles/{vehicle_id}/visits")
async def create_visit(vehicle_id: str, payload: Dict[str, Any] = Body(...)):
    """Create a new visit for a vehicle"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        visit_id = str(uuid.uuid4())

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            row = {
                "id": visit_id,
                "vehicle_id": vehicle_id,
                "entry_date": payload.get("entryDate")
                or datetime.now(timezone.utc).isoformat(),
                "exit_date": payload.get("exitDate"),
                "status": payload.get("status", "in_progress"),
                "mileage": payload.get("mileage"),
                "notes": payload.get("notes", ""),
                "technician_id": payload.get("technicianId"),
            }

            res = supa.client.table("vehicle_visits").insert(row).execute()
            r = (res.data or [{}])[0]

            # --- SYNC TO OPERATIONS (FINANCE) ---
            if "notes" in payload:
                await _sync_visit_to_operation(visit_id, r, supa_service=supa)
            # ------------------------------------

            return {
                "id": r.get("id"),
                "vehicleId": r.get("vehicle_id"),
                "entryDate": r.get("entry_date"),
                "exitDate": r.get("exit_date"),
                "status": r.get("status"),
                "mileage": r.get("mileage"),
                "notes": r.get("notes"),
                "technicianId": r.get("technician_id"),
                "createdAt": r.get("created_at"),
            }

        # MongoDB fallback
        doc = {
            "id": visit_id,
            "vehicleId": vehicle_id,
            "entryDate": payload.get("entryDate") or datetime.now(timezone.utc),
            "exitDate": payload.get("exitDate"),
            "status": payload.get("status", "in_progress"),
            "mileage": payload.get("mileage"),
            "notes": payload.get("notes", ""),
            "technicianId": payload.get("technicianId"),
            "createdAt": datetime.now(timezone.utc),
        }

        await db.vehicle_visits.insert_one(doc)
        
        # --- SYNC TO OPERATIONS (MONGO) ---
        if "notes" in payload:
             doc_norm = {**doc, "vehicleId": vehicle_id}
             await _sync_visit_to_operation(visit_id, doc_norm, supa_service=None)
        # ----------------------------------

        doc.pop("_id", None)
        for k in ("entryDate", "exitDate", "createdAt"):
            if doc.get(k) and hasattr(doc[k], "isoformat"):
                doc[k] = doc[k].isoformat()
        return doc
    except Exception as e:
        import traceback
        print(f"❌ Create Visit Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create visit: {str(e)}")


@router.get("/visits/{visit_id}/operations")
async def get_visit_operations(visit_id: str):
    """Get all operations for a specific visit"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            res = (
                supa.client.table("operations")
                .select("*")
                .eq("visit_id", visit_id)
                # In Supabase schema the operation date column is `op_date` (not `date`).
                .order("op_date", desc=True)
                .execute()
            )
            return res.data or []

        # MongoDB fallback
        docs = (
            await db.operations.find({"visitId": visit_id}, {"_id": 0})
            .sort("date", -1)
            .to_list(length=1000)
        )
        for d in docs:
            if d.get("date") and hasattr(d["date"], "isoformat"):
                d["date"] = d["date"].isoformat()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/visits/{visit_id}")
async def update_visit(visit_id: str, payload: Dict[str, Any] = Body(...)):
    """Update a visit"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        print(f"📝 Update Visit {visit_id[:8]}: keys={list(payload.keys())} status={payload.get('status','--')}")

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            upd = {}
            if "exitDate" in payload:
                upd["exit_date"] = payload["exitDate"]
            if "status" in payload:
                upd["status"] = payload["status"]
            if "mileage" in payload:
                upd["mileage"] = payload["mileage"]
            if "notes" in payload:
                upd["notes"] = payload["notes"]
            if "technicianId" in payload:
                upd["technician_id"] = payload["technicianId"]

            res = (
                supa.client.table("vehicle_visits")
                .update(upd)
                .eq("id", visit_id)
                .execute()
            )
            if not res.data:
                raise HTTPException(status_code=404, detail="Visit not found")
            r = res.data[0]
            print(f"   Visit updated in DB: status={r.get('status')} notes_len={len(r.get('notes','') or '')}")
            
            # --- SYNC TO OPERATIONS (FINANCE) ---
            if "notes" in payload or "status" in payload:
                await _sync_visit_to_operation(visit_id, r, supa_service=supa)
            # ------------------------------------

            result = {
                "id": r.get("id"),
                "vehicleId": r.get("vehicle_id"),
                "entryDate": r.get("entry_date"),
                "exitDate": r.get("exit_date"),
                "status": r.get("status"),
                "mileage": r.get("mileage"),
                "notes": r.get("notes"),
                "technicianId": r.get("technician_id"),
            }

            # --- Prevent closing visit unless balance == 0 (financial rule) ---
            if payload.get("status") == "completed":
                parsed_notes = _parse_notes_json(upd.get("notes") or r.get("notes"))
                fin = _calc_visit_financial(parsed_notes)
                if fin.get('balance', 0) != 0:
                    raise HTTPException(status_code=400, detail="Cannot close visit unless balance is zero")

            # --- AUTO WHATSAPP NOTIFICATION on completion ---
            if payload.get("status") == "completed":
                try:
                    vehicle_id = r.get("vehicle_id")
                    v_res = supa.client.table("vehicles").select("plate_number,customer_name,customer_phone").eq("id", vehicle_id).single().execute()
                    if v_res.data:
                        phone = v_res.data.get("customer_phone", "")
                        customer_name = v_res.data.get("customer_name", "عميل")
                        plate = v_res.data.get("plate_number", "")
                        # Parse items total
                        total = 0
                        try:
                            notes_raw = r.get("notes", "")
                            if notes_raw and isinstance(notes_raw, str) and notes_raw.strip().startswith("{"):
                                parsed = json.loads(notes_raw)
                                items = parsed.get("items", [])
                                total = sum(float(it.get("price", 0)) * float(it.get("quantity", 1)) for it in items)
                        except Exception:
                            pass
                        total_str = f"{total:,.0f}" if total else ""
                        msg = (
                            f"السلام عليكم {customer_name}\n\n"
                            f"نفيدكم بأن مركبتكم ({plate}) جاهزة للاستلام.\n"
                        )
                        if total_str:
                            msg += f"المبلغ المستحق: {total_str} ر.س\n"
                        msg += f"\nشاكرين ثقتكم بنا."
                        if phone:
                            import urllib.parse
                            norm = "".join([c for c in phone if c.isdigit()])
                            if norm.startswith("05"):
                                norm = "966" + norm[1:]
                            elif norm.startswith("5") and len(norm) == 9:
                                norm = "966" + norm
                            elif not norm.startswith("966"):
                                norm = "966" + norm
                            encoded = urllib.parse.quote(msg)
                            result["whatsappNotification"] = {
                                "url": f"https://api.whatsapp.com/send?phone={norm}&text={encoded}",
                                "phone": norm,
                                "message": msg,
                                "customerName": customer_name,
                            }
                            print(f"   WhatsApp notification prepared for {customer_name} ({norm})")
                except Exception as e:
                    print(f"   WhatsApp notification prep failed: {e}")
            # ------------------------------------------------

            return result

        # MongoDB fallback
        upd = {}
        if "exitDate" in payload:
            upd["exitDate"] = payload["exitDate"]
        if "status" in payload:
            upd["status"] = payload["status"]
        if "mileage" in payload:
            upd["mileage"] = payload["mileage"]
        if "notes" in payload:
            upd["notes"] = payload["notes"]
        if "technicianId" in payload:
            upd["technicianId"] = payload["technicianId"]

        await db.vehicle_visits.update_one({"id": visit_id}, {"$set": upd})
        doc = await db.vehicle_visits.find_one({"id": visit_id}, {"_id": 0})
        
        # --- SYNC TO OPERATIONS (MONGO) ---
        if "notes" in payload or "status" in payload:
             # Normalize doc for helper
             doc_norm = {**doc, "vehicleId": doc.get("vehicleId")}
             await _sync_visit_to_operation(visit_id, doc_norm, supa_service=None)
        # ----------------------------------

        for k in ("entryDate", "exitDate", "createdAt"):
            if doc.get(k) and hasattr(doc[k], "isoformat"):
                doc[k] = doc[k].isoformat()
        return doc or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Database Initialization Endpoint ---------------------


@router.delete("/visits/{visit_id}")
async def delete_visit(visit_id: str):
    """Delete a visit (including closed visits)"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        # Supabase implementation
        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            # Delete related operations first
            try:
                supa.client.table("operations").delete().eq("visit_id", visit_id).execute()
            except Exception:
                pass

            res = supa.client.table("vehicle_visits").delete().eq("id", visit_id).execute()
            if not (res.data and len(res.data) > 0):
                raise HTTPException(status_code=404, detail="Visit not found")
            return {"success": True}

        # MongoDB implementation (legacy)
        await db.operations.delete_many({"visitId": visit_id})
        result = await db.vehicle_visits.delete_one({"id": visit_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Visit not found")
        return {"success": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/init-database")
async def init_database():
    """Initialize database tables and default data"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            results = {
                "images_column": False,
                "accounts_table": False,
                "default_accounts": False,
                "errors": [],
            }

            # Step 1: Add images column to approval_requests
            try:
                # Check if column exists
                existing = (
                    supa.client.table("approval_requests")
                    .select("images")
                    .limit(1)
                    .execute()
                )
                results["images_column"] = True
                results["messages"] = ["images column already exists"]
            except Exception as e:
                error_msg = str(e)
                if "images" in error_msg and "column" in error_msg.lower():
                    # Column doesn't exist, need to add it manually
                    results["errors"].append(
                        "images column needs manual addition in Supabase Dashboard"
                    )
                else:
                    results["images_column"] = True

            # Step 2: Create accounts table by trying to insert
            try:
                # Try to query accounts table
                existing_accounts = (
                    supa.client.table("accounts").select("*").limit(1).execute()
                )
                results["accounts_table"] = True

                # Check if we need to insert default accounts
                if not existing_accounts.data:
                    # Insert default accounts
                    default_accounts = [
                        {
                            "id": "acc-1000",
                            "code": "1000",
                            "name": "الأصول",
                            "name_en": "Assets",
                            "type": "asset",
                            "parent_id": None,
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1100",
                            "code": "1100",
                            "name": "الأصول المتداولة",
                            "name_en": "Current Assets",
                            "type": "asset",
                            "parent_id": "acc-1000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1101",
                            "code": "1101",
                            "name": "النقد",
                            "name_en": "Cash",
                            "type": "asset",
                            "parent_id": "acc-1100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1102",
                            "code": "1102",
                            "name": "البنك",
                            "name_en": "Bank",
                            "type": "asset",
                            "parent_id": "acc-1100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1103",
                            "code": "1103",
                            "name": "العملاء",
                            "name_en": "Accounts Receivable",
                            "type": "asset",
                            "parent_id": "acc-1100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1105",
                            "code": "1105",
                            "name": "مخزون قطع غيار",
                            "name_en": "Spare Parts Inventory",
                            "type": "asset",
                            "parent_id": "acc-1100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1106",
                            "code": "1106",
                            "name": "مخزون مستهلكات",
                            "name_en": "Consumables Inventory",
                            "type": "asset",
                            "parent_id": "acc-1100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1200",
                            "code": "1200",
                            "name": "الأصول الثابتة",
                            "name_en": "Fixed Assets",
                            "type": "asset",
                            "parent_id": "acc-1000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1201",
                            "code": "1201",
                            "name": "معدات ميكانيكية",
                            "name_en": "Mechanical Equipment",
                            "type": "asset",
                            "parent_id": "acc-1200",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1202",
                            "code": "1202",
                            "name": "رافعات سيارات",
                            "name_en": "Car Lifts",
                            "type": "asset",
                            "parent_id": "acc-1200",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1203",
                            "code": "1203",
                            "name": "أجهزة فحص",
                            "name_en": "Diagnostic Tools",
                            "type": "asset",
                            "parent_id": "acc-1200",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-1207",
                            "code": "1207",
                            "name": "مجمع الإهلاك",
                            "name_en": "Accumulated Depreciation",
                            "type": "asset",
                            "parent_id": "acc-1200",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-2000",
                            "code": "2000",
                            "name": "الخصوم",
                            "name_en": "Liabilities",
                            "type": "liability",
                            "parent_id": None,
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-2100",
                            "code": "2100",
                            "name": "الخصوم المتداولة",
                            "name_en": "Current Liabilities",
                            "type": "liability",
                            "parent_id": "acc-2000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-2101",
                            "code": "2101",
                            "name": "الموردون",
                            "name_en": "Accounts Payable",
                            "type": "liability",
                            "parent_id": "acc-2100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-2102",
                            "code": "2102",
                            "name": "مصروفات مستحقة",
                            "name_en": "Accrued Expenses",
                            "type": "liability",
                            "parent_id": "acc-2100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-2103",
                            "code": "2103",
                            "name": "رواتب مستحقة",
                            "name_en": "Accrued Salaries",
                            "type": "liability",
                            "parent_id": "acc-2100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-3000",
                            "code": "3000",
                            "name": "حقوق الملكية",
                            "name_en": "Equity",
                            "type": "equity",
                            "parent_id": None,
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-3100",
                            "code": "3100",
                            "name": "حقوق المالك",
                            "name_en": "Owner's Equity",
                            "type": "equity",
                            "parent_id": "acc-3000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-3101",
                            "code": "3101",
                            "name": "رأس المال",
                            "name_en": "Owner Capital",
                            "type": "equity",
                            "parent_id": "acc-3100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-3102",
                            "code": "3102",
                            "name": "مسحوبات المالك",
                            "name_en": "Owner Drawings",
                            "type": "equity",
                            "parent_id": "acc-3100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-3103",
                            "code": "3103",
                            "name": "أرباح محتجزة",
                            "name_en": "Retained Earnings",
                            "type": "equity",
                            "parent_id": "acc-3100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-3104",
                            "code": "3104",
                            "name": "صافي الربح/الخسارة",
                            "name_en": "Net Profit/Loss",
                            "type": "equity",
                            "parent_id": "acc-3100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-4000",
                            "code": "4000",
                            "name": "الإيرادات",
                            "name_en": "Revenue",
                            "type": "revenue",
                            "parent_id": None,
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-4100",
                            "code": "4100",
                            "name": "إيرادات الخدمات",
                            "name_en": "Service Revenue",
                            "type": "revenue",
                            "parent_id": "acc-4000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-4101",
                            "code": "4101",
                            "name": "إيرادات خدمات ميكانيكية",
                            "name_en": "Mechanical Service Revenue",
                            "type": "revenue",
                            "parent_id": "acc-4100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-4102",
                            "code": "4102",
                            "name": "إيرادات إصلاح محركات",
                            "name_en": "Engine Repair Revenue",
                            "type": "revenue",
                            "parent_id": "acc-4100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-4103",
                            "code": "4103",
                            "name": "إيرادات فرامل وتعليق",
                            "name_en": "Brake & Suspension Revenue",
                            "type": "revenue",
                            "parent_id": "acc-4100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-5000",
                            "code": "5000",
                            "name": "تكلفة الخدمات",
                            "name_en": "Cost of Services",
                            "type": "expense",
                            "parent_id": None,
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-5100",
                            "code": "5100",
                            "name": "تكاليف مباشرة",
                            "name_en": "Direct Costs",
                            "type": "expense",
                            "parent_id": "acc-5000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-5101",
                            "code": "5101",
                            "name": "أجور فنيين مباشرة",
                            "name_en": "Technicians Wages - Direct",
                            "type": "expense",
                            "parent_id": "acc-5100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-5102",
                            "code": "5102",
                            "name": "قطع غيار مستخدمة",
                            "name_en": "Spare Parts Used",
                            "type": "expense",
                            "parent_id": "acc-5100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-5103",
                            "code": "5103",
                            "name": "مستهلكات مستخدمة",
                            "name_en": "Consumables Used",
                            "type": "expense",
                            "parent_id": "acc-5100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6000",
                            "code": "6000",
                            "name": "المصروفات التشغيلية",
                            "name_en": "Operating Expenses",
                            "type": "expense",
                            "parent_id": None,
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6100",
                            "code": "6100",
                            "name": "مصروفات عامة وإدارية",
                            "name_en": "General & Administrative",
                            "type": "expense",
                            "parent_id": "acc-6000",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6101",
                            "code": "6101",
                            "name": "رواتب إدارية",
                            "name_en": "Administrative Salaries",
                            "type": "expense",
                            "parent_id": "acc-6100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6102",
                            "code": "6102",
                            "name": "إيجار المركز",
                            "name_en": "Workshop Rent",
                            "type": "expense",
                            "parent_id": "acc-6100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6103",
                            "code": "6103",
                            "name": "كهرباء ومياه",
                            "name_en": "Electricity & Water",
                            "type": "expense",
                            "parent_id": "acc-6100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6104",
                            "code": "6104",
                            "name": "صيانة معدات",
                            "name_en": "Equipment Maintenance",
                            "type": "expense",
                            "parent_id": "acc-6100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                        {
                            "id": "acc-6105",
                            "code": "6105",
                            "name": "ملابس وسلامة مهنية",
                            "name_en": "Uniforms & Safety",
                            "type": "expense",
                            "parent_id": "acc-6100",
                            "is_system": True,
                            "balance": 0.0,
                        },
                    ]

                    try:
                        supa.client.table("accounts").insert(default_accounts).execute()
                        results["default_accounts"] = True
                        results["accounts_created"] = len(default_accounts)
                    except Exception as e:
                        results["errors"].append(
                            f"Failed to insert accounts: {str(e)[:100]}"
                        )
                else:
                    results["default_accounts"] = True
                    results["accounts_created"] = len(existing_accounts.data)
                    results["message"] = "Accounts already exist"

            except Exception as e:
                error_msg = str(e)
                if "accounts" in error_msg and "schema cache" in error_msg.lower():
                    results["errors"].append(
                        "accounts table does not exist - needs manual creation in Supabase Dashboard"
                    )
                else:
                    results["errors"].append(
                        f"Error with accounts table: {str(e)[:100]}"
                    )

            return results

        # MongoDB - just return success
        return {
            "message": "MongoDB does not require initialization",
            "provider": "mongo",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Chart of Accounts APIs ---------------------
@router.get("/accounts")
async def list_accounts():
    """Get all accounts in the chart of accounts"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            res = supa.client.table("accounts").select("*").order("code").execute()
            return res.data or []

        # MongoDB fallback
        docs = (
            await db.accounts.find({}, {"_id": 0}).sort("code", 1).to_list(length=1000)
        )
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accounts")
async def create_account(payload: Dict[str, Any] = Body(...)):
    """Create a new account"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        account_id = str(uuid.uuid4())

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            row = {
                "id": account_id,
                "code": payload.get("code"),
                "name": payload.get("name"),
                "name_en": payload.get("nameEn", ""),
                "type": payload.get("type", "expense"),
                "parent_id": payload.get("parentId"),
                "is_system": payload.get("isSystem", False),
                "balance": 0.0,
            }
            res = supa.client.table("accounts").insert(row).execute()
            r = (res.data or [{}])[0]
            return {
                "id": r.get("id"),
                "code": r.get("code"),
                "name": r.get("name"),
                "nameEn": r.get("name_en"),
                "type": r.get("type"),
                "parentId": r.get("parent_id"),
                "isSystem": r.get("is_system"),
                "balance": r.get("balance"),
                "createdAt": r.get("created_at"),
            }

        # MongoDB fallback
        doc = {
            "id": account_id,
            "code": payload.get("code"),
            "name": payload.get("name"),
            "nameEn": payload.get("nameEn", ""),
            "type": payload.get("type", "expense"),
            "parentId": payload.get("parentId"),
            "isSystem": payload.get("isSystem", False),
            "balance": 0.0,
            "createdAt": datetime.now(timezone.utc),
        }
        await db.accounts.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, payload: Dict[str, Any] = Body(...)):
    """Update an existing account"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            upd = {}
            if "code" in payload:
                upd["code"] = payload["code"]
            if "name" in payload:
                upd["name"] = payload["name"]
            if "nameEn" in payload:
                upd["name_en"] = payload["nameEn"]
            if "type" in payload:
                upd["type"] = payload["type"]
            if "parentId" in payload:
                upd["parent_id"] = payload["parentId"]
            if "balance" in payload:
                upd["balance"] = payload["balance"]

            res = (
                supa.client.table("accounts").update(upd).eq("id", account_id).execute()
            )
            r = (res.data or [{}])[0]
            return {
                "id": r.get("id"),
                "code": r.get("code"),
                "name": r.get("name"),
                "nameEn": r.get("name_en"),
                "type": r.get("type"),
                "parentId": r.get("parent_id"),
                "isSystem": r.get("is_system"),
                "balance": r.get("balance"),
                "createdAt": r.get("created_at"),
            }

        # MongoDB fallback
        upd = {k: v for k, v in payload.items() if k not in ["id", "_id", "createdAt"]}
        await db.accounts.update_one({"id": account_id}, {"$set": upd})
        doc = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        return doc or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    """Delete an account (only if not system and has no children)"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            # Check if account exists and is system
            res = (
                supa.client.table("accounts").select("*").eq("id", account_id).execute()
            )
            acc = (res.data or [None])[0]
            if not acc:
                raise HTTPException(status_code=404, detail="الحساب غير موجود")
            if acc.get("is_system"):
                raise HTTPException(status_code=400, detail="لا يمكن حذف حساب نظام")

            # Check if has children
            children_res = (
                supa.client.table("accounts")
                .select("id")
                .eq("parent_id", account_id)
                .limit(1)
                .execute()
            )
            if children_res.data:
                raise HTTPException(
                    status_code=400, detail="لا يمكن حذف حساب يحتوي على حسابات فرعية"
                )

            # Delete account
            supa.client.table("accounts").delete().eq("id", account_id).execute()
            return {"success": True}

        # MongoDB fallback
        acc = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not acc:
            raise HTTPException(status_code=404, detail="الحساب غير موجود")
        if acc.get("isSystem"):
            raise HTTPException(status_code=400, detail="لا يمكن حذف حساب نظام")

        children = await db.accounts.find_one({"parentId": account_id}, {"_id": 0})
        if children:
            raise HTTPException(
                status_code=400, detail="لا يمكن حذف حساب يحتوي على حسابات فرعية"
            )

        await db.accounts.delete_one({"id": account_id})
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accounts/init-defaults")
async def init_default_accounts():
    """Initialize default chart of accounts if empty"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()

            # Check if accounts exist
            res = supa.client.table("accounts").select("id").limit(1).execute()
            if res.data:
                return {"message": "الحسابات موجودة بالفعل", "count": len(res.data)}

            # Insert default accounts
            default_accounts = [
                # 1000 - Assets
                {
                    "id": "acc-1000",
                    "code": "1000",
                    "name": "الأصول",
                    "name_en": "Assets",
                    "type": "asset",
                    "parent_id": None,
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1100",
                    "code": "1100",
                    "name": "الأصول المتداولة",
                    "name_en": "Current Assets",
                    "type": "asset",
                    "parent_id": "acc-1000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1101",
                    "code": "1101",
                    "name": "النقد",
                    "name_en": "Cash",
                    "type": "asset",
                    "parent_id": "acc-1100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1102",
                    "code": "1102",
                    "name": "البنك",
                    "name_en": "Bank",
                    "type": "asset",
                    "parent_id": "acc-1100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1103",
                    "code": "1103",
                    "name": "العملاء",
                    "name_en": "Accounts Receivable",
                    "type": "asset",
                    "parent_id": "acc-1100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1105",
                    "code": "1105",
                    "name": "مخزون قطع غيار",
                    "name_en": "Spare Parts Inventory",
                    "type": "asset",
                    "parent_id": "acc-1100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1106",
                    "code": "1106",
                    "name": "مخزون مستهلكات",
                    "name_en": "Consumables Inventory",
                    "type": "asset",
                    "parent_id": "acc-1100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1200",
                    "code": "1200",
                    "name": "الأصول الثابتة",
                    "name_en": "Fixed Assets",
                    "type": "asset",
                    "parent_id": "acc-1000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1201",
                    "code": "1201",
                    "name": "معدات ميكانيكية",
                    "name_en": "Mechanical Equipment",
                    "type": "asset",
                    "parent_id": "acc-1200",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1202",
                    "code": "1202",
                    "name": "رافعات سيارات",
                    "name_en": "Car Lifts",
                    "type": "asset",
                    "parent_id": "acc-1200",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1203",
                    "code": "1203",
                    "name": "أجهزة فحص",
                    "name_en": "Diagnostic Tools",
                    "type": "asset",
                    "parent_id": "acc-1200",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-1207",
                    "code": "1207",
                    "name": "مجمع الإهلاك",
                    "name_en": "Accumulated Depreciation",
                    "type": "asset",
                    "parent_id": "acc-1200",
                    "is_system": True,
                    "balance": 0.0,
                },
                # 2000 - Liabilities
                {
                    "id": "acc-2000",
                    "code": "2000",
                    "name": "الخصوم",
                    "name_en": "Liabilities",
                    "type": "liability",
                    "parent_id": None,
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-2100",
                    "code": "2100",
                    "name": "الخصوم المتداولة",
                    "name_en": "Current Liabilities",
                    "type": "liability",
                    "parent_id": "acc-2000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-2101",
                    "code": "2101",
                    "name": "الموردون",
                    "name_en": "Accounts Payable",
                    "type": "liability",
                    "parent_id": "acc-2100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-2102",
                    "code": "2102",
                    "name": "مصروفات مستحقة",
                    "name_en": "Accrued Expenses",
                    "type": "liability",
                    "parent_id": "acc-2100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-2103",
                    "code": "2103",
                    "name": "رواتب مستحقة",
                    "name_en": "Accrued Salaries",
                    "type": "liability",
                    "parent_id": "acc-2100",
                    "is_system": True,
                    "balance": 0.0,
                },
                # 3000 - Equity
                {
                    "id": "acc-3000",
                    "code": "3000",
                    "name": "حقوق الملكية",
                    "name_en": "Equity",
                    "type": "equity",
                    "parent_id": None,
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-3100",
                    "code": "3100",
                    "name": "حقوق المالك",
                    "name_en": "Owner's Equity",
                    "type": "equity",
                    "parent_id": "acc-3000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-3101",
                    "code": "3101",
                    "name": "رأس المال",
                    "name_en": "Owner Capital",
                    "type": "equity",
                    "parent_id": "acc-3100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-3102",
                    "code": "3102",
                    "name": "مسحوبات المالك",
                    "name_en": "Owner Drawings",
                    "type": "equity",
                    "parent_id": "acc-3100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-3103",
                    "code": "3103",
                    "name": "أرباح محتجزة",
                    "name_en": "Retained Earnings",
                    "type": "equity",
                    "parent_id": "acc-3100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-3104",
                    "code": "3104",
                    "name": "صافي الربح/الخسارة",
                    "name_en": "Net Profit/Loss",
                    "type": "equity",
                    "parent_id": "acc-3100",
                    "is_system": True,
                    "balance": 0.0,
                },
                # 4000 - Revenue
                {
                    "id": "acc-4000",
                    "code": "4000",
                    "name": "الإيرادات",
                    "name_en": "Revenue",
                    "type": "revenue",
                    "parent_id": None,
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-4100",
                    "code": "4100",
                    "name": "إيرادات الخدمات",
                    "name_en": "Service Revenue",
                    "type": "revenue",
                    "parent_id": "acc-4000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-4101",
                    "code": "4101",
                    "name": "إيرادات خدمات ميكانيكية",
                    "name_en": "Mechanical Service Revenue",
                    "type": "revenue",
                    "parent_id": "acc-4100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-4102",
                    "code": "4102",
                    "name": "إيرادات إصلاح محركات",
                    "name_en": "Engine Repair Revenue",
                    "type": "revenue",
                    "parent_id": "acc-4100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-4103",
                    "code": "4103",
                    "name": "إيرادات فرامل وتعليق",
                    "name_en": "Brake & Suspension Revenue",
                    "type": "revenue",
                    "parent_id": "acc-4100",
                    "is_system": True,
                    "balance": 0.0,
                },
                # 5000 - Cost of Services
                {
                    "id": "acc-5000",
                    "code": "5000",
                    "name": "تكلفة الخدمات",
                    "name_en": "Cost of Services",
                    "type": "expense",
                    "parent_id": None,
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-5100",
                    "code": "5100",
                    "name": "تكاليف مباشرة",
                    "name_en": "Direct Costs",
                    "type": "expense",
                    "parent_id": "acc-5000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-5101",
                    "code": "5101",
                    "name": "أجور فنيين مباشرة",
                    "name_en": "Technicians Wages - Direct",
                    "type": "expense",
                    "parent_id": "acc-5100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-5102",
                    "code": "5102",
                    "name": "قطع غيار مستخدمة",
                    "name_en": "Spare Parts Used",
                    "type": "expense",
                    "parent_id": "acc-5100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-5103",
                    "code": "5103",
                    "name": "مستهلكات مستخدمة",
                    "name_en": "Consumables Used",
                    "type": "expense",
                    "parent_id": "acc-5100",
                    "is_system": True,
                    "balance": 0.0,
                },
                # 6000 - Operating Expenses
                {
                    "id": "acc-6000",
                    "code": "6000",
                    "name": "المصروفات التشغيلية",
                    "name_en": "Operating Expenses",
                    "type": "expense",
                    "parent_id": None,
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-6100",
                    "code": "6100",
                    "name": "مصروفات عامة وإدارية",
                    "name_en": "General & Administrative",
                    "type": "expense",
                    "parent_id": "acc-6000",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-6101",
                    "code": "6101",
                    "name": "رواتب إدارية",
                    "name_en": "Administrative Salaries",
                    "type": "expense",
                    "parent_id": "acc-6100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-6102",
                    "code": "6102",
                    "name": "إيجار المركز",
                    "name_en": "Workshop Rent",
                    "type": "expense",
                    "parent_id": "acc-6100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-6103",
                    "code": "6103",
                    "name": "كهرباء ومياه",
                    "name_en": "Electricity & Water",
                    "type": "expense",
                    "parent_id": "acc-6100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-6104",
                    "code": "6104",
                    "name": "صيانة معدات",
                    "name_en": "Equipment Maintenance",
                    "type": "expense",
                    "parent_id": "acc-6100",
                    "is_system": True,
                    "balance": 0.0,
                },
                {
                    "id": "acc-6105",
                    "code": "6105",
                    "name": "ملابس وسلامة مهنية",
                    "name_en": "Uniforms & Safety",
                    "type": "expense",
                    "parent_id": "acc-6100",
                    "is_system": True,
                    "balance": 0.0,
                },
            ]

            supa.client.table("accounts").insert(default_accounts).execute()
            return {
                "message": "تم إنشاء شجرة الحسابات الافتراضية",
                "count": len(default_accounts),
            }

        # MongoDB fallback
        count = await db.accounts.count_documents({})
        if count > 0:
            return {"message": "الحسابات موجودة بالفعل", "count": count}

        default_accounts = [
            # 1000 - Assets
            {
                "id": "acc-1000",
                "code": "1000",
                "name": "الأصول",
                "nameEn": "Assets",
                "type": "asset",
                "parentId": None,
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1100",
                "code": "1100",
                "name": "الأصول المتداولة",
                "nameEn": "Current Assets",
                "type": "asset",
                "parentId": "acc-1000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1101",
                "code": "1101",
                "name": "النقد",
                "nameEn": "Cash",
                "type": "asset",
                "parentId": "acc-1100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1102",
                "code": "1102",
                "name": "البنك",
                "nameEn": "Bank",
                "type": "asset",
                "parentId": "acc-1100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1103",
                "code": "1103",
                "name": "العملاء",
                "nameEn": "Accounts Receivable",
                "type": "asset",
                "parentId": "acc-1100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1105",
                "code": "1105",
                "name": "مخزون قطع غيار",
                "nameEn": "Spare Parts Inventory",
                "type": "asset",
                "parentId": "acc-1100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1106",
                "code": "1106",
                "name": "مخزون مستهلكات",
                "nameEn": "Consumables Inventory",
                "type": "asset",
                "parentId": "acc-1100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1200",
                "code": "1200",
                "name": "الأصول الثابتة",
                "nameEn": "Fixed Assets",
                "type": "asset",
                "parentId": "acc-1000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1201",
                "code": "1201",
                "name": "معدات ميكانيكية",
                "nameEn": "Mechanical Equipment",
                "type": "asset",
                "parentId": "acc-1200",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1202",
                "code": "1202",
                "name": "رافعات سيارات",
                "nameEn": "Car Lifts",
                "type": "asset",
                "parentId": "acc-1200",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1203",
                "code": "1203",
                "name": "أجهزة فحص",
                "nameEn": "Diagnostic Tools",
                "type": "asset",
                "parentId": "acc-1200",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-1207",
                "code": "1207",
                "name": "مجمع الإهلاك",
                "nameEn": "Accumulated Depreciation",
                "type": "asset",
                "parentId": "acc-1200",
                "isSystem": True,
                "balance": 0.0,
            },
            # 2000 - Liabilities
            {
                "id": "acc-2000",
                "code": "2000",
                "name": "الخصوم",
                "nameEn": "Liabilities",
                "type": "liability",
                "parentId": None,
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-2100",
                "code": "2100",
                "name": "الخصوم المتداولة",
                "nameEn": "Current Liabilities",
                "type": "liability",
                "parentId": "acc-2000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-2101",
                "code": "2101",
                "name": "الموردون",
                "nameEn": "Accounts Payable",
                "type": "liability",
                "parentId": "acc-2100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-2102",
                "code": "2102",
                "name": "مصروفات مستحقة",
                "nameEn": "Accrued Expenses",
                "type": "liability",
                "parentId": "acc-2100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-2103",
                "code": "2103",
                "name": "رواتب مستحقة",
                "nameEn": "Accrued Salaries",
                "type": "liability",
                "parentId": "acc-2100",
                "isSystem": True,
                "balance": 0.0,
            },
            # 3000 - Equity
            {
                "id": "acc-3000",
                "code": "3000",
                "name": "حقوق الملكية",
                "nameEn": "Equity",
                "type": "equity",
                "parentId": None,
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-3100",
                "code": "3100",
                "name": "حقوق المالك",
                "nameEn": "Owner's Equity",
                "type": "equity",
                "parentId": "acc-3000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-3101",
                "code": "3101",
                "name": "رأس المال",
                "nameEn": "Owner Capital",
                "type": "equity",
                "parentId": "acc-3100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-3102",
                "code": "3102",
                "name": "مسحوبات المالك",
                "nameEn": "Owner Drawings",
                "type": "equity",
                "parentId": "acc-3100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-3103",
                "code": "3103",
                "name": "أرباح محتجزة",
                "nameEn": "Retained Earnings",
                "type": "equity",
                "parentId": "acc-3100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-3104",
                "code": "3104",
                "name": "صافي الربح/الخسارة",
                "nameEn": "Net Profit/Loss",
                "type": "equity",
                "parentId": "acc-3100",
                "isSystem": True,
                "balance": 0.0,
            },
            # 4000 - Revenue
            {
                "id": "acc-4000",
                "code": "4000",
                "name": "الإيرادات",
                "nameEn": "Revenue",
                "type": "revenue",
                "parentId": None,
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-4100",
                "code": "4100",
                "name": "إيرادات الخدمات",
                "nameEn": "Service Revenue",
                "type": "revenue",
                "parentId": "acc-4000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-4101",
                "code": "4101",
                "name": "إيرادات خدمات ميكانيكية",
                "nameEn": "Mechanical Service Revenue",
                "type": "revenue",
                "parentId": "acc-4100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-4102",
                "code": "4102",
                "name": "إيرادات إصلاح محركات",
                "nameEn": "Engine Repair Revenue",
                "type": "revenue",
                "parentId": "acc-4100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-4103",
                "code": "4103",
                "name": "إيرادات فرامل وتعليق",
                "nameEn": "Brake & Suspension Revenue",
                "type": "revenue",
                "parentId": "acc-4100",
                "isSystem": True,
                "balance": 0.0,
            },
            # 5000 - Cost of Services
            {
                "id": "acc-5000",
                "code": "5000",
                "name": "تكلفة الخدمات",
                "nameEn": "Cost of Services",
                "type": "expense",
                "parentId": None,
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-5100",
                "code": "5100",
                "name": "تكاليف مباشرة",
                "nameEn": "Direct Costs",
                "type": "expense",
                "parentId": "acc-5000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-5101",
                "code": "5101",
                "name": "أجور فنيين مباشرة",
                "nameEn": "Technicians Wages - Direct",
                "type": "expense",
                "parentId": "acc-5100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-5102",
                "code": "5102",
                "name": "قطع غيار مستخدمة",
                "nameEn": "Spare Parts Used",
                "type": "expense",
                "parentId": "acc-5100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-5103",
                "code": "5103",
                "name": "مستهلكات مستخدمة",
                "nameEn": "Consumables Used",
                "type": "expense",
                "parentId": "acc-5100",
                "isSystem": True,
                "balance": 0.0,
            },
            # 6000 - Operating Expenses
            {
                "id": "acc-6000",
                "code": "6000",
                "name": "المصروفات التشغيلية",
                "nameEn": "Operating Expenses",
                "type": "expense",
                "parentId": None,
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-6100",
                "code": "6100",
                "name": "مصروفات عامة وإدارية",
                "nameEn": "General & Administrative",
                "type": "expense",
                "parentId": "acc-6000",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-6101",
                "code": "6101",
                "name": "رواتب إدارية",
                "nameEn": "Administrative Salaries",
                "type": "expense",
                "parentId": "acc-6100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-6102",
                "code": "6102",
                "name": "إيجار المركز",
                "nameEn": "Workshop Rent",
                "type": "expense",
                "parentId": "acc-6100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-6103",
                "code": "6103",
                "name": "كهرباء ومياه",
                "nameEn": "Electricity & Water",
                "type": "expense",
                "parentId": "acc-6100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-6104",
                "code": "6104",
                "name": "صيانة معدات",
                "nameEn": "Equipment Maintenance",
                "type": "expense",
                "parentId": "acc-6100",
                "isSystem": True,
                "balance": 0.0,
            },
            {
                "id": "acc-6105",
                "code": "6105",
                "name": "ملابس وسلامة مهنية",
                "nameEn": "Uniforms & Safety",
                "type": "expense",
                "parentId": "acc-6100",
                "isSystem": True,
                "balance": 0.0,
            },
        ]

        for acc in default_accounts:
            acc["createdAt"] = datetime.now(timezone.utc)

        await db.accounts.insert_many(default_accounts)
        return {
            "message": "تم إنشاء شجرة الحسابات الافتراضية",
            "count": len(default_accounts),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Templates (Compatibility minimal) ---------------------
@router.get("/templates")
async def list_templates():
    # compat: map to invoice templates list
    try:
        docs = await db.invoice_templates.find({}).to_list(length=1000)
        for d in docs:
            d.pop("_id", None)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates")
async def create_print_template(payload: Dict[str, Any] = Body(...)):
    """إنشاء نموذج طباعة جديد من المصمم"""
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "type": payload.get("type", "invoice"),
            "name": payload.get("name", "قالب جديد"),
            "content": payload.get("content", ""),
            "isActive": payload.get("isActive", False),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await db.print_templates.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """حذف نموذج طباعة"""
    try:
        result = await db.print_templates.delete_one({"id": template_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
        return {"message": "Template deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/{template_id}/make-default")
async def make_template_default(template_id: str):
    """جعل النموذج افتراضي"""
    try:
        # Get template first
        template = await db.print_templates.find_one({"id": template_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        template_type = template.get("type", "invoice")

        # Remove default from all templates of same type
        await db.print_templates.update_many(
            {"type": template_type}, {"$set": {"isActive": False}}
        )

        # Set this template as default
        await db.print_templates.update_one(
            {"id": template_id}, {"$set": {"isActive": True}}
        )

        return {"message": "Template set as default", "id": template_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/{template_id}/apply-to-all")
async def apply_template_to_all(template_id: str):
    """تطبيق النموذج على جميع الأنواع"""
    try:
        template = await db.print_templates.find_one({"id": template_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        content = template.get("content", "")
        name = template.get("name", "قالب")

        # Apply to all types
        types = ["invoice", "diagnosis", "quote", "receipt", "vehicle_estimate"]
        applied = []

        for t in types:
            await db.print_templates.update_one(
                {"type": t},
                {
                    "$set": {
                        "content": content,
                        "name": f"{name} - {t}",
                        "isActive": True,
                    }
                },
                upsert=True,
            )
            applied.append(t)

        return {"message": "Template applied to all types", "applied": applied}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/print/render", response_class=HTMLResponse)
async def print_render(payload: Dict[str, Any] = Body(...)):
    """Compatibility render endpoint: if html provided return it; otherwise attempt to resolve repair template and apply data placeholders."""
    try:
        html = (payload or {}).get("html")
        data = (payload or {}).get("data") or {}
        if not html:
            # fallback to built-in simple doc
            html = "<html><body><h3>وثيقة</h3><p>{{CUSTOMER_NAME}}</p></body></html>"
        # replace {{KEY}} with values
        for k, v in data.items():
            html = html.replace(f"{{{{{k}}}}}", str(v))
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Print: Resolve Template ---------------------
@router.post("/print/resolve-template")
async def print_resolve_template(payload: Dict[str, Any] = Body(...)):
    try:
        override_type = (
            (payload or {}).get("override_type")
            or (payload or {}).get("type")
            or "invoice"
        )
        # Try Supabase DB first (if available)
        tpl = None
        if db:
            tpl = await db.print_templates.find_one(
                {"type": override_type, "isActive": True}
            )
        else:
            # Use Supabase to fetch template
            supa = SupabaseService()
            templates = await supa.execute_query(
                "print_templates",
                method="select",
                filters={"type": override_type, "is_active": True},
                order=("created_at", "desc"),
                limit=1,
            )
            if templates:
                tpl = templates[0]

        if tpl:
            tpl.pop("_id", None)
            return {"type": override_type, "template": tpl}
        # Fallback to bundled files
        root = os.path.dirname(os.path.abspath(__file__))
        fname = None
        if override_type in ("invoice", "sales_invoice"):
            fname = os.path.join(root, "invoice_template_repair_ar.html")
            if not os.path.exists(fname):
                fname = os.path.join(root, "invoice_template_mechanic.html")
        elif override_type in ("diagnosis", "vehicle_estimate"):
            fname = os.path.join(root, "invoice_template_modern.html")
        elif override_type in ("quote", "receipt"):
            fname = os.path.join(root, "invoice_template_modern.html")
        content = None
        if fname and os.path.exists(fname):
            with open(fname, "r", encoding="utf-8") as f:
                content = f.read()
        else:
            content = "<html><body><h1>قالب طباعة افتراضي</h1><div>{{CUSTOMER_NAME}}</div></body></html>"
        tpl = {
            "id": str(uuid.uuid4()),
            "name": f"Default {override_type}",
            "content": content,
            "isActive": True,
            "type": override_type,
        }
        return {"type": override_type, "template": tpl}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Invoice Templates (Excel-first + Design) ---------------------
@router.get("/invoice-templates")
async def list_invoice_templates():
    # In Supabase or memory mode, avoid hitting Mongo (returns empty list instead of 500)
    provider = os.environ.get("DB_PROVIDER", "mongo").lower()
    if provider in ("memory", "supabase"):
        return []
    docs = (
        await db.invoice_templates.find({"archived": {"$ne": True}})
        .sort("createdAt", -1)
        .to_list(length=1000)
    )
    out = []
    for d in docs:
        d.pop("_id", None)
        out.append(d)
    return out


@router.get("/invoice-templates/{tid}")
async def get_invoice_template(tid: str):
    d = await db.invoice_templates.find_one({"id": tid})
    if not d:
        raise HTTPException(status_code=404, detail="Template not found")
    d.pop("_id", None)
    return d


@router.delete("/invoice-templates/{tid}")
async def delete_invoice_template(tid: str):
    # Soft delete: archive instead of physical delete
    await db.invoice_templates.update_one(
        {"id": tid}, {"$set": {"archived": True, "archivedAt": datetime.utcnow()}}
    )
    return {"status": "archived"}


@router.put("/invoice-templates/{tid}")
async def update_invoice_template(tid: str, payload: Dict[str, Any] = Body(...)):
    await db.invoice_templates.update_one(
        {"id": tid}, {"$set": {**payload, "updatedAt": datetime.utcnow()}}
    )
    doc = await db.invoice_templates.find_one({"id": tid})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    doc.pop("_id", None)
    return doc


@router.post("/invoice-templates/create-blank")
async def create_blank_template(payload: Dict[str, Any] = Body(None)):
    try:
        name = (payload or {}).get("name") or "قالب فارغ"
        rows = int((payload or {}).get("rows") or 12)
        cols = int((payload or {}).get("cols") or 8)
        preview = [["" for _ in range(cols)] for _ in range(rows)]
        # place a default ITEMS anchor and headers row
        if rows >= 2:
            preview[0][0] = "{{WORKSHOP_NAME}}"
            preview[0][3] = "{{CUSTOMER_NAME}}"
            preview[1][0] = "{{ITEMS}}"
        doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "format": "xlsx",
            "fileId": None,
            "fields": ["{{WORKSHOP_NAME}}", "{{CUSTOMER_NAME}}", "{{ITEMS}}"],
            "preview": preview,
            "mapping": {},
            "itemsConfig": {
                "anchor": "{{ITEMS}}",
                "columns": {"description": "", "qty": "", "price": "", "total": ""},
            },
            "elements": [],
            "schema": [],
            "page": {"size": "A4", "orientation": "portrait"},
            "isDefault": False,
            "createdAt": datetime.utcnow(),
        }
        await db.invoice_templates.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoice-templates/{tid}/design")
async def save_design(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        elements = (payload or {}).get("elements") or []
        schema = (payload or {}).get("schema") or []
        page = (payload or {}).get("page") or {"size": "A4", "orientation": "portrait"}
        await db.invoice_templates.update_one(
            {"id": tid},
            {
                "$set": {
                    "elements": elements,
                    "schema": schema,
                    "page": page,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        d = await db.invoice_templates.find_one({"id": tid})
        if not d:
            raise HTTPException(status_code=404, detail="Template not found")
        d.pop("_id", None)
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoice-templates/{tid}/save-json")
async def save_template_from_json(tid: str, payload: Dict[str, Any] = Body(...)):
    # also persist mapping/items if provided for unified save
    alt_mapping = (payload or {}).get("mapping")
    alt_items = (payload or {}).get("items")
    if alt_mapping is not None or alt_items is not None:
        try:
            await db.invoice_templates.update_one(
                {"id": tid},
                {
                    "$set": {
                        "mapping": alt_mapping or {},
                        "itemsConfig": alt_items or {},
                        "updatedAt": datetime.utcnow(),
                    }
                },
            )
        except Exception:
            pass
    try:
        if not xlsxwriter:
            raise HTTPException(status_code=500, detail="xlsxwriter not installed")
        grid = payload.get("grid")
        if not isinstance(grid, list):
            raise HTTPException(status_code=400, detail="grid required")
        out = io.BytesIO()
        book = xlsxwriter.Workbook(out, {"in_memory": True})
        sheet = book.add_worksheet("Template")
        for r, row in enumerate(grid):
            if not isinstance(row, list):
                continue
            for c, val in enumerate(row):
                sheet.write(r, c, "" if val is None else str(val))
        book.close()
        xlsx_bytes = out.getvalue()
        file_id = None
        if templates_bucket:
            try:
                file_oid = await templates_bucket.upload_from_stream(
                    f"template_{tid}.xlsx",
                    io.BytesIO(xlsx_bytes),
                    metadata={
                        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    },
                )
                file_id = str(file_oid)
            except Exception as e:
                print(f"gridfs upload failed: {e}")
        await db.invoice_templates.update_one(
            {"id": tid},
            {
                "$set": {
                    "format": "xlsx",
                    "fileId": file_id,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        return {"status": "ok", "fileId": file_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoice-templates/{tid}/make-default")
async def make_default_template(tid: str):
    try:
        await db.invoice_templates.update_many({}, {"$set": {"isDefault": False}})
        await db.invoice_templates.update_one(
            {"id": tid}, {"$set": {"isDefault": True, "updatedAt": datetime.utcnow()}}
        )
        doc = await db.invoice_templates.find_one({"id": tid})
        if not doc:
            raise HTTPException(status_code=404, detail="Template not found")
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoice-templates/{tid}/update-mapping")
async def update_template_mapping(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        mapping = (payload or {}).get("mapping") or {}
        items = (payload or {}).get("items") or {}
        await db.invoice_templates.update_one(
            {"id": tid},
            {
                "$set": {
                    "mapping": mapping,
                    "itemsConfig": items,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        doc = await db.invoice_templates.find_one({"id": tid})
        if not doc:
            raise HTTPException(status_code=404, detail="Template not found")
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoice-templates/{tid}/save-named")
async def save_named_copy(tid: str, payload: Dict[str, Any] = Body(...)):
    try:
        if not xlsxwriter:
            raise HTTPException(status_code=500, detail="xlsxwriter not installed")
        name = (payload or {}).get("name") or "فاتوره"
        grid = (payload or {}).get("grid") or []
        mapping = (payload or {}).get("mapping") or {}
        items_cfg = (payload or {}).get("itemsConfig") or {}
        sample_data = (payload or {}).get("data") or {}
        elements = (payload or {}).get("elements") or []
        schema = (payload or {}).get("schema") or []
        page = (payload or {}).get("page") or {"size": "A4", "orientation": "portrait"}

        # build xlsx from grid
        out = io.BytesIO()
        book = xlsxwriter.Workbook(out, {"in_memory": True})
        sheet = book.add_worksheet("Template")
        for r, row in enumerate(grid):
            if not isinstance(row, list):
                continue
            for c, val in enumerate(row):
                sheet.write(r, c, "" if val is None else str(val))
        book.close()
        xlsx_bytes = out.getvalue()
        file_id = None
        if templates_bucket:
            try:
                file_oid = await templates_bucket.upload_from_stream(
                    f"{name}_{uuid.uuid4().hex}.xlsx",
                    io.BytesIO(xlsx_bytes),
                    metadata={
                        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    },
                )
                file_id = str(file_oid)
            except Exception as e:
                print(f"gridfs upload failed: {e}")
        new_id = str(uuid.uuid4())
        doc = {
            "id": new_id,
            "name": name,
            "format": "xlsx",
            "fileId": file_id,
            "fields": [],
            "preview": grid,
            "mapping": mapping,
            "itemsConfig": items_cfg,
            "elements": elements,
            "schema": schema,
            "page": page,
            "sampleData": sample_data,
            "isDefault": False,
            "createdAt": datetime.utcnow(),
        }
        await db.invoice_templates.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoice-templates/{tid}/auto-save")
async def auto_save_template(tid: str, payload: Dict[str, Any] = Body(...)):
    """Auto-save from Studio: persist design/grid/mapping/items and ensure a snapshot model copy saved-named=فاتوره if not exists."""
    try:
        grid = (payload or {}).get("grid")
        mapping = (payload or {}).get("mapping")
        items_cfg = (payload or {}).get("itemsConfig")
        elements = (payload or {}).get("elements")
        schema = (payload or {}).get("schema")
        page = (payload or {}).get("page")
        updates = {"updatedAt": datetime.utcnow()}
        if grid is not None:
            updates["preview"] = grid
        if mapping is not None:
            updates["mapping"] = mapping
        if items_cfg is not None:
            updates["itemsConfig"] = items_cfg
        if elements is not None:
            updates["elements"] = elements
        if schema is not None:
            updates["schema"] = schema
        if page is not None:
            updates["page"] = page
        if updates:
            await db.invoice_templates.update_one({"id": tid}, {"$set": updates})
        # create snapshot if no previous snapshot with name startswith 'فاتوره'
        snap = await db.invoice_templates.find_one(
            {"name": {"$regex": "^فاتوره"}, "sourceId": tid, "archived": {"$ne": True}}
        )
        if not snap:
            # minimal snapshot without heavy XLSX write for performance
            new_id = str(uuid.uuid4())
            base = await db.invoice_templates.find_one({"id": tid})
            if base:
                base.pop("_id", None)
                base.update(
                    {
                        "id": new_id,
                        "name": "فاتوره",
                        "sourceId": tid,
                        "isDefault": False,
                        "createdAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow(),
                    }
                )
                await db.invoice_templates.insert_one(base)
        doc = await db.invoice_templates.find_one({"id": tid})
        doc.pop("_id", None)
        return {"status": "ok", "template": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Duplicate code removed


@router.post("/print/invoice-xlsx")
async def print_invoice_xlsx(payload: Dict[str, Any] = Body(...)):
    try:
        if not openpyxl:
            raise HTTPException(status_code=500, detail="openpyxl not installed")
        t_id = payload.get("templateId")
        data = payload.get("data") or {}

        template = await db.invoice_templates.find_one({"id": t_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # In a real implementation, we would load the template from GridFS
        # or build it from the 'preview' grid.
        # For now, creating a basic Excel file on the fly

        out = io.BytesIO()
        book = openpyxl.Workbook()
        sheet = book.active
        sheet.title = "Invoice"

        # Simple filling
        sheet["A1"] = data.get("WORKSHOP_NAME", "Workshop")
        sheet["A2"] = f"Invoice: {data.get('INVOICE_NO', '')}"

        # Items
        row = 5
        sheet.cell(row, 1, "Item")
        sheet.cell(row, 2, "Qty")
        sheet.cell(row, 3, "Price")
        sheet.cell(row, 4, "Total")

        items = data.get("ITEMS", [])
        for item in items:
            row += 1
            sheet.cell(row, 1, item.get("description", ""))
            sheet.cell(row, 2, item.get("qty", 0))
            sheet.cell(row, 3, item.get("price", 0))
            sheet.cell(row, 4, item.get("total", 0))

        book.save(out)
        out.seek(0)

        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=invoice_{data.get('INVOICE_NO')}.xlsx"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Public Agent Proxy (Internal LLM) ============
@router.post("/public-agent/chat")
async def public_agent_chat(payload: Dict[str, Any] = Body(...)):
    try:
        message = payload.get("message")
        session_id = payload.get("sessionId") or str(uuid.uuid4())

        # Use internal LLM instead of Genspark
        llm_key = os.getenv("EMERGENT_LLM_KEY")
        if not llm_key:
            return {
                "response": "عذراً، خدمة المحادثة غير متوفرة حالياً (API Key missing).",
                "session_id": session_id,
            }

        system_message = """أنت مساعد ذكي لورشة سيارات. تتحدث العربية بطلاقة. 
        مهمتك مساعدة العملاء في الإجابة على استفساراتهم حول صيانة السيارات، المواعيد، والخدمات.
        كن مهذباً ومحترفاً."""

        chat = LlmChat(
            api_key=llm_key, session_id=session_id, system_message=system_message
        ).with_model("anthropic", "claude-sonnet-4.5-20250929")

        response_text = await chat.send_message(UserMessage(text=message))

        return {"response": response_text, "session_id": session_id}
    except Exception as e:
        print(f"Public Agent Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
