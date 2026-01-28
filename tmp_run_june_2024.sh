#!/usr/bin/env bash
set -euo pipefail

API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d "=" -f2)
WORKSHOP=finmodule-sync

echo "API_URL=$API_URL"
echo "WORKSHOP=$WORKSHOP"

echo "--- RESET ---"
curl -s -X DELETE "$API_URL/api/finance/reset-all-data?workshop_id=$WORKSHOP&confirm=DELETE_ALL" | python3 -m json.tool

echo "--- CREATE SCENARIO (JUNE 2024) ---"

AHMED_OP_ID=$(
  curl -s -X POST "$API_URL/api/operations" \
    -H "Content-Type: application/json" \
    -d '{"workshopId":"finmodule-sync","type":"sale","partnerType":"customer","partnerName":"أحمد العتيبي","items":[{"itemType":"service","name":"يونيو-أحمد","quantity":1,"price":780}],"paymentMethod":"credit","date":"2024-06-01","notes":"يونيو 2024 - أحمد"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])"
)

echo "AHMED_OP_ID=$AHMED_OP_ID"

curl -s -X POST "$API_URL/api/operations/$AHMED_OP_ID/confirm-payment" \
  -H "Content-Type: application/json" \
  -d '{"workshopId":"finmodule-sync","amount":400,"date":"2024-06-01"}' | python3 -m json.tool

curl -s -X POST "$API_URL/api/operations/$AHMED_OP_ID/confirm-payment" \
  -H "Content-Type: application/json" \
  -d '{"workshopId":"finmodule-sync","amount":200,"date":"2024-06-15"}' | python3 -m json.tool

MOHAMMED_OP_ID=$(
  curl -s -X POST "$API_URL/api/operations" \
    -H "Content-Type: application/json" \
    -d '{"workshopId":"finmodule-sync","type":"sale","partnerType":"customer","partnerName":"محمد القحطاني","items":[{"itemType":"service","name":"يونيو-محمد","quantity":1,"price":720}],"paymentMethod":"credit","date":"2024-06-05","notes":"يونيو 2024 - محمد"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])"
)

echo "MOHAMMED_OP_ID=$MOHAMMED_OP_ID"

curl -s -X POST "$API_URL/api/operations/$MOHAMMED_OP_ID/confirm-payment" \
  -H "Content-Type: application/json" \
  -d '{"workshopId":"finmodule-sync","amount":720,"date":"2024-06-20"}' | python3 -m json.tool

SARA_OP_ID=$(
  curl -s -X POST "$API_URL/api/operations" \
    -H "Content-Type: application/json" \
    -d '{"workshopId":"finmodule-sync","type":"sale","partnerType":"customer","partnerName":"سارة الشمري","items":[{"itemType":"service","name":"يونيو-سارة","quantity":1,"price":330}],"paymentMethod":"cash","date":"2024-06-10","notes":"يونيو 2024 - سارة"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])"
)

echo "SARA_OP_ID=$SARA_OP_ID"


echo "--- REPORTS (EXPECTED AR=180) ---"

echo "[1] AR Customers"
curl -s "$API_URL/api/finance/ar/customers?workshop_id=$WORKSHOP&as_of=2024-06-30" | python3 -m json.tool

echo "[2] AR Ledger"
curl -s "$API_URL/api/finance/ar/ledger?workshop_id=$WORKSHOP&start_date=2024-06-01&end_date=2024-06-30" | python3 -m json.tool

echo "[3] Ahmed Statement"
curl -s --get "$API_URL/api/finance/ar/customer-statement" \
  --data-urlencode "workshop_id=$WORKSHOP" \
  --data-urlencode "customer=أحمد العتيبي" \
  --data-urlencode "start_date=2024-06-01" \
  --data-urlencode "end_date=2024-06-30" | python3 -m json.tool

echo "[4] Aging"
curl -s "$API_URL/api/finance/ar/aging?workshop_id=$WORKSHOP&as_of=2024-06-30" | python3 -m json.tool

echo "[5] Turnover"
curl -s "$API_URL/api/finance/ar/turnover?workshop_id=$WORKSHOP&start_date=2024-06-01&end_date=2024-06-30&credit_sales_total=1500" | python3 -m json.tool

echo "[6] Journal Entries (June only)"
curl -s "$API_URL/api/finance/journal-entries?workshop_id=$WORKSHOP&start_date=2024-06-01&end_date=2024-06-30&limit=200" | python3 -m json.tool


echo "--- CLEANUP (delete ops) ---"
curl -s -X DELETE "$API_URL/api/operations/$AHMED_OP_ID" >/dev/null || true
curl -s -X DELETE "$API_URL/api/operations/$MOHAMMED_OP_ID" >/dev/null || true
curl -s -X DELETE "$API_URL/api/operations/$SARA_OP_ID" >/dev/null || true

echo "DONE"