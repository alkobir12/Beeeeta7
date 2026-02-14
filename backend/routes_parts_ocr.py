import os
import json
import re
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent


router = APIRouter(prefix="/api")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


class PartsOcrRequest(BaseModel):
    image_base64: str


class PartsOcrResponse(BaseModel):
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    currency: Optional[str] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    items: List[Dict[str, Any]] = []
    raw_text: Optional[str] = None
    success: bool = True


def strip_base64(data: str) -> str:
    if not data:
        return ""
    if "," in data:
        return data.split(",", 1)[1]
    return data


def parse_json_response(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return {}
    return {}


@router.post("/parts/ocr", response_model=PartsOcrResponse)
async def ocr_parts(request: PartsOcrRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY is missing")

    image_b64 = strip_base64(request.image_base64)
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    system_message = (
        "You are an OCR assistant. Extract spare parts invoice data. Return ONLY valid JSON with this schema: "
        "{supplier, invoice_number, invoice_date, currency, subtotal, tax, total, items:[{name, quantity, unit_price, total}]}. "
        "If a field is missing, return null."
    )

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id="parts-ocr", system_message=system_message)
    chat.model = "gpt-4o-mini"
    user_message = UserMessage(text="Extract the invoice data.", file_contents=[ImageContent(image_base64=image_b64)])
    try:
        response = await chat.send_message(user_message)
    except Exception as e:
        print(f"OCR request failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR request failed: {e}")

    response_text = response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
    parsed = parse_json_response(response_text)

    items = parsed.get("items") or []
    normalized_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("item") or item.get("description")
        quantity = item.get("quantity") or item.get("qty")
        unit_price = item.get("unit_price") or item.get("price")
        total = item.get("total") or item.get("line_total")
        normalized_items.append(
            {
                "name": name,
                "quantity": quantity,
                "unit_price": unit_price,
                "total": total,
            }
        )

    return PartsOcrResponse(
        supplier=parsed.get("supplier"),
        invoice_number=parsed.get("invoice_number"),
        invoice_date=parsed.get("invoice_date"),
        currency=parsed.get("currency"),
        subtotal=parsed.get("subtotal"),
        tax=parsed.get("tax"),
        total=parsed.get("total"),
        items=normalized_items,
        raw_text=response_text,
        success=True,
    )