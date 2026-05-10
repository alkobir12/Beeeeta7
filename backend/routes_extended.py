from fastapi import APIRouter, HTTPException, Body, Request, UploadFile, File, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from collections import defaultdict
import asyncio
import json
import uuid
import os
import io
import re
import base64
import mimetypes

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
from bulk_delete_audit import record_bulk_delete_event
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


def _safe_filename(value: str) -> str:
    raw = re.sub(r"[^\w.\-]+", "_", str(value or "").strip())
    return raw[:120] or f"receipt_{uuid.uuid4().hex[:8]}.bin"


def _save_operation_payment_receipt(op_id: str, receipt_payload: Dict[str, Any]) -> Optional[Dict[str, str]]:
    if not isinstance(receipt_payload, dict):
        return None

    base64_value = str(receipt_payload.get("base64") or receipt_payload.get("data") or "").strip()
    if not base64_value:
        return None

    mime_type = str(receipt_payload.get("mimeType") or receipt_payload.get("type") or "application/octet-stream")
    original_name = str(receipt_payload.get("name") or "receipt.bin")

    if base64_value.startswith("data:"):
        try:
            header, body = base64_value.split(",", 1)
            if ";base64" in header:
                mime_candidate = header.split(";")[0].replace("data:", "").strip()
                if mime_candidate:
                    mime_type = mime_candidate
            base64_value = body
        except Exception:
            return None

    try:
        binary = base64.b64decode(base64_value, validate=False)
    except Exception:
        return None

    if not binary:
        return None

    # 6MB hard cap for safety
    if len(binary) > 6 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="receipt file too large (max 6MB)")

    ext = os.path.splitext(original_name)[1].strip().lower()
    if not ext:
        ext = mimetypes.guess_extension(mime_type) or ".bin"
    filename = _safe_filename(f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}")

    base_dir = os.path.join(os.path.dirname(__file__), "uploads", "operation_payment_receipts", op_id)
    os.makedirs(base_dir, exist_ok=True)
    file_path = os.path.join(base_dir, filename)

    with open(file_path, "wb") as f:
        f.write(binary)

    return {
        "filename": filename,
        "mime_type": mime_type,
        "url": f"/api/operations/{op_id}/payment-receipts/{filename}",
    }


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


def _extract_request_actor(request: Optional[Request]) -> Dict[str, str]:
    headers = getattr(request, "headers", {}) or {}
    user_id = str(headers.get("x-user-id") or headers.get("x-user-name") or "system").strip() or "system"
    user_role = str(headers.get("x-user-role") or "unknown").strip() or "unknown"
    return {"user_id": user_id, "user_role": user_role}


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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
                    except Exception:
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/biz-accounts/{aid}")
async def delete_biz_account(aid: str):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            existing = (
                supa.client.table("business_accounts")
                .select("id")
                .eq("id", aid)
                .limit(1)
                .execute()
                .data
                or []
            )
            if not existing:
                raise HTTPException(status_code=404, detail="not found")

            supa.client.table("business_accounts").delete().eq("id", aid).execute()
            return {"status": "ok", "deleted": 1}

        if provider == "memory" or db is None:
            return {"status": "ok", "deleted": 0}

        res = await db.business_accounts.delete_one({"id": aid})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="not found")
        return {"status": "ok", "deleted": int(res.deleted_count)}
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Operations & Analytics ---------------------
# NOTE: This app uses a modern chart of accounts (e.g., 1101 cash, 1102 bank, 1103 customers, 2101 suppliers).
# Legacy codes (101/113/211/411/514) caused misclassification in reports.
ACCOUNT_NAME_MAP = {
    # ─── أكواد جديدة (تسلسلية) ───
    "003": "النقد",
    "004": "البنك",
    "005": "العملاء (ذمم مدينة)",
    "006": "نقاط بيع",
    "022": "مسحوبات المالك",
    "025": "الإيرادات",
    "026": "إيرادات الخدمات",
    "027": "إيرادات خدمات ميكانيكية",
    "028": "إيرادات إصلاح محركات",
    "029": "إيرادات فرامل وتعليق",
    "030": "تكلفة الخدمات",
    "031": "تكاليف مباشرة",
    "035": "المصروفات التشغيلية",
    "036": "مصروفات عامة وإدارية",
    "037": "رواتب إدارية",
    "010": "معدات ميكانيكية",
    "042": "ايراد قطع الورشه",
    "2101": "الموردون (ذمم دائنة)",
    "211":  "حساب فروقات ترحيل",
    # ─── أكواد قديمة (للتوافق مع القيود التاريخية) ───
    "1101": "النقد",
    "1102": "البنك",
    "1103": "العملاء (ذمم مدينة)",
    "1104": "نقاط بيع",
    "4100": "إيرادات الخدمات",
    "4000": "الإيرادات",
    "6101": "رواتب إدارية",
    "3102": "مسحوبات المالك",
    "1201": "معدات ميكانيكية",
    "6100": "مصروفات عامة وإدارية",
}


# الكلمات الدالة على نوع الإيراد
_TOWDHEEB_KEYWORDS = ["توضيب", "تلميع مكينة", "غسيل مكينة", "تنظيف مكينة"]


def _infer_revenue_code(op: Dict[str, Any]) -> str:
    """
    يستنتج كود حساب الإيراد الصحيح من بنود العملية:
    - توضيب → 028 (إيرادات إصلاح محركات)
    - غير ذلك → 027 (إيرادات خدمات ميكانيكية)
    """
    items = op.get("items") or []
    all_text = " ".join(
        [str(op.get("notes") or ""), str(op.get("description") or "")]
        + [str(it.get("name") or "") for it in items
           if str(it.get("itemType") or "").lower() not in ("supplier",)]
    )
    for kw in _TOWDHEEB_KEYWORDS:
        if kw in all_text:
            return "028"
    return "027"

# خريطة تحويل الأكواد القديمة → الجديدة
LEGACY_TO_NEW_CODE = {
    "1101": "003", "acc-1101": "003",
    "1102": "004", "acc-1102": "004",
    "1103": "005", "acc-1103": "005",
    "1104": "006", "acc-1104": "006",
    "4000": "025", "acc-4000": "025",
    "4100": "026", "acc-4100": "026",
    "5000": "030", "acc-5000": "030",
    "5100": "031", "acc-5100": "031",
    "6000": "035", "acc-6000": "035",
    "6100": "036", "acc-6100": "036",
    "6101": "037", "acc-6101": "037",
    "3102": "022", "acc-3102": "022",
    "1201": "010", "acc-1201": "010",
}

# Fallback mapping: if an entry stores account as an internal id like acc-1101, map it to the numeric code.
ACCOUNT_ID_TO_CODE = {
    "acc-1101": "003", "acc-1102": "004", "acc-1103": "005", "acc-1104": "006",
    "acc-2101": "2101", "acc-4100": "026", "acc-4000": "025",
    "acc-6101": "037", "acc-3102": "022", "acc-1201": "010", "acc-6100": "036",
}

RAKAN_ACCOUNT_CODE_PREFIX = "5000"


