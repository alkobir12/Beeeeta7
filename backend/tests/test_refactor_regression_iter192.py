"""
Iteration 192 — Regression test for major routes_extended.py refactor (Jan 2026).
Verifies 5 extracted modules expose endpoints on original URL paths:
  - routes_workshop_config.py  (Settings / Profile / Auth OTP)
  - routes_approvals.py        (Approvals + Notifications)
  - routes_accounts_extended.py (Chart of Accounts)
  - routes_templates_extended.py (Print / Invoice Templates)
  - routes_technicians.py      (Technicians CRUD — moved from server.py)
Plus pre-existing firewall sanity.
"""
import os
import requests
import pytest

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return (url or "").rstrip("/")

BASE_URL = _load_backend_url()
WORKSHOP_ID = "finmodule-sync"
HEADERS = {"Content-Type": "application/json"}


# ---------- Workshop Config (routes_workshop_config.py) ----------
class TestWorkshopConfig:
    def test_get_settings(self):
        r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)

    def test_post_settings_no_break(self):
        payload = {"language": "ar", "TEST_marker": "iter192"}
        r = requests.post(f"{BASE_URL}/api/settings", json=payload, headers=HEADERS, timeout=15)
        assert r.status_code in (200, 201), r.text

    def test_get_profile(self):
        r = requests.get(f"{BASE_URL}/api/profile", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)

    def test_put_profile(self):
        payload = {"name": "ورشة اختبار 192", "TEST_marker": "iter192"}
        r = requests.put(f"{BASE_URL}/api/profile", json=payload, headers=HEADERS, timeout=15)
        assert r.status_code in (200, 201), r.text

    def test_auth_request_otp(self):
        payload = {"phone": "0500000000"}
        r = requests.post(f"{BASE_URL}/api/auth/request-otp", json=payload, headers=HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # MUST include token + whatsappDeeplink per request
        assert "token" in data, f"missing token: {data}"
        # accept either key naming
        assert ("whatsappDeeplink" in data) or ("whatsapp_deeplink" in data) or ("whatsappUrl" in data), \
            f"missing whatsapp deeplink: {data}"


# ---------- Approvals (routes_approvals.py) ----------
class TestApprovals:
    def test_list_approvals(self):
        r = requests.get(f"{BASE_URL}/api/approvals", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_create_approval(self):
        payload = {
            "title": "TEST_iter192_approval",
            "type": "generic",
            "description": "regression test create",
            "workshop_id": WORKSHOP_ID,
        }
        r = requests.post(f"{BASE_URL}/api/approvals", json=payload, headers=HEADERS, timeout=15)
        # Accept 200/201 for create
        assert r.status_code in (200, 201), r.text

    def test_public_token_404_for_garbage(self):
        r = requests.get(f"{BASE_URL}/api/approvals/public/nonexistent-token-iter192", timeout=15)
        assert r.status_code == 404, f"expected 404 for garbage token got {r.status_code}: {r.text[:200]}"

    def test_notifications_prepare(self):
        payload = {"phone": "0500000000", "link": "https://example.com/approve/xyz"}
        r = requests.post(f"{BASE_URL}/api/notifications/prepare", json=payload, headers=HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert ("whatsappUrl" in data) or ("whatsapp_url" in data), f"missing whatsappUrl: {data}"


# ---------- Accounts / COA (routes_accounts_extended.py) ----------
class TestAccountsExtended:
    def test_accounts_list(self):
        r = requests.get(f"{BASE_URL}/api/accounts?workshop_id={WORKSHOP_ID}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_accounts_tree(self):
        r = requests.get(f"{BASE_URL}/api/accounts/tree?workshop_id={WORKSHOP_ID}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_account_transactions_with_seeded_id(self):
        # Fetch first account id then ask for its transactions
        r = requests.get(f"{BASE_URL}/api/accounts?workshop_id={WORKSHOP_ID}", timeout=20)
        if r.status_code != 200:
            pytest.skip("accounts list not available")
        accounts = r.json() if isinstance(r.json(), list) else r.json().get("accounts", [])
        if not accounts:
            pytest.skip("no accounts seeded")
        acc_id = accounts[0].get("id") or accounts[0].get("_id") or accounts[0].get("code")
        if not acc_id:
            pytest.skip("account record has no id field")
        r2 = requests.get(f"{BASE_URL}/api/accounts/{acc_id}/transactions?workshop_id={WORKSHOP_ID}", timeout=20)
        assert r2.status_code == 200, r2.text

    def test_init_defaults(self):
        r = requests.post(f"{BASE_URL}/api/accounts/init-defaults", json={"workshop_id": WORKSHOP_ID},
                          headers=HEADERS, timeout=30)
        assert r.status_code == 200, r.text


# ---------- Templates (routes_templates_extended.py) ----------
class TestTemplatesExtended:
    def test_invoice_templates_list(self):
        r = requests.get(f"{BASE_URL}/api/invoice-templates", timeout=15)
        assert r.status_code == 200, r.text

    def test_print_render_placeholders(self):
        payload = {
            "html": "<p>Hello {{name}} amount={{amount}}</p>",
            "data": {"name": "أحمد", "amount": "1500"},
        }
        r = requests.post(f"{BASE_URL}/api/print/render", json=payload, headers=HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        body = r.text
        assert "أحمد" in body, f"placeholder name not substituted: {body[:200]}"
        assert "1500" in body, f"placeholder amount not substituted: {body[:200]}"

    def test_templates_list(self):
        r = requests.get(f"{BASE_URL}/api/templates", timeout=15)
        assert r.status_code == 200, r.text


# ---------- Technicians (routes_technicians.py) ----------
class TestTechnicians:
    def test_list_technicians(self):
        r = requests.get(f"{BASE_URL}/api/technicians", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # The request says: should be 3 records currently — accept >=1 (may be 4 after our POST below)
        assert len(data) >= 1, "expected at least 1 technician seeded"

    def test_create_technician(self):
        payload = {"name": "فني تجريبي iter192", "phone": "0500000000", "specialty": "كهرباء"}
        r = requests.post(f"{BASE_URL}/api/technicians", json=payload, headers=HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created.get("name") == payload["name"], created


# ---------- Firewall sanity (routes_firewall.py — unchanged) ----------
class TestFirewallStillWorks:
    def test_firewall_status(self):
        r = requests.get(f"{BASE_URL}/api/firewall/status?workshop_id={WORKSHOP_ID}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        summary = data.get("summary", data)
        assert summary.get("total_entries") == 63, f"total_entries mismatch: {summary}"
        assert summary.get("balance_health_percent") == 100 or summary.get("balance_health_percent") == 100.0, \
            f"balance_health_percent mismatch: {summary}"

    def test_unbalanced_journal_rejected(self):
        payload = {
            "description": "TEST_iter192_unbalanced",
            "lines": [
                {"account_id": "1000", "debit": 100, "credit": 0},
                {"account_id": "2000", "debit": 0, "credit": 50},
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/finance/journal-entries?workshop_id={WORKSHOP_ID}",
            json=payload, headers=HEADERS, timeout=15,
        )
        assert r.status_code == 400, f"expected 400 for unbalanced, got {r.status_code}: {r.text[:200]}"
