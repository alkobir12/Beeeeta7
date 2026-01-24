"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ورشة الكبير للسيارات - نظام واتساب المتكامل                    ║
║                      Al-Kabeer Auto Workshop - Web Dashboard                      ║
║                                  Version 3.1.0                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
import httpx
import json
import os
import base64
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging
import re

# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("AlKabeer")

router = APIRouter(prefix="/api/whatsapp-bot", tags=["whatsapp-bot"])

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

class Config:
    INFOBIP_BASE_URL = "https://4kmg2m.api.infobip.com"
    INFOBIP_API_KEY = os.getenv("INFOBIP_API_KEY", "8038da14086df3a783c1baad41289125-68821ef3-8822-4153-b25c-c859e1fae75e")
    WHATSAPP_SENDER = os.getenv("WHATSAPP_SENDER", "966540444051")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

WORKSHOP_INFO = {
    "name": "ورشة الكبير للسيارات",
    "name_en": "Al-Kabeer Auto Workshop",
    "phone": "055 328 0100",
    "location_url": "https://maps.app.goo.gl/MdCcwUEiSYseQEna9",
    "coordinates": {"lat": 26.3267, "lng": 43.9650},
    "address": "القصيم - المملكة العربية السعودية",
    "hours_display": "8ص-12ظ و 4ع-9م",
    "working_days": "السبت - الخميس"
}

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

CUSTOMER_CARS = {
    "MR0HA8CD5K1058519": {
        "model": "Toyota Fortuner", "year": 2019,
        "engine": {"code": "1GD-FTV", "displacement": "2.8L", "type": "Turbo Diesel", "power_hp": "177-204", "torque_nm": 450},
        "parts": {
            "oil_filter": {"part_no": "04152-YZZA4", "price_min": 50, "price_max": 80, "name": "فلتر زيت"},
            "fuel_filter": {"part_no": "23390-0L070", "price_min": 150, "price_max": 250, "name": "فلتر ديزل"},
            "injector": {"part_no": "23670-0E020", "price_min": 700, "price_max": 1200, "name": "بخاخ ديزل"},
            "turbo": {"part_no": "17201-11080", "price_min": 3000, "price_max": 6000, "name": "تيربو"}
        }
    },
    "JTMAABBJ7P4039559": {
        "model": "Toyota Land Cruiser 300", "year": 2023,
        "engine": {"code": "F33A-FTV", "displacement": "3.3L", "type": "V6 Twin Turbo Diesel", "power_hp": "309", "torque_nm": 700},
        "parts": {
            "oil_filter": {"part_no": "04152-YZZA6", "price_min": 50, "price_max": 80, "name": "فلتر زيت"},
            "injector": {"part_no": "23670-0E020", "price_min": 800, "price_max": 1200, "name": "بخاخ"},
            "turbo": {"part_no": "17201-0E050", "price_min": 5000, "price_max": 8000, "name": "تيربو"}
        }
    },
    "JTMDV09J194022240": {
        "model": "Toyota Land Cruiser 200", "year": 2008,
        "engine": {"code": "1VD-FTV", "displacement": "4.5L", "type": "V8 Twin Turbo Diesel", "power_hp": "286", "torque_nm": 650},
        "parts": {
            "oil_filter": {"part_no": "04152-38020", "price_min": 40, "price_max": 70, "name": "فلتر زيت"},
            "injector": {"part_no": "23670-51030", "price_min": 600, "price_max": 1000, "name": "بخاخ"},
            "turbo": {"part_no": "17201-51021", "price_min": 4000, "price_max": 7000, "name": "تيربو"}
        }
    }
}

SOUND_SIGNATURES = {
    "normal": {"name_ar": "طبيعي", "severity": "سليم ✅", "color": "#22c55e", "causes": ["صوت المكينة طبيعي"]},
    "knocking": {"name_ar": "طقطقة", "severity": "عالي ⚠️", "color": "#ef4444", "causes": ["بخاخات تالفة", "صمامات", "بيرنقات"]},
    "whistling": {"name_ar": "صفير", "severity": "متوسط ⚠️", "color": "#eab308", "causes": ["تسريب هواء", "تيربو"]},
    "rattling": {"name_ar": "خشخشة", "severity": "متوسط-عالي ⚠️", "color": "#f97316", "causes": ["سلسلة تايمنق"]},
    "grinding": {"name_ar": "احتكاك معدني", "severity": "خطير 🚨", "color": "#dc2626", "causes": ["بيرنقات تالفة", "مضخة زيت"]}
}

