"""Iteration 212 regression tests for users API username/permissions and dashboard access signals."""

import os
import uuid

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def created_user_ids():
    ids = []
    yield ids


@pytest.fixture(autouse=True)
def cleanup_created_users(api_client, created_user_ids):
    yield
    if not BASE_URL:
        return
    for user_id in created_user_ids:
        api_client.delete(f"{BASE_URL.rstrip('/')}/api/users/{user_id}")


def _base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is required")
    return BASE_URL.rstrip("/")


def _list_users(api_client):
    response = api_client.get(f"{_base_url()}/api/users")
    assert response.status_code == 200, f"GET /api/users failed: {response.status_code} {response.text}"
    data = response.json()
    assert isinstance(data, list)
    return data


def _find_user(users, login_key):
    needle = str(login_key or "").strip().lower()
    return next(
        (
            row
            for row in users
            if str(row.get("username") or "").strip().lower() == needle
            or str(row.get("name") or "").strip().lower() == needle
        ),
        None,
    )


@pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL is required")
class TestUsersApiRegressionIter212:
    # users API: verify username + normalized modules + no-password + update permissions preservation

    def test_get_users_returns_no_password_and_includes_username(self, api_client):
        users = _list_users(api_client)
        assert len(users) > 0
        for user in users:
            assert "password" not in user
            assert "username" in user

    def test_faraj1_has_dashboard_view_and_normalized_permission_modules(self, api_client):
        users = _list_users(api_client)
        faraj = _find_user(users, "فرج1")
        assert faraj is not None, "User فرج1 not found in /api/users"

        permissions = faraj.get("permissions") or {}
        assert permissions.get("dashboard", {}).get("view") is True
        assert "operations" in permissions
        assert "journal_entries" in permissions
        assert "archive" in permissions

    def test_update_non_permission_fields_preserves_permissions(self, api_client, created_user_ids):
        suffix = uuid.uuid4().hex[:8]
        phone = f"0597{uuid.uuid4().int % 1000000:06d}"
        payload = {
            "name": f"TEST_User_{suffix}",
            "username": f"test_user_{suffix}",
            "password": "123456",
            "phone": phone,
            "role": "employee",
            "permissions": {
                "dashboard": {"view": True},
                "vehicles": {"view": True, "create": False, "edit": False, "delete": False},
                "operations": {"view": False, "settle": False, "edit": False, "delete": False},
                "journal_entries": {"view": True, "create": False, "edit": False, "delete": False, "pos": False},
                "archive": {"view": True, "create": False, "edit": False, "delete": False},
            },
        }

        create_res = api_client.post(f"{_base_url()}/api/users", json=payload)
        assert create_res.status_code == 200, f"Create user failed: {create_res.status_code} {create_res.text}"
        created = create_res.json()
        created_user_ids.append(created["id"])
        original_permissions = created.get("permissions")

        update_res = api_client.put(
            f"{_base_url()}/api/users/{created['id']}",
            json={"name": f"TEST_User_updated_{suffix}"},
        )
        assert update_res.status_code == 200, f"Update user failed: {update_res.status_code} {update_res.text}"
        updated = update_res.json()
        assert updated["permissions"] == original_permissions

        users = _list_users(api_client)
        fetched = next((u for u in users if u.get("id") == created["id"]), None)
        assert fetched is not None
        assert fetched["permissions"] == original_permissions
        assert fetched["name"] == f"TEST_User_updated_{suffix}"

    def test_username_fallback_is_normalized_when_not_provided(self, api_client, created_user_ids):
        suffix = uuid.uuid4().hex[:6]
        fallback_name = f"TEST_NoUsername_{suffix}"
        payload = {
            "name": fallback_name,
            "phone": f"0598{uuid.uuid4().int % 1000000:06d}",
            "password": "123456",
            "role": "viewer",
        }
        create_res = api_client.post(f"{_base_url()}/api/users", json=payload)
        assert create_res.status_code == 200, f"Create user failed: {create_res.status_code} {create_res.text}"
        created = create_res.json()
        created_user_ids.append(created["id"])

        assert created.get("username")
        assert created["username"] in {fallback_name, payload["phone"]}

        users = _list_users(api_client)
        fetched = next((u for u in users if u.get("id") == created["id"]), None)
        assert fetched is not None
        assert fetched.get("username")
