import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
import sys
import os

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase_service import SupabaseService

@pytest.fixture
def mock_supabase_client():
    mock_client = MagicMock()
    return mock_client

@pytest.fixture
def supabase_service(mock_supabase_client):
    with patch("supabase_service.create_client", return_value=mock_supabase_client):
        with patch.dict(os.environ, {"SUPABASE_URL": "http://mock", "SUPABASE_SERVICE_ROLE_KEY": "mock"}):
            service = SupabaseService()
            return service

def test_vehicles_count_active(supabase_service, mock_supabase_client):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.count = 42

    # We need to correctly mock the chain: table().select().not_.in_().limit().execute()
    mock_table = MagicMock()
    mock_supabase_client.table.return_value = mock_table

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select

    mock_not = MagicMock()
    mock_select.not_ = mock_not # Note: not_ is an attribute that returns an object with in_

    mock_in = MagicMock()
    mock_not.in_.return_value = mock_in

    mock_limit = MagicMock()
    mock_in.limit.return_value = mock_limit

    mock_limit.execute.return_value = mock_response

    count = supabase_service.vehicles_count_active()

    assert count == 42
    mock_supabase_client.table.assert_called_with("vehicles")
    mock_table.select.assert_called_with("id", count="exact")

def test_customers_count(supabase_service, mock_supabase_client):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.count = 100

    mock_table = MagicMock()
    mock_supabase_client.table.return_value = mock_table

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select

    mock_limit = MagicMock()
    mock_select.limit.return_value = mock_limit

    mock_limit.execute.return_value = mock_response

    count = supabase_service.customers_count()

    assert count == 100
    mock_supabase_client.table.assert_called_with("customers")
    mock_table.select.assert_called_with("id", count="exact")

def test_transactions_list_date_filtering(supabase_service, mock_supabase_client):
    mock_response = MagicMock()
    mock_response.data = [{"id": "1", "amount": 100}]

    mock_table = MagicMock()
    mock_supabase_client.table.return_value = mock_table

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select

    mock_gte = MagicMock()
    mock_select.gte.return_value = mock_gte

    mock_lt = MagicMock()
    mock_gte.lt.return_value = mock_lt

    mock_order = MagicMock()
    mock_lt.order.return_value = mock_order

    mock_order.execute.return_value = mock_response

    transactions = supabase_service.transactions_list(start_date="2024-01-01", end_date="2024-02-01")

    assert len(transactions) == 1
    mock_select.gte.assert_called_with("date", "2024-01-01")
    mock_gte.lt.assert_called_with("date", "2024-02-01")
