## 2025-05-22 - [Dashboard Lazy Loading & Stats Pass]
**Learning:** Initializing dozens of API calls on dashboard mount (N+1) severely impacts performance and network congestion. Consolidating multiple array filter/map operations into a single O(N) pass significantly reduces CPU overhead on the main thread for large datasets.
**Action:** Use a single loop to calculate dashboard statistics and implement lazy loading for detailed data only when UI expansion occurs.
