# Bolt's Journal

## 2026-02-14 - Dashboard Performance Optimization
**Learning:** Initializing detailed statistics for all dashboard items on mount creates an N+1 API call bottleneck as the dataset grows. Lazy loading these details upon user interaction (expansion) significantly reduces initial payload and network congestion.
**Action:** Always prefer lazy loading for secondary details in list/grid views. Ensure React hooks (useCallback/useEffect) for data fetching don't create dependency loops by using refs for internal state checks when updating that same state.
