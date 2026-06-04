## 2026-06-04 - [N+1 API Bottleneck on Dashboard Load]
**Learning:** The dashboard was eagerly fetching detailed visit summaries for every single vehicle in the main list (up to 200) immediately upon mounting. This created a significant network and processing bottleneck, especially since this data is only visible when a card is expanded.
**Action:** Shifted to a lazy-loading model where summaries are fetched only for the `expandedVehicleId`. Improved perceived performance by using locally available vehicle data (`parts`, `estimatedTotal`) as UI fallbacks while async data loads.
