"""Permissions normalization regression tests for users module and route access modules."""

import os
import uuid

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


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
    for user_id in created_user_ids:
        api_client.delete(f"{BASE_URL}/api/users/{user_id}")


def _create_user(api_client, created_user_ids, permissions):
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST_PERM_{suffix}",
        "phone": f"0599{uuid.uuid4().int % 1000000:06d}",
        "role": "employee",
        "permissions": permissions,
    }
    response = api_client.post(f"{BASE_URL}/api/users", json=payload)
    assert response.status_code == 200, f"Create user failed: {response.status_code} {response.text}"
    data = response.json()
    created_user_ids.append(data["id"])
    return data


def _get_user(api_client, user_id):
    response = api_client.get(f"{BASE_URL}/api/users")
    assert response.status_code == 200, f"List users failed: {response.status_code} {response.text}"
    users = response.json()
    assert isinstance(users, list)
    user = next((row for row in users if row.get("id") == user_id), None)
    assert user is not None, f"Created user {user_id} not found in users list"
    return user


@pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL is required")
class TestUsersPermissionNormalization:
    # users permissions: verify normalization for operations/journal_entries/archive from legacy module-style permissions

    def test_permissions_normalize_from_work_orders_reports_vehicles(self, api_client, created_user_ids):
        created = _create_user(
            api_client,
            created_user_ids,
            permissions={
                "work_orders": {"view": True, "create": False, "edit": True, "delete": False},
                "reports": {"view": True, "create": False, "edit": False, "delete": False},
                "vehicles": {"view": True, "create": True, "edit": False, "delete": True},
                "debts": {"view": True, "settle": True},
            },
        )

        fetched = _get_user(api_client, created["id"])
        perms = fetched.get("permissions", {})

        assert perms["operations"] == {"view": True, "settle": True, "edit": True, "delete": False}
        assert perms["journal_entries"] == {"view": True, "create": False, "edit": False, "delete": False, "pos": True}
        assert perms["archive"] == {"view": True, "create": True, "edit": False, "delete": True}

    def test_existing_new_modules_are_preserved_without_override(self, api_client, created_user_ids):
        created = _create_user(
            api_client,
            created_user_ids,
            permissions={
                "operations": {"view": False, "settle": False, "edit": False, "delete": False},
                "journal_entries": {"view": True, "create": True, "edit": False, "delete": False, "pos": False},
                "archive": {"view": False, "create": False, "edit": False, "delete": False},
                "work_orders": {"view": True, "create": True, "edit": True, "delete": True},
                "reports": {"view": True, "create": True, "edit": True, "delete": True},
                "vehicles": {"view": True, "create": True, "edit": True, "delete": True},
            },
        )

        fetched = _get_user(api_client, created["id"])
        perms = fetched.get("permissions", {})

        assert perms["operations"] == {"view": False, "settle": False, "edit": False, "delete": False}
        assert perms["journal_entries"] == {"view": True, "create": True, "edit": False, "delete": False, "pos": False}
        assert perms["archive"] == {"view": False, "create": False, "edit": False, "delete": False}
