"""Iteration 211 - Smart POS recent entries + journal enrichment regression checks."""

import os
import re

import pytest
import requests
from dotenv import load_dotenv


# Module coverage: /api/finance/journal-entries fields used by JournalEntries -> SmartPOSJournal recent cards
load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID")


@pytest.fixture(scope="module")
def journal_entries():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is missing")
    if not WORKSHOP_ID:
        pytest.skip("REACT_APP_WORKSHOP_ID is missing")

    response = requests.get(
        f"{BASE_URL}/api/finance/journal-entries",
        params={"workshop_id": WORKSHOP_ID, "limit": 300},
        timeout=30,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("success") is True
    rows = payload.get("data") or []
    assert isinstance(rows, list)
    return rows


def _target_entry(rows):
    for row in rows:
        row_id = str(row.get("id") or "")
        ref = str(row.get("reference_id") or "")
        desc = str(row.get("description") or "")
        if (
            row_id.startswith("d8c7cdba")
            or ref.startswith("d8c7cdba")
            or "99970dc5" in desc
            or "[VISIT:" in desc
        ):
            return row
    return None


def test_target_visit_receipt_entry_has_amount_source_party_vehicle(journal_entries):
    entry = _target_entry(journal_entries)
    assert entry, "Target visit receipt entry (d8c7cdba / VISIT token) was not found"

    assert float(entry.get("total") or 0) > 0
    assert entry.get("source") == "visit_receipt_voucher"
    assert str(entry.get("party_label") or "").strip() != ""
    assert str(entry.get("vehicle_label") or "").strip() != ""


def test_target_visit_receipt_entry_expected_values(journal_entries):
    entry = _target_entry(journal_entries)
    assert entry, "Target visit receipt entry was not found"

    # Reported user case: amount and labels for vehicle 1060 / plate 7782
    assert round(float(entry.get("total") or 0), 2) == 500.00
    assert "1060" in str(entry.get("party_label") or "")
    assert "7782" in str(entry.get("vehicle_label") or "")


def test_target_description_contains_visit_token_for_frontend_stripping(journal_entries):
    entry = _target_entry(journal_entries)
    assert entry, "Target visit receipt entry was not found"

    description = str(entry.get("description") or "")
    assert "[VISIT:" in description
    assert "99970dc5" in description


def test_lines_metadata_present_for_recent_card_line_summary(journal_entries):
    entry = _target_entry(journal_entries)
    assert entry, "Target visit receipt entry was not found"

    lines = entry.get("lines") or []
    assert isinstance(lines, list)
    assert len(lines) >= 2

    for line in lines:
        assert str(line.get("account") or line.get("code") or "").strip() != ""
        assert str(line.get("account_name") or line.get("name") or "").strip() != ""
        assert isinstance(float(line.get("debit") or 0), float)
        assert isinstance(float(line.get("credit") or 0), float)


def test_target_line_summary_accounts_include_cash_and_receivables(journal_entries):
    entry = _target_entry(journal_entries)
    assert entry, "Target visit receipt entry was not found"

    lines = entry.get("lines") or []
    accounts = {str(line.get("account") or line.get("code") or "").strip() for line in lines}
    assert "003" in accounts
    assert "005" in accounts


def test_vehicle_label_can_be_filled_from_vehicle_ref_token_when_direct_link_missing(journal_entries):
    candidates = []
    token_re = re.compile(r"\[VEHICLE_REF:([^\]]+)\]", re.IGNORECASE)
    for row in journal_entries:
        description = str(row.get("description") or "")
        match = token_re.search(description)
        if not match:
            continue
        token_vehicle = match.group(1).strip()
        vehicle_label = str(row.get("vehicle_label") or "").strip()
        if token_vehicle:
            candidates.append((token_vehicle, vehicle_label, row))

    assert candidates, "No journal entries with [VEHICLE_REF:...] token found"
    assert any(token_vehicle == vehicle_label for token_vehicle, vehicle_label, _ in candidates), (
        "Expected at least one row where vehicle_label is populated from [VEHICLE_REF] token"
    )


def test_core_fields_for_journalentries_to_smartpos_transform_exist(journal_entries):
    sample = journal_entries[0] if journal_entries else None
    assert sample, "No journal entries returned"

    required = ["id", "date", "description", "total", "source", "party_label", "vehicle_label", "lines"]
    for field in required:
        assert field in sample, f"Missing required field for frontend transform: {field}"
