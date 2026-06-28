## 2026-06-28 - Lazy Loading Vehicle Summaries
**Learning:** The Dashboard was performing N API calls on mount to fetch visit summaries for every vehicle, creating a significant network and processing bottleneck as the vehicle list grows.
**Action:** Implement lazy loading for secondary details triggered by UI interaction (e.g., card expansion). Use existing local data (like `vehicle.parts`) as a UI fallback to ensure immediate feedback while async data loads.
