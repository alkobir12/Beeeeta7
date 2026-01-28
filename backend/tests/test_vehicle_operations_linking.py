"""Test vehicleId -> operations linking and filtering.

Validates:
- creating operation with vehicleId stores vehicle_id
- GET /api/operations?vehicle_id=... returns the created operation

Provider: uses local backend (0.0.0.0:8001) and existing vehicles.
"""

import requests

BASE = "http://0.0.0.0:8001"
WORKSHOP_ID = "finmodule-sync"


def test_vehicle_operation_filtering():
    vehicles = requests.get(f"{BASE}/api/vehicles", timeout=30).json()
    assert isinstance(vehicles, list)
    assert len(vehicles) > 0
    vehicle_id = vehicles[0]["id"]

    op = requests.post(
        f"{BASE}/api/operations",
        json={
            "workshopId": WORKSHOP_ID,
            "vehicleId": vehicle_id,
            "type": "sale",
            "partnerType": "customer",
            "partnerName": "اختبار ربط سيارة",
            "items": [{"itemType": "service", "name": "x", "quantity": 1, "price": 10}],
            "paymentMethod": "cash",
            "date": "2024-06-01",
        },
        timeout=30,
    ).json()

    assert op.get("id")
    assert op.get("vehicleId") == vehicle_id

    ops = requests.get(
        f"{BASE}/api/operations", params={"vehicle_id": vehicle_id}, timeout=30
    ).json()
    assert isinstance(ops, list)
    assert any(o.get("id") == op["id"] for o in ops)

    # cleanup
    requests.delete(f"{BASE}/api/operations/{op['id']}", timeout=30)


if __name__ == "__main__":
    import pytest

    pytest.main([__file__, "-v", "--tb=short"])
