## 2026-06-19 - Lazy Loading Dashboard Summaries
**Learning:** Initializing detailed vehicle summaries for all vehicles on the dashboard caused an N+1 API call bottleneck, significantly slowing down initial load time as the vehicle count grew.
**Action:** Implement lazy loading triggered by UI interactions (like card expansion) to fetch secondary data only when needed. Use locally available data (e.g., `vehicle.parts`) as a UI fallback to maintain perceived speed.
