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
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    tax_number: Optional[str] = None
    currency: Optional[str] = None
    totals: Dict[str, Any] = {}
    items: List[Dict[str, Any]] = []
    ocr_text: Optional[str] = None
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


def normalize_optional(value: Any) -> Any:
    if isinstance(value, str) and value.strip().lower() in {"null", "none", ""}:
        return None
    return value


@router.post("/parts/ocr", response_model=PartsOcrResponse)
async def ocr_parts(request: PartsOcrRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY is missing")

    image_b64 = strip_base64(request.image_base64)
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    ocr_system_message = (
        "Extract all text from the invoice image exactly as written. "
        "Preserve Arabic/English characters and numbers. "
        "Do NOT summarize or invent. Return plain text only."
    )

    parse_system_message = (
        "You are an expert invoice parser for auto spare parts. Use ONLY the provided OCR text. "
        "Do NOT invent any part names or codes. Keep part numbers exactly as written. "
        "Identify table columns (Part No/Description/Qty/Unit Price/Total). "
        "Return ONLY valid JSON with schema: {vendor, invoice_number, date, tax_number, currency, "
        "items:[{part_number, description, quantity, unit_price, total, confidence}], "
        "totals:{subtotal, tax, grand_total}}. "
        "Set confidence between 0 and 1 for each row. If uncertain, use low confidence and keep fields null."
    )

    ocr_chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id="parts-ocr-text", system_message=ocr_system_message)
    ocr_chat.model = "gpt-4o-mini"
    ocr_chat.extra_params = {"temperature": 0}
    ocr_message = UserMessage(text="Extract invoice text.", file_contents=[ImageContent(image_base64=image_b64)])
    try:
        ocr_text = await ocr_chat.send_message(ocr_message)
    except Exception as e:
        print(f"OCR request failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR request failed: {e}")

    ocr_text_value = ocr_text if isinstance(ocr_text, str) else json.dumps(ocr_text, ensure_ascii=False)
    if not ocr_text_value or len(ocr_text_value.strip()) < 20:
        raise HTTPException(status_code=500, detail="OCR text extraction too short")

    parse_chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id="parts-ocr-parse", system_message=parse_system_message)
    parse_chat.model = "gpt-4o-mini"
    parse_chat.extra_params = {"temperature": 0}
    parse_message = UserMessage(text=f"OCR TEXT:\n{ocr_text_value}")
    try:
        parsed_response = await parse_chat.send_message(parse_message)
    except Exception as e:
        print(f"OCR parse failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR parse failed: {e}")

    response_text = parsed_response if isinstance(parsed_response, str) else json.dumps(parsed_response, ensure_ascii=False)
    parsed = parse_json_response(response_text)

    items = parsed.get("items") or []
    normalized_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        part_number = item.get("part_number") or item.get("part_no") or item.get("code")
        description = item.get("description") or item.get("name") or item.get("item")
        quantity = item.get("quantity") or item.get("qty")
        unit_price = item.get("unit_price") or item.get("price")
        total = item.get("total") or item.get("line_total")
        confidence = item.get("confidence")
        normalized_items.append(
            {
                "part_number": part_number,
                "description": description,
                "quantity": quantity,
                "unit_price": unit_price,
                "total": total,
                "confidence": confidence,
            }
        )

    totals = parsed.get("totals") or {
        "subtotal": parsed.get("subtotal"),
        "tax": parsed.get("tax"),
        "grand_total": parsed.get("grand_total") or parsed.get("total"),
    }
    totals = {k: normalize_optional(v) for k, v in totals.items()}

    return PartsOcrResponse(
        vendor=normalize_optional(parsed.get("vendor") or parsed.get("supplier")),
        invoice_number=normalize_optional(parsed.get("invoice_number")),
        date=normalize_optional(parsed.get("date") or parsed.get("invoice_date")),
        tax_number=normalize_optional(parsed.get("tax_number") or parsed.get("vat_number")),
        currency=normalize_optional(parsed.get("currency")),
        totals=totals,
        items=normalized_items,
        ocr_text=ocr_text_value,
        raw_text=response_text,
        success=True,
    )