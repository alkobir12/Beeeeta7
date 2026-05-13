"""Iteration 208 - targeted API assertions for vehicle 1060 visit-derived operation display."""

import os

import pytest
import requests
from dotenv import load_dotenv


# Module coverage: operations list payload sanitization for specific user-reported operation
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def api_base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is missing")
    return BASE_URL


def _contains_target_item(row: dict) -> bool:
    items = row.get("items") or []
    for item in items:
        name = str((item or {}).get("name") or (item or {}).get("description") or "")
        if "توضيب" in name and "مكينة" in name:
            return True
    return False


def _contains_vehicle_1060_context(row: dict) -> bool:
    searchable = " ".join(
        [
            str(row.get("vehiclePlate") or ""),
            str(row.get("vehicleBrand") or ""),
            str(row.get("vehicleModel") or ""),
            str(row.get("notes") or ""),
            str(row.get("partnerName") or ""),
        ]
    )
    return "1060" in searchable and "ايسوزو" in searchable and "ونيت" in searchable


class TestSpecificOperationDisplay:
    def test_target_operation_payment_and_notes_are_corrected(self, api_base_url):
        response = requests.get(f"{api_base_url}/api/operations", params={"limit": 200}, timeout=20)
        assert response.status_code == 200
        rows = response.json()
        assert isinstance(rows, list)

        candidates = [
            row
            for row in rows
            if _contains_target_item(row) and _contains_vehicle_1060_context(row)
        ]
        if not candidates:
            pytest.skip("Target operation (1060/ايسوزو ونيت/توضيب مكينة) not found in current dataset")

        row = candidates[0]
        assert row.get("paymentStatus") == "paid_full"
        assert round(float(row.get("totalPaid") or 0), 2) == 2300.00
        assert round(float(row.get("balance") or 0), 2) == 0.00

        notes = str(row.get("notes") or "")
        assert "عملية من الزيارة 001" in notes
        assert "99970dc5" not in notes

        visible_text = " ".join(
            [
                str(row.get("type") or ""),
                str(row.get("paymentStatus") or ""),
                str(row.get("notes") or ""),
                str(row.get("source") or ""),
            ]
        )
        forbidden = ["حساب حساب", "التصنيف: غير مصنف", "ذو القعدة", "99970dc5", "account_id", "payment_status"]
        for token in forbidden:
            assert token not in visible_text

    def test_vehicle_file_financial_summary_and_journals_are_linked(self, api_base_url):
        ops_response = requests.get(f"{api_base_url}/api/operations", params={"limit": 200}, timeout=20)
        assert ops_response.status_code == 200
        candidates = [
            row
            for row in ops_response.json()
            if _contains_target_item(row) and _contains_vehicle_1060_context(row)
        ]
        if not candidates:
            pytest.skip("Target operation not found in current dataset")
        row = candidates[0]
        vehicle_id = row.get("vehicleId")
        operation_id = row.get("id")
        assert vehicle_id and operation_id

        summary_response = requests.get(f"{api_base_url}/api/vehicles/{vehicle_id}/financial-summary", timeout=20)
        assert summary_response.status_code == 200
        summary = summary_response.json()
        assert round(float(summary.get("total_workshop") or 0), 2) == 2300.00
        assert round(float(summary.get("total_paid") or 0), 2) == 2300.00
        assert round(float(summary.get("balance") or 0), 2) == 0.00

        visits_response = requests.get(f"{api_base_url}/api/vehicles/{vehicle_id}/visits", timeout=20)
        assert visits_response.status_code == 200
        visits = visits_response.json()
        target_visit = next((visit for visit in visits if visit.get("id") == row.get("visitId")), None)
        assert target_visit is not None
        assert target_visit.get("payment_status") == "paid_full"
        assert round(float(target_visit.get("total_paid") or 0), 2) == 2300.00

        journals_response = requests.get(
            f"{api_base_url}/api/finance/journal-entries",
            params={"workshop_id": "finmodule-sync", "limit": 300},
            timeout=25,
        )
        assert journals_response.status_code == 200
        linked_entries = [
            entry for entry in journals_response.json().get("data", [])
            if entry.get("reference_id") == operation_id
        ]
        assert linked_entries, "No journal entries linked to the operation reference_id"
        assert any("1060" in str(entry.get("party_label") or "") for entry in linked_entries)
        assert any("7782" in str(entry.get("vehicle_label") or "") for entry in linked_entries)
        for entry in linked_entries:
            for line in entry.get("lines") or []:
                assert str(line.get("account") or line.get("code") or "") not in {"1101", "1102", "1103", "1104"}
