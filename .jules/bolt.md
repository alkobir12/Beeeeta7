## 2026-05-30 - Dashboard Performance Optimization
**Learning:** Large React components are prone to N+1 API call bottlenecks and Temporal Dead Zone (TDZ) ReferenceErrors when state/helpers are defined far from their usage. Consolidating multiple array iterations in dashboard statistics significantly improves render performance.
**Action:** Always define state hooks and helper functions at the top of the component. Use locally available data as UI fallbacks while lazy-loading detailed async data to improve perceived performance.
