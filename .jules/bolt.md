## 2026-06-22 - [Full Stack Dashboard Optimization]
**Learning:** Found an N+1 API call pattern in `Dashboard.jsx` where each vehicle triggered a separate `/visits` fetch on mount. Combined with in-memory filtering/counting in the backend `get_stats`, this created significant lag.
**Action:** Implement lazy loading for secondary data (only fetch on card expansion) and push aggregation logic (counts, date filters) to the database layer (Supabase `count="exact"`). Use `useMemo` to hoist static configs and consolidate stats calculation into a single pass.
