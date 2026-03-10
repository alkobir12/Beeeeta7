import json
import os
import time

import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


class TestWorkshopBotArchiveSearch:
    created_vehicle_id = None

    def _ensure_vehicle_with_visit(self):
        assert BASE_URL, "REACT_APP_BACKEND_URL must be set for tests"

        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles", timeout=30)
        assert vehicles_response.status_code == 200, vehicles_response.text
        vehicles = vehicles_response.json() or []

        for vehicle in vehicles[:10]:
            vehicle_id = vehicle.get("id")
            if not vehicle_id:
                continue
            visits_response = requests.get(
                f"{BASE_URL}/api/vehicles/{vehicle_id}/visits", timeout=30
            )
            if visits_response.status_code != 200:
                continue
            visits = visits_response.json() or []
            if visits:
                return vehicle, visits[0]

        unique_suffix = str(int(time.time()))[-6:]
        vehicle_payload = {
            "plateNumber": f"ا ر ش {unique_suffix}",
            "brand": "تويوتا",
            "model": "هايلوكس",
            "year": 2022,
            "color": "أبيض",
            "customerName": f"عميل اختبار {unique_suffix}",
            "customerPhone": f"050{unique_suffix}",
            "customerEmail": "archive-search@example.com",
            "services": [],
            "notes": "سيارة اختبار للبحث الأرشيفي",
        }
        create_vehicle_response = requests.post(
            f"{BASE_URL}/api/vehicles", json=vehicle_payload, timeout=30
        )
        assert create_vehicle_response.status_code == 200, create_vehicle_response.text
        vehicle = create_vehicle_response.json()
        self.created_vehicle_id = vehicle.get("id")

        visit_payload = {
            "status": "completed",
            "entryDate": "2026-03-10T08:00:00Z",
            "exitDate": "2026-03-10T12:30:00Z",
            "mileage": 182000,
            "notes": json.dumps({
                "text": "فحص وإصلاح سريع",
                "items": [
                    {
                        "name": "تغيير زيت",
                        "quantity": 1,
                        "price": 180,
                        "itemType": "service",
                    },
                    {
                        "name": "فلتر هواء",
                        "quantity": 1,
                        "price": 95,
                        "itemType": "part",
                    },
                ],
                "payments": [{"kind": "advance", "amount": 275}],
            }, ensure_ascii=False),
        }
        create_visit_response = requests.post(
            f"{BASE_URL}/api/vehicles/{vehicle['id']}/visits",
            json=visit_payload,
            timeout=30,
        )
        assert create_visit_response.status_code == 200, create_visit_response.text
        visit = create_visit_response.json()
        return vehicle, visit

    def teardown_method(self):
        if self.created_vehicle_id:
            requests.delete(
                f"{BASE_URL}/api/vehicles/{self.created_vehicle_id}", timeout=30
            )
            self.created_vehicle_id = None

    def test_archive_search_by_plate_returns_latest_visit(self):
        vehicle, _visit = self._ensure_vehicle_with_visit()
        query = str(vehicle.get("plateNumber") or "").split(" ")[-1]
        response = requests.get(
            f"{BASE_URL}/api/vehicles/archive-search",
            params={"query": query, "limit": 5},
            timeout=30,
        )
        assert response.status_code == 200, response.text

        data = response.json()
        assert "results" in data
        assert data["resultsCount"] >= 1
        assert data["bestMatch"] is not None
        assert data["bestMatch"]["vehicle"]["plateNumber"]
        assert "responseText" in data["bestMatch"]
        assert "latestVisit" in data["bestMatch"]

    def test_archive_search_understands_natural_language_phrase(self):
        vehicle, _visit = self._ensure_vehicle_with_visit()
        plate = str(vehicle.get("plateNumber") or "")
        phrase = f"سياره {plate} ماهي تفاصيل آخر زياره"
        response = requests.get(
            f"{BASE_URL}/api/vehicles/archive-search",
            params={"query": phrase, "limit": 5},
            timeout=30,
        )
        assert response.status_code == 200, response.text

        data = response.json()
        assert data["bestMatch"] is not None
        assert data["bestMatch"]["vehicle"]["plateNumber"]
        assert data["bestMatch"]["responseText"]