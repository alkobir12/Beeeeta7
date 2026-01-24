# -*- coding: utf-8 -*-
"""
Denso Integrated Injector Diagnostic System - Version 7.0 Final
نظام تشخيص حاقنات Denso المتكامل - الإصدار 7.0 النهائي

Based on official technical training manuals and service standards:
- Denso Technical Training Manuals (HP3, G2, G3, G4 Systems)
- BOSCH EPS815 Service Manual - VL Mode Standards
- Toyota Workshop Manuals (1VD-FTV, 2KD-FTV)
- Isuzu Workshop Manual (4JJ1-TC)
- Mitsubishi Workshop Manuals (4D56, 4M41, 4N15)
"""

from datetime import datetime
from typing import Dict, List, Optional


class DensoSystemV7:
    """
    نظام تشخيص حاقنات Denso الشامل - الإصدار 7.0
    Complete Denso Injector Diagnostic System - Version 7.0
    """

    def __init__(self):
        self.system_info = {
            "name": "Denso Integrated Injector Diagnostic System",
            "version": "7.0 Final",
            "last_updated": "2024-12-02",
            "original_references": [
                "Denso Technical Training Manuals (HP3, G2, G3, G4 Systems)",
                "BOSCH EPS815 Service Manual - VL Mode Standards",
                "Toyota Workshop Manuals (1VD-FTV, 2KD-FTV)",
                "Isuzu Workshop Manual (4JJ1-TC)",
                "Mitsubishi Workshop Manuals (4D56, 4M41, 4N15)",
            ],
        }

        # Denso Generations Specifications
        self.denso_generations = {
            "G2": {
                "description": "Second Generation Common Rail System",
                "pressure_range": {
                    "min_mpa": 120,
                    "max_mpa": 160,
                    "min_bar": 1200,
                    "max_bar": 1600,
                },
                "injection_type": "Solenoid",
                "electrical_resistance": {
                    "typical_ohm": 0.4,
                    "tolerance_percent": 10,
                    "range_min": 0.36,
                    "range_max": 0.44,
                },
                "response_time_ms": 0.8,
            },
            "G3": {
                "description": "Third Generation Common Rail System",
                "pressure_range": {
                    "min_mpa": 160,
                    "max_mpa": 180,
                    "min_bar": 1600,
                    "max_bar": 1800,
                },
                "injection_type": "Piezoelectric",
                "electrical_resistance": {
                    "typical_ohm": 0.35,
                    "tolerance_percent": 10,
                    "range_min": 0.315,
                    "range_max": 0.385,
                },
                "response_time_ms": 0.4,
            },
            "G4": {
                "description": "Fourth Generation Common Rail System",
                "pressure_range": {
                    "min_mpa": 200,
                    "max_mpa": 220,
                    "min_bar": 2000,
                    "max_bar": 2200,
                },
                "injection_type": "Advanced Piezoelectric",
                "electrical_resistance": {
                    "typical_ohm": 0.3,
                    "tolerance_percent": 10,
                    "range_min": 0.27,
                    "range_max": 0.33,
                },
                "response_time_ms": 0.2,
            },
            "G4S": {
                "description": "Fourth Generation Super High Pressure",
                "pressure_range": {
                    "min_mpa": 220,
                    "max_mpa": 250,
                    "min_bar": 2200,
                    "max_bar": 2500,
                },
                "injection_type": "Ultra-Fast Piezoelectric",
                "electrical_resistance": {
                    "typical_ohm": 0.25,
                    "tolerance_percent": 8,
                    "range_min": 0.23,
                    "range_max": 0.27,
                },
                "response_time_ms": 0.15,
            },
            "HP3": {
                "description": "High Pressure Third Generation",
                "pressure_range": {
                    "min_mpa": 180,
                    "max_mpa": 200,
                    "min_bar": 1800,
                    "max_bar": 2000,
                },
                "injection_type": "Enhanced Piezoelectric",
                "electrical_resistance": {
                    "typical_ohm": 0.32,
                    "tolerance_percent": 10,
                    "range_min": 0.288,
                    "range_max": 0.352,
                },
                "response_time_ms": 0.3,
            },
            "HP4": {
                "description": "High Pressure Fourth Generation",
                "pressure_range": {
                    "min_mpa": 220,
                    "max_mpa": 250,
                    "min_bar": 2200,
                    "max_bar": 2500,
                },
                "injection_type": "Ultra Piezoelectric",
                "electrical_resistance": {
                    "typical_ohm": 0.28,
                    "tolerance_percent": 8,
                    "range_min": 0.2576,
                    "range_max": 0.3024,
                },
                "response_time_ms": 0.18,
            },
        }

        # Supported Engines Database
        self.supported_engines = {
            "Toyota_1VD-FTV": {
                "manufacturer": "Toyota",
                "engine_model": "1VD-FTV",
                "displacement_liters": 4.5,
                "cylinder_count": 8,
                "denso_generation": "G3",
                "original_part_numbers": [
                    "095000-9780",
                    "095000-9781",
                    "23670-51050",
                    "23670-51051",
                ],
                "injector_specifications": {
                    "operating_pressure_mpa": 180,
                    "operating_pressure_bar": 1800,
                    "flow_rate_cc_min": 1200,
                    "electrical_resistance_ohm": 0.28,
                    "resistance_tolerance_percent": 10,
                    "injection_type": "Common Rail Piezoelectric",
                    "nozzle_holes": 8,
                    "spray_angle_degrees": 148,
                    "opening_pressure_bar": 300,
                },
                "vl_mode_parameters": {
                    "test_pressure_bar": [1600, 1800, 2000],
                    "duration_min_microseconds": 1400,
                    "duration_max_microseconds": 2000,
                    "return_quantity_max_ml_min": 2.0,
                    "test_frequency_hz": 2,
                    "acceptable_tolerance_percent": 10,
                },
            },
            "Toyota_2KD-FTV": {
                "manufacturer": "Toyota",
                "engine_model": "2KD-FTV",
                "displacement_liters": 2.5,
                "cylinder_count": 4,
                "denso_generation": "G2",
                "original_part_numbers": [
                    "095000-6353",
                    "095000-6354",
                    "23670-39365",
                    "23670-39366",
                ],
                "injector_specifications": {
                    "operating_pressure_mpa": 160,
                    "operating_pressure_bar": 1600,
                    "flow_rate_cc_min": 800,
                    "electrical_resistance_ohm": 0.35,
                    "resistance_tolerance_percent": 10,
                    "injection_type": "Common Rail Solenoid",
                    "nozzle_holes": 6,
                    "spray_angle_degrees": 142,
                    "opening_pressure_bar": 280,
                },
                "vl_mode_parameters": {
                    "test_pressure_bar": [1400, 1600, 1800],
                    "duration_min_microseconds": 1400,
                    "duration_max_microseconds": 2000,
                    "return_quantity_max_ml_min": 2.5,
                    "test_frequency_hz": 2,
                    "acceptable_tolerance_percent": 10,
                },
            },
            "Isuzu_4JJ1-TC": {
                "manufacturer": "Isuzu",
                "engine_model": "4JJ1-TC",
                "displacement_liters": 3.0,
                "cylinder_count": 4,
                "denso_generation": "G3",
                "original_part_numbers": [
                    "095000-6980",
                    "095000-6981",
                    "8-98151837-2",
                    "8-98151837-3",
                ],
                "injector_specifications": {
                    "operating_pressure_mpa": 180,
                    "operating_pressure_bar": 1800,
                    "flow_rate_cc_min": 950,
                    "electrical_resistance_ohm": 0.4,
                    "resistance_tolerance_percent": 10,
                    "injection_type": "Common Rail Piezoelectric",
                    "nozzle_holes": 7,
                    "spray_angle_degrees": 145,
                    "opening_pressure_bar": 320,
                },
                "vl_mode_parameters": {
                    "test_pressure_bar": [1600, 1800, 2000],
                    "duration_min_microseconds": 1400,
                    "duration_max_microseconds": 2000,
                    "return_quantity_max_ml_min": 1.8,
                    "test_frequency_hz": 2,
                    "acceptable_tolerance_percent": 10,
                },
            },
            "Mitsubishi_4D56": {
                "manufacturer": "Mitsubishi",
                "engine_model": "4D56",
                "displacement_liters": 2.5,
                "cylinder_count": 4,
                "denso_generation": "G2",
                "original_part_numbers": [
                    "095000-5600",
                    "095000-5601",
                    "1465A041",
                    "1465A042",
                ],
                "injector_specifications": {
                    "operating_pressure_mpa": 160,
                    "operating_pressure_bar": 1600,
                    "flow_rate_cc_min": 750,
                    "electrical_resistance_ohm": 0.5,
                    "resistance_tolerance_percent": 10,
                    "injection_type": "Common Rail Solenoid",
                    "nozzle_holes": 5,
                    "spray_angle_degrees": 140,
                    "opening_pressure_bar": 260,
                },
                "vl_mode_parameters": {
                    "test_pressure_bar": [1400, 1600, 1800],
                    "duration_min_microseconds": 1400,
                    "duration_max_microseconds": 2000,
                    "return_quantity_max_ml_min": 3.0,
                    "test_frequency_hz": 2,
                    "acceptable_tolerance_percent": 10,
                },
            },
            "Mitsubishi_4M41": {
                "manufacturer": "Mitsubishi",
                "engine_model": "4M41",
                "displacement_liters": 3.2,
                "cylinder_count": 4,
                "denso_generation": "G3",
                "original_part_numbers": [
                    "095000-5760",
                    "095000-5761",
                    "1465A295",
                    "1465A296",
                ],
                "injector_specifications": {
                    "operating_pressure_mpa": 180,
                    "operating_pressure_bar": 1800,
                    "flow_rate_cc_min": 1000,
                    "electrical_resistance_ohm": 0.35,
                    "resistance_tolerance_percent": 10,
                    "injection_type": "Common Rail Piezoelectric",
                    "nozzle_holes": 6,
                    "spray_angle_degrees": 144,
                    "opening_pressure_bar": 300,
                },
                "vl_mode_parameters": {
                    "test_pressure_bar": [1600, 1800, 2000],
                    "duration_min_microseconds": 1400,
                    "duration_max_microseconds": 2000,
                    "return_quantity_max_ml_min": 2.2,
                    "test_frequency_hz": 2,
                    "acceptable_tolerance_percent": 10,
                },
            },
            "Mitsubishi_4N15": {
                "manufacturer": "Mitsubishi",
                "engine_model": "4N15",
                "displacement_liters": 2.4,
                "cylinder_count": 4,
                "denso_generation": "G4",
                "original_part_numbers": [
                    "295050-0880",
                    "295050-0881",
                    "1465A644",
                    "1465A645",
                ],
                "injector_specifications": {
                    "operating_pressure_mpa": 220,
                    "operating_pressure_bar": 2200,
                    "flow_rate_cc_min": 900,
                    "electrical_resistance_ohm": 0.3,
                    "resistance_tolerance_percent": 10,
                    "injection_type": "Common Rail Piezoelectric Advanced",
                    "nozzle_holes": 8,
                    "spray_angle_degrees": 150,
                    "opening_pressure_bar": 350,
                },
                "vl_mode_parameters": {
                    "test_pressure_bar": [2000, 2200, 2400],
                    "duration_min_microseconds": 1400,
                    "duration_max_microseconds": 2000,
                    "return_quantity_max_ml_min": 1.5,
                    "test_frequency_hz": 2,
                    "acceptable_tolerance_percent": 10,
                },
            },
        }

        # Denso VL Mode Reference (بديل عن توصيف BOSCH النصي، مع الحفاظ على معايير التردد والضغط)
        self.bosch_vl_mode_standard = {
            "definition": "Denso VL Mode Reference",
            "description": "Denso full-load reference for VL Mode using maximum rail pressure and 2 Hz frequency",
            "test_parameters": {
                "duration_definition": "Long actuation time for maximum flow measurement",
                "duration_minimum_microseconds": 1400,
                "pressure_definition": "Use engine-specific maximum operating pressure from Denso specs",
                "frequency_hz": 2,
                "measurement_type": "Return quantity only",
                "acceptable_range_percent": 10,
            },
            "validation_criteria": {
                "pressure_validation": "Must match engine maximum operating pressure from Denso data",
                "duration_validation": "Must be >= 1400 microseconds",
                "return_quantity_validation": "Must not exceed engine-specific maximum return quantity",
                "frequency_validation": "Must be exactly 2 Hz",
            },
        }

        # Test Sequence
        self.denso_test_sequence = {
            "step_1": {
                "name": "Visual Inspection",
                "name_ar": "الفحص البصري",
                "description": "Check injector body, nozzle, and electrical connections",
                "description_ar": "فحص جسم الحاقن والبخاخ والتوصيلات الكهربائية",
                "tools_required": ["Visual inspection", "Magnifying glass"],
                "tools_required_ar": ["فحص بصري", "عدسة مكبرة"],
                "pass_criteria": "No physical damage or contamination visible",
                "pass_criteria_ar": "عدم وجود تلف فيزيائي أو تلوث ظاهر",
            },
            "step_2": {
                "name": "Electrical Resistance Test",
                "name_ar": "اختبار المقاومة الكهربائية",
                "description": "Measure injector coil resistance",
                "description_ar": "قياس مقاومة ملف الحاقن",
                "tools_required": ["Digital multimeter", "Test leads"],
                "tools_required_ar": ["مقياس رقمي متعدد", "أسلاك اختبار"],
                "pass_criteria": "Resistance within ±10% of specified value",
                "pass_criteria_ar": "المقاومة ضمن ±10% من القيمة المحددة",
            },
            "step_3": {
                "name": "Leak Test",
                "name_ar": "اختبار التسريب",
                "description": "Check for external fuel leaks",
                "description_ar": "فحص تسريب الوقود الخارجي",
                "tools_required": ["Leak test equipment", "Safety equipment"],
                "tools_required_ar": ["معدات اختبار التسريب", "معدات السلامة"],
                "pass_criteria": "No visible leaks at test pressure",
                "pass_criteria_ar": "عدم وجود تسريب ظاهر عند ضغط الاختبار",
            },
            "step_4": {
                "name": "Opening Pressure Test",
                "name_ar": "اختبار ضغط الفتح",
                "description": "Verify injector opening pressure",
                "description_ar": "التحقق من ضغط فتح الحاقن",
                "tools_required": ["Pressure test bench", "Pressure gauge"],
                "tools_required_ar": ["منصة اختبار الضغط", "مقياس الضغط"],
                "pass_criteria": "Opening pressure within specification range",
                "pass_criteria_ar": "ضغط الفتح ضمن نطاق المواصفات",
            },
            "step_5": {
                "name": "VL Mode Test (Denso Reference)",
                "name_ar": "اختبار وضع VL (مرجع دنسو)",
                "description": "Full load VL test using Denso injector operating specs (pressure, duration, frequency)",
                "description_ar": "اختبار وضع VL بالحمل الكامل باستخدام مواصفات دنسو لضغط السكة والزمن والتردد",
                "tools_required": ["VL test bench", "Return quantity measurement"],
                "tools_required_ar": ["منصة اختبار VL", "قياس كمية الرجوع"],
                "pass_criteria": "Return quantity within Denso acceptable limits",
                "pass_criteria_ar": "كمية الرجوع ضمن الحدود المقبولة حسب مرجع دنسو",
            },
            "step_6": {
                "name": "Flow Rate Test",
                "name_ar": "اختبار معدل التدفق",
                "description": "Measure injector flow rate at operating conditions",
                "description_ar": "قياس معدل تدفق الحاقن في ظروف التشغيل",
                "tools_required": ["Flow measurement system", "Calibrated containers"],
                "tools_required_ar": ["نظام قياس التدفق", "حاويات معايرة"],
                "pass_criteria": "Flow rate within ±5% of specification",
                "pass_criteria_ar": "معدل التدفق ضمن ±5% من المواصفات",
            },
            "step_7": {
                "name": "Spray Pattern Test",
                "name_ar": "اختبار نمط الرش",
                "description": "Verify fuel spray pattern and atomization",
                "description_ar": "التحقق من نمط رش الوقود والتذرير",
                "tools_required": [
                    "Spray pattern analyzer",
                    "High-speed camera (optional)",
                ],
                "tools_required_ar": ["محلل نمط الرش", "كاميرا عالية السرعة (اختياري)"],
                "pass_criteria": "Uniform spray pattern, proper atomization",
                "pass_criteria_ar": "نمط رش موحد، تذرير مناسب",
            },
        }

        # Diagnostic Codes
        self.diagnostic_codes = {
            "R001": {
                "code": "R001",
                "description": "Electrical resistance above specification",
                "description_ar": "المقاومة الكهربائية أعلى من المواصفات",
                "probable_cause": "Coil winding damage or corrosion",
                "probable_cause_ar": "تلف في ملف الحاقن أو تآكل",
                "action": "Replace injector",
                "action_ar": "استبدال الحاقن",
            },
            "R002": {
                "code": "R002",
                "description": "Electrical resistance below specification",
                "description_ar": "المقاومة الكهربائية أقل من المواصفات",
                "probable_cause": "Short circuit in coil winding",
                "probable_cause_ar": "دائرة قصر في ملف الحاقن",
                "action": "Replace injector",
                "action_ar": "استبدال الحاقن",
            },
            "VL001": {
                "code": "VL001",
                "description": "VL Mode return quantity exceeds limit",
                "description_ar": "كمية الرجوع في وضع VL تتجاوز الحد",
                "probable_cause": "Injector nozzle wear or internal leakage",
                "probable_cause_ar": "تآكل بخاخ الحاقن أو تسريب داخلي",
                "action": "Clean or replace injector",
                "action_ar": "تنظيف أو استبدال الحاقن",
            },
            "P001": {
                "code": "P001",
                "description": "Opening pressure below specification",
                "description_ar": "ضغط الفتح أقل من المواصفات",
                "probable_cause": "Spring fatigue or nozzle wear",
                "probable_cause_ar": "إجهاد الزنبرك أو تآكل البخاخ",
                "action": "Recalibrate or replace injector",
                "action_ar": "إعادة معايرة أو استبدال الحاقن",
            },
            "F001": {
                "code": "F001",
                "description": "Flow rate below specification",
                "description_ar": "معدل التدفق أقل من المواصفات",
                "probable_cause": "Nozzle blockage or internal restriction",
                "probable_cause_ar": "انسداد البخاخ أو قيد داخلي",
                "action": "Clean injector nozzle",
                "action_ar": "تنظيف بخاخ الحاقن",
            },
            "S001": {
                "code": "S001",
                "description": "Poor spray pattern or atomization",
                "description_ar": "نمط رش ضعيف أو تذرير سيء",
                "probable_cause": "Nozzle hole damage or contamination",
                "probable_cause_ar": "تلف في فتحات البخاخ أو تلوث",
                "action": "Clean or replace nozzle",
                "action_ar": "تنظيف أو استبدال البخاخ",
            },
        }

        # Pressure Conversions
        self.pressure_conversions = {
            "bar_to_mpa": 0.1,
            "mpa_to_bar": 10,
            "bar_to_psi": 14.5038,
            "psi_to_bar": 0.0689476,
            "mpa_to_psi": 145.038,
        }

    def get_engines_list(self) -> List[Dict]:
        """
        الحصول على قائمة المحركات المدعومة
        Get list of supported engines
        """
        engines = []
        for engine_id, data in self.supported_engines.items():
            engines.append(
                {
                    "id": engine_id,
                    "label": f"{data['manufacturer']} {data['engine_model']}",
                    "manufacturer": data["manufacturer"],
                    "model": data["engine_model"],
                    "displacement": data["displacement_liters"],
                    "cylinders": data["cylinder_count"],
                    "generation": data["denso_generation"],
                }
            )
        return engines

    def get_engine_details(self, engine_id: str) -> Optional[Dict]:
        """
        الحصول على تفاصيل محرك معين
        Get details for a specific engine
        """
        return self.supported_engines.get(engine_id)

    def validate_resistance(self, engine_id: str, measured_resistance: float) -> Dict:
        """
        التحقق من المقاومة الكهربائية
        Validate electrical resistance
        """
        engine = self.supported_engines.get(engine_id)
        if not engine:
            return {
                "valid": False,
                "message": "المحرك غير موجود في قاعدة البيانات",
                "message_en": "Engine not found in database",
            }

        specs = engine["injector_specifications"]
        nominal = specs["electrical_resistance_ohm"]
        tolerance = specs["resistance_tolerance_percent"] / 100

        min_resistance = nominal * (1 - tolerance)
        max_resistance = nominal * (1 + tolerance)

        is_valid = min_resistance <= measured_resistance <= max_resistance

        if is_valid:
            return {
                "valid": True,
                "message": f"المقاومة ضمن النطاق المقبول ({min_resistance:.2f} - {max_resistance:.2f} Ω)",
                "message_en": f"Resistance within acceptable range ({min_resistance:.2f} - {max_resistance:.2f} Ω)",
                "measured": measured_resistance,
                "nominal": nominal,
                "range": {"min": min_resistance, "max": max_resistance},
            }
        else:
            if measured_resistance > max_resistance:
                code = "R001"
            else:
                code = "R002"

            diagnostic = self.diagnostic_codes[code]
            return {
                "valid": False,
                "message": f"المقاومة خارج النطاق المقبول. {diagnostic['description_ar']}",
                "message_en": f"Resistance out of range. {diagnostic['description']}",
                "measured": measured_resistance,
                "nominal": nominal,
                "range": {"min": min_resistance, "max": max_resistance},
                "diagnostic_code": code,
                "action": diagnostic["action_ar"],
                "action_en": diagnostic["action"],
            }

    def validate_vl_mode(
        self,
        engine_id: str,
        pressure_bar: float,
        duration_us: float,
        return_qty_ml_min: float,
    ) -> Dict:
        """
        التحقق من قراءات وضع VL (الحمل الكامل)
        Validate VL Mode (Full Load) readings
        """
        engine = self.supported_engines.get(engine_id)
        if not engine:
            return {
                "valid": False,
                "message": "المحرك غير موجود في قاعدة البيانات",
                "message_en": "Engine not found in database",
            }

        vl_params = engine["vl_mode_parameters"]

        # Validate pressure
        pressure_range = vl_params["test_pressure_bar"]
        pressure_ok = pressure_range[0] <= pressure_bar <= pressure_range[-1]

        # Validate duration
        duration_ok = duration_us >= vl_params["duration_min_microseconds"]

        # Validate return quantity
        return_qty_ok = return_qty_ml_min <= vl_params["return_quantity_max_ml_min"]

        all_valid = pressure_ok and duration_ok and return_qty_ok

        messages = []
        messages_en = []

        if not pressure_ok:
            messages.append(
                f"⚠️ الضغط خارج النطاق المقبول ({pressure_range[0]}-{pressure_range[-1]} bar)"
            )
            messages_en.append(
                f"⚠️ Pressure out of range ({pressure_range[0]}-{pressure_range[-1]} bar)"
            )

        if not duration_ok:
            messages.append(
                f"⚠️ المدة أقل من الحد الأدنى ({vl_params['duration_min_microseconds']} μs)"
            )
            messages_en.append(
                f"⚠️ Duration below minimum ({vl_params['duration_min_microseconds']} μs)"
            )

        if not return_qty_ok:
            messages.append(
                f"⚠️ كمية الرجوع تتجاوز الحد الأقصى ({vl_params['return_quantity_max_ml_min']} ml/min)"
            )
            messages_en.append(
                f"⚠️ Return quantity exceeds maximum ({vl_params['return_quantity_max_ml_min']} ml/min)"
            )
            messages.append("→ السبب المحتمل: تآكل البخاخ أو تسريب داخلي")
            messages_en.append("→ Probable cause: Nozzle wear or internal leakage")
            messages.append("→ الإجراء: تنظيف أو استبدال الحاقن")
            messages_en.append("→ Action: Clean or replace injector")

        if all_valid:
            return {
                "valid": True,
                "message": "✅ جميع قراءات وضع VL ضمن النطاق المقبول",
                "message_en": "✅ All VL Mode readings within acceptable range",
                "readings": {
                    "pressure_bar": pressure_bar,
                    "duration_us": duration_us,
                    "return_qty_ml_min": return_qty_ml_min,
                },
                "specifications": vl_params,
            }
        else:
            # استخدم كود تشخيصي VL001 عندما تتجاوز كمية الرجوع الحد الأقصى
            diagnostic_code = None
            diagnostic_action_ar = None
            diagnostic_action_en = None
            if not return_qty_ok:
                diagnostic = self.diagnostic_codes.get("VL001")
                if diagnostic:
                    diagnostic_code = diagnostic["code"]
                    diagnostic_action_ar = diagnostic["action_ar"]
                    diagnostic_action_en = diagnostic["action"]

            return {
                "valid": False,
                "message": "\n".join(messages),
                "message_en": "\n".join(messages_en),
                "readings": {
                    "pressure_bar": pressure_bar,
                    "duration_us": duration_us,
                    "return_qty_ml_min": return_qty_ml_min,
                },
                "specifications": vl_params,
                "checks": {
                    "pressure_ok": pressure_ok,
                    "duration_ok": duration_ok,
                    "return_qty_ok": return_qty_ok,
                },
                "diagnostic_code": diagnostic_code,
                "action": diagnostic_action_ar,
                "action_en": diagnostic_action_en,
            }

    def get_test_sequence(self) -> Dict:
        """
        الحصول على تسلسل الاختبار الكامل
        Get complete test sequence
        """
        return self.denso_test_sequence

    def get_generation_info(self, generation: str) -> Optional[Dict]:
        """
        الحصول على معلومات جيل Denso محدد
        Get information about specific Denso generation
        """
        return self.denso_generations.get(generation)

    def convert_pressure(self, value: float, from_unit: str, to_unit: str) -> float:
        """
        تحويل وحدات الضغط
        Convert pressure units
        """
        conversions = self.pressure_conversions

        # Convert to bar first
        if from_unit == "mpa":
            value_bar = value * conversions["mpa_to_bar"]
        elif from_unit == "psi":
            value_bar = value * conversions["psi_to_bar"]
        else:  # already bar
            value_bar = value

        # Convert from bar to target
        if to_unit == "mpa":
            return value_bar * conversions["bar_to_mpa"]
        elif to_unit == "psi":
            return value_bar * conversions["bar_to_psi"]
        else:  # bar
            return value_bar

    def generate_full_report(self, engine_id: str, test_data: Dict) -> Dict:
        """
        إنشاء تقرير تشخيصي كامل
        Generate complete diagnostic report
        """
        engine = self.supported_engines.get(engine_id)
        if not engine:
            return {"error": "Engine not found"}

        report = {
            "report_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "system_version": self.system_info["version"],
            "engine_info": {
                "manufacturer": engine["manufacturer"],
                "model": engine["engine_model"],
                "displacement": f"{engine['displacement_liters']} L",
                "cylinders": engine["cylinder_count"],
                "denso_generation": engine["denso_generation"],
            },
            "test_results": {},
        }

        # Validate resistance if provided
        if "resistance_ohm" in test_data:
            report["test_results"]["resistance"] = self.validate_resistance(
                engine_id, test_data["resistance_ohm"]
            )

        # Validate VL mode if provided
        if all(
            k in test_data for k in ["pressure_bar", "duration_us", "return_qty_ml_min"]
        ):
            report["test_results"]["vl_mode"] = self.validate_vl_mode(
                engine_id,
                test_data["pressure_bar"],
                test_data["duration_us"],
                test_data["return_qty_ml_min"],
            )

        # Overall status
        all_valid = all(
            result.get("valid", False) for result in report["test_results"].values()
        )

        report["overall_status"] = {
            "pass": all_valid,
            "message_ar": (
                "✅ الحاقن يعمل ضمن المواصفات"
                if all_valid
                else "❌ الحاقن يحتاج إلى صيانة أو استبدال"
            ),
            "message_en": (
                "✅ Injector operating within specifications"
                if all_valid
                else "❌ Injector needs service or replacement"
            ),
        }

        return report


# Example usage / مثال على الاستخدام
if __name__ == "__main__":
    system = DensoSystemV7()

    # Get engines list
    engines = system.get_engines_list()
    print("Supported Engines:")
    for engine in engines:
        print(f"  - {engine['label']} ({engine['generation']})")

    # Test validation
    print("\n--- Test Example ---")
    result = system.validate_resistance("Toyota_1VD-FTV", 0.29)
    print(f"Resistance Test: {result['message_ar']}")

    result = system.validate_vl_mode("Toyota_1VD-FTV", 1800, 1500, 1.8)
    print(f"VL Mode Test: {result['message_ar']}")