def _normalize_account_code(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    # تحويل acc-XXXX أو acc-legacy
    if raw in ACCOUNT_ID_TO_CODE:
        return ACCOUNT_ID_TO_CODE[raw]
    if raw.startswith("acc-") and raw[4:].isdigit():
        code = raw[4:]
        return LEGACY_TO_NEW_CODE.get(code, code)
    # تحويل الأكواد القديمة للجديدة
    if raw in LEGACY_TO_NEW_CODE:
        return LEGACY_TO_NEW_CODE[raw]
    return raw


def _is_rakan_account_code(value: Any) -> bool:
    return _normalize_account_code(value).startswith(RAKAN_ACCOUNT_CODE_PREFIX)


def _is_rakan_business_account_doc(account: Dict[str, Any]) -> bool:
    return (
        _is_rakan_text(account.get("name"))
        or _is_rakan_text(account.get("code"))
        or _is_rakan_account_code(account.get("code"))
    )


def _build_chart_account_ref_map(chart_accounts: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    ref_map: Dict[str, Dict[str, Any]] = {}
    for account in chart_accounts or []:
        code = _normalize_account_code(account.get("code"))
        if not code:
            continue
        account_type = str(account.get("type") or "").strip().lower()
        account_name = (
            account.get("name_ar")
            or account.get("name")
            or account.get("name_en")
            or code
        )
        meta = {
            "code": code,
            "type": account_type,
            "name": account_name,
            "is_rakan": _is_rakan_account_code(code),
        }
        refs = {
            str(account.get("id") or "").strip(),
            str(account.get("code") or "").strip(),
            code,
        }
        for ref in refs:
            if ref:
                ref_map[ref] = meta
    return ref_map


def _resolve_chart_account_meta(
    account_ref: Optional[str],
    chart_account_ref_map: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    ref = str(account_ref or "").strip()
    if not ref:
        return {"code": "", "type": "", "name": "", "is_rakan": False}
    normalized = _normalize_account_code(ref)
    return (
        chart_account_ref_map.get(ref)
        or chart_account_ref_map.get(normalized)
        or {
            "code": normalized or ref,
            "type": "",
            "name": normalized or ref,
            "is_rakan": _is_rakan_account_code(normalized or ref),
        }
    )


def _infer_operation_type_from_account(
    requested_type: Optional[str],
    account_type: Optional[str],
) -> str:
    req = str(requested_type or "").strip().lower()
    if req in {
        "purchase",
        "sale",
        "expense",
        "service",
        "payment_order",
        "sale_return",
        "purchase_return",
    }:
        return req
    acc_type = str(account_type or "").strip().lower()
    if acc_type == "revenue":
        return "sale"
    if acc_type == "expense":
        return "purchase" if req == "purchase" else "expense"
    if acc_type in {"asset", "liability"}:
        return "purchase"
    if acc_type == "equity":
        return "expense"
    return req or "purchase"


def _append_note_token(notes: str, token: str) -> str:
    base = str(notes or "").strip()
    if token in base:
        return base
    return f"{base} {token}".strip()


def _enrich_operation_notes(
    notes: Any,
    is_rakan: bool,
    accounting_code: Optional[str],
    accounting_name: Optional[str] = None,
) -> str:
    enriched = str(notes or "").strip()
    if accounting_code:
        enriched = _append_note_token(enriched, f"ACCOUNT_CODE:{accounting_code}")
    if accounting_name:
        enriched = _append_note_token(enriched, f"ACCOUNTING_TARGET:{accounting_name}")
    if is_rakan:
        enriched = _append_note_token(enriched, "[RAKAN_PARTS]")
    return enriched


def _safe_amount(value: Any) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _split_operation_totals(op: Dict[str, Any]) -> Dict[str, float]:
    total = _safe_amount(op.get("total"))
    items = op.get("items") or []
    if not isinstance(items, list) or not items:
        supplier_total = _safe_amount(op.get("supplier_archive_total") or op.get("total_suppliers"))
        return {
            "combined_total": total,
            "workshop_total": max(total - supplier_total, 0.0) if supplier_total > 0 else total,
            "supplier_total": supplier_total,
        }

    workshop = 0.0
    suppliers = 0.0
    for item in items:
        if not isinstance(item, dict):
            continue
        line_total = _safe_amount(item.get("total"))
        if line_total <= 0:
            line_total = _safe_amount(item.get("price")) * _safe_amount(item.get("quantity") or item.get("qty") or 1)
        item_type = str(item.get("itemType") or item.get("type") or "").strip().lower()
        if item_type == "supplier":
            suppliers += line_total
        else:
            workshop += line_total

    if workshop <= 0 and total > 0:
        workshop = max(total - suppliers, 0.0)

    combined = total if total > 0 else (workshop + suppliers)
    return {
        "combined_total": round(combined, 2),
        "workshop_total": round(workshop, 2),
        "supplier_total": round(suppliers, 2),
    }


def _build_operation_journal_entry(
    op: Dict[str, Any],
    workshop_id: Optional[str],
    chart_account_ref_map: Optional[Dict[str, Dict[str, Any]]] = None,
):
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
    totals = _split_operation_totals(op)
    total = _safe_amount(op.get("total"))
    workshop_total = totals.get("workshop_total", total)
    supplier_total = totals.get("supplier_total", 0.0)

    if total <= 0:
        total = workshop_total
    if total <= 0:
        return None

    is_credit = payment_method == "credit"

    # Choose cash/bank/pos code for non-credit payments (أكواد جديدة)
    cash_code = "003"
    if payment_method in ("transfer", "bank", "تحويل", "بنك"):
        cash_code = "004"
    elif payment_method in ("pos", "card", "mada", "visa", "mastercard", "نقاط بيع", "نقاط_بيع", "point_of_sale", "بطاقة", "بطاقه", "شبكة"):
        cash_code = "006"

    chart_account_ref_map = chart_account_ref_map or {}

    def _to_meta(account_ref: Optional[str]) -> Dict[str, Any]:
        if not account_ref:
            return {"code": "", "type": "", "name": "", "is_rakan": False}
        v = str(account_ref).strip()
        if not v:
            return {"code": "", "type": "", "name": "", "is_rakan": False}
        return _resolve_chart_account_meta(v, chart_account_ref_map)

    selected_meta = _to_meta(
        op.get("accountingAccountId")
        or op.get("accounting_account_id")
        or op.get("accountId")
        or op.get("account_id")
    )
    selected_code = selected_meta.get("code") or ""

    scope = str(op.get("scope") or "").strip().lower()
    business_unit = str(op.get("businessUnit") or op.get("business_unit") or "").strip().lower()
    source = str(op.get("source") or "").strip().lower()
    notes_text = str(op.get("notes") or "")
    notes_lower = notes_text.lower()
    is_rakan_operation = (
        selected_meta.get("is_rakan")
        or scope == "rakan_parts"
        or business_unit == "rakan_parts"
        or "rakan_parts" in source
        or "[rakan_parts]" in notes_lower
    )

    lines = []
    transaction_type = None

    # 🚫 Rakan business unit is independent from the workshop ledger.
    # Skip ALL Rakan operations — no journal entry. Rakan analytics live
    # under the parts dashboard ("تحليلات قطع راكان") only.
    if is_rakan_operation:
        return None

    # Detect parts sale (vs service sale) by inspecting items.
    items_for_check = op.get("items") or []
    has_part_item = any(
        str(it.get("itemType") or it.get("item_type") or "").lower() == "part"
        for it in items_for_check
        if isinstance(it, dict)
    )
    has_service_item = any(
        str(it.get("itemType") or it.get("item_type") or "").lower() == "service"
        for it in items_for_check
        if isinstance(it, dict)
    )

    # كشف موردي الورشة المعروفين (أبو خالد) حتى بدون linkedPart/revenueAccountCode
    _ABU_KHALED_KW = ["أبو خالد الكبير", "ابو خالد الكبير", "أبو خالد", "ابو خالد"]

    # موردو الآجل: تُنشأ لهم قيود مشتريات آجل تلقائياً
    _AJEL_SUPPLIER_KW = [
        "مخرطة", "مخرطه", "المخرطة", "المخرطه",
        "مخرطة العوفي", "العبدالرحيم", "عبدالرحيم",
        "عبدالرحيم صيانة", "عبدالرحيم  صيانة",
    ]

    def _is_known_workshop_supplier(name: str) -> bool:
        n = str(name or "").strip()
        return any(kw in n for kw in _ABU_KHALED_KW)

    def _is_ajel_supplier(name: str) -> bool:
        """موردو الآجل: المخرطة والعبدالرحيم — تُسجَّل مشترياتهم كذمم دائنة آجل."""
        n = str(name or "").strip()
        return any(kw in n for kw in _AJEL_SUPPLIER_KW)

    # استخرج بنود موردي الآجل
    ajel_supplier_items = [
        it for it in items_for_check
        if isinstance(it, dict)
        and str(it.get("itemType") or "").lower() == "supplier"
        and _is_ajel_supplier(str(it.get("name") or ""))
    ]
    ajel_total = sum(_safe_amount(it.get("total") or it.get("price") or 0) for it in ajel_supplier_items)

    if op_type in ("sale", "service"):
        total = workshop_total if workshop_total > 0 else total
        if total <= 0:
            return None

        # 🚫 Non-Rakan parts-only sale → archive only, no journal entry.
        # BUT: if any item has revenueAccountCode='042' (workshop supplier part),
        # create a journal entry to account 042 (ايراد قطع الورشة).
        items_for_check = op.get("items") or []
        workshop_supplier_items = [
            it for it in items_for_check
            if isinstance(it, dict)
            and str(it.get("itemType") or "").lower() == "supplier"
            and not is_rakan_operation
            and not _is_ajel_supplier(str(it.get("name") or ""))  # موردو الآجل مُستثنون
            and (
                it.get("revenueAccountCode") == "042"
                or it.get("linkedPart")
                or _is_known_workshop_supplier(str(it.get("name") or ""))
            )
        ]
        workshop_parts_total = sum(
            _safe_amount(it.get("total") or it.get("price") or 0)
            for it in workshop_supplier_items
        )
        # إذا لم يُضبط workshop_parts_total من العناصر، استخدم supplier_total
        if workshop_parts_total <= 0 and supplier_total > 0 and workshop_supplier_items:
            workshop_parts_total = supplier_total

        if (
            op_type == "sale"
            and has_part_item
            and not has_service_item
            and not workshop_supplier_items
        ):
            return None

        transaction_type = "sale"
        debit_code = "005" if is_credit else cash_code
        _valid_rev_code = (
            selected_code
            if selected_code and len(selected_code) <= 12 and "-" not in selected_code
            else None
        )
        if _valid_rev_code:
            _valid_rev_code = LEGACY_TO_NEW_CODE.get(_valid_rev_code, _valid_rev_code)
        revenue_code = _valid_rev_code or _infer_revenue_code(op)

        # المبلغ الإجمالي للقيد = workshop services + workshop supplier parts (042)
        # workshop_total (متاح من الحسابات السابقة) = الخدمات فقط (بدون موردين)
        # نتجنب الازدواجية باستخدام workshop_total الصافي للخدمات
        service_amount = workshop_total  # 0 في حالة قطع فقط، 200 في حالة مختلطة
        full_debit = service_amount + workshop_parts_total  # 200+120=320 أو 0+150=150

        if workshop_parts_total > 0 and service_amount > 0:
            # عملية مختلطة: خدمات → 026، قطع ورشة → 042
            lines = [
                {
                    "account": debit_code,
                    "account_name": ACCOUNT_NAME_MAP.get(debit_code, debit_code),
                    "debit": full_debit,
                    "credit": 0,
                },
                {
                    "account": revenue_code,
                    "account_name": ACCOUNT_NAME_MAP.get(revenue_code, "إيرادات الخدمات"),
                    "debit": 0,
                    "credit": service_amount,
                },
                {
                    "account": "042",
                    "account_name": "ايراد قطع الورشه",
                    "debit": 0,
                    "credit": workshop_parts_total,
                },
            ]
        elif workshop_parts_total > 0:
            # قطع ورشة فقط → 042 (بدون خدمات)
            lines = [
                {
                    "account": debit_code,
                    "account_name": ACCOUNT_NAME_MAP.get(debit_code, debit_code),
                    "debit": workshop_parts_total,
                    "credit": 0,
                },
                {
                    "account": "042",
                    "account_name": "ايراد قطع الورشه",
                    "debit": 0,
                    "credit": workshop_parts_total,
                },
            ]
        else:
            lines = [
                {
                    "account": debit_code,
                    "account_name": ACCOUNT_NAME_MAP.get(debit_code, debit_code),
                    "debit": total,
                    "credit": 0,
                },
                {
                    "account": revenue_code,
                    "account_name": ACCOUNT_NAME_MAP.get(revenue_code, revenue_code),
                    "debit": 0,
                    "credit": total,
                },
            ]

    elif op_type in ("purchase", "expense"):
        transaction_type = "purchase" if op_type == "purchase" else "expense"

        # enforce purchases/expenses into expense accounts (030-059 new codes, or 5xxx/6xxx legacy)
        def _is_expense_code(c):
            if not c:
                return False
            try:
                n = int(c)
                if 30 <= n <= 59:
                    return True
            except (ValueError, TypeError):
                pass
            return str(c or "").startswith(("5", "6"))
        if op_type == "purchase":
            debit_code = selected_code if (selected_code and len(selected_code) <= 12 and "-" not in selected_code and _is_expense_code(selected_code)) else "036"
        else:
            debit_code = selected_code if (selected_code and len(selected_code) <= 12 and "-" not in selected_code and _is_expense_code(selected_code)) else "036"
        if debit_code:
            debit_code = LEGACY_TO_NEW_CODE.get(debit_code, debit_code)
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

    elif op_type == "sale_return":
        transaction_type = "sale_return"
        _valid_dr_code = (
            selected_code
            if selected_code and len(selected_code) <= 12 and "-" not in selected_code
            else None
        )
        debit_code = _valid_dr_code or "026"
        credit_code = "005" if is_credit else cash_code
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

    elif op_type == "purchase_return":
        transaction_type = "purchase_return"
        debit_code = "2101" if is_credit else cash_code
        credit_code = selected_code if str(selected_code or "").startswith(("5", "6")) else "6100"
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

    elif op_type == "payment_order":
        transaction_type = "payment_order"
        partner_type = str(op.get("partnerType") or op.get("partner_type") or "").strip().lower()

        if partner_type == "customer":
            # تحصيل من عميل: Dr نقدية/بنك, Cr ذمم مدينة
            lines = [
                {
                    "account": cash_code,
                    "account_name": ACCOUNT_NAME_MAP.get(cash_code, cash_code),
                    "debit": total,
                    "credit": 0,
                },
                {
                    "account": "005",
                    "account_name": ACCOUNT_NAME_MAP.get("005", "005"),
                    "debit": 0,
                    "credit": total,
                },
            ]
        else:
            # سداد لمورد: Dr ذمم دائنة, Cr نقدية/بنك
            lines = [
                {
                    "account": "2101",
                    "account_name": ACCOUNT_NAME_MAP.get("2101", "2101"),
                    "debit": total,
                    "credit": 0,
                },
                {
                    "account": cash_code,
                    "account_name": ACCOUNT_NAME_MAP.get(cash_code, cash_code),
                    "debit": 0,
                    "credit": total,
                },
            ]

    else:
        return None

    description = (
        op.get("notes")
        or f"عملية {transaction_type} - {op.get('partnerName') or op.get('partner_name') or ''}"
    )
    if is_rakan_operation and "[RAKAN_PARTS]" not in str(description):
        description = f"[RAKAN_PARTS] {description}".strip()

    primary_entry = {
        "id": str(uuid.uuid4()),
        "workshop_id": workshop_id,
        "date": op.get("date") or op.get("op_date") or datetime.utcnow().isoformat(),
        "description": description,
        "lines": lines,
        "total": total,
        "operation_total": totals.get("combined_total", total),
        "workshop_total": workshop_total,
        "supplier_archive_total": supplier_total,
        "source": "operation_rakan_parts" if is_rakan_operation else "operation",
        "transaction_type": transaction_type,
        "reference_id": op.get("id"),
    }

    # ─── قيود آجل إضافية لموردي المخرطة والعبدالرحيم ────────────────────────
    # المنطق الصحيح:
    # - العميل يدفع للورشة مبلغاً يشمل تكلفة المخرطة
    # - الورشة تكون مدينة للمخرطة بهذا المبلغ (آجل)
    # القيد المنفصل: Dr تكلفة (036) / Cr مورد آجل (2101)
    # القيد الرئيسي لا يشمل مبلغ المخرطة في الدائن (يُحسب كامل المبلغ عبر النقدية)
    extra_entries = []
    if ajel_total > 0:
        for it in ajel_supplier_items:
            it_total = _safe_amount(it.get("total") or it.get("price") or 0)
            if it_total <= 0:
                continue
            sup_name = str(it.get("name") or "مورد")
            extra_entries.append({
                "id": str(uuid.uuid4()),
                "workshop_id": workshop_id,
                "date": op.get("date") or datetime.utcnow().isoformat(),
                "description": f"[آجل] مشتريات من {sup_name} — {op.get('partnerName') or op.get('partner_name') or ''}",
                "lines": [
                    {
                        "account": "036",
                        "account_name": "مصروفات عامة وإدارية",
                        "debit": it_total,
                        "credit": 0,
                    },
                    {
                        "account": "2101",
                        "account_name": f"مورد - {sup_name}",
                        "debit": 0,
                        "credit": it_total,
                    },
                ],
                "total": it_total,
                "source": "ajel_supplier_purchase",
                "transaction_type": "purchase",
                "reference_id": op.get("id"),
                "supplier_name": sup_name,
            })

    if extra_entries:
        return [primary_entry] + extra_entries
    return primary_entry


def _safe_insert_journal_entry(supa: SupabaseService, entry: Dict[str, Any]):
    if not entry:
        return None
    payload = dict(entry)
    try:
        return supa.client.table("journal_entries").insert(payload).execute().data
    except Exception as error:
        print(f"Journal entry insert failed, retry adaptive fields: {error}")
        retry_payload = dict(payload)
        for _ in range(12):
            match = re.search(r"Could not find the '([^']+)' column", str(error))
            if not match:
                break
            missing_field = match.group(1)
            if missing_field not in retry_payload:
                break
            retry_payload.pop(missing_field, None)
            try:
                return supa.client.table("journal_entries").insert(retry_payload).execute().data
            except Exception as retry_error:
                error = retry_error

        basic = {
            k: entry.get(k)
            for k in [
                "id",
                "workshop_id",
                "date",
                "description",
                "lines",
                "total",
                "source",
                "transaction_type",
                "reference_id",
            ]
        }
        try:
            return supa.client.table("journal_entries").insert(basic).execute().data
        except Exception as error2:
            print(f"Journal entry insert failed: {error2}")
            return None
@router.get("/operations")
async def list_operations(
    workshop_id: Optional[str] = None,
    account_id: Optional[str] = None,
    type: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    limit: Optional[int] = Query(default=None, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
):
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            ops = supa.operations_list(
                workshop_id=workshop_id,
                account_id=account_id,
                type=type,
                vehicle_id=vehicle_id,
                limit=limit,
                offset=offset,
            )
            return ops

        if provider == "memory" or db is None:
            ops = _mem_read("operations")
            if workshop_id:
                ops = [
                    o for o in ops if str(o.get("workshopId") or o.get("workshop_id") or "") == str(workshop_id)
                ]
            if account_id:
                ops = [o for o in ops if o.get("accountId") == account_id]
            if type:
                ops = [o for o in ops if o.get("type") == type]
            if vehicle_id:
                ops = [o for o in ops if o.get("vehicleId") == vehicle_id]
            ops = sorted(
                ops,
                key=lambda o: str(o.get("date") or o.get("op_date") or o.get("createdAt") or o.get("created_at") or o.get("updatedAt") or o.get("updated_at") or ""),
                reverse=True,
            )
            if offset:
                ops = ops[offset:]
            if limit:
                ops = ops[:limit]
            for o in ops:
                if not o.get("scope"):
                    o["scope"] = "vehicle" if o.get("vehicleId") else "workshop"
            return ops

        q: Dict[str, Any] = {}
        if workshop_id:
            q["workshopId"] = workshop_id
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
                    "accountId": 1,
                    "accountingAccountId": 1,
                    "partnerId": 1,
                    "notes": 1,
                    "paymentStatus": 1,
                    "paymentMethod": 1,
                    "scope": 1,
                    "source": 1,
                    "businessUnit": 1,
                },
            )
            .sort("date", -1)
            .skip(offset)
            .to_list(length=limit or 2000)
        )
        for o in ops:
            o.pop("_id", None)
            if o.get("date") and hasattr(o["date"], "isoformat"):
                o["date"] = o["date"].isoformat()
            o["scope"] = o.get("scope") or ("vehicle" if o.get("vehicleId") else "workshop")
        return ops
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _operation_date_key(op: Dict[str, Any]) -> str:
    return str(
        op.get("date")
        or op.get("op_date")
        or op.get("createdAt")
        or op.get("created_at")
        or ""
    )[:10]


def _operation_integrity_signature(op: Dict[str, Any]) -> str:
    op_type = str(op.get("type") or "").strip().lower()
    partner = str(op.get("partnerId") or op.get("partner_id") or op.get("partnerName") or op.get("partner_name") or "").strip().lower()
    vehicle = str(op.get("vehicleId") or op.get("vehicle_id") or "").strip().lower()
    date_key = _operation_date_key(op)
    try:
        total = round(float(op.get("total") or 0), 2)
    except Exception:
        total = 0.0
    return f"{op_type}|{partner}|{vehicle}|{total}|{date_key}"


@router.post("/operations/integrity/check")
async def operations_integrity_check(payload: Dict[str, Any] = Body(...)):
    """
    كشف ترابط العملية بين:
    - operations
    - vehicle/visit
    - journal_entries(reference_id)
    مع تحذيرات التكرار المحتمل.
    """
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        raw_op_ids = payload.get("op_ids") or payload.get("operation_ids") or []
        op_ids = [str(x).strip() for x in raw_op_ids if str(x).strip()]
        vehicle_id = str(payload.get("vehicle_id") or payload.get("vehicleId") or "").strip()
        workshop_id = str(payload.get("workshop_id") or payload.get("workshopId") or "").strip()

        operations_rows: List[Dict[str, Any]] = []
        journal_rows: List[Dict[str, Any]] = []
        visits_rows: List[Dict[str, Any]] = []
        vehicles_rows: List[Dict[str, Any]] = []

        if provider == "supabase":
            supa = SupabaseService()
            if supa.mock_mode:
                base_ops = _mem_read("operations")
                if workshop_id:
                    base_ops = [o for o in base_ops if str(o.get("workshopId") or o.get("workshop_id") or "") == workshop_id]
                if vehicle_id:
                    base_ops = [o for o in base_ops if str(o.get("vehicleId") or o.get("vehicle_id") or "") == vehicle_id]
                if op_ids:
                    op_set = set(op_ids)
                    base_ops = [o for o in base_ops if str(o.get("id") or "") in op_set]
                operations_rows = base_ops[:500]
                if not op_ids:
                    op_ids = [str(o.get("id") or "") for o in operations_rows if str(o.get("id") or "")]
                journal_rows = [
                    j for j in _mem_read("journal_entries")
                    if str(j.get("reference_id") or j.get("referenceId") or "") in set(op_ids)
                ]
                visit_ids = {
                    str(o.get("visitId") or o.get("visit_id") or "")
                    for o in operations_rows
                    if str(o.get("visitId") or o.get("visit_id") or "")
                }
                vehicle_ids = {
                    str(o.get("vehicleId") or o.get("vehicle_id") or "")
                    for o in operations_rows
                    if str(o.get("vehicleId") or o.get("vehicle_id") or "")
                }
                visits_rows = [v for v in _mem_read("vehicle_visits") if str(v.get("id") or "") in visit_ids]
                vehicles_rows = [v for v in _mem_read("vehicles") if str(v.get("id") or "") in vehicle_ids]
            else:
                q = supa.client.table("operations").select("*")
                if vehicle_id:
                    q = q.eq("vehicle_id", vehicle_id)
                if op_ids:
                    q = q.in_("id", op_ids)
                q = q.order("created_at", desc=True).limit(500)
                operations_rows = q.execute().data or []

                if not op_ids:
                    op_ids = [str(o.get("id") or "") for o in operations_rows if str(o.get("id") or "")]

                if op_ids:
                    try:
                        journal_rows = (
                            supa.client.table("journal_entries")
                            .select("id,reference_id,total,source,date")
                            .in_("reference_id", op_ids)
                            .execute()
                            .data
                            or []
                        )
                    except Exception:
                        journal_rows = []

                visit_ids = list({str(o.get("visit_id") or "") for o in operations_rows if str(o.get("visit_id") or "")})
                vehicle_ids = list({str(o.get("vehicle_id") or "") for o in operations_rows if str(o.get("vehicle_id") or "")})

                if visit_ids:
                    visits_rows = (
                        supa.client.table("vehicle_visits")
                        .select("*")
                        .in_("id", visit_ids)
                        .execute()
                        .data
                        or []
                    )
                if vehicle_ids:
                    vehicles_rows = (
                        supa.client.table("vehicles")
                        .select("*")
                        .in_("id", vehicle_ids)
                        .execute()
                        .data
                        or []
                    )

        elif provider == "memory" or db is None:
            base_ops = _mem_read("operations")
            if workshop_id:
                base_ops = [o for o in base_ops if str(o.get("workshopId") or o.get("workshop_id") or "") == workshop_id]
            if vehicle_id:
                base_ops = [o for o in base_ops if str(o.get("vehicleId") or o.get("vehicle_id") or "") == vehicle_id]
            if op_ids:
                op_set = set(op_ids)
                base_ops = [o for o in base_ops if str(o.get("id") or "") in op_set]
            operations_rows = base_ops[:500]
            if not op_ids:
                op_ids = [str(o.get("id") or "") for o in operations_rows if str(o.get("id") or "")]
            journal_rows = [
                j for j in _mem_read("journal_entries")
                if str(j.get("reference_id") or j.get("referenceId") or "") in set(op_ids)
            ]
            visit_ids = {
                str(o.get("visitId") or o.get("visit_id") or "")
                for o in operations_rows
                if str(o.get("visitId") or o.get("visit_id") or "")
            }
            vehicle_ids = {
                str(o.get("vehicleId") or o.get("vehicle_id") or "")
                for o in operations_rows
                if str(o.get("vehicleId") or o.get("vehicle_id") or "")
            }
            visits_rows = [v for v in _mem_read("vehicle_visits") if str(v.get("id") or "") in visit_ids]
            vehicles_rows = [v for v in _mem_read("vehicles") if str(v.get("id") or "") in vehicle_ids]
        else:
            q: Dict[str, Any] = {}
            if workshop_id:
                q["workshopId"] = workshop_id
            if vehicle_id:
                q["vehicleId"] = vehicle_id
            if op_ids:
                q["id"] = {"$in": op_ids}

            operations_rows = await db.operations.find(
                q,
                {
                    "_id": 0,
                    "id": 1,
                    "type": 1,
                    "total": 1,
                    "partnerId": 1,
                    "partnerName": 1,
                    "vehicleId": 1,
                    "visitId": 1,
                    "scope": 1,
                    "date": 1,
                    "createdAt": 1,
                    "notes": 1,
                },
            ).to_list(length=500)

            if not op_ids:
                op_ids = [str(o.get("id") or "") for o in operations_rows if str(o.get("id") or "")]

            journal_rows = await db.journal_entries.find(
                {"reference_id": {"$in": op_ids}},
                {"_id": 0, "id": 1, "reference_id": 1, "total": 1, "source": 1, "date": 1},
            ).to_list(length=2000)

            visit_ids = list({str(o.get("visitId") or "") for o in operations_rows if str(o.get("visitId") or "")})
            vehicle_ids = list({str(o.get("vehicleId") or "") for o in operations_rows if str(o.get("vehicleId") or "")})

            if visit_ids:
                visits_rows = await db.vehicle_visits.find(
                    {"id": {"$in": visit_ids}},
                    {"_id": 0, "id": 1, "vehicleId": 1, "status": 1},
                ).to_list(length=1000)
            if vehicle_ids:
                vehicles_rows = await db.vehicles.find(
                    {"id": {"$in": vehicle_ids}},
                    {"_id": 0, "id": 1, "plateNumber": 1, "status": 1},
                ).to_list(length=1000)

        if not operations_rows:
            return {
                "success": True,
                "data": {"items": [], "summary": {"total": 0, "ok": 0, "warnings": 0, "duplicates": 0}},
            }

        op_norm = []
        for op in operations_rows:
            op_norm.append({
                "id": str(op.get("id") or ""),
                "type": op.get("type"),
                "total": op.get("total"),
                "partnerId": op.get("partnerId") or op.get("partner_id"),
                "partnerName": op.get("partnerName") or op.get("partner_name"),
                "vehicleId": op.get("vehicleId") or op.get("vehicle_id"),
                "visitId": op.get("visitId") or op.get("visit_id"),
                "scope": op.get("scope"),
                "date": op.get("date") or op.get("createdAt") or op.get("created_at"),
            })

        journal_count_by_ref = defaultdict(int)
        for row in journal_rows:
            ref = str(row.get("reference_id") or row.get("referenceId") or "").strip()
            if ref:
                journal_count_by_ref[ref] += 1

        visit_map: Dict[str, Dict[str, Any]] = {}
        for v in visits_rows:
            v_id = str(v.get("id") or "").strip()
            if not v_id:
                continue
            visit_map[v_id] = {
                "id": v_id,
                "vehicleId": v.get("vehicleId") or v.get("vehicle_id"),
                "status": v.get("status"),
            }

        vehicle_ids_existing = {
            str(v.get("id") or "").strip()
            for v in vehicles_rows
            if str(v.get("id") or "").strip()
        }

        signature_count = defaultdict(int)
        for op in op_norm:
            signature_count[_operation_integrity_signature(op)] += 1

        items = []
        ok_count = 0
        warn_count = 0
        duplicate_count = 0

        for op in op_norm:
            op_id = op.get("id")
            warnings = []
            journal_count = int(journal_count_by_ref.get(op_id, 0))
            if journal_count == 0:
                warnings.append("missing_journal_entry")

            op_vehicle_id = str(op.get("vehicleId") or "").strip()
            op_visit_id = str(op.get("visitId") or "").strip()

            if op_vehicle_id and op_vehicle_id not in vehicle_ids_existing:
                warnings.append("vehicle_not_found")

            visit_row = visit_map.get(op_visit_id) if op_visit_id else None
            if op_visit_id and not visit_row:
                warnings.append("visit_not_found")
            if visit_row and op_vehicle_id and str(visit_row.get("vehicleId") or "") != op_vehicle_id:
                warnings.append("visit_vehicle_mismatch")

            if str(op.get("scope") or "").lower() == "vehicle" and not op_vehicle_id:
                warnings.append("vehicle_scope_without_vehicle")

            sign = _operation_integrity_signature(op)
            dup_size = int(signature_count.get(sign, 0))
            if dup_size > 1:
                warnings.append("potential_duplicate")
                duplicate_count += 1

            status = "ok" if not warnings else "warning"
            if status == "ok":
                ok_count += 1
            else:
                warn_count += 1

            items.append(
                {
                    "op_id": op_id,
                    "status": status,
                    "warnings": warnings,
                    "links": {
                        "journal_count": journal_count,
                        "has_vehicle": bool(op_vehicle_id),
                        "has_visit": bool(op_visit_id),
                        "visit_vehicle_match": False if (visit_row and op_vehicle_id and str(visit_row.get("vehicleId") or "") != op_vehicle_id) else True,
                    },
                    "duplicate_group_size": dup_size,
                }
            )

        return {
            "success": True,
            "data": {
                "items": items,
                "summary": {
                    "total": len(items),
                    "ok": ok_count,
                    "warnings": warn_count,
                    "duplicates": duplicate_count,
                },
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _extract_visit_items_for_dashboard(visit_row: Dict[str, Any]) -> List[Dict[str, Any]]:
    notes_payload = _parse_notes_json(visit_row.get("notes"))
    financial = _calc_visit_financial(notes_payload)
    items = financial.get("items") or notes_payload.get("items") or []
    if not items and (notes_payload.get("services") or notes_payload.get("parts")):
        items = [*(notes_payload.get("services") or []), *(notes_payload.get("parts") or [])]
    return items if isinstance(items, list) else []


def _build_dashboard_vehicle_summary(vehicle_id: str, visits: List[Dict[str, Any]]) -> Dict[str, Any]:
    latest_visit = None
    latest_key = ""

    for row in visits:
        row_key = str(row.get("entryDate") or row.get("entry_date") or row.get("createdAt") or row.get("created_at") or "")
        if not latest_visit or row_key > latest_key:
            latest_visit = row
            latest_key = row_key

    items = _extract_visit_items_for_dashboard(latest_visit or {})
    names = []
    for item in items:
        name = str(item.get("name") or item.get("description") or "").strip()
        if name:
            names.append(name)

    service_type = "، ".join(names[:3]) if names else "غير محدد"
    estimated_total = 0.0
    for item in items:
        try:
            quantity = float(item.get("quantity") or 1)
        except Exception:
            quantity = 1.0
        try:
            price = float(item.get("price") or item.get("unit_price") or 0)
        except Exception:
            price = 0.0
        try:
            line_total = float(item.get("total") or (quantity * price))
        except Exception:
            line_total = quantity * price
        estimated_total += line_total

    return {
        "vehicleId": vehicle_id,
        "visitsCount": len(visits),
        "estimatedTotal": round(estimated_total, 2),
        "serviceType": service_type,
    }


@router.post("/vehicles/dashboard/summaries")
async def vehicle_dashboard_summaries(payload: Dict[str, Any] = Body(...)):
    try:
        raw_ids = payload.get("vehicle_ids") or payload.get("vehicleIds") or []
        vehicle_ids = [str(v).strip() for v in raw_ids if str(v).strip()]
        if not vehicle_ids:
            return {"summaries": []}

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        grouped: Dict[str, List[Dict[str, Any]]] = {vid: [] for vid in vehicle_ids}

        if provider == "supabase":
            supa = SupabaseService()
            if supa.mock_mode:
                rows = [
                    row
                    for row in _mem_read("vehicle_visits")
                    if str(row.get("vehicleId") or "") in grouped
                ]
                for row in rows:
                    vid = str(row.get("vehicleId") or "")
                    grouped.setdefault(vid, []).append(row)
            else:
                chunk_size = 100
                for i in range(0, len(vehicle_ids), chunk_size):
                    chunk_ids = vehicle_ids[i : i + chunk_size]
                    res = (
                        supa.client.table("vehicle_visits")
                        .select("id,vehicle_id,entry_date,created_at,notes")
                        .in_("vehicle_id", chunk_ids)
                        .execute()
                    )
                    for row in res.data or []:
                        vid = str(row.get("vehicle_id") or "")
                        grouped.setdefault(vid, []).append(row)

        elif provider == "memory" or db is None:
            rows = [
                row
                for row in _mem_read("vehicle_visits")
                if str(row.get("vehicleId") or "") in grouped
            ]
            for row in rows:
                vid = str(row.get("vehicleId") or "")
                grouped.setdefault(vid, []).append(row)
        else:
            rows = await db.vehicle_visits.find(
                {"vehicleId": {"$in": vehicle_ids}},
                {
                    "_id": 0,
                    "id": 1,
                    "vehicleId": 1,
                    "entryDate": 1,
                    "createdAt": 1,
                    "notes": 1,
                },
            ).to_list(length=5000)
            for row in rows:
                vid = str(row.get("vehicleId") or "")
                grouped.setdefault(vid, []).append(row)

        summaries = [
            _build_dashboard_vehicle_summary(vehicle_id=vid, visits=grouped.get(vid, []))
            for vid in vehicle_ids
        ]
        return {"summaries": summaries}
    except HTTPException:
        raise
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
            existing = supa.operations_get(op_id)
            if not existing:
                raise HTTPException(status_code=404, detail="not found")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/operations")
async def delete_all_operations(request: Request):
    """Delete all operations - for cleanup/reset"""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        actor = _extract_request_actor(request)
        if provider == "supabase":
            supa = SupabaseService()
            # Delete all operations - use gt filter instead of neq
            try:
                # Get all operations first
                all_ops = supa.operations_list()
                deleted_count = len(all_ops or [])
                # Delete each one
                for op in all_ops:
                    try:
                        supa.client.table("operations").delete().eq(
                            "id", op["id"]
                        ).execute()
                    except:
                        pass
                audit_event = record_bulk_delete_event(
                    action="delete_all_operations",
                    source_endpoint="/api/operations",
                    user_id=actor["user_id"],
                    user_role=actor["user_role"],
                    items={"operations_deleted": deleted_count},
                    meta={"provider": provider},
                )
                return {
                    "success": True,
                    "message": f"Deleted {len(all_ops)} operations",
                    "audit_event": audit_event,
                }
            except Exception as e:
                audit_event = record_bulk_delete_event(
                    action="delete_all_operations",
                    source_endpoint="/api/operations",
                    user_id=actor["user_id"],
                    user_role=actor["user_role"],
                    items={"operations_deleted": "all"},
                    meta={"provider": provider, "note": str(e)},
                )
                return {
                    "success": True,
                    "message": "Operations table cleared",
                    "note": str(e),
                    "audit_event": audit_event,
                }

        if provider == "memory" or db is None:
            _mem_write("operations", [])
            audit_event = record_bulk_delete_event(
                action="delete_all_operations",
                source_endpoint="/api/operations",
                user_id=actor["user_id"],
                user_role=actor["user_role"],
                items={"operations_deleted": "all"},
                meta={"provider": provider},
            )
            return {"success": True, "message": "All operations deleted", "audit_event": audit_event}

        result = await db.operations.delete_many({})
        audit_event = record_bulk_delete_event(
            action="delete_all_operations",
            source_endpoint="/api/operations",
            user_id=actor["user_id"],
            user_role=actor["user_role"],
            items={"operations_deleted": result.deleted_count},
            meta={"provider": provider},
        )
        return {
            "success": True,
            "message": f"Deleted {result.deleted_count} operations",
            "audit_event": audit_event,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleanup/keep-debts-only")
async def cleanup_keep_debts_only(request: Request, confirm: str = Query(...)):
    """Delete journal entries + non-debt operations, keep debt operations only."""
    if confirm != "KEEP_DEBTS_ONLY":
        raise HTTPException(status_code=400, detail="confirm=KEEP_DEBTS_ONLY مطلوب")

    def _is_debt_related(op: Dict[str, Any]) -> bool:
        op_type = str(op.get("type") or "").strip().lower()
        payment_method = str(op.get("payment_method") or op.get("paymentMethod") or "").strip().lower()
        payment_status = str(op.get("payment_status") or op.get("paymentStatus") or "").strip().lower()
        if op_type == "payment_order":
            return True
        if payment_method == "credit":
            return True
        if payment_status in {"credit", "unpaid", "pending", "partial"}:
            return True
        return False

    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        actor = _extract_request_actor(request)
        result = {
            "operations_kept": 0,
            "operations_deleted": 0,
            "journal_entries_deleted": 0,
        }

        if provider == "supabase":
            supa = SupabaseService()
            all_ops = supa.operations_list() or []
            keep_ids = []
            delete_ids = []
            for op in all_ops:
                op_id = str(op.get("id") or "").strip()
                if not op_id:
                    continue
                if _is_debt_related(op):
                    keep_ids.append(op_id)
                else:
                    delete_ids.append(op_id)

            for op_id in delete_ids:
                try:
                    supa.client.table("operations").delete().eq("id", op_id).execute()
                except Exception as op_del_error:
                    print(f"Cleanup operation delete failed for {op_id}: {op_del_error}")

            journal_ids = []
            try:
                journal_rows = supa.client.table("journal_entries").select("id").range(0, 9999).execute().data or []
                journal_ids = [str(row.get("id") or "").strip() for row in journal_rows if row.get("id")]
            except Exception as journal_read_error:
                print(f"Cleanup journal fetch failed: {journal_read_error}")

            for journal_id in journal_ids:
                try:
                    supa.client.table("journal_entries").delete().eq("id", journal_id).execute()
                except Exception as je_del_error:
                    print(f"Cleanup journal delete failed for {journal_id}: {je_del_error}")

            result["operations_kept"] = len(keep_ids)
            result["operations_deleted"] = len(delete_ids)
            result["journal_entries_deleted"] = len(journal_ids)
            audit_event = record_bulk_delete_event(
                action="cleanup_keep_debts_only",
                source_endpoint="/api/cleanup/keep-debts-only",
                user_id=actor["user_id"],
                user_role=actor["user_role"],
                items=result,
                meta={"confirm": confirm, "provider": provider},
            )
            return {"success": True, "data": result, "audit_event": audit_event}

        if provider == "memory" or db is None:
            operations = _mem_read("operations")
            kept_ops = [op for op in operations if _is_debt_related(op)]
            deleted_count = max(0, len(operations) - len(kept_ops))
            _mem_write("operations", kept_ops)
            journals = _mem_read("journal_entries")
            _mem_write("journal_entries", [])
            result["operations_kept"] = len(kept_ops)
            result["operations_deleted"] = deleted_count
            result["journal_entries_deleted"] = len(journals)
            audit_event = record_bulk_delete_event(
                action="cleanup_keep_debts_only",
                source_endpoint="/api/cleanup/keep-debts-only",
                user_id=actor["user_id"],
                user_role=actor["user_role"],
                items=result,
                meta={"confirm": confirm, "provider": provider},
            )
            return {"success": True, "data": result, "audit_event": audit_event}

        operations = await db.operations.find({}, {"_id": 0, "id": 1, "type": 1, "payment_method": 1, "paymentMethod": 1, "payment_status": 1, "paymentStatus": 1}).to_list(length=50000)
        keep_ids = []
        delete_ids = []
        for op in operations:
            op_id = str(op.get("id") or "").strip()
            if not op_id:
                continue
            if _is_debt_related(op):
                keep_ids.append(op_id)
            else:
                delete_ids.append(op_id)

        if delete_ids:
            await db.operations.delete_many({"id": {"$in": delete_ids}})
        je_result = await db.journal_entries.delete_many({})

        result["operations_kept"] = len(keep_ids)
        result["operations_deleted"] = len(delete_ids)
        result["journal_entries_deleted"] = je_result.deleted_count
        audit_event = record_bulk_delete_event(
            action="cleanup_keep_debts_only",
            source_endpoint="/api/cleanup/keep-debts-only",
            user_id=actor["user_id"],
            user_role=actor["user_role"],
            items=result,
            meta={"confirm": confirm, "provider": provider},
        )
        return {"success": True, "data": result, "audit_event": audit_event}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/operations/{op_id}/payment-receipts/{filename}")
async def get_operation_payment_receipt(op_id: str, filename: str):
    safe_name = _safe_filename(filename)
    file_path = os.path.join(
        os.path.dirname(__file__),
        "uploads",
        "operation_payment_receipts",
        op_id,
        safe_name,
    )
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="receipt not found")

    guessed_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    with open(file_path, "rb") as f:
        payload = f.read()
    headers = {"Content-Disposition": f'inline; filename="{safe_name}"'}
    return StreamingResponse(io.BytesIO(payload), media_type=guessed_type, headers=headers)


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
        try:
            uuid.UUID(str(op_id))
        except Exception:
            raise HTTPException(status_code=400, detail="invalid operation id")

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider != "supabase":
            raise HTTPException(status_code=400, detail="confirm-payment supported only for supabase provider")

        supa = SupabaseService()
        workshop_id = (payload or {}).get("workshopId") or (payload or {}).get("workshop_id")

        op_rows = (
            supa.client.table("operations").select("*").eq("id", op_id).execute().data
            or []
        )
        if not op_rows:
            raise HTTPException(status_code=404, detail="operation not found")
        op_row = op_rows[0]

        # إذا لم يُرسَل workshopId من الفرونت، استخدم الـ workshop_id من العملية نفسها
        if not workshop_id:
            workshop_id = (
                op_row.get("workshopId")
                or op_row.get("workshop_id")
                or os.environ.get("DEFAULT_WORKSHOP_ID", "finmodule-sync")
            )
        if not workshop_id:
            raise HTTPException(status_code=400, detail="workshopId required")

        payment_methods = {
            str(op_row.get("payment_method") or "").lower(),
            str(op_row.get("paymentMethod") or "").lower(),
        }
        payment_statuses = {
            str(op_row.get("payment_status") or "").lower(),
            str(op_row.get("paymentStatus") or "").lower(),
        }

        is_credit_flow = (
            "credit" in payment_methods
            or len(payment_statuses.intersection({"credit", "unpaid", "pending", "partial"})) > 0
        )

        if not is_credit_flow:
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
                .in_("source", ["operation_payment", "operation_payment_income", "supplier_balance_payment"])
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

        # Choose cash/bank account for settlement based on explicit selected method
        requested_method_raw = str(
            (payload or {}).get("payment_method")
            or (payload or {}).get("paymentMethod")
            or "cash"
        ).strip().lower()

        bank_aliases = {"bank", "transfer", "bank_transfer", "تحويل", "بنك"}
        cash_aliases = {"cash", "نقد", "نقدي", "كاش"}
        pos_aliases  = {"pos", "card", "mada", "visa", "mastercard", "بطاقة", "بطاقه", "شبكة", "نقاط بيع", "نقاط_بيع", "point_of_sale"}

        if requested_method_raw in pos_aliases:
            settlement_method = "pos"
        elif requested_method_raw in bank_aliases:
            settlement_method = "bank"
        elif requested_method_raw in cash_aliases:
            settlement_method = "cash"
        else:
            raise HTTPException(status_code=400, detail="payment_method must be cash, bank, or pos")

        # الأكواد الجديدة: 003=نقد، 004=بنك، 006=نقاط بيع
        if settlement_method == "bank":
            cash_code = "004"
        elif settlement_method == "pos":
            cash_code = "006"
        else:
            cash_code = "003"

        op_account_code = str(op_row.get("account") or op_row.get("accountCode") or "").strip()
        if not op_account_code:
            # الأكواد الجديدة: 027 للخدمات الميكانيكية بدلاً من 4001 القديم
            op_account_code = "027" if op_type in ("sale", "service") else "036"
        else:
            # تحويل أي كود قديم إلى الجديد
            op_account_code = LEGACY_TO_NEW_CODE.get(op_account_code, op_account_code)
        op_account_name = (
            op_row.get("account_name")
            or op_row.get("accountName")
            or ACCOUNT_NAME_MAP.get(op_account_code, op_account_code)
        )

        has_base_operation_entry = False
        try:
            base_entries = (
                supa.client.table("journal_entries")
                .select("id,source")
                .eq("reference_id", op_id)
                .neq("source", "operation_payment")
                .neq("source", "operation_payment_income")
                .limit(1)
                .execute()
                .data
                or []
            )
            has_base_operation_entry = len(base_entries) > 0
        except Exception:
            has_base_operation_entry = False

        if has_base_operation_entry:
            if op_type in ("sale", "service"):
                # Accrual settlement: Dr Cash/Bank/POS, Cr AR
                lines = [
                    {
                        "account": cash_code,
                        "account_name": ACCOUNT_NAME_MAP.get(cash_code, cash_code),
                        "debit": pay_amount,
                        "credit": 0,
                    },
                    {
                        "account": "005",
                        "account_name": ACCOUNT_NAME_MAP.get("005", "العملاء"),
                        "debit": 0,
                        "credit": pay_amount,
                    },
                ]
                desc = f"تحصيل آجل - {op_row.get('partner_name') or ''}"
            elif op_type in ("purchase", "expense"):
                # Accrual settlement: Dr AP, Cr Cash/Bank/POS
                lines = [
                    {
                        "account": "2101",
                        "account_name": ACCOUNT_NAME_MAP.get("2101", "الموردون"),
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
        else:
            # Cash-basis fallback (after cleanup or missing base entries)
            if op_type in ("sale", "service"):
                lines = [
                    {
                        "account": cash_code,
                        "account_name": ACCOUNT_NAME_MAP.get(cash_code, cash_code),
                        "debit": pay_amount,
                        "credit": 0,
                    },
                    {
                        "account": op_account_code,
                        "account_name": op_account_name,
                        "debit": 0,
                        "credit": pay_amount,
                    },
                ]
                desc = f"تحصيل نقدي (اعتراف إيراد) - {op_row.get('partner_name') or ''}"
            elif op_type in ("purchase", "expense"):
                lines = [
                    {
                        "account": op_account_code,
                        "account_name": op_account_name,
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
                desc = f"سداد نقدي (اعتراف مصروف) - {op_row.get('partner_name') or ''}"
            else:
                raise HTTPException(status_code=400, detail="unsupported operation type")

        pay_date = (payload or {}).get("date")
        receipt_info = _save_operation_payment_receipt(op_id, (payload or {}).get("receipt") or {})
        if receipt_info and receipt_info.get("url"):
            desc = f"{desc} | إيصال: {receipt_info.get('filename')}"
        entry_source = "operation_payment" if has_base_operation_entry else "operation_payment_income"
        entry = {
            "id": str(uuid.uuid4()),
            "workshop_id": workshop_id,
            "date": pay_date or datetime.utcnow().isoformat(),
            "description": desc,
            "lines": lines,
            "total": pay_amount,
            "source": entry_source,
            "transaction_type": "payment",
            "reference_id": op_id,
        }
        if receipt_info:
            entry["receipt_url"] = receipt_info.get("url")
            entry["receipt_name"] = receipt_info.get("filename")
        _safe_insert_journal_entry(supa, entry)

        remaining_after = max(0.0, remaining - pay_amount)
        new_status = "paid" if remaining_after <= 0.0001 else "partial"
        new_method = settlement_method if new_status == "paid" else "credit"

        try:
            update_payload = {
                "payment_method": new_method,
                "paymentMethod": new_method,
                "payment_status": new_status,
                "paymentStatus": new_status,
            }
            if receipt_info and receipt_info.get("url"):
                prev_notes = str(op_row.get("notes") or "").strip()
                receipt_line = f"[PAYMENT_RECEIPT] {receipt_info.get('url')}"
                update_payload["notes"] = f"{prev_notes}\n{receipt_line}".strip()
            try:
                supa.client.table("operations").update(update_payload).eq("id", op_id).execute()
            except Exception as update_error:
                retry_payload = dict(update_payload)
                for _ in range(10):
                    match = re.search(r"Could not find the '([^']+)' column", str(update_error))
                    if not match:
                        break
                    missing_col = match.group(1)
                    if missing_col not in retry_payload:
                        break
                    retry_payload.pop(missing_col, None)
                    try:
                        supa.client.table("operations").update(retry_payload).eq("id", op_id).execute()
                        update_error = None
                        break
                    except Exception as retry_error:
                        update_error = retry_error
                if update_error:
                    print(f"confirm-payment operation update skipped: {update_error}")
        except Exception:
            pass

        # Cleanup legacy rows that might have been inserted without workshop_id (fallback insert)
        try:
            supa.client.table("journal_entries").delete().is_("workshop_id", "null").execute()
        except Exception:
            pass

        return {
            "success": True,
            "data": {
                "paid": round(pay_amount, 2),
                "remaining": round(remaining_after, 2),
                "status": new_status,
                "payment_method": new_method,
                "settlement_method": settlement_method,
                "receipt_url": receipt_info.get("url") if receipt_info else None,
                "receipt_name": receipt_info.get("filename") if receipt_info else None,
            },
        }

    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ AutoProfit Pro Integration: Apply Accounting Entries ============


def _normalize_operation_kind(payload: Dict[str, Any]) -> str:
    raw = str(payload.get("operationKind") or payload.get("scope") or "").strip().upper()
    if raw in ["WORKSHOP_OPERATION", "WORKSHOP"]:
        return "WORKSHOP_OPERATION"
    if raw in ["VEHICLE_OPERATION", "VEHICLE"]:
        return "VEHICLE_OPERATION"
    if raw in ["RAKAN_PARTS_OPERATION", "RAKAN_PARTS", "RAKAN"]:
        return "RAKAN_PARTS_OPERATION"

    scope = str(payload.get("scope") or "").strip().lower()
    if scope == "vehicle":
        return "VEHICLE_OPERATION"
    if scope == "rakan_parts":
        return "RAKAN_PARTS_OPERATION"
    if payload.get("vehicleId") or payload.get("vehicle_id"):
        return "VEHICLE_OPERATION"
    return "WORKSHOP_OPERATION"


def _is_rakan_text(value: Any) -> bool:
    txt = str(value or "").strip().lower()
    return "راكان" in txt or "rakan" in txt


def _pick_business_account(
    kind: str,
    provided_id: Optional[str],
    biz_accounts: List[Dict[str, Any]],
) -> Optional[str]:
    if not biz_accounts:
        return None

    by_id = {str(b.get("id")): b for b in biz_accounts if b.get("id")}
    if provided_id and str(provided_id) in by_id:
        provided = by_id[str(provided_id)]
        provided_is_rakan = _is_rakan_business_account_doc(provided)
        if (kind == "RAKAN_PARTS_OPERATION" and provided_is_rakan) or (
            kind != "RAKAN_PARTS_OPERATION" and not provided_is_rakan
        ):
            return str(provided_id)

    if kind == "RAKAN_PARTS_OPERATION":
        rakan = next(
            (b for b in biz_accounts if _is_rakan_business_account_doc(b)),
            None,
        )
        return str(rakan.get("id")) if rakan else None

    non_rakan = [
        b for b in biz_accounts if not _is_rakan_business_account_doc(b)
    ]
    if non_rakan:
        preferred = next(
            (
                b
                for b in non_rakan
                if any(
                    key in f"{str(b.get('name') or '').lower()} {str(b.get('code') or '').lower()}"
                    for key in ["main", "workshop", "الرئيس", "الرئيسي", "default"]
                )
            ),
            None,
        )
        return str((preferred or non_rakan[0]).get("id"))

    return str(biz_accounts[0].get("id"))


def _apply_operation_kind_defaults(
    payload: Dict[str, Any],
    kind: str,
    vehicle_doc: Optional[Dict[str, Any]],
) -> None:
    payload["operationKind"] = kind

    if kind == "WORKSHOP_OPERATION":
        payload["scope"] = "workshop"
        payload["source"] = payload.get("source") or "workshop_operation"
        payload["businessUnit"] = payload.get("businessUnit") or "workshop"
        payload["vehicleId"] = None
        payload["visitId"] = None
        payload["partnerType"] = payload.get("partnerType") or (
            "supplier" if payload.get("type") == "purchase" else "customer"
        )
        return

    if kind == "VEHICLE_OPERATION":
        if not payload.get("vehicleId"):
            raise HTTPException(status_code=400, detail="VEHICLE_OPERATION requires vehicleId")
        payload["scope"] = "vehicle"
        payload["source"] = payload.get("source") or "vehicle_operation"
        payload["businessUnit"] = payload.get("businessUnit") or "workshop"
        payload["partnerType"] = "customer"
        if vehicle_doc:
            payload["partnerId"] = (
                vehicle_doc.get("customerId")
                or vehicle_doc.get("customer_id")
                or payload.get("partnerId")
            )
            payload["partnerName"] = (
                vehicle_doc.get("customerName")
                or vehicle_doc.get("customer_name")
                or payload.get("partnerName")
            )
        return

    if kind == "RAKAN_PARTS_OPERATION":
        op_type = str(payload.get("type") or "").strip().lower()
        has_link = bool(
            payload.get("vehicleId")
            or payload.get("partnerId")
            or str(payload.get("partnerName") or "").strip()
        )
        if op_type in {"sale", "service"} and not has_link:
            raise HTTPException(status_code=400, detail="RAKAN_PARTS_OPERATION requires customer or vehicle")
        payload["scope"] = "rakan_parts"
        payload["source"] = payload.get("source") or "rakan_parts_operation"
        payload["businessUnit"] = payload.get("businessUnit") or "rakan_parts"
        if payload.get("vehicleId") and vehicle_doc:
            payload["partnerType"] = "customer"
            payload["partnerId"] = (
                vehicle_doc.get("customerId")
                or vehicle_doc.get("customer_id")
                or payload.get("partnerId")
            )
            payload["partnerName"] = (
                vehicle_doc.get("customerName")
                or vehicle_doc.get("customer_name")
                or payload.get("partnerName")
            )
        return


@router.post("/operations")
async def create_operation(payload: Dict[str, Any] = Body(...)):
    try:
        payload = dict(payload or {})
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        kind = _normalize_operation_kind(payload)

        vehicle_doc = None
        biz_accounts: List[Dict[str, Any]] = []
        chart_accounts: List[Dict[str, Any]] = []

        if provider == "supabase":
            supa_for_meta = SupabaseService()
            try:
                biz_accounts = supa_for_meta.accounts_list() or []
            except Exception:
                biz_accounts = []

            try:
                chart_res = (
                    supa_for_meta.client.table("accounts")
                    .select("*")
                    .execute()
                )
                chart_accounts = chart_res.data or []
            except Exception:
                chart_accounts = []

            if payload.get("vehicleId"):
                try:
                    vehicles = supa_for_meta.vehicles_list() or []
                    vehicle_doc = next(
                        (v for v in vehicles if str(v.get("id")) == str(payload.get("vehicleId"))),
                        None,
                    )
                except Exception:
                    vehicle_doc = None

        elif provider == "memory" or db is None:
            biz_accounts = _mem_read("business_accounts")
            chart_accounts = _mem_read("accounts") or _mem_read("chart_of_accounts")
            if payload.get("vehicleId"):
                vehicles = _mem_read("vehicles")
                vehicle_doc = next(
                    (v for v in vehicles if str(v.get("id")) == str(payload.get("vehicleId"))),
                    None,
                )
        else:
            biz_accounts = await db.business_accounts.find({}, {"_id": 0}).to_list(1000)
            chart_accounts = await db.accounts.find({}, {"_id": 0}).to_list(5000)
            if payload.get("vehicleId"):
                vehicle_doc = await db.vehicles.find_one(
                    {"id": str(payload.get("vehicleId"))}, {"_id": 0}
                )

        chart_account_ref_map = _build_chart_account_ref_map(chart_accounts)
        accounting_ref = (
            payload.get("accountingAccountId")
            or payload.get("accounting_account_id")
            or payload.get("accountId")
            or payload.get("account_id")
        )
        accounting_meta = _resolve_chart_account_meta(accounting_ref, chart_account_ref_map)
        accounting_code = accounting_meta.get("code") or ""
        is_rakan_by_account = _is_rakan_account_code(accounting_code)

        if is_rakan_by_account:
            kind = "RAKAN_PARTS_OPERATION"
        elif kind == "RAKAN_PARTS_OPERATION":
            kind = "VEHICLE_OPERATION" if payload.get("vehicleId") else "WORKSHOP_OPERATION"

        payload["type"] = _infer_operation_type_from_account(
            payload.get("type"), accounting_meta.get("type")
        )

        op_type = str(payload.get("type") or "").lower()
        original_type = str(payload.get("originalType") or payload.get("original_type") or "").lower()
        partner_type = str(payload.get("partnerType") or payload.get("partner_type") or "").lower()
        has_partner = bool(payload.get("partnerId") or payload.get("partner_id") or payload.get("partnerName") or payload.get("partner_name"))
        has_vehicle = bool(payload.get("vehicleId") or payload.get("vehicle_id"))

        if op_type in {"sale", "sale_return"} and not (has_vehicle or has_partner):
            raise HTTPException(status_code=400, detail="عمليات البيع/مرتجع البيع تتطلب ربطاً بمركبة أو عميل")

        if op_type in {"purchase", "purchase_return"} and not has_partner:
            raise HTTPException(status_code=400, detail="عمليات الشراء/مرتجع الشراء تتطلب اختيار مورد")

        if op_type == "payment_order" and original_type == "receipt_voucher":
            if not has_vehicle:
                raise HTTPException(status_code=400, detail="سند القبض يجب أن يكون مرتبطاً بمركبة")
            payload["partnerType"] = "customer"
            payload["partner_type"] = "customer"

        if op_type == "payment_order" and original_type == "settlement":
            if not has_partner or partner_type not in {"customer", "supplier"}:
                raise HTTPException(status_code=400, detail="التسوية يجب أن تكون مرتبطة بعميل أو مورد")

        payload["notes"] = _enrich_operation_notes(
            payload.get("notes"),
            is_rakan=is_rakan_by_account,
            accounting_code=accounting_code,
            accounting_name=accounting_meta.get("name"),
        )
        if accounting_code:
            payload["accountingAccountCode"] = accounting_code

        if kind == "RAKAN_PARTS_OPERATION" and not any(
            _is_rakan_business_account_doc(x) for x in biz_accounts
        ):
            if provider == "supabase":
                try:
                    supa_for_meta = SupabaseService()
                    created_rakan = supa_for_meta.accounts_create(
                        name="قطع راكان", code="RAKAN_PARTS", currency="SAR"
                    )
                    if created_rakan:
                        biz_accounts = [created_rakan, *biz_accounts]
                except Exception:
                    pass

        _apply_operation_kind_defaults(payload, kind, vehicle_doc)

        visit_data = None
        if payload.get("vehicleId"):
            if payload.get("visitId"):
                visit_data = await _get_vehicle_visit_by_id(provider, payload.get("visitId"), db)
            if not visit_data:
                visit_data = await _get_latest_vehicle_visit(provider, payload.get("vehicleId"))
                if visit_data:
                    payload["visitId"] = visit_data.get("id")

        resolved_account_id = _pick_business_account(
            kind, payload.get("accountId"), biz_accounts
        )
        if not resolved_account_id:
            raise HTTPException(
                status_code=400,
                detail="تعذر تحديد حساب الأعمال المناسب للعملية. تحقق من إعداد حسابات الفروع.",
            )
        payload["accountId"] = resolved_account_id

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
                entry = _build_operation_journal_entry(
                    op,
                    workshop_id,
                    chart_account_ref_map=chart_account_ref_map,
                )
                # قد يُعيد list من القيود (في حالة موردي الآجل)
                if isinstance(entry, list):
                    for e in entry:
                        _safe_insert_journal_entry(supa, e)
                else:
                    _safe_insert_journal_entry(supa, entry)
            except Exception as je_error:
                print(f"Failed to create journal entry for operation: {je_error}")
            await _append_operation_to_visit(payload, op, provider, db, visit_data)
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
                "accountingAccountId": payload.get("accountingAccountId"),
                "vehicleId": payload.get("vehicleId"),
                "partnerType": payload.get("partnerType"),
                "partnerId": payload.get("partnerId"),
                "partnerName": payload.get("partnerName"),
                "items": items,
                "subtotal": subtotal,
                "total": subtotal,
                "paymentMethod": payload.get("paymentMethod", "cash"),
                "paymentStatus": payload.get("paymentStatus", "paid"),
                "paymentAmount": payload.get("paymentAmount"),
                "notes": payload.get("notes"),
                "scope": payload.get("scope") or ("vehicle" if payload.get("vehicleId") else "workshop"),
                "source": payload.get("source"),
                "businessUnit": payload.get("businessUnit") or payload.get("business_unit"),
                "date": datetime.utcnow().isoformat(),
                "createdAt": datetime.utcnow().isoformat(),
            }
            rows.append(doc)
            _mem_write("operations", rows)
            await _append_operation_to_visit(payload, doc, provider, db, visit_data)
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
            "accountingAccountId": payload.get("accountingAccountId"),
            "vehicleId": payload.get("vehicleId"),
            "type": payload.get("type", "purchase"),
            "partnerType": payload.get("partnerType", "supplier"),
            "partnerId": payload.get("partnerId"),
            "partnerName": payload.get("partnerName"),
            "items": items,
            "subtotal": subtotal,
            "total": subtotal,
            "paymentMethod": payload.get("paymentMethod", "cash"),
            "paymentStatus": payload.get("paymentStatus", "paid"),
            "paymentAmount": payload.get("paymentAmount"),
            "notes": payload.get("notes"),
            "scope": payload.get("scope") or ("vehicle" if payload.get("vehicleId") else "workshop"),
            "source": payload.get("source"),
            "businessUnit": payload.get("businessUnit") or payload.get("business_unit"),
            "date": datetime.utcnow(),
            "createdAt": datetime.utcnow(),
        }
        await db.operations.insert_one(op)

        # inventory adjust for parts
        if op["type"] in ("purchase", "sale", "sale_return", "purchase_return"):
            for it in items:
                if it.get("itemType") == "part" and it.get("itemId"):
                    delta = int(float(it.get("quantity", 0)))
                    if op["type"] in ("sale", "purchase_return"):
                        delta = -delta
                    await db.parts.update_one(
                        {"id": it["itemId"]}, {"$inc": {"quantity": delta}}
                    )
        # transaction record (income/expense)
        tx = {
            "id": str(uuid.uuid4()),
            "accountId": op["accountId"],
            "vehicleId": op.get("vehicleId"),
            "type": "income" if op["type"] in ("sale", "purchase_return") else "expense",
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
        await _append_operation_to_visit(payload, op, provider, db, visit_data)
        return op
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
        # Backward compatibility: default to workshop (support itemType)
        raw_type = it.get('billingType') or it.get('type') or it.get('itemType') or 'workshop'
        billing_type = str(raw_type).lower()
        qty = _num(it.get('quantity', 1), 1.0)
        price = _num(it.get('price', it.get('unit_price', 0)), 0.0)
        line_total = _num(it.get('total'), qty * price)
        if billing_type in {'supplier', 'part', 'parts'}:
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

    # Keep legacy total/balance view for vehicle page display
    # while exposing supplier archive explicitly in a separate field.
    total_amount = total_workshop + total_suppliers
    balance = total_amount - total_paid

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
        'supplier_archive_total': round(total_suppliers, 2),
        'total_amount': round(total_amount, 2),
        'total_paid': round(total_paid, 2),
        'advance_paid': round(advance_paid, 2),
        'balance': round(balance, 2),
        'payment_status': payment_status,
    }


ARCHIVE_SEARCH_DIGITS_MAP = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
ARCHIVE_SEARCH_STOP_WORDS = {
    "السياره",
    "سياره",
    "السيارة",
    "سيارة",
    "المركبه",
    "مركبه",
    "المركبة",
    "مركبة",
    "عميل",
    "العميل",
    "لوحه",
    "لوحة",
    "زياره",
    "زيارة",
    "اخر",
    "آخر",
    "تفاصيل",
    "ماهي",
    "وش",
    "ايش",
    "عن",
    "ابحث",
    "بحث",
    "اريد",
    "أريد",
    "اعطني",
    "اعرض",
    "متى",
    "تم",
}


def _normalize_archive_search_text(value: Any, keep_spaces: bool = False) -> str:
    text = str(value or "").strip().lower().translate(ARCHIVE_SEARCH_DIGITS_MAP)
    if not text:
        return ""
    replacements = {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ٱ": "ا",
        "ة": "ه",
        "ى": "ي",
        "ؤ": "و",
        "ئ": "ي",
    }
    for src, dest in replacements.items():
        text = text.replace(src, dest)
    text = re.sub(r"[^0-9a-z\u0600-\u06FF\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text if keep_spaces else text.replace(" ", "")


def _extract_archive_search_terms(query: str) -> Dict[str, Any]:
    spaced = _normalize_archive_search_text(query, keep_spaces=True)
    raw_tokens = [token for token in spaced.split(" ") if token]
    filtered_tokens = [
        token for token in raw_tokens if token not in ARCHIVE_SEARCH_STOP_WORDS
    ]
    compact = "".join(filtered_tokens) or _normalize_archive_search_text(query)
    return {
        "raw": query,
        "spaced": spaced,
        "tokens": filtered_tokens or raw_tokens,
        "compact": compact,
    }


def _build_archive_vehicle_fields(vehicle: Dict[str, Any]) -> Dict[str, str]:
    plate = str(vehicle.get("plateNumber") or vehicle.get("plate_number") or "")
    customer = str(vehicle.get("customerName") or vehicle.get("customer_name") or "")
    brand = str(vehicle.get("brand") or "")
    model = str(vehicle.get("model") or "")
    year = str(vehicle.get("year") or "")
    file_number = str(vehicle.get("fileNumber") or vehicle.get("file_number") or "")
    vin = str(vehicle.get("vin") or "")
    vehicle_title = " ".join(part for part in [brand, model, year] if part).strip()
    combined = " ".join(
        part for part in [plate, customer, vehicle_title, file_number, vin] if part
    )
    return {
        "plate": _normalize_archive_search_text(plate),
        "customer": _normalize_archive_search_text(customer),
        "vehicle": _normalize_archive_search_text(vehicle_title),
        "combined": _normalize_archive_search_text(combined),
    }


def _score_archive_vehicle_match(
    vehicle: Dict[str, Any], compact_query: str, tokens: List[str]
) -> Dict[str, Any]:
    fields = _build_archive_vehicle_fields(vehicle)
    score = 0
    reasons: List[str] = []
    matched_tokens = 0

    if compact_query:
        if fields["plate"] and (compact_query in fields["plate"] or fields["plate"] in compact_query):
            score += 140
            reasons.append("مطابقة رقم اللوحة")
        if fields["customer"] and compact_query in fields["customer"]:
            score += 110
            reasons.append("مطابقة اسم العميل")
        if fields["vehicle"] and compact_query in fields["vehicle"]:
            score += 95
            reasons.append("مطابقة المركبة")
        if fields["combined"] and compact_query in fields["combined"]:
            score += 70

    for token in tokens:
        if len(token) < 1:
            continue
        if fields["plate"] and token in fields["plate"]:
            score += 28
            matched_tokens += 1
        elif fields["customer"] and token in fields["customer"]:
            score += 24
            matched_tokens += 1
        elif fields["vehicle"] and token in fields["vehicle"]:
            score += 20
            matched_tokens += 1
        elif fields["combined"] and token in fields["combined"]:
            score += 10
            matched_tokens += 1

    if tokens and matched_tokens == len(tokens):
        score += 35
        reasons.append("مطابقة كل أجزاء البحث")
    elif matched_tokens:
        reasons.append(f"مطابقة {matched_tokens} من {len(tokens)} أجزاء البحث")

    return {"score": score, "reasons": reasons}


def _payment_method_label(method: Optional[str], payment_status: Optional[str], total_paid: float) -> str:
    normalized = str(method or "").strip().lower()
    labels = {
        "cash": "نقدًا",
        "credit": "آجل",
        "transfer": "تحويل",
        "bank": "تحويل بنكي",
        "card": "بطاقة",
        "mada": "مدى",
    }
    if payment_status == "unpaid":
        return "غير مسددة بعد"
    if payment_status == "partial":
        return "دفعة جزئية / تحت الحساب"
    if normalized in labels:
        label = labels[normalized]
    elif total_paid > 0:
        label = "دفعات زيارة"
    else:
        label = "غير محددة"

    if normalized == "credit" and payment_status == "paid_full":
        return "آجل تم سداده"
    return label


def _humanize_archive_date(value: Any) -> str:
    if not value:
        return "غير محدد"
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except Exception:
            return str(value)
    return dt.strftime("%Y-%m-%d %H:%M")


def _build_repair_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    cleaned_items: List[Dict[str, Any]] = []
    for item in items or []:
        name = str(item.get("name") or item.get("title") or "").strip()
        if not name:
            continue
        quantity = item.get("quantity") or 1
        try:
            quantity = int(quantity)
        except Exception:
            quantity = 1
        cleaned_items.append(
            {
                "name": name,
                "quantity": quantity,
                "price": float(item.get("price") or item.get("unit_price") or 0),
            }
        )

    if not cleaned_items:
        return {
            "items": [],
            "summary": "لا توجد بنود إصلاح مسجلة في آخر زيارة",
        }

    summary_parts = []
    for item in cleaned_items[:4]:
        qty_suffix = f" ×{item['quantity']}" if item["quantity"] > 1 else ""
        summary_parts.append(f"{item['name']}{qty_suffix}")
    extra_count = max(0, len(cleaned_items) - 4)
    summary = "، ".join(summary_parts)
    if extra_count:
        summary += f" +{extra_count} أخرى"

    return {"items": cleaned_items, "summary": summary}


async def _list_archive_search_vehicles(provider: str) -> List[Dict[str, Any]]:
    if provider == "supabase":
        supa = SupabaseService()
        if supa.mock_mode:
            return _mem_read("vehicles")
        return supa.vehicles_list()

    if provider == "memory" or db is None:
        return _mem_read("vehicles")

    return await db.vehicles.find(
        {},
        {
            "_id": 0,
            "id": 1,
            "plateNumber": 1,
            "brand": 1,
            "model": 1,
            "year": 1,
            "customerName": 1,
            "customerPhone": 1,
            "fileNumber": 1,
            "vin": 1,
        },
    ).to_list(3000)


async def _get_latest_vehicle_visit(provider: str, vehicle_id: str) -> Optional[Dict[str, Any]]:
    if provider == "supabase":
        supa = SupabaseService()
        if supa.mock_mode:
            visits = [
                row for row in _mem_read("vehicle_visits") if row.get("vehicleId") == vehicle_id
            ]
            visits.sort(
                key=lambda row: str(
                    row.get("entryDate") or row.get("exitDate") or row.get("createdAt") or ""
                ),
                reverse=True,
            )
            return visits[0] if visits else None

        res = (
            supa.client.table("vehicle_visits")
            .select("*")
            .eq("vehicle_id", vehicle_id)
            .order("entry_date", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        return {
            "id": row.get("id"),
            "vehicleId": row.get("vehicle_id"),
            "entryDate": row.get("entry_date"),
            "exitDate": row.get("exit_date"),
            "status": row.get("status"),
            "mileage": row.get("mileage"),
            "notes": row.get("notes"),
            "createdAt": row.get("created_at"),
        }

    if provider == "memory" or db is None:
        visits = [row for row in _mem_read("vehicle_visits") if row.get("vehicleId") == vehicle_id]
        visits.sort(
            key=lambda row: str(
                row.get("entryDate") or row.get("exitDate") or row.get("createdAt") or ""
            ),
            reverse=True,
        )
        return visits[0] if visits else None

    rows = await db.vehicle_visits.find(
        {"vehicleId": vehicle_id}, {"_id": 0}
    ).sort("entryDate", -1).limit(1).to_list(1)
    if not rows:
        return None
    row = rows[0]
    for key in ("entryDate", "exitDate", "createdAt"):
        if row.get(key) and hasattr(row[key], "isoformat"):
            row[key] = row[key].isoformat()
    return row


async def _get_vehicle_visit_by_id(provider: str, visit_id: str, db=None):
    if not visit_id:
        return None
    if provider == "supabase":
        supa = SupabaseService()
        if supa.mock_mode:
            for visit in _mem_read("vehicle_visits"):
                if str(visit.get("id")) == str(visit_id):
                    return visit
            return None
        res = supa.client.table("vehicle_visits").select("*").eq("id", visit_id).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    if provider == "memory" or db is None:
        visits = _mem_read("vehicle_visits")
        for visit in visits:
            if str(visit.get("id")) == str(visit_id):
                return visit
        return None
    row = await db.vehicle_visits.find_one({"id": visit_id}, {"_id": 0})
    if row:
        for key in ("entryDate", "exitDate", "createdAt"):
            if row.get(key) and hasattr(row[key], "isoformat"):
                row[key] = row[key].isoformat()
    return row


async def _append_operation_to_visit(payload: dict, operation: dict, provider: str, db=None, visit_data: dict = None):
    vehicle_id = payload.get("vehicleId") or payload.get("vehicle_id") or operation.get("vehicle_id")
    if not vehicle_id:
        return
    visit = visit_data or await _get_vehicle_visit_by_id(provider, payload.get("visitId"), db) or await _get_latest_vehicle_visit(provider, vehicle_id)
    if not visit:
        return

    notes_payload = _parse_notes_json(visit.get("notes"))
    items = notes_payload.get("items", [])
    payment_status = payload.get("paymentStatus") or payload.get("payment_status")

    for item in payload.get("items", []) or []:
        quantity = float(item.get("quantity") or 1)
        price = float(item.get("price") or item.get("unit_price") or item.get("unitPrice") or 0)
        total = float(item.get("total") or item.get("total_price") or (quantity * price))
        name = item.get("name") or item.get("description") or item.get("label") or item.get("itemName") or "عنصر"
        items.append({
            "name": name,
            "description": item.get("description") or name,
            "quantity": quantity,
            "price": price,
            "total": total,
            "itemType": item.get("itemType") or item.get("type") or payload.get("itemType"),
            "paymentStatus": payment_status,
            "operationId": operation.get("id"),
            "operationNumber": operation.get("operation_number") or operation.get("operationNumber"),
            "source": "operation",
            "createdAt": datetime.utcnow().isoformat(),
        })

    notes_payload["items"] = items
    notes_payload.setdefault("payments", [])
    notes_payload.setdefault("technicians", [])
    updated_notes = json.dumps(notes_payload, ensure_ascii=False)
    visit_id = visit.get("id")

    if provider == "supabase":
        supa = SupabaseService()
        if supa.mock_mode:
            visits = _mem_read("vehicle_visits")
            for row in visits:
                if str(row.get("id")) == str(visit_id):
                    row["notes"] = updated_notes
            _mem_write("vehicle_visits", visits)
        else:
            supa.client.table("vehicle_visits").update({"notes": updated_notes}).eq("id", visit_id).execute()
    elif provider == "memory" or db is None:
        visits = _mem_read("vehicle_visits")
        for row in visits:
            if str(row.get("id")) == str(visit_id):
                row["notes"] = updated_notes
        _mem_write("vehicle_visits", visits)
    else:
        await db.vehicle_visits.update_one({"id": visit_id}, {"$set": {"notes": updated_notes}})


async def _get_visit_archive_operations(provider: str, visit_id: str) -> List[Dict[str, Any]]:
    if not visit_id:
        return []

    if provider == "supabase":
        supa = SupabaseService()
        if supa.mock_mode:
            rows = [row for row in _mem_read("operations") if row.get("visitId") == visit_id]
            rows.sort(
                key=lambda row: str(row.get("createdAt") or row.get("date") or ""),
                reverse=True,
            )
            return rows
        res = (
            supa.client.table("operations")
            .select("*")
            .eq("visit_id", visit_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        rows = res.data or []
        return [
            {
                "id": row.get("id"),
                "items": row.get("items") or [],
                "paymentMethod": row.get("payment_method"),
                "total": row.get("total"),
                "date": row.get("op_date"),
                "createdAt": row.get("created_at"),
            }
            for row in rows
        ]

    if provider == "memory" or db is None:
        rows = [row for row in _mem_read("operations") if row.get("visitId") == visit_id]
        rows.sort(
            key=lambda row: str(row.get("createdAt") or row.get("date") or ""),
            reverse=True,
        )
        return rows

    rows = await db.operations.find(
        {"visitId": visit_id}, {"_id": 0}
    ).sort("createdAt", -1).limit(10).to_list(10)
    for row in rows:
        for key in ("date", "createdAt"):
            if row.get(key) and hasattr(row[key], "isoformat"):
                row[key] = row[key].isoformat()
    return rows


def _format_archive_response_text(vehicle: Dict[str, Any], latest_visit: Optional[Dict[str, Any]]) -> str:
    plate = vehicle.get("plateNumber") or vehicle.get("plate_number") or "-"
    vehicle_name = " ".join(
        str(part).strip()
        for part in [vehicle.get("brand"), vehicle.get("model"), vehicle.get("year")]
        if str(part or "").strip()
    )
    customer_name = vehicle.get("customerName") or vehicle.get("customer_name") or "-"

    if not latest_visit:
        return (
            f"تم العثور على المركبة {plate} ({vehicle_name or 'بدون وصف'}) للعميل {customer_name}، "
            "لكن لا توجد زيارة سابقة مسجلة لها."
        )

    visit_date = _humanize_archive_date(
        latest_visit.get("entryDate") or latest_visit.get("exitDate") or latest_visit.get("createdAt")
    )
    repairs = latest_visit.get("repairsSummary") or "لا توجد بنود إصلاح مسجلة"
    total_amount = latest_visit.get("totalAmount") or 0
    payment_method = latest_visit.get("paymentMethodLabel") or "غير محددة"
    return (
        f"آخر زيارة للمركبة {plate} ({vehicle_name or 'بدون وصف'}) كانت بتاريخ {visit_date}.\n"
        f"العميل: {customer_name}.\n"
        f"ما تم إصلاحه: {repairs}.\n"
        f"القيمة: {round(float(total_amount), 2)} ر.س.\n"
        f"طريقة الدفع: {payment_method}."
    )


@router.get("/vehicles/archive-search")
async def archive_search_latest_visit(
    query: str = Query(..., min_length=1),
    limit: int = Query(default=5, ge=1, le=10),
):
    """بحث أرشيفي سريع عن آخر زيارة عبر اسم العميل أو المركبة أو اللوحة."""
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        search_terms = _extract_archive_search_terms(query)
        compact_query = search_terms.get("compact") or ""
        tokens = search_terms.get("tokens") or []

        if not compact_query and not tokens:
            return {
                "query": query,
                "interpretedQuery": "",
                "resultsCount": 0,
                "bestMatch": None,
                "results": [],
            }

        vehicles = await _list_archive_search_vehicles(provider)
        scored = []
        for vehicle in vehicles:
            match = _score_archive_vehicle_match(vehicle, compact_query, tokens)
            if match["score"] <= 0:
                continue
            scored.append({**match, "vehicle": vehicle})

        scored.sort(key=lambda row: row["score"], reverse=True)
        results = []
        for candidate in scored[: limit * 2]:
            vehicle = candidate["vehicle"]
            latest_visit = await _get_latest_vehicle_visit(provider, str(vehicle.get("id") or ""))
            operations = await _get_visit_archive_operations(
                provider, str((latest_visit or {}).get("id") or "")
            )
            parsed_notes = _parse_notes_json((latest_visit or {}).get("notes"))
            visit_financial = _calc_visit_financial(parsed_notes)

            repair_source = visit_financial.get("items") or []
            if not repair_source and operations:
                repair_source = operations[0].get("items") or []
            repair_data = _build_repair_summary(repair_source)

            latest_operation = operations[0] if operations else {}
            total_amount = visit_financial.get("total_amount") or float(
                latest_operation.get("total") or 0
            )
            payment_method = latest_operation.get("paymentMethod")
            payment_method_label = _payment_method_label(
                payment_method,
                visit_financial.get("payment_status"),
                float(visit_financial.get("total_paid") or 0),
            )

            latest_visit_payload = None
            if latest_visit:
                latest_visit_payload = {
                    "id": latest_visit.get("id"),
                    "entryDate": latest_visit.get("entryDate") or latest_visit.get("entry_date"),
                    "exitDate": latest_visit.get("exitDate") or latest_visit.get("exit_date"),
                    "status": latest_visit.get("status") or "-",
                    "repairs": repair_data["items"],
                    "repairsSummary": repair_data["summary"],
                    "totalAmount": round(float(total_amount or 0), 2),
                    "totalPaid": round(float(visit_financial.get("total_paid") or 0), 2),
                    "balance": round(float(visit_financial.get("balance") or 0), 2),
                    "paymentStatus": visit_financial.get("payment_status") or "unknown",
                    "paymentMethod": payment_method or "",
                    "paymentMethodLabel": payment_method_label,
                }

            vehicle_payload = {
                "id": vehicle.get("id"),
                "plateNumber": vehicle.get("plateNumber") or vehicle.get("plate_number"),
                "brand": vehicle.get("brand"),
                "model": vehicle.get("model"),
                "year": vehicle.get("year"),
                "customerName": vehicle.get("customerName") or vehicle.get("customer_name"),
                "customerPhone": vehicle.get("customerPhone") or vehicle.get("customer_phone"),
                "fileNumber": vehicle.get("fileNumber") or vehicle.get("file_number"),
            }

            result_item = {
                "matchScore": candidate["score"],
                "matchReasons": candidate.get("reasons") or [],
                "vehicle": vehicle_payload,
                "latestVisit": latest_visit_payload,
                "responseText": _format_archive_response_text(vehicle_payload, latest_visit_payload),
            }
            results.append(result_item)
            if len(results) >= limit:
                break

        return {
            "query": query,
            "interpretedQuery": search_terms.get("spaced") or compact_query,
            "resultsCount": len(results),
            "bestMatch": results[0] if results else None,
            "results": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vehicles/{vehicle_id}/financial-summary")
async def vehicle_financial_summary(vehicle_id: str):
    """Aggregate financial totals for a vehicle across all visits.

    Reads visit items/payments from visit.notes JSON (no schema changes).
    Returns workshop/suppliers/paid/balance + advance_paid.
    """
    try:
        try:
            uuid.UUID(str(vehicle_id))
        except Exception:
            raise HTTPException(status_code=404, detail="vehicle not found")

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        total_workshop = 0.0
        total_suppliers = 0.0
        total_paid = 0.0
        total_advance = 0.0

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            vehicle_check = (
                supa.client.table("vehicles")
                .select("id")
                .eq("id", vehicle_id)
                .limit(1)
                .execute()
                .data
                or []
            )
            if not vehicle_check:
                raise HTTPException(status_code=404, detail="vehicle not found")

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
            exists = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0, "id": 1})
            if not exists:
                raise HTTPException(status_code=404, detail="vehicle not found")

            docs = await db.vehicle_visits.find({"vehicleId": vehicle_id}, {"_id": 0, "notes": 1}).to_list(2000)
            for d in docs:
                parsed = _parse_notes_json(d.get('notes'))
                fin = _calc_visit_financial(parsed)
                total_workshop += fin['total_workshop']
                total_suppliers += fin['total_suppliers']
                total_paid += fin['total_paid']
                total_advance += fin['advance_paid']

        # Keep current UI-compatible balance formula
        total_amount = total_workshop + total_suppliers
        balance = total_amount - total_paid

        return {
            "total_workshop": round(total_workshop, 2),
            "total_suppliers": round(total_suppliers, 2),
            "supplier_archive_total": round(total_suppliers, 2),
            "total_paid": round(total_paid, 2),
            "advance_paid": round(total_advance, 2),
            "total_amount": round(total_amount, 2),
            "balance": round(balance, 2),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
            
            # --- Balance check (non-blocking): log only if workshop balance unpaid ---
            if payload.get("status") == "completed":
                parsed_notes = _parse_notes_json(upd.get("notes") or r.get("notes"))
                fin = _calc_visit_financial(parsed_notes)
                # الموردون وحدة أرشيفية منفصلة — الفحص على رصيد الورشة فقط
                workshop_balance = round(fin.get('total_workshop', 0) - fin.get('total_paid', 0), 2)
                if workshop_balance > 0.01:
                    print(f"   [INFO] Visit closed with outstanding workshop balance: {workshop_balance:.2f} SAR")

            # Make sure we return 4xx properly (Cloudflare 520 appears when unhandled)
            if payload.get("status") == "completed":
                # validation already done above
                pass

            # --- SYNC TO OPERATIONS (FINANCE) ---
            if "notes" in payload or "status" in payload:
                sync_payload = {**payload, "id": visit_id}
                if r:
                    sync_payload = {**sync_payload, **r}
                if not sync_payload.get("vehicle_id") and not sync_payload.get("vehicleId"):
                    try:
                        existing = (
                            supa.client.table("vehicle_visits")
                            .select("vehicle_id")
                            .eq("id", visit_id)
                            .limit(1)
                            .execute()
                        )
                        row = (existing.data or [None])[0]
                        if row and row.get("vehicle_id"):
                            sync_payload["vehicle_id"] = row.get("vehicle_id")
                    except Exception:
                        pass
                await _sync_visit_to_operation(visit_id, sync_payload, supa_service=supa)
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
    except HTTPException:
        raise
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

    except HTTPException:
        raise
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------- Chart of Accounts APIs ---------------------
async def _account_status_overrides_map() -> Dict[str, bool]:
    try:
        if db is not None:
            rows = await db.account_status_overrides.find({}, {"_id": 0}).to_list(5000)
            return {
                str(row.get("accountId")): bool(row.get("isActive", True))
                for row in rows
                if row.get("accountId")
            }

        rows = _mem_read("account_status_overrides")
        return {
            str(row.get("accountId")): bool(row.get("isActive", True))
            for row in rows
            if row.get("accountId")
        }
    except Exception:
        return {}


async def _set_account_status_override(account_id: str, is_active: bool):
    doc = {
        "accountId": account_id,
        "isActive": bool(is_active),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if db is not None:
        await db.account_status_overrides.update_one(
            {"accountId": account_id}, {"$set": doc}, upsert=True
        )
        return

    rows = _mem_read("account_status_overrides")
    replaced = False
    for i, row in enumerate(rows):
        if row.get("accountId") == account_id:
            rows[i] = doc
            replaced = True
            break
    if not replaced:
        rows.append(doc)
    _mem_write("account_status_overrides", rows)


async def _remove_account_status_override(account_id: str):
    if db is not None:
        await db.account_status_overrides.delete_one({"accountId": account_id})
        return

    rows = _mem_read("account_status_overrides")
    rows = [row for row in rows if row.get("accountId") != account_id]
    _mem_write("account_status_overrides", rows)


async def _account_usage_map() -> Dict[str, str]:
    import time
    global _USAGE_MAP_CACHE, _USAGE_MAP_CACHE_AT
    now_ts = time.time()
    if _USAGE_MAP_CACHE is not None and (now_ts - _USAGE_MAP_CACHE_AT) < _USAGE_MAP_CACHE_TTL:
        return _USAGE_MAP_CACHE
    try:
        if db is not None:
            rows = await db.account_usage.find({}, {"_id": 0}).to_list(5000)
            result = {
                str(row.get("accountId")): str(row.get("lastUsedAt"))
                for row in rows
                if row.get("accountId")
            }
            _USAGE_MAP_CACHE = result
            _USAGE_MAP_CACHE_AT = now_ts
            return result
        rows = _mem_read("account_usage")
        result = {
            str(row.get("accountId")): str(row.get("lastUsedAt"))
            for row in rows
            if row.get("accountId")
        }
        _USAGE_MAP_CACHE = result
        _USAGE_MAP_CACHE_AT = now_ts
        return result
    except Exception:
        return {}


async def _account_display_codes_map() -> Dict[str, str]:
    try:
        if db is not None:
            rows = await db.account_display_codes.find({}, {"_id": 0}).to_list(5000)
            return {
                str(row.get("accountId")): str(row.get("displayCode"))
                for row in rows
                if row.get("accountId") and row.get("displayCode")
            }

        rows = _mem_read("account_display_codes")
        return {
            str(row.get("accountId")): str(row.get("displayCode"))
            for row in rows
            if row.get("accountId") and row.get("displayCode")
        }
    except Exception:
        return {}


async def _set_account_display_code(account_id: str, display_code: str):
    doc = {
        "accountId": account_id,
        "displayCode": display_code,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if db is not None:
        await db.account_display_codes.update_one(
            {"accountId": account_id}, {"$set": doc}, upsert=True
        )
        return

    rows = _mem_read("account_display_codes")
    replaced = False
    for i, row in enumerate(rows):
        if row.get("accountId") == account_id:
            rows[i] = doc
            replaced = True
            break
    if not replaced:
        rows.append(doc)
    _mem_write("account_display_codes", rows)


async def _account_code_aliases_map() -> Dict[str, str]:
    """Map account_id -> legacy/original code before reindexing."""
    try:
        if db is not None:
            rows = await db.account_code_aliases.find({}, {"_id": 0}).to_list(5000)
            return {
                str(row.get("accountId")): str(row.get("legacyCode"))
                for row in rows
                if row.get("accountId") and row.get("legacyCode")
            }
        rows = _mem_read("account_code_aliases")
        return {
            str(row.get("accountId")): str(row.get("legacyCode"))
            for row in rows
            if row.get("accountId") and row.get("legacyCode")
        }
    except Exception:
        return {}


async def _set_account_code_alias(account_id: str, legacy_code: str):
    doc = {
        "accountId": account_id,
        "legacyCode": legacy_code,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if db is not None:
        await db.account_code_aliases.update_one(
            {"accountId": account_id}, {"$set": doc}, upsert=True
        )
        return

    rows = _mem_read("account_code_aliases")
    replaced = False
    for i, row in enumerate(rows):
        if row.get("accountId") == account_id:
            rows[i] = doc
            replaced = True
            break
    if not replaced:
        rows.append(doc)
    _mem_write("account_code_aliases", rows)


async def _set_account_usage(account_id: str, last_used_at: str):
    doc = {"accountId": account_id, "lastUsedAt": last_used_at}
    if db is not None:
        await db.account_usage.update_one({"accountId": account_id}, {"$set": doc}, upsert=True)
        return

    rows = _mem_read("account_usage")
    replaced = False
    for i, row in enumerate(rows):
        if row.get("accountId") == account_id:
            rows[i] = doc
            replaced = True
            break
    if not replaced:
        rows.append(doc)
    _mem_write("account_usage", rows)


def _normalize_account_row(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(raw.get("id") or ""),
        "code": str(raw.get("code") or ""),
        "legacy_code": str(raw.get("legacy_code") or raw.get("legacyCode") or ""),
        "name": raw.get("name") or raw.get("name_ar") or raw.get("code") or "",
        "type": raw.get("type") or "asset",
        "parent_id": raw.get("parent_id") or raw.get("parentId") or None,
        "balance": float(raw.get("balance") or raw.get("current_balance") or 0),
        "active": bool(raw.get("active", True)),
        "is_system": bool(raw.get("is_system") or raw.get("isSystem") or False),
        "last_used_at": raw.get("last_used_at") or raw.get("lastUsedAt"),
    }


def _line_account_code(
    line: Dict[str, Any],
    id_to_code: Dict[str, str],
    legacy_to_current: Optional[Dict[str, str]] = None,
) -> str:
    raw = str(line.get("account") or line.get("account_code") or "").strip()
    if raw in id_to_code:
        return id_to_code[raw]
    if legacy_to_current and raw in legacy_to_current:
        return legacy_to_current[raw]
    return raw


def _apply_account_filters(
    account: Dict[str, Any],
    type_filter: str,
    hide_zero: bool,
    search_q: str,
) -> bool:
    if type_filter and type_filter != "all" and account.get("type") != type_filter:
        return False
    if hide_zero and abs(float(account.get("balance") or 0)) < 0.0001:
        return False
    if search_q:
        hay = f"{account.get('code','')} {account.get('name','')}".lower()
        if search_q not in hay:
            return False
    return True


_LIST_ACCOUNTS_CACHE = None
_LIST_ACCOUNTS_CACHE_AT = 0.0
_LIST_ACCOUNTS_CACHE_TTL = 10.0  # seconds

_USAGE_MAP_CACHE = None
_USAGE_MAP_CACHE_AT = 0.0
_USAGE_MAP_CACHE_TTL = 30.0  # seconds (usage timestamps can be slightly stale)


def invalidate_accounts_cache():
    """Called after any account mutation (create/update/delete) to bust caches."""
    global _LIST_ACCOUNTS_CACHE_AT, _USAGE_MAP_CACHE_AT
    _LIST_ACCOUNTS_CACHE_AT = 0.0
    _USAGE_MAP_CACHE_AT = 0.0


@router.get("/accounts")
async def list_accounts():
    """Get all accounts in the chart of accounts (cached for short TTL)."""
    import time
    global _LIST_ACCOUNTS_CACHE, _LIST_ACCOUNTS_CACHE_AT
    now_ts = time.time()
    if _LIST_ACCOUNTS_CACHE is not None and (now_ts - _LIST_ACCOUNTS_CACHE_AT) < _LIST_ACCOUNTS_CACHE_TTL:
        return _LIST_ACCOUNTS_CACHE
    try:
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        overrides = await _account_status_overrides_map()
        code_aliases = await _account_code_aliases_map()

        if provider == "supabase":
            from supabase_service import SupabaseService

            supa = SupabaseService()
            res = supa.client.table("accounts").select("*").order("code").execute()
            items = res.data or []
            for item in items:
                base_active = item.get("is_active")
                if base_active is None:
                    base_active = item.get("active")
                item["active"] = bool(
                    overrides.get(str(item.get("id")), True if base_active is None else base_active)
                )
                legacy_code = code_aliases.get(str(item.get("id")))
                if legacy_code:
                    item["legacy_code"] = legacy_code
            _LIST_ACCOUNTS_CACHE = items
            _LIST_ACCOUNTS_CACHE_AT = now_ts
            return items

        # MongoDB fallback
        docs = (
            await db.accounts.find({}, {"_id": 0}).sort("code", 1).to_list(length=1000)
        )
        for doc in docs:
            base_active = doc.get("active")
            doc["active"] = bool(
                overrides.get(str(doc.get("id")), True if base_active is None else base_active)
            )
            legacy_code = code_aliases.get(str(doc.get("id")))
            if legacy_code:
                doc["legacyCode"] = legacy_code
        return docs
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/status-overrides")
async def get_account_status_overrides():
    """Returns account active overrides map for UI state merge."""
    return {"overrides": await _account_status_overrides_map()}


@router.patch("/accounts/{account_id}/active")
async def set_account_active(
    account_id: str, payload: Dict[str, Any] = Body(...), request: Request = None
):
    """Enable/disable account without relying on DB schema columns."""
    try:
        role = (request.headers.get("x-user-role", "") if request else "").lower()
        if role and role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="هذه العملية متاحة للمدير فقط")

        is_active = bool(payload.get("isActive", True))
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        # Ensure account exists
        if provider == "supabase":
            supa = SupabaseService()
            acc_res = (
                supa.client.table("accounts")
                .select("id,is_system")
                .eq("id", account_id)
                .limit(1)
                .execute()
            )
            acc = (acc_res.data or [None])[0]
            if not acc:
                raise HTTPException(status_code=404, detail="الحساب غير موجود")
            if acc.get("is_system") and not is_active:
                raise HTTPException(status_code=400, detail="لا يمكن تعطيل حساب نظام")
        else:
            acc = await db.accounts.find_one({"id": account_id}, {"_id": 0})
            if not acc:
                raise HTTPException(status_code=404, detail="الحساب غير موجود")
            if acc.get("isSystem") and not is_active:
                raise HTTPException(status_code=400, detail="لا يمكن تعطيل حساب نظام")

        await _set_account_status_override(account_id, is_active)
        return {"success": True, "accountId": account_id, "isActive": is_active}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, request: Request = None):
    """Delete an account (only if not system and has no children)"""
    try:
        role = (request.headers.get("x-user-role", "") if request else "").lower()
        if role and role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="هذه العملية متاحة للمدير فقط")

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
            # cleanup status override
            await _remove_account_status_override(account_id)
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
        await _remove_account_status_override(account_id)
        return {"success": True}
    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/tree")
async def accounts_tree(
    workshop_id: str = Query("finmodule-sync"),
    type: str = Query("all"),
    hideZero: bool = Query(False),
    search: str = Query(""),
):
    """شجرة الحسابات مع إحصائيات النشاط والملخصات المالية."""
    try:
        raw_accounts = await list_accounts()
        normalized = [_normalize_account_row(acc) for acc in (raw_accounts or [])]
        usage_map = await _account_usage_map()

        for acc in normalized:
            usage_ts = usage_map.get(acc["id"])
            if usage_ts:
                acc["last_used_at"] = usage_ts
            acc["transaction_count"] = 0
            acc["total_debit"] = 0.0
            acc["total_credit"] = 0.0
            acc["activity_volume"] = 0.0
            acc["warning_negative"] = acc["balance"] < 0 and acc["type"] in {"asset", "expense"}

        id_to_code = {acc["id"]: acc["code"] for acc in normalized if acc.get("id") and acc.get("code")}
        code_to_acc = {acc["code"]: acc for acc in normalized if acc.get("code")}
        legacy_to_current = {
            str(acc.get("legacy_code") or "").strip(): str(acc.get("code") or "").strip()
            for acc in normalized
            if str(acc.get("legacy_code") or "").strip() and str(acc.get("code") or "").strip()
        }

        def _pick_code_by_name(keywords: List[str], acc_type: Optional[str] = None) -> str:
            for acc in normalized:
                code = str(acc.get("code") or "").strip()
                if not code:
                    continue
                if acc_type and str(acc.get("type") or "").strip().lower() != acc_type:
                    continue
                name = str(acc.get("name") or "").strip().lower()
                if any(k in name for k in keywords):
                    return code
            return ""

        ar_code = _pick_code_by_name(["عميل", "ذمم"], "asset")
        ap_code = _pick_code_by_name(["مورد", "دائن"], "liability")
        revenue_code = _pick_code_by_name(["إيراد", "ايراد"], "revenue")
        expense_code = _pick_code_by_name(["مصروف"], "expense")
        cost_code = _pick_code_by_name(["تكلفة"], "cost")

        def _map_legacy_code(code: str) -> str:
            raw = str(code or "").strip()
            if not raw:
                return raw
            mapped = legacy_to_current.get(raw)
            if mapped:
                return mapped
            if raw.startswith("1103") and ar_code:
                return ar_code
            if raw.startswith("2101") and ap_code:
                return ap_code
            if raw.startswith("400") or raw.startswith("410"):
                return revenue_code or raw
            if raw.startswith("500") or raw.startswith("510"):
                return cost_code or expense_code or raw
            if raw.startswith("600") or raw.startswith("610"):
                return expense_code or raw
            return raw

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        # Reuse the routes_finance TTL cache for journal entries to avoid
        # double-fetching (accounts/tree + internal income statement call).
        rows = []
        try:
            from routes_finance import _fetch_journal_entries as _finance_fetch_je
            rows = _finance_fetch_je(workshop_id, limit=5000, include_rakan=True)
        except Exception:
            if provider == "supabase":
                supa = SupabaseService()
                jres = (
                    supa.client.table("journal_entries")
                    .select("date,lines")
                    .eq("workshop_id", workshop_id)
                    .limit(5000)
                    .execute()
                )
                rows = jres.data or []
            else:
                rows = await db.journal_entries.find({"workshop_id": workshop_id}, {"_id": 0, "date": 1, "lines": 1}).to_list(length=5000)

        for entry in rows:
            for line in entry.get("lines", []) or []:
                code = _line_account_code(line, id_to_code)
                code = _map_legacy_code(code)
                acc = code_to_acc.get(code)
                if not acc:
                    continue
                debit = float(line.get("debit") or 0)
                credit = float(line.get("credit") or 0)
                acc["transaction_count"] += 1
                acc["total_debit"] += debit
                acc["total_credit"] += credit
                acc["activity_volume"] = acc["total_debit"] + acc["total_credit"]

        # اعتماد الرصيد من القيود الفعلية لضمان التطابق (بدل الاعتماد على قيمة مخزنة قديمة)
        for acc in normalized:
            debit = float(acc.get("total_debit") or 0)
            credit = float(acc.get("total_credit") or 0)
            acc_type = str(acc.get("type") or "").strip().lower()
            if acc_type in {"asset", "expense"}:
                computed_balance = debit - credit
            else:
                computed_balance = credit - debit
            acc["balance"] = round(computed_balance, 2)
            acc["warning_negative"] = acc["balance"] < 0 and acc_type in {"asset", "expense"}

        type_filter = str(type or "all").strip().lower()
        search_q = str(search or "").strip().lower()
        visible_accounts = [
            acc for acc in normalized if _apply_account_filters(acc, type_filter, hideZero, search_q)
        ]

        summary = {
            "assets": round(sum(a["balance"] for a in visible_accounts if a["type"] == "asset"), 2),
            "liabilities": round(sum(a["balance"] for a in visible_accounts if a["type"] == "liability"), 2),
            "equity": round(sum(a["balance"] for a in visible_accounts if a["type"] == "equity"), 2),
            "revenue": round(sum(a["balance"] for a in visible_accounts if a["type"] == "revenue"), 2),
            "expense": round(sum(a["balance"] for a in visible_accounts if a["type"] == "expense"), 2),
            "purchase": round(sum(a["balance"] for a in visible_accounts if a["type"] in {"cost", "purchase"}), 2),
        }
        summary["net_profit"] = round(summary["revenue"] - (summary["expense"] + summary["purchase"]), 2)

        # توحيد مرجع الربحية مع تقرير الدخل لتجنب اختلاف الصفحات المالية
        try:
            from routes_finance import get_income_statement

            income_payload = await get_income_statement(
                workshop_id=workshop_id,
                start_date="2000-01-01",
                end_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            )
            income_totals = (income_payload.get("data") or {}).get("totals") or {}
            summary["revenue"] = round(float(income_totals.get("revenue") or 0), 2)
            summary["expense"] = round(float(income_totals.get("expenses") or 0), 2)
            summary["purchase"] = 0.0
            summary["net_profit"] = round(float(income_totals.get("net_income") or 0), 2)
            summary["financial_source"] = "income_statement"
        except Exception:
            pass

        visible_ids = {a["id"] for a in visible_accounts}
        by_parent: Dict[str, list] = {}
        for acc in visible_accounts:
            parent = str(acc.get("parent_id") or "")
            by_parent.setdefault(parent, []).append(acc)

        def _sort_key(acc: Dict[str, Any]):
            code = str(acc.get("code") or "").strip()
            if code.isdigit():
                return (0, int(code), code)
            return (1, code)

        def build_node(acc: Dict[str, Any], level: int = 0) -> Dict[str, Any]:
            children = by_parent.get(acc["id"], [])
            children = sorted(children, key=_sort_key)
            return {
                **acc,
                "level": level,
                "children": [build_node(child, level + 1) for child in children],
            }

        # Flatten on active search (as requested)
        if search_q:
            flat_nodes = sorted(visible_accounts, key=_sort_key)
            return {
                "success": True,
                "data": {
                    "mode": "flat",
                    "summary": summary,
                    "accounts": flat_nodes,
                },
            }

        roots = [
            acc
            for acc in visible_accounts
            if not acc.get("parent_id") or str(acc.get("parent_id")) not in visible_ids
        ]
        roots = sorted(roots, key=_sort_key)

        return {
            "success": True,
            "data": {
                "mode": "tree",
                "summary": summary,
                "accounts": [build_node(root, 0) for root in roots],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accounts/reindex-display-codes")
async def reindex_account_display_codes():
    """إعادة ترقيم كود الحساب نفسه بشكل متسلسل يبدأ من 001 مع حفظ الكود الأصلي كـ legacy alias."""
    try:
        raw_accounts = await list_accounts()
        normalized = [_normalize_account_row(acc) for acc in (raw_accounts or [])]
        candidates = [acc for acc in normalized if acc.get("id")]
        alias_map = await _account_code_aliases_map()

        def sort_key(acc: Dict[str, Any]):
            code = str(acc.get("code") or "").strip()
            if code.isdigit():
                return (0, int(code), code)
            return (1, code)

        candidates.sort(key=sort_key)

        changed = []
        provider = os.environ.get("DB_PROVIDER", "mongo").lower()

        for idx, acc in enumerate(candidates, start=1):
            account_id = str(acc.get("id"))
            old_code = str(acc.get("code") or "").strip()
            new_code = f"{idx:03d}"
            legacy_code = str(alias_map.get(account_id) or old_code)

            await _set_account_code_alias(account_id, legacy_code)

            if old_code != new_code:
                if provider == "supabase":
                    supa = SupabaseService()
                    supa.client.table("accounts").update({"code": new_code}).eq("id", account_id).execute()
                elif db is not None:
                    await db.accounts.update_one({"id": account_id}, {"$set": {"code": new_code}})

            changed.append(
                {
                    "account_id": account_id,
                    "old_code": old_code,
                    "new_code": new_code,
                    "legacy_code": legacy_code,
                    "name": acc.get("name"),
                }
            )

        return {
            "success": True,
            "data": {
                "count": len(changed),
                "first_code": changed[0]["new_code"] if changed else None,
                "last_code": changed[-1]["new_code"] if changed else None,
                "sample": changed[:50],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/{account_id}/transactions")
async def account_transactions(
    account_id: str,
    workshop_id: str = Query("finmodule-sync"),
    limit: int = Query(10, ge=1, le=200),
):
    """آخر عمليات الحساب."""
    try:
        raw_accounts = await list_accounts()
        normalized = [_normalize_account_row(acc) for acc in (raw_accounts or [])]
        target = next((a for a in normalized if a["id"] == account_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="الحساب غير موجود")

        id_to_code = {acc["id"]: acc["code"] for acc in normalized if acc.get("id") and acc.get("code")}
        target_code = target["code"]
        legacy_to_current = {
            str(acc.get("legacy_code") or "").strip(): str(acc.get("code") or "").strip()
            for acc in normalized
            if str(acc.get("legacy_code") or "").strip() and str(acc.get("code") or "").strip()
        }

        def _pick_code_by_name(keywords: List[str], acc_type: Optional[str] = None) -> str:
            for acc in normalized:
                code = str(acc.get("code") or "").strip()
                if not code:
                    continue
                if acc_type and str(acc.get("type") or "").strip().lower() != acc_type:
                    continue
                name = str(acc.get("name") or "").strip().lower()
                if any(k in name for k in keywords):
                    return code
            return ""

        ar_code = _pick_code_by_name(["عميل", "ذمم"], "asset")
        ap_code = _pick_code_by_name(["مورد", "دائن"], "liability")
        revenue_code = _pick_code_by_name(["إيراد", "ايراد"], "revenue")
        expense_code = _pick_code_by_name(["مصروف"], "expense")
        cost_code = _pick_code_by_name(["تكلفة"], "cost")

        def _map_legacy_code(code: str) -> str:
            raw = str(code or "").strip()
            if not raw:
                return raw
            mapped = legacy_to_current.get(raw)
            if mapped:
                return mapped
            if raw.startswith("1103") and ar_code:
                return ar_code
            if raw.startswith("2101") and ap_code:
                return ap_code
            if raw.startswith("400") or raw.startswith("410"):
                return revenue_code or raw
            if raw.startswith("500") or raw.startswith("510"):
                return cost_code or expense_code or raw
            if raw.startswith("600") or raw.startswith("610"):
                return expense_code or raw
            return raw

        provider = os.environ.get("DB_PROVIDER", "mongo").lower()
        if provider == "supabase":
            supa = SupabaseService()
            rows = (
                supa.client.table("journal_entries")
                .select("id,date,description,lines")
                .eq("workshop_id", workshop_id)
                .order("date", desc=True)
                .limit(20000)
                .execute()
                .data
                or []
            )
        else:
            rows = await db.journal_entries.find({"workshop_id": workshop_id}, {"_id": 0, "id": 1, "date": 1, "description": 1, "lines": 1}).sort("date", -1).to_list(length=20000)

        tx = []
        for row in rows:
            debit = 0.0
            credit = 0.0
            for line in row.get("lines", []) or []:
                code = _line_account_code(line, id_to_code)
                code = _map_legacy_code(code)
                if code == target_code:
                    debit += float(line.get("debit") or 0)
                    credit += float(line.get("credit") or 0)
            if debit == 0 and credit == 0:
                continue
            tx.append(
                {
                    "id": row.get("id"),
                    "date": row.get("date"),
                    "description": row.get("description") or "",
                    "debit": round(debit, 2),
                    "credit": round(credit, 2),
                }
            )

        tx = tx[: max(limit, 1)]
        running = float(target.get("balance") or 0)
        for item in tx:
            item["balance"] = round(running, 2)
            running -= item["debit"] - item["credit"]

        return {"success": True, "data": {"account": target, "transactions": tx}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/{account_id}/sparkline")
async def account_sparkline(
    account_id: str,
    workshop_id: str = Query("finmodule-sync"),
    days: int = Query(30, ge=7, le=120),
):
    """حركة الرصيد اليومية للحساب."""
    try:
        tx_res = await account_transactions(account_id=account_id, workshop_id=workshop_id, limit=2000)
        payload = tx_res.get("data", {})
        transactions = payload.get("transactions", [])
        start_date = datetime.now(timezone.utc) - timedelta(days=days - 1)

        daily_map: Dict[str, float] = {}
        for item in transactions:
            raw_date = str(item.get("date") or "")
            try:
                dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00")) if raw_date else datetime.now(timezone.utc)
            except Exception:
                dt = datetime.now(timezone.utc)
            key = dt.strftime("%Y-%m-%d")
            daily_map[key] = daily_map.get(key, 0.0) + float(item.get("debit") or 0) - float(item.get("credit") or 0)

        points = []
        balance = 0.0
        for i in range(days):
            day = start_date + timedelta(days=i)
            key = day.strftime("%Y-%m-%d")
            balance += daily_map.get(key, 0.0)
            points.append({"date": key, "balance": round(balance, 2)})

        return {"success": True, "data": {"days": days, "points": points}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/accounts/{account_id}/touch")
async def touch_account(account_id: str):
    """تحديث وقت آخر استخدام للحساب."""
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        await _set_account_usage(account_id, now_iso)
        try:
            provider = os.environ.get("DB_PROVIDER", "mongo").lower()
            if provider == "supabase":
                supa = SupabaseService()
                # best effort: may fail if column not available
                supa.client.table("accounts").update({"last_used_at": now_iso}).eq("id", account_id).execute()
            else:
                await db.accounts.update_one({"id": account_id}, {"$set": {"last_used_at": now_iso}})
        except Exception:
            pass
        return {"success": True, "account_id": account_id, "last_used_at": now_iso}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/export")
async def export_accounts(
    workshop_id: str = Query("finmodule-sync"),
    type: str = Query("all"),
    hideZero: bool = Query(False),
    search: str = Query(""),
):
    """تصدير الحسابات المرئية بعد التصفية (JSON للواجهة لاستخدام Excel)."""
    payload = await accounts_tree(
        workshop_id=workshop_id,
        type=type,
        hideZero=hideZero,
        search=search,
    )
    data = payload.get("data", {})
    mode = data.get("mode")
    rows = []

    if mode == "flat":
        rows = data.get("accounts", [])
    else:
        def flatten(nodes):
            for node in nodes:
                rows.append({k: v for k, v in node.items() if k != "children"})
                flatten(node.get("children", []))

        flatten(data.get("accounts", []))

    export_rows = [
        {
            "code": r.get("code"),
            "name": r.get("name"),
            "type": r.get("type"),
            "balance": r.get("balance"),
            "total_debit": r.get("total_debit"),
            "total_credit": r.get("total_credit"),
            "transaction_count": r.get("transaction_count"),
        }
        for r in rows
    ]

    return {"success": True, "data": {"summary": data.get("summary", {}), "rows": export_rows}}


@router.get("/accounts/reconciliation-report")
async def accounts_reconciliation_report(
    workshop_id: str = Query("finmodule-sync"),
):
    """تقرير تدقيق ربط المبالغ: مقارنة الرصيد مع (مدين-دائن) أو (دائن-مدين) حسب نوع الحساب."""
    try:
        payload = await accounts_tree(
            workshop_id=workshop_id,
            type="all",
            hideZero=False,
            search="",
        )
        data = payload.get("data", {})
        mode = data.get("mode")

        rows: List[Dict[str, Any]] = []
        if mode == "flat":
            rows = list(data.get("accounts", []) or [])
        else:
            def flatten(nodes: List[Dict[str, Any]]):
                for node in nodes or []:
                    rows.append({k: v for k, v in node.items() if k != "children"})
                    flatten(node.get("children", []) or [])

            flatten(data.get("accounts", []) or [])

        report_rows = []
        matched = 0
        mismatched = 0
        max_abs_diff = 0.0

        for row in rows:
            debit = float(row.get("total_debit") or 0)
            credit = float(row.get("total_credit") or 0)
            balance = float(row.get("balance") or 0)
            acc_type = str(row.get("type") or "").strip().lower()

            if acc_type in {"asset", "expense"}:
                expected_balance = debit - credit
            else:
                expected_balance = credit - debit

            difference = round(balance - expected_balance, 2)
            is_matched = abs(difference) <= 0.01
            if is_matched:
                matched += 1
            else:
                mismatched += 1
            max_abs_diff = max(max_abs_diff, abs(difference))

            report_rows.append(
                {
                    "account_id": row.get("id"),
                    "code": row.get("code"),
                    "name": row.get("name"),
                    "type": acc_type,
                    "balance": round(balance, 2),
                    "total_debit": round(debit, 2),
                    "total_credit": round(credit, 2),
                    "expected_balance": round(expected_balance, 2),
                    "difference": difference,
                    "matched": is_matched,
                }
            )

        report_rows.sort(key=lambda r: abs(float(r.get("difference") or 0)), reverse=True)

        return {
            "success": True,
            "data": {
                "summary": {
                    "accounts_count": len(report_rows),
                    "matched_count": matched,
                    "mismatched_count": mismatched,
                    "max_abs_difference": round(max_abs_diff, 2),
                },
                "rows": report_rows,
            },
        }
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
                    "id": "acc-1104",
                    "code": "1104",
                    "name": "نقاط بيع",
                    "name_en": "POS",
                    "type": "asset",
                    "parent_id": "acc-1102",
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
                "id": "acc-1104",
                "code": "1104",
                "name": "نقاط بيع",
                "nameEn": "POS",
                "type": "asset",
                "parentId": "acc-1102",
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
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