# Message history storage
message_history: List[Dict] = []
stats = {"total_messages": 0, "audio_analyzed": 0, "images_analyzed": 0}

# ═══════════════════════════════════════════════════════════════════════════════
# SERVICES
# ═══════════════════════════════════════════════════════════════════════════════

class InfobipService:
    def __init__(self):
        self.base_url = Config.INFOBIP_BASE_URL
        self.headers = {
            "Authorization": f"App {Config.INFOBIP_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def send_text(self, to: str, text: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/whatsapp/1/message/text",
                headers=self.headers,
                json={"from": Config.WHATSAPP_SENDER, "to": to, "content": {"text": text}}
            )
            return response.json()
    
    async def send_image(self, to: str, image_url: str, caption: str = "") -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/whatsapp/1/message/image",
                headers=self.headers,
                json={"from": Config.WHATSAPP_SENDER, "to": to, "content": {"mediaUrl": image_url, "caption": caption}}
            )
            return response.json()
    
    async def send_location(self, to: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/whatsapp/1/message/location",
                headers=self.headers,
                json={
                    "from": Config.WHATSAPP_SENDER, "to": to,
                    "content": {
                        "latitude": WORKSHOP_INFO["coordinates"]["lat"],
                        "longitude": WORKSHOP_INFO["coordinates"]["lng"],
                        "name": WORKSHOP_INFO["name"],
                        "address": WORKSHOP_INFO["address"]
                    }
                }
            )
            return response.json()
    
    async def download_media(self, media_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(media_url, headers={"Authorization": f"App {Config.INFOBIP_API_KEY}"})
            return response.content

infobip = InfobipService()

class GeminiAssistant:
    SYSTEM_PROMPT = """أنت "أبو فهد" مدير خدمة العملاء في ورشة الكبير للسيارات.
تتحدث باللهجة القصيمية. خبير في مكائن الديزل والبنزين.
رقم التواصل: 055 328 0100
الموقع: https://maps.app.goo.gl/MdCcwUEiSYseQEna9
ساعات العمل: 8ص-12ظ و 4ع-9م (السبت-الخميس)"""

    async def chat(self, message: str) -> str:
        if not Config.GEMINI_API_KEY:
            return self._fallback(message)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{Config.GEMINI_MODEL}:generateContent?key={Config.GEMINI_API_KEY}",
                    json={
                        "contents": [{"role": "user", "parts": [{"text": self.SYSTEM_PROMPT + "\n\nالعميل: " + message}]}],
                        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 500}
                    }
                )
                data = response.json()
                if "candidates" in data:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error(f"Gemini error: {e}")
        return self._fallback(message)
    
    async def analyze_image(self, image_data: bytes, caption: str = "") -> str:
        if not Config.GEMINI_API_KEY:
            return "📷 استلمت الصورة! للتحليل اتصل: " + WORKSHOP_INFO["phone"]
        try:
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{Config.GEMINI_MODEL}:generateContent?key={Config.GEMINI_API_KEY}",
                    json={
                        "contents": [{
                            "role": "user",
                            "parts": [
                                {"text": self.SYSTEM_PROMPT + f"\n\nحلل الصورة. سؤال العميل: {caption or 'وش هذي؟'}"},
                                {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}}
                            ]
                        }],
                        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 800}
                    }
                )
                data = response.json()
                if "candidates" in data:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error(f"Vision error: {e}")
        return f"📷 استلمت الصورة!\n📞 {WORKSHOP_INFO['phone']}"
    
    def _fallback(self, message: str) -> str:
        m = message.lower()
        if any(w in m for w in ["هلا", "السلام", "مرحبا"]):
            return f"هلا والله! 👋\nأنا أبو فهد من ورشة الكبير 🚗\nوش أقدر أساعدك؟\n📞 {WORKSHOP_INFO['phone']}"
        if any(w in m for w in ["موقع", "وين"]):
            return f"📍 موقعنا:\n{WORKSHOP_INFO['location_url']}\n⏰ {WORKSHOP_INFO['hours_display']}"
        if any(w in m for w in ["موعد", "حجز"]):
            return f"📅 للحجز:\n📞 {WORKSHOP_INFO['phone']}\n⏰ {WORKSHOP_INFO['hours_display']}"
        return f"شكراً على تواصلك! 🚗\n📞 {WORKSHOP_INFO['phone']}"

