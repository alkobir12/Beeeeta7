import os
import re

files = [
    '/app/frontend/src/pages/Dashboard.jsx',
    '/app/frontend/src/pages/Operations.jsx',
    '/app/frontend/src/pages/PartsCatalog.jsx',
    '/app/frontend/src/pages/Technicians.jsx',
    '/app/frontend/src/pages/KnowledgeBase.jsx',
    '/app/frontend/src/pages/Customers.jsx',
    '/app/frontend/src/pages/ServicesManagement.jsx',
    '/app/frontend/src/pages/Settings.jsx',
    '/app/frontend/src/pages/NewVehicle.jsx',
    '/app/frontend/src/pages/VehicleDetails.jsx',
    # PartsInventory is manually updated
    '/app/frontend/src/pages/Suppliers.jsx',
    '/app/frontend/src/pages/UsersManagement.jsx',
    '/app/frontend/src/pages/Analytics.jsx',
    '/app/frontend/src/pages/CEO.jsx',
    '/app/frontend/src/pages/Payroll.jsx',
    '/app/frontend/src/pages/BusinessAccounts.jsx',
    '/app/frontend/src/pages/CustomerReceipts.jsx',
    '/app/frontend/src/pages/VehicleArchive.jsx',
    '/app/frontend/src/pages/WorkshopProfile.jsx',
    '/app/frontend/src/pages/Templates.jsx',
    '/app/frontend/src/pages/InvoiceDesignerStudio.jsx'
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"Skipping {file_path} (not found)")
        continue

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove import Layout
    content = re.sub(r"import\s+Layout\s+from\s+['\"].*?Layout['\"];?\n?", "", content)
    
    # Remove <Layout> tag (multiline safe)
    # This looks for <Layout> or <Layout prop="..."> and removes it
    # We use non-greedy matching for props if any
    content = re.sub(r"<\s*Layout\s*[^>]*>", "", content)
    
    # Remove </Layout> tag
    content = re.sub(r"<\s*/\s*Layout\s*>", "", content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Processed {file_path}")
