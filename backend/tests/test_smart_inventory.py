"""
Test Smart Inventory API endpoints:
- GET /api/inventory/dashboard
- GET /api/inventory/alerts
- GET /api/inventory/control-panel
- POST /api/inventory/backorders
- PATCH /api/inventory/backorders/{id}/status
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL environment variable is not set")


class TestSmartInventoryDashboard:
    """Test inventory dashboard endpoint"""

    def test_get_inventory_dashboard(self):
        """GET /api/inventory/dashboard should return summary, alerts_preview, and top_movers"""
        response = requests.get(f"{BASE_URL}/api/inventory/dashboard", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        # Validate summary structure
        assert "summary" in data, "Dashboard should contain 'summary'"
        summary = data["summary"]
        assert "total_parts" in summary
        assert "low_stock_count" in summary
        assert "out_of_stock_count" in summary
        assert "inventory_cost_value" in summary
        assert "inventory_retail_value" in summary
        assert "critical_alerts_count" in summary
        assert "pending_backorders_count" in summary
        assert "updated_at" in summary
        
        # Validate alerts_preview
        assert "alerts_preview" in data, "Dashboard should contain 'alerts_preview'"
        assert isinstance(data["alerts_preview"], list)
        
        # Validate top_movers
        assert "top_movers" in data, "Dashboard should contain 'top_movers'"
        assert isinstance(data["top_movers"], list)
        
        print(f"✅ Dashboard returned: total_parts={summary['total_parts']}, low_stock={summary['low_stock_count']}, critical_alerts={summary['critical_alerts_count']}")


class TestSmartInventoryAlerts:
    """Test inventory alerts endpoint"""

    def test_get_inventory_alerts_default(self):
        """GET /api/inventory/alerts should return a list of alerts"""
        response = requests.get(f"{BASE_URL}/api/inventory/alerts", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert isinstance(data, list), "Alerts should be a list"
        print(f"✅ Alerts endpoint returned {len(data)} alerts")

    def test_get_inventory_alerts_with_limit(self):
        """GET /api/inventory/alerts?limit=20 should respect limit param"""
        response = requests.get(f"{BASE_URL}/api/inventory/alerts", params={"limit": 20}, timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 20, f"Expected max 20 alerts, got {len(data)}"
        
        # Validate alert structure if any exist
        if data:
            alert = data[0]
            assert "id" in alert, "Alert should have 'id'"
            assert "severity" in alert, "Alert should have 'severity'"
            assert "alert_type" in alert, "Alert should have 'alert_type'"
            assert "title" in alert, "Alert should have 'title'"
            assert "message" in alert, "Alert should have 'message'"
            print(f"✅ First alert: severity={alert['severity']}, type={alert['alert_type']}")
        else:
            print("✅ No alerts returned (valid empty response)")


class TestSmartInventoryControlPanel:
    """Test inventory control panel endpoint"""

    def test_get_control_panel_default(self):
        """GET /api/inventory/control-panel should return analytics data"""
        response = requests.get(f"{BASE_URL}/api/inventory/control-panel", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        
        # Validate overview
        assert "overview" in data, "Control panel should have 'overview'"
        overview = data["overview"]
        assert "period_days" in overview
        assert "total_parts" in overview
        assert "sales_total" in overview
        assert "purchases_total" in overview
        assert "gross_profit_estimate" in overview
        
        # Validate category_performance
        assert "category_performance" in data
        assert isinstance(data["category_performance"], list)
        
        # Validate backorder_summary
        assert "backorder_summary" in data
        
        print(f"✅ Control panel overview: sales={overview['sales_total']}, purchases={overview['purchases_total']}")

    def test_get_control_panel_with_days(self):
        """GET /api/inventory/control-panel?days=90 should respect days param"""
        response = requests.get(f"{BASE_URL}/api/inventory/control-panel", params={"days": 90}, timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data["overview"]["period_days"] == 90, f"Expected period_days=90, got {data['overview']['period_days']}"
        print(f"✅ Control panel for 90 days: total_parts={data['overview']['total_parts']}")


class TestSmartInventoryArchitecture:
    """Test replenishment architecture endpoint"""

    def test_get_inventory_architecture(self):
        """GET /api/inventory/architecture should return blueprint and planning tables"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/architecture", params={"days": 90}, timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "blueprint" in data, "Architecture should include blueprint"
        assert "replenishment_plan" in data, "Architecture should include replenishment_plan"
        assert "supplier_health" in data, "Architecture should include supplier_health"
        assert "stock_segments" in data, "Architecture should include stock_segments"
        assert data["blueprint"]["period_days"] == 90
        assert isinstance(data["replenishment_plan"], list)
        assert isinstance(data["supplier_health"], list)
        assert isinstance(data["stock_segments"], list)
        print(
            f"✅ Architecture blueprint: urgent={data['blueprint']['urgent_reorders_count']}, supplier_coverage={data['blueprint']['supplier_coverage_pct']}%"
        )


