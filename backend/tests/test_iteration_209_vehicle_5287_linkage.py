"""Iteration 209 - explicit linkage checks for vehicle 5287... and operation 99970dc5..."""

import os

import pytest
import requests
from dotenv import load_dotenv


# Module coverage: vehicle financial summary ↔ visits ↔ operations ↔ journal linkage
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")

TARGET_VEHICLE_ID = "5287aa8d-2969-48ed-bc5e-2ca0f97a03a3"
TARGET_OPERATION_PREFIX = "99970dc5"


@pytest.fixture(scope="module")
def api_base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is missing")
    return BASE_URL


def _first_target_operation(rows):
    for row in rows or []:
        op_id = str(row.get("id") or "")
        if op_id.startswith(TARGET_OPERATION_PREFIX):
            return row
    return None


class TestVehicle5287Linkage:
    def test_financial_summary_is_fully_paid(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/vehicles/{TARGET_VEHICLE_ID}/financial-summary",
            timeout=20,
        )
        assert response.status_code == 200
        data = response.json()

        assert round(float(data.get("total_workshop") or 0), 2) == 2300.00
        assert round(float(data.get("total_paid") or 0), 2) == 2300.00
        assert round(float(data.get("balance") or 0), 2) == 0.00

    def test_vehicle_visits_show_paid_full(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/vehicles/{TARGET_VEHICLE_ID}/visits",
            timeout=20,
        )
        assert response.status_code == 200
        rows = response.json()
        assert isinstance(rows, list)

        paid_full_visits = [
            row
            for row in rows
            if str(row.get("payment_status") or "").lower() == "paid_full"
            and round(float(row.get("total_paid") or 0), 2) == 2300.00
            and round(float(row.get("balance") or 0), 2) == 0.00
        ]
        assert paid_full_visits, "No paid_full visit found with total_paid=2300 and balance=0"

    def test_operations_vehicle_filter_has_target_values(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/operations",
            params={"vehicle_id": TARGET_VEHICLE_ID, "limit": 200},
            timeout=20,
        )
        assert response.status_code == 200
        rows = response.json()
        assert isinstance(rows, list)

        target = _first_target_operation(rows)
        assert target is not None, "Target operation 99970dc5... not found for vehicle"

        assert str(target.get("paymentStatus") or "").lower() == "paid_full"
        assert str(target.get("paymentMethod") or "").lower() in {"cash", "pos", "card"}
        assert round(float(target.get("totalPaid") or 0), 2) == 2300.00
        assert round(float(target.get("balance") or 0), 2) == 0.00

    def test_journal_entries_are_linked_and_use_new_codes(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/finance/journal-entries",
            params={"workshop_id": WORKSHOP_ID, "limit": 500},
            timeout=25,
        )
        assert response.status_code == 200
        payload = response.json()
        rows = payload.get("data") or []

        linked_entries = [
            row for row in rows if str(row.get("reference_id") or "").startswith(TARGET_OPERATION_PREFIX)
        ]
        assert linked_entries, "No linked journal entry found for reference_id=99970dc5..."

        assert any("1060" in str(row.get("party_label") or "") for row in linked_entries)
        assert any("7782" in str(row.get("vehicle_label") or "") for row in linked_entries)

        old_codes = {"1101", "1102", "1103", "1104"}
        all_codes = []
        for entry in linked_entries:
            for line in entry.get("lines") or []:
                code = str(line.get("account") or line.get("code") or "").strip()
                if code:
                    all_codes.append(code)
                    assert code not in old_codes

        assert "003" in all_codes, "Expected new cash code 003 in linked entries"
        assert any(code in {"027", "026"} for code in all_codes), "Expected new revenue code (027/026)"

    def test_no_collect_customer_duplicate_payment_orders_for_vehicle(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/operations",
            params={"vehicle_id": TARGET_VEHICLE_ID, "limit": 300},
            timeout=20,
        )
        assert response.status_code == 200
        rows = response.json()
        assert isinstance(rows, list)

        candidate_types = {"payment_order", "collect_customer", "receipt_voucher", "settlement"}
        candidate_rows = [
            row
            for row in rows
            if str(row.get("type") or "").strip().lower() in candidate_types
            or any(token in str(row.get("source") or "").lower() for token in ["collect_customer", "receipt_voucher", "settlement"])
        ]

        signatures = {}
        duplicates = []
        for row in candidate_rows:
            signature = (
                str(row.get("vehicleId") or "").strip(),
                str(row.get("partnerId") or row.get("partnerName") or "").strip().lower(),
                str(row.get("date") or "")[:10],
                round(float(row.get("total") or 0), 2),
            )
            if signature in signatures:
                duplicates.append((signatures[signature], row.get("id")))
            else:
                signatures[signature] = row.get("id")

        assert not duplicates, f"Potential duplicate collect/payment_order operations found: {duplicates[:3]}"
