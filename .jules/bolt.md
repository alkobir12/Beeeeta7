## 2026-01-24 - Optimized Dashboard Data Loading
**Learning:** Initializing dozens of API calls on dashboard load for non-visible content (N+1 pattern) significantly delays Time to Interactive. Stats calculation using multiple array filters/maps is also a hidden bottleneck for large datasets.
**Action:** Always implement lazy loading for collapsible/expandable components. Refactor multiple array passes into a single O(N) iteration for state calculation. Use local fallbacks (data already in memory) to keep the UI responsive while detailed data loads.
