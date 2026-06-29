## 2025-05-24 - Optimized Dashboard performance and eliminated N+1 API calls
**Learning:** Found that the Dashboard component was fetching detailed summaries for every vehicle on initial mount, creating an N+1 API call bottleneck. Additionally, complex statistics were being recalculated on every render using multiple filter passes.
**Action:** Implemented lazy loading for secondary data (only fetch on card expansion), used available local data as UI fallbacks, and refactored statistics to use a single O(N) iteration pass with memoization.
