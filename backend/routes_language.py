from fastapi import APIRouter
from language_dictionary import (
    ENGINE_TERMS,
    FUEL_SYSTEM_TERMS,
    COOLING_SYSTEM_TERMS,
    ELECTRICAL_SYSTEM_TERMS,
    IGNITION_SYSTEM_TERMS,
    BRAKE_SYSTEM_TERMS,
    SUSPENSION_SYSTEM_TERMS,
    TRANSMISSION_SYSTEM_TERMS,
    EXHAUST_SYSTEM_TERMS,
    TIRES_WHEELS_TERMS,
    TOOLS_MEASUREMENTS_TERMS,
    GENERAL_TERMS,
    FINANCIAL_TERMS,
    SALES_PURCHASE_TERMS,
    TECHNICAL_TERMS,
    MECHANICAL_SERVICES_TERMS,
    CHART_OF_ACCOUNTS_TERMS,
)

router = APIRouter(prefix="/api/translations", tags=["translations"])


@router.get("/")
async def get_all_translations():
    """Return all dictionary terms organized by category"""
    return {
        "engine": ENGINE_TERMS,
        "fuel_system": FUEL_SYSTEM_TERMS,
        "cooling_system": COOLING_SYSTEM_TERMS,
        "electrical": ELECTRICAL_SYSTEM_TERMS,
        "ignition": IGNITION_SYSTEM_TERMS,
        "brakes": BRAKE_SYSTEM_TERMS,
        "suspension": SUSPENSION_SYSTEM_TERMS,
        "transmission": TRANSMISSION_SYSTEM_TERMS,
        "exhaust": EXHAUST_SYSTEM_TERMS,
        "tires_wheels": TIRES_WHEELS_TERMS,
        "tools": TOOLS_MEASUREMENTS_TERMS,
        "general": GENERAL_TERMS,
        "financial": FINANCIAL_TERMS,
        "sales_purchase": SALES_PURCHASE_TERMS,
        "technical": TECHNICAL_TERMS,
        "services": MECHANICAL_SERVICES_TERMS,
        "chart_of_accounts": CHART_OF_ACCOUNTS_TERMS,
    }


@router.get("/combined")
async def get_combined_dictionary():
    """Return a single flat dictionary for simple key-value lookup"""
    combined = {}
    dicts = [
        ENGINE_TERMS,
        FUEL_SYSTEM_TERMS,
        COOLING_SYSTEM_TERMS,
        ELECTRICAL_SYSTEM_TERMS,
        IGNITION_SYSTEM_TERMS,
        BRAKE_SYSTEM_TERMS,
        SUSPENSION_SYSTEM_TERMS,
        TRANSMISSION_SYSTEM_TERMS,
        EXHAUST_SYSTEM_TERMS,
        TIRES_WHEELS_TERMS,
        TOOLS_MEASUREMENTS_TERMS,
        GENERAL_TERMS,
        FINANCIAL_TERMS,
        SALES_PURCHASE_TERMS,
        TECHNICAL_TERMS,
        MECHANICAL_SERVICES_TERMS,
        CHART_OF_ACCOUNTS_TERMS,
    ]

    for d in dicts:
        combined.update(d)

    return combined
