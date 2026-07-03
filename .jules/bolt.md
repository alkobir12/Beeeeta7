# Bolt Performance Journal

## 2024-07-03 - Hoisting computations and lazy loading on Dashboard
**Learning:** The Dashboard was performing N+1 API calls by fetching visits for every vehicle in the list on mount. Additionally, statistics were calculated using multiple filter passes over the vehicle array.
**Action:** Implemented lazy loading for vehicle summaries (only fetch on card expansion), hoisted price calculation to the backend list endpoint, and refactored stats calculation into a single $O(N)$ pass. Hoisted stateless helpers outside the React render loop to prevent redundant re-allocations.
