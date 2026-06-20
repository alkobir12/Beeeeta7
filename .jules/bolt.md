# Bolt Performance Journal

## 2025-05-15 - Dashboard Performance Optimization
**Learning:** The `Dashboard.jsx` component suffered from several performance anti-patterns:
1. Eagerly fetching detailed vehicle summaries for all vehicles on mount (N+1 API calls).
2. Multiple $O(N)$ array iterations in the `stats` calculation.
3. Redundant re-creation of stateless helper functions and configuration objects on every render.
4. Redundant string lowercase conversions during filtering.

**Action:**
1. Implement lazy-loading for vehicle summaries, triggered by card expansion.
2. Consolidate statistics into a single $O(N)$ pass.
3. Hoist helpers and memoize configuration objects.
4. Pre-calculate lowercase search terms outside the filter loop.
