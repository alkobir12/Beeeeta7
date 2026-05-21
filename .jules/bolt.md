## 2025-02-12 - Dashboard Statistics Optimization
**Learning:** Multiple `.filter().length` calls on a large array (like `dashboardVehicles`) causes redundant $O(N)$ iterations. Consolidating these into a single `.reduce()` pass improves performance significantly, especially as the dataset grows. Memoizing filtered lists with `useMemo` is also crucial to avoid expensive re-calculations on unrelated UI state changes.
**Action:** Always look for opportunities to consolidate array iterations into a single $O(N)$ pass using `.reduce()` and ensure derived state is properly memoized.
