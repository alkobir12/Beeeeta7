# apps/api/src/core/accounting/constants.py

SAUDI_CHART_OF_ACCOUNTS = {
    "1": {
        "code": "1",
        "name": "الأصول",
        "type": "asset",
        "subcategories": {
            "11": {"code": "11", "name": "الأصول المتداولة", "type": "current_asset"},
            "111": {"code": "111", "name": "النقدية في الصندوق", "type": "cash"},
            "112": {"code": "112", "name": "البنك الأهلي", "type": "bank"},
            "113": {"code": "113", "name": "العملاء", "type": "accounts_receivable"},
            "115": {"code": "115", "name": "المخزون", "type": "inventory"},
            "12": {"code": "12", "name": "الأصول الثابتة", "type": "fixed_asset"},
            "121": {"code": "121", "name": "السيارات والمعدات", "type": "vehicles_equipment"},
            "122": {"code": "122", "name": "المباني", "type": "buildings"},
            "123": {"code": "123", "name": "الاستهلاك المتراكم", "type": "accumulated_depreciation"},
        },
    },
    "2": {
        "code": "2",
        "name": "الخصوم",
        "type": "liability",
        "subcategories": {
            "21": {"code": "21", "name": "الخصوم المتداولة", "type": "current_liability"},
            "211": {"code": "211", "name": "الموردين", "type": "accounts_payable"},
            "212": {"code": "212", "name": "الضرائب المستحقة", "type": "tax_payable"},
            "213": {"code": "213", "name": "الرواتب المستحقة", "type": "salary_payable"},
            "22": {"code": "22", "name": "الخصوم طويلة الأجل", "type": "long_term_liability"},
        },
    },
    "3": {
        "code": "3",
        "name": "حقوق الملكية",
        "type": "equity",
        "subcategories": {
            "31": {"code": "31", "name": "رأس المال", "type": "capital"},
            "311": {"code": "311", "name": "رأس مال المالك", "type": "owner_capital"},
            "32": {"code": "32", "name": "الأرباح المحتجزة", "type": "retained_earnings"},
        },
    },
    "4": {
        "code": "4",
        "name": "الإيرادات",
        "type": "revenue",
        "subcategories": {
            "41": {"code": "41", "name": "إيرادات الخدمات", "type": "service_revenue"},
            "411": {"code": "411", "name": "إيرادات صيانة السيارات", "type": "car_maintenance"},
            "412": {"code": "412", "name": "إيرادات بيع قطع الغيار", "type": "parts_sales"},
        },
    },
    "5": {
        "code": "5",
        "name": "المصروفات",
        "type": "expense",
        "subcategories": {
            "51": {"code": "51", "name": "مصروفات التشغيل", "type": "operating_expense"},
            "511": {"code": "511", "name": "رواتب الموظفين", "type": "salaries"},
            "512": {"code": "512", "name": "إيجار الورشة", "type": "rent"},
            "513": {"code": "513", "name": "فواتير المياه والكهرباء", "type": "utilities"},
            "514": {"code": "514", "name": "شراء قطع الغيار", "type": "parts_purchase"},
            "52": {"code": "52", "name": "مصروفات الإهلاك", "type": "depreciation_expense"},
        },
    },
}
