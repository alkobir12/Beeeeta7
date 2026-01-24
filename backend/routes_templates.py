"""
مسارات إدارة النماذج المخصصة
Custom Templates Management Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional
from datetime import datetime
import os
import uuid
import shutil
from pathlib import Path

router = APIRouter(prefix="/api/templates")

# مجلد حفظ النماذج
TEMPLATES_DIR = Path(__file__).parent / "custom_templates"
TEMPLATES_DIR.mkdir(exist_ok=True)

# قاعدة بيانات بسيطة للنماذج (ستُستبدل بـ MongoDB)
templates_db = []


@router.get("")
async def get_templates():
    """الحصول على جميع النماذج المخصصة"""
    return {"templates": templates_db}


@router.post("/upload")
async def upload_template(
    file: UploadFile = File(...),
    name: Optional[str] = None,
    description: Optional[str] = None,
    type: Optional[str] = "invoice",  # invoice, diagnosis, quote, receipt
):
    """رفع نموذج جديد (HTML أو PDF)"""

    # التحقق من نوع الملف
    allowed_extensions = [".html", ".htm", ".pdf"]
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"نوع الملف غير مدعوم. الأنواع المسموحة: {', '.join(allowed_extensions)}",
        )

    # إنشاء معرف فريد
    template_id = str(uuid.uuid4())
    filename = f"{template_id}{file_ext}"
    file_path = TEMPLATES_DIR / filename

    # حفظ الملف
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"فشل في حفظ الملف: {str(e)}")

    # إضافة إلى قاعدة البيانات
    template = {
        "id": template_id,
        "name": name or file.filename,
        "description": description or "",
        "type": type,
        "file_type": file_ext[1:],  # html أو pdf
        "filename": filename,
        "original_filename": file.filename,
        "file_size": os.path.getsize(file_path),
        "created_at": datetime.now().isoformat(),
        "active": True,
    }

    templates_db.append(template)

    return {"success": True, "message": "تم رفع النموذج بنجاح", "template": template}


@router.get("/{template_id}")
async def get_template(template_id: str):
    """الحصول على نموذج معين"""
    template = next((t for t in templates_db if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="النموذج غير موجود")
    return template


@router.get("/{template_id}/download")
async def download_template(template_id: str):
    """تحميل ملف النموذج"""
    template = next((t for t in templates_db if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="النموذج غير موجود")

    file_path = TEMPLATES_DIR / template["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="ملف النموذج غير موجود")

    return FileResponse(
        path=file_path,
        filename=template["original_filename"],
        media_type="application/octet-stream",
    )


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """حذف نموذج"""
    global templates_db

    template = next((t for t in templates_db if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="النموذج غير موجود")

    # حذف الملف
    file_path = TEMPLATES_DIR / template["filename"]
    if file_path.exists():
        file_path.unlink()

    # حذف من قاعدة البيانات
    templates_db = [t for t in templates_db if t["id"] != template_id]

    return {"success": True, "message": "تم حذف النموذج"}


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    active: Optional[bool] = None,
):
    """تحديث معلومات نموذج"""
    template = next((t for t in templates_db if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="النموذج غير موجود")

    if name is not None:
        template["name"] = name
    if description is not None:
        template["description"] = description
    if active is not None:
        template["active"] = active

    template["updated_at"] = datetime.now().isoformat()

    return {"success": True, "template": template}


@router.post("/{template_id}/use")
async def use_template(template_id: str):
    """استخدام نموذج لتوليد مستند"""
    template = next((t for t in templates_db if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="النموذج غير موجود")

    file_path = TEMPLATES_DIR / template["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="ملف النموذج غير موجود")

    # قراءة محتوى النموذج
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {
        "success": True,
        "template_id": template_id,
        "content": content,
        "type": template["file_type"],
    }
