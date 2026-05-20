## 2024-02-11 - Dashboard Optimization & N+1 Request Fix
**Learning:** Consolidating multiple array iterations (filter/map) into a single O(N) pass using .reduce() significantly improves performance on pages with large datasets. Additionally, deferring expensive data fetching (summaries) until a UI element is expanded (Lazy Loading) prevents unnecessary network congestion and improves initial load time.
**Action:** Always prefer single-pass reductions for complex stats and lazy-load secondary data that isn't immediately visible to the user.
