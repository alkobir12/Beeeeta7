## 2025-05-15 - Dashboard Optimization Patterns
**Learning:** Consolidated multiple O(N) passes (filter/map/length) into a single O(N) `.reduce()` pass for dashboard statistics. Also solved an N+1 API bottleneck by moving vehicle visit summaries to a lazy-loading pattern triggered by card expansion.
**Action:** Use single-pass reduction for complex metric calculations and lazy-load details that aren't immediately visible.

## 2025-05-15 - React Component Render Hygiene
**Learning:** Hoisting configuration factories (like `getStatusConfig`) and stateless helpers (like `getServiceTypeLabel`) outside of functional components prevents redundant re-allocations. Combining this with `useMemo` for translation-dependent config ensures optimal render performance.
**Action:** Always hoist stateless logic and memoize configuration objects that depend on hooks.
