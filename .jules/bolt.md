## 2025-05-15 - Dashboard N+1 API Bottleneck
**Learning:** The dashboard was fetching detailed visit summaries for every vehicle simultaneously on component mount. This creates a massive network bottleneck (N+1 problem) as the number of vehicles grows.
**Action:** Implement lazy loading for secondary data, triggering fetches only when UI elements (like cards) are expanded or interacted with.

## 2025-05-15 - Backend In-Memory Statistics Processing
**Learning:** Fetching entire tables (transactions, vehicles, customers) from Supabase to count or filter them in Python (memory) is an anti-pattern that fails to scale.
**Action:** Push counting and filtering logic to the database layer using native `.select(count="exact")` and range filtering.

## 2025-05-15 - Redundant List Iterations in React
**Learning:** Performing multiple `.filter().length` operations within `useMemo` for dashboard stats results in $O(K \times N)$ complexity, where $K$ is the number of stats.
**Action:** Consolidate into a single $O(N)$ pass using `.forEach()` or `.reduce()` to calculate all metrics in one iteration.