ai_assistant = GeminiAssistant()

class AudioAnalyzer:
    async def analyze(self, audio_data: bytes) -> dict:
        try:
            import librosa
            import numpy as np
            import io
            import soundfile as sf
            
            audio_array, sr = sf.read(io.BytesIO(audio_data))
            if len(audio_array.shape) > 1:
                audio_array = audio_array.mean(axis=1)
            
            spectral_centroid = librosa.feature.spectral_centroid(y=audio_array, sr=sr)
            brightness = min(1.0, max(0.0, float(np.mean(spectral_centroid) / 8000)))
            
            onset_env = librosa.onset.onset_strength(y=audio_array, sr=sr)
            sharpness = min(1.0, max(0.0, float(np.std(onset_env) / np.mean(onset_env)) / 2)) if np.mean(onset_env) > 0 else 0
            
            spectral_flatness = librosa.feature.spectral_flatness(y=audio_array)
            richness = min(1.0, max(0.0, float(1 - np.mean(spectral_flatness))))
            
            diagnosis = self._classify(brightness, sharpness, richness)
            
            return {
                "success": True,
                "coords": {"brightness": round(brightness, 2), "sharpness": round(sharpness, 2), "richness": round(richness, 2)},
                "diagnosis": diagnosis
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _classify(self, b, s, r):
        signatures = {
            "normal": (0.3, 0.2, 0.3),
            "knocking": (0.5, 0.8, 0.5),
            "whistling": (0.9, 0.3, 0.2),
            "rattling": (0.5, 0.5, 0.8),
            "grinding": (0.7, 0.7, 0.9)
        }
        min_dist, best = float('inf'), "normal"
        for name, (sb, ss, sr) in signatures.items():
            dist = ((b-sb)**2 + (s-ss)**2 + (r-sr)**2) ** 0.5
            if dist < min_dist:
                min_dist, best = dist, name
        
        sig = SOUND_SIGNATURES[best]
        return {
            "type": best, "name_ar": sig["name_ar"], "severity": sig["severity"],
            "color": sig["color"], "causes": sig["causes"],
            "confidence": round(max(0, (1-min_dist)*100), 1)
        }

audio_analyzer = AudioAnalyzer()

# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGE HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

async def handle_message(message_data: dict, background_tasks: BackgroundTasks):
    global stats
    try:
        sender = message_data.get("from", "")
        msg_type = message_data.get("type", "").upper()
        
        if not sender:
            return
        
        stats["total_messages"] += 1
        
        # Log message
        log_entry = {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "from": sender,
            "type": msg_type,
            "direction": "incoming"
        }
        
        if msg_type == "TEXT":
            text = message_data.get("text", {}).get("text", "")
            log_entry["content"] = text[:100]
            
            # Check VIN
            vin_match = re.search(r'[A-HJ-NPR-Z0-9]{17}', text.upper())
            if vin_match:
                vin = vin_match.group()
                if vin in CUSTOMER_CARS:
                    car = CUSTOMER_CARS[vin]
                    parts_text = "\n".join([f"• {p['name']}: {p['price_min']}-{p['price_max']} ريال" for p in list(car['parts'].values())[:4]])
                    response = f"🚗 *سيارتك:*\n{car['model']} {car['year']}\n🔧 {car['engine']['code']}\n\n💰 *القطع:*\n{parts_text}\n\n📞 {WORKSHOP_INFO['phone']}"
                    await infobip.send_text(sender, response)
                    log_entry["response"] = "VIN found"
                    message_history.append(log_entry)
                    return
            
            response = await ai_assistant.chat(text)
            await infobip.send_text(sender, response)
            log_entry["response"] = response[:100]
            
        elif msg_type in ["AUDIO", "VOICE"]:
            stats["audio_analyzed"] += 1
            media_url = message_data.get("audio", {}).get("url", "") or message_data.get("voice", {}).get("url", "")
            if media_url:
                await infobip.send_text(sender, "⏳ جاري تحليل الصوت 3D...")
                audio_data = await infobip.download_media(media_url)
                result = await audio_analyzer.analyze(audio_data)
                
                if result["success"]:
                    d = result["diagnosis"]
                    c = result["coords"]
                    response = f"""🔊 *نتيجة التحليل 3D:*

📍 الصوت: {d['name_ar']}
📊 الثقة: {d['confidence']}%
⚠️ الخطورة: {d['severity']}

📊 *الإحداثيات:*
X: {'█'*int(c['brightness']*10)}{'░'*(10-int(c['brightness']*10))} {c['brightness']:.0%}
Y: {'█'*int(c['sharpness']*10)}{'░'*(10-int(c['sharpness']*10))} {c['sharpness']:.0%}
Z: {'█'*int(c['richness']*10)}{'░'*(10-int(c['richness']*10))} {c['richness']:.0%}

🔧 *الأسباب:*
{chr(10).join(['• ' + cause for cause in d['causes']])}

📞 للحجز: {WORKSHOP_INFO['phone']}"""
                    await infobip.send_text(sender, response)
                    log_entry["response"] = f"Audio: {d['name_ar']}"
                else:
                    await infobip.send_text(sender, f"❌ فشل التحليل\n📞 {WORKSHOP_INFO['phone']}")
                    log_entry["response"] = "Audio analysis failed"
        
        elif msg_type == "IMAGE":
            stats["images_analyzed"] += 1
            media_url = message_data.get("image", {}).get("url", "")
            caption = message_data.get("image", {}).get("caption", "")
            if media_url:
                await infobip.send_text(sender, "⏳ جاري تحليل الصورة...")
                image_data = await infobip.download_media(media_url)
                response = await ai_assistant.analyze_image(image_data, caption)
                await infobip.send_text(sender, response)
                log_entry["response"] = "Image analyzed"
        
        elif msg_type == "LOCATION":
            await infobip.send_text(sender, f"📍 شفت موقعك!\nموقعنا: {WORKSHOP_INFO['location_url']}")
            await infobip.send_location(sender)
            log_entry["response"] = "Location sent"
        
        else:
            await infobip.send_text(sender, f"📩 استلمت رسالتك!\n📞 {WORKSHOP_INFO['phone']}")
            log_entry["response"] = "Default response"
        
        message_history.append(log_entry)
        if len(message_history) > 100:
            message_history.pop(0)
            
    except Exception as e:
        logger.error(f"Handler error: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_stats():
    """Get current stats"""
    return {**stats, "cars_count": len(CUSTOMER_CARS), "messages_count": len(message_history)}

@router.get("/messages")
async def get_messages(limit: int = 20):
    """Get recent messages"""
    return {"messages": message_history[-limit:][::-1], "total": len(message_history)}

@router.get("/cars")
async def get_cars():
    """Get all cars in database"""
    return {"cars": CUSTOMER_CARS, "count": len(CUSTOMER_CARS)}

@router.get("/car/{vin}")
async def get_car(vin: str):
    """Get car by VIN"""
    car = CUSTOMER_CARS.get(vin.upper())
    return {"success": bool(car), "car": car}

@router.get("/sounds")
async def get_sounds():
    """Get sound signatures"""
    return {"sounds": SOUND_SIGNATURES}

@router.post("/send")
async def send_message(request: Request):
    """Send message API"""
    try:
        data = await request.json()
        phone = data.get("phone", "").strip()
        msg_type = data.get("type", "text")
        text = data.get("text", "")
        
        if not phone:
            return {"success": False, "error": "رقم الجوال مطلوب"}
        
        # Clean phone number
        phone = re.sub(r'[^\d]', '', phone)
        if not phone.startswith("966"):
            if phone.startswith("0"):
                phone = "966" + phone[1:]
            else:
                phone = "966" + phone
        
        if msg_type == "location":
            result = await infobip.send_location(phone)
        else:
            if not text:
                return {"success": False, "error": "نص الرسالة مطلوب"}
            result = await infobip.send_text(phone, text)
        
        # Log outgoing
        message_history.append({
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "from": phone,
            "type": msg_type.upper(),
            "direction": "outgoing",
            "content": text[:100] if text else "Location"
        })
        
        return {"success": True, "result": result}
        
    except Exception as e:
        logger.error(f"Send error: {e}")
        return {"success": False, "error": str(e)}

@router.post("/webhook/infobip")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    """Infobip webhook"""
    try:
        body = await request.json()
        for result in body.get("results", []):
            message = result.get("message", {})
            if message:
                background_tasks.add_task(handle_message, message, background_tasks)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workshop-info")
async def get_workshop_info():
    """Get workshop information"""
    return WORKSHOP_INFO

@router.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy", "version": "3.1.0"}
