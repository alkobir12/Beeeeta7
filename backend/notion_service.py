"""
Notion Service for Workshop Management System
Handles all Notion API interactions
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime

# Try to import notion-client, fallback to mock if not available
try:
    from notion_client import Client

    NOTION_AVAILABLE = True
except ImportError:
    NOTION_AVAILABLE = False
    print("⚠️ notion-client not installed. Using mock mode.")


class NotionService:
    """Service for interacting with Notion API"""

    def __init__(self):
        """Initialize Notion client"""
        self.notion_token = os.environ.get("NOTION_TOKEN", "")
        self.customers_db = os.environ.get("NOTION_CUSTOMERS_DB", "")
        self.procedures_db = os.environ.get("NOTION_PROCEDURES_DB", "")
        self.appointments_db = os.environ.get("NOTION_APPOINTMENTS_DB", "")

        if self.notion_token and NOTION_AVAILABLE:
            self.client = Client(auth=self.notion_token)
            self.mock_mode = False
        else:
            self.client = None
            self.mock_mode = True
            print(
                "⚠️ Running in MOCK mode. Set NOTION_TOKEN to enable real Notion integration."
            )

    def get_customers(
        self, filter_condition: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """Get all customers from Notion"""
        if self.mock_mode:
            return self._get_mock_customers()

        try:
            response = self.client.databases.query(
                database_id=self.customers_db, page_size=100
            )

            customers = []
            for page in response.get("results", []):
                customer = self._extract_page_properties(page)
                customer["id"] = page["id"]
                customers.append(customer)

            return customers
        except Exception as e:
            print(f"Error retrieving customers: {e}")
            return []

    def create_customer(
        self, name: str, email: str, phone: str, company: str, notes: str = ""
    ) -> Dict[str, Any]:
        """Create new customer in Notion"""
        if self.mock_mode:
            return {
                "id": f"mock-{datetime.now().timestamp()}",
                "name": name,
                "email": email,
                "phone": phone,
                "company": company,
                "notes": notes,
                "status": "mocked",
            }

        try:
            properties = {
                "Name": {"title": [{"text": {"content": name}}]},
                "Email": {"email": email},
                "Phone": {"phone_number": phone},
                "Company": {"rich_text": [{"text": {"content": company}}]},
                "Notes": {"rich_text": [{"text": {"content": notes}}]},
                "Created": {"date": {"start": datetime.now().isoformat()}},
            }

            response = self.client.pages.create(
                parent={"database_id": self.customers_db}, properties=properties
            )

            return {
                "id": response["id"],
                "name": name,
                "email": email,
                "phone": phone,
                "company": company,
            }
        except Exception as e:
            print(f"Error creating customer: {e}")
            raise

    def get_procedures(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get workshop procedures"""
        if self.mock_mode:
            return self._get_mock_procedures(category)

        try:
            query_params = {"database_id": self.procedures_db}

            if category:
                query_params["filter"] = {
                    "property": "Category",
                    "select": {"equals": category},
                }

            response = self.client.databases.query(**query_params)

            procedures = []
            for page in response.get("results", []):
                proc = self._extract_page_properties(page)
                proc["id"] = page["id"]
                procedures.append(proc)

            return procedures
        except Exception as e:
            print(f"Error retrieving procedures: {e}")
            return []

    def _extract_page_properties(self, page: Dict[str, Any]) -> Dict[str, Any]:
        """Extract properties from Notion page"""
        properties = {}
        props = page.get("properties", {})

        for prop_name, prop_data in props.items():
            prop_type = prop_data.get("type")

            if prop_type == "title":
                texts = prop_data.get("title", [])
                properties["name"] = texts[0]["text"]["content"] if texts else ""
            elif prop_type == "rich_text":
                texts = prop_data.get("rich_text", [])
                properties[prop_name.lower()] = (
                    texts[0]["text"]["content"] if texts else ""
                )
            elif prop_type == "email":
                properties["email"] = prop_data.get("email", "")
            elif prop_type == "phone_number":
                properties["phone"] = prop_data.get("phone_number", "")
            elif prop_type == "number":
                properties[prop_name.lower()] = prop_data.get("number")
            elif prop_type == "select":
                select_info = prop_data.get("select", {})
                properties[prop_name.lower()] = (
                    select_info.get("name") if select_info else ""
                )

        return properties

    # Mock data for testing without Notion
    def _get_mock_customers(self) -> List[Dict[str, Any]]:
        """Return mock customer data"""
        return [
            {
                "id": "mock-customer-1",
                "name": "أحمد محمد",
                "email": "ahmed@example.com",
                "phone": "+966501234567",
                "company": "شركة الخليج",
                "notes": "عميل مميز",
            },
            {
                "id": "mock-customer-2",
                "name": "فاطمة علي",
                "email": "fatima@example.com",
                "phone": "+966507654321",
                "company": "مؤسسة النور",
                "notes": "زبون دائم",
            },
        ]

    def _get_mock_procedures(
        self, category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Return mock procedure data"""
        all_procedures = [
            {
                "id": "mock-proc-1",
                "name": "تشخيص المحرك",
                "category": "تشخيص",
                "steps": "1. توصيل جهاز الفحص\n2. قراءة الأكواد\n3. فحص الحساسات",
                "equipment": "جهاز OBD2، ملتيميتر",
            },
            {
                "id": "mock-proc-2",
                "name": "تغيير الزيت",
                "category": "صيانة",
                "steps": "1. تسخين المحرك\n2. تصريف الزيت القديم\n3. استبدال الفلتر\n4. إضافة زيت جديد",
                "equipment": "مفتاح فلتر، قمع، وعاء",
            },
            {
                "id": "mock-proc-3",
                "name": "فحص الفرامل",
                "category": "سلامة",
                "steps": "1. رفع السيارة\n2. فحص سماكة الأقراص\n3. فحص سائل الفرامل\n4. اختبار الأداء",
                "equipment": "جاك هيدروليكي، قياس السماكة",
            },
        ]

        if category:
            return [p for p in all_procedures if p["category"] == category]
        return all_procedures
