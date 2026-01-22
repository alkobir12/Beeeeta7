from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....core.database import SessionLocal
from ....services.accounting.accounting_service import AccountingService
from ....schemas.accounting.journal_entries import (
    JournalEntryCreate,
    JournalEntryPostRequest,
    JournalEntryResponse,
)
from ....models.accounting.journal_entries import JournalEntry


router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/journal-entries", response_model=JournalEntryResponse)
def create_journal_entry(
    payload: JournalEntryCreate,
    workshop_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """إنشاء قيد يومي جديد في حالة مسودة (draft)."""
    service = AccountingService(db)
    try:
        je = service.create_journal_entry(payload, workshop_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return je


@router.post("/journal-entries/{entry_id}/post", response_model=JournalEntryResponse)
def post_journal_entry(
    entry_id: uuid.UUID,
    payload: JournalEntryPostRequest,
    db: Session = Depends(get_db),
):
    """ترحيل قيد يومي (تحويله إلى منشور وتحديث أرصدة الحسابات)."""
    service = AccountingService(db)
    try:
        je = service.post_journal_entry(entry_id, payload.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return je


@router.get("/journal-entries", response_model=List[JournalEntryResponse])
def list_journal_entries(
    workshop_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """عرض قائمة القيود اليومية لورشة معينة."""
    items = (
        db.query(JournalEntry)
        .filter(JournalEntry.workshop_id == workshop_id)
        .order_by(JournalEntry.created_at.desc())
        .all()
    )
    return items
