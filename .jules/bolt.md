## 2026-02-12 - N+1 API calls on Dashboard
**Learning:** The dashboard was fetching summaries for all vehicles (up to 200), including those already delivered and filtered out from view. This caused unnecessary N+1 API calls on every initial load or refresh.
**Action:** Use a memoized filtered subset of data (like `dashboardVehicles`) to trigger detail-fetching `useEffect`s, ensuring only visible or relevant data is fetched.
