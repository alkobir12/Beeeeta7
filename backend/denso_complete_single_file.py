# -*- coding: utf-8 -*-
import json
import os
from datetime import datetime

class CompleteDensoSystem:
    """
    نظام تشخيص حاقنات Denso المتكامل (Single File Version)
    يحتوي على قاعدة البيانات ومنطق التحقق ومفتاح Google API.
    """
    
    def __init__(self):
        self.system_version = "7.0 Final"
        # المفتاح الجديد الذي تم توفيره
        import os
        self.google_api_key = os.environ.get("GOOGLE_API_KEY", "")
        
        # قاعدة بيانات المحركات والمواصفات (مدمجة)
        self.engine_database = {
            "Toyota_1VD-FTV": {
                "label": "Toyota Land Cruiser (1VD-FTV)",
                "manufacturer": "Denso",
                "part_numbers": ["095000-9780", "23670-59025", "23670-51020"],
                "generation": "G3",
                "specifications": {
                    "pressure": "180 MPa (1800 bar)",
                    "flow_rate": "255 cc/min @ 3 bar",
                    "electrical_resistance": "0.28 Ω ±10%",
                    "injection_type": "Common Rail Piezoelectric"
                },
                "test_parameters": {
                    "VL_mode_pressure": "1600-2000 bar",
                    "VL_mode_duration": 1400, # Minimum duration in microseconds
                    "return_quantity_limit": 2.0, # Max ml/min
                    "opening_pressure": "1600 bar ±50 bar"
                }
            },
            "Toyota_2KD-FTV": {
                "label": "Toyota Hilux/Innova (2KD-FTV)",
                "manufacturer": "Denso", 
                "part_numbers": ["095000-6353", "23670-30400", "23670-39375"],
                "generation": "G2",
                "specifications": {
                    "pressure": "160 MPa (1600 bar)",
                    "flow_rate": "185 cc/min @ 3 bar", 
                    "electrical_resistance": "0.35 Ω ±10%"
                },
                "test_parameters": {
                    "VL_mode_pressure": "1350-1650 bar",
                    "VL_mode_duration": 1400,
                    "return_quantity_limit": 1.5, 
                    "opening_pressure": "1350 bar ±40 bar"
                }
            },
            "Isuzu_4JJ1-TC": {
                "label": "Isuzu D-Max (4JJ1-TC)",
                "manufacturer": "Denso",
                "part_numbers": ["095000-6980", "095000-6981", "8-97602485-6"],
                "generation": "G3", 
                "specifications": {
                    "pressure": "180 MPa (1800 bar)",
                    "flow_rate": "275 cc/min @ 3 bar",
                    "electrical_resistance": "0.4 Ω ±10%"
                },
                "test_parameters": {
                    "VL_mode_pressure": "1600-1800 bar", 
                    "VL_mode_duration": 1400,
                    "return_quantity_limit": 2.5,
                    "opening_pressure": "1600 bar ±60 bar"
                }
            },
            "Mitsubishi_4D56": {
                "label": "Mitsubishi Pajero/L200 (4D56)",
                "manufacturer": "Denso",
                "part_numbers": ["095000-5600", "SM095000-56002D", "1465A041"],
                "generation": "G2",
                "specifications": {
                    "pressure": "160 MPa (1600 bar)", 
                    "flow_rate": "210 cc/min @ 3 bar",
                    "electrical_resistance": "0.5 Ω ±10%"
                },
                "test_parameters": {
                    "VL_mode_pressure": "1350-1600 bar",
                    "VL_mode_duration": 1400, 
                    "return_quantity_limit": 1.8,
                    "opening_pressure": "1350 bar ±45 bar"
                }
            }
        }

    def get_google_key(self):
        """إرجاع مفتاح Google API المستخدم"""
        return self.google_api_key

    def validate_vl_reading(self, engine_type: str, pressure: float, duration: float, return_qty: float) -> dict:
        """
        التحقق من قراءات وضع الحمل الكامل (VL Mode)
        """
        if engine_type not in self.engine_database:
            return {"valid": False, "reason": "Engine not found"}
            
        params = self.engine_database[engine_type]["test_parameters"]
        
        # 1. Check Pressure Range (e.g. "1600-2000 bar")
        p_range = params["VL_mode_pressure"].replace(" bar", "").split("-")
        min_p = float(p_range[0])
        max_p = float(p_range[1])
        pressure_valid = min_p <= pressure <= max_p
        
        # 2. Check Duration
        duration_valid = duration >= params["VL_mode_duration"]
        
        # 3. Check Return Quantity
        return_valid = return_qty <= params["return_quantity_limit"]
        
        is_valid = pressure_valid and duration_valid and return_valid
        
        return {
            "valid": is_valid,
            "details": {
                "pressure": "OK" if pressure_valid else "Fail",
                "duration": "OK" if duration_valid else "Fail",
                "return": "OK" if return_valid else "Fail"
            },
            "engine": self.engine_database[engine_type]["label"]
        }

    def search_by_part_number(self, part_number: str) -> dict:
        """البحث عن الحاقن بواسطة رقم القطعة"""
        results = []
        for engine_code, data in self.engine_database.items():
            if part_number in data["part_numbers"]:
                results.append({
                    "engine_code": engine_code,
                    "engine_name": data["label"],
                    "specs": data["specifications"]
                })
        
        return {
            "found": len(results) > 0,
            "count": len(results),
            "results": results
        }
