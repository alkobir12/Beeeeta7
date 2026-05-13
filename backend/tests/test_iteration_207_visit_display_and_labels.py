"""Iteration 207 - Visit display formatting and movement label sanitation."""

import os
import re

import pytest
import requests
from dotenv import load_dotenv


# Module coverage: operations + vehicle visits + supplier/customer movement visit display
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
VISIT_3_DIGIT_RE = re.compile(r"^\d{3}$")


@pytest.fixture(scope="module")
def api_base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is missing")
    return BASE_URL


def _extract_visit_display(row: dict) -> str:
    return str(
        row.get("visitNumberDisplay")
        or row.get("visit_number_display")
        or row.get("visitNumber")
        or row.get("visit_number")
        or ""
    ).strip()


class TestVisitNumberFormatting:
    def test_operations_visit_number_display_is_3_digits(self, api_base_url):
        response = requests.get(f"{api_base_url}/api/operations", params={"limit": 200}, timeout=20)
        assert response.status_code == 200
        rows = response.json()
        assert isinstance(rows, list)

        linked = [r for r in rows if str(r.get("visitId") or r.get("visit_id") or "").strip()]
        if not linked:
            pytest.skip("No operations linked to visits in current dataset")

        with_display = [r for r in linked if _extract_visit_display(r)]
        assert with_display, "Visit-linked operations should expose visitNumber/visitNumberDisplay"

        bad = []
        for row in with_display:
            disp = _extract_visit_display(row)
            if not VISIT_3_DIGIT_RE.match(disp):
                bad.append({"id": row.get("id"), "visit": disp})

        assert not bad, f"Found non 3-digit visit displays in operations: {bad[:5]}"

    def test_vehicle_visits_endpoint_returns_3_digit_visit_display(self, api_base_url):
        vehicles_resp = requests.get(f"{api_base_url}/api/vehicles", timeout=20)
        assert vehicles_resp.status_code == 200
        vehicles = vehicles_resp.json()
        assert isinstance(vehicles, list)
        if not vehicles:
            pytest.skip("No vehicles in dataset")

        tested = False
        for vehicle in vehicles[:12]:
            vid = vehicle.get("id")
            if not vid:
                continue
            visits_resp = requests.get(f"{api_base_url}/api/vehicles/{vid}/visits", timeout=20)
            if visits_resp.status_code != 200:
                continue
            payload = visits_resp.json()
            visits = payload.get("visits", payload) if isinstance(payload, dict) else payload
            if not isinstance(visits, list) or not visits:
                continue

            tested = True
            bad = []
            for visit in visits:
                disp = _extract_visit_display(visit)
                if disp and not VISIT_3_DIGIT_RE.match(disp):
                    bad.append({"visitId": visit.get("id"), "visit": disp})
            assert not bad, f"Vehicle {vid} has non 3-digit visit displays: {bad[:5]}"
            break

        assert tested, "Could not find a vehicle with visits to validate formatting"


class TestMovementVisitLabelSanitation:
    def test_supplier_movements_do_not_expose_raw_visit_uuid(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/suppliers",
            params={"workshop_id": WORKSHOP_ID},
            timeout=20,
        )
        assert response.status_code == 200
        suppliers = response.json()
        assert isinstance(suppliers, list)

        checked_any = False
        violations = []
        for supplier in suppliers:
            movements = supplier.get("movements") or []
            if not isinstance(movements, list):
                continue
            for mv in movements:
                checked_any = True
                display = _extract_visit_display(mv)
                if display and UUID_RE.match(display):
                    violations.append({"supplier": supplier.get("name"), "visit": display, "movement": mv.get("id")})

        if not checked_any:
            pytest.skip("No supplier movements available")

        assert not violations, f"Supplier movements exposing raw UUID visit labels: {violations[:5]}"

    def test_customer_movements_do_not_expose_raw_visit_uuid(self, api_base_url):
        response = requests.get(
            f"{api_base_url}/api/customers",
            params={"workshop_id": WORKSHOP_ID},
            timeout=20,
        )
        assert response.status_code == 200
        customers = response.json()
        assert isinstance(customers, list)

        checked_any = False
        violations = []
        for customer in customers:
            movements = customer.get("movements") or []
            if not isinstance(movements, list):
                continue
            for mv in movements:
                checked_any = True
                display = _extract_visit_display(mv)
                if display and UUID_RE.match(display):
                    violations.append({"customer": customer.get("name"), "visit": display, "movement": mv.get("id")})

        if not checked_any:
            pytest.skip("No customer movements available")

        assert not violations, f"Customer movements exposing raw UUID visit labels: {violations[:5]}"