class TestRakanAnalytics:
    """Test dedicated Rakan analytics endpoint"""

    def test_get_rakan_analytics(self):
        """GET /api/inventory/rakan-analytics should return normalized financial analytics"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/rakan-analytics", params={"days": 90}, timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        for key in [
            "period_days",
            "revenue",
            "expense",
            "profit",
            "period_comparison",
            "expense_breakdown",
            "expense_reasons",
            "price_trend",
            "insights",
        ]:
            assert key in data, f"Rakan analytics should include '{key}'"

        assert data["period_days"] == 90
        assert isinstance(data["expense_breakdown"], list)
        assert isinstance(data["expense_reasons"], list)
        assert isinstance(data["price_trend"], list)
        assert isinstance(data["insights"], list)
        print(
            f"✅ Rakan analytics: revenue={data['revenue']}, expense={data['expense']}, profit={data['profit']}"
        )


class TestSmartInventoryBackorders:
    """Test backorders CRUD operations"""
    
    created_backorder_id = None

    def test_1_create_backorder(self):
        """POST /api/inventory/backorders creates a new backorder"""
        payload = {
            "part_name": f"Test Part {uuid.uuid4().hex[:8]}",
            "requested_quantity": 5,
            "customer_name": "عميل اختبار",
            "customer_phone": "+966555123456",
            "note": "طلب اختباري للتأكد من عمل API"
        }
        response = requests.post(f"{BASE_URL}/api/inventory/backorders", json=payload, timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "id" in data, "Backorder response should have 'id'"
        assert data["part_name"] == payload["part_name"], "part_name mismatch"
        assert data["requested_quantity"] == payload["requested_quantity"], "requested_quantity mismatch"
        assert data["customer_name"] == payload["customer_name"], "customer_name mismatch"
        assert data["status"] == "pending", f"Expected status 'pending', got {data['status']}"
        
        TestSmartInventoryBackorders.created_backorder_id = data["id"]
        print(f"✅ Backorder created: id={data['id']}, part={data['part_name']}")

    def test_2_list_backorders(self):
        """GET /api/inventory/backorders lists all backorders"""
        response = requests.get(f"{BASE_URL}/api/inventory/backorders", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert isinstance(data, list), "Backorders list should be an array"
        print(f"✅ Backorders list returned {len(data)} records")

    def test_3_update_backorder_status(self):
        """PATCH /api/inventory/backorders/{id}/status updates backorder status"""
        backorder_id = TestSmartInventoryBackorders.created_backorder_id
        if not backorder_id:
            pytest.skip("No backorder was created in previous test")
        
        payload = {
            "status": "ordered",
            "note": "تم طلب القطعة من المورد"
        }
        response = requests.patch(
            f"{BASE_URL}/api/inventory/backorders/{backorder_id}/status",
            json=payload,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data["status"] == "ordered", f"Expected status 'ordered', got {data['status']}"
        print(f"✅ Backorder status updated to 'ordered' for id={backorder_id}")

    def test_4_verify_backorder_status_change(self):
        """GET /api/inventory/backorders should show updated status"""
        backorder_id = TestSmartInventoryBackorders.created_backorder_id
        if not backorder_id:
            pytest.skip("No backorder was created")
        
        response = requests.get(f"{BASE_URL}/api/inventory/backorders", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        found = False
        for order in data:
            if order.get("id") == backorder_id:
                found = True
                assert order["status"] == "ordered", f"Expected 'ordered', got {order['status']}"
                print(f"✅ Verified backorder {backorder_id} has status 'ordered'")
                break
        
        assert found, f"Created backorder {backorder_id} not found in list"


class TestPartsEndpointRegression:
    """Verify /parts endpoints still work after Smart Inventory integration"""

    def test_get_parts_list(self):
        """GET /api/parts should still return parts list"""
        response = requests.get(f"{BASE_URL}/api/parts", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert isinstance(data, list), "Parts should be a list"
        print(f"✅ /api/parts returns {len(data)} parts (no regression)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
