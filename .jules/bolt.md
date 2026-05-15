# Bolt's Journal - Critical Learnings Only

## 2025-02-12 - Initial Entry
**Learning:** Starting the mission to optimize the Autoprofit Pro application.
**Action:** Explore frontend and backend for common performance bottlenecks like N+1 queries, unnecessary re-renders, or missing indexes.

## 2025-02-12 - Dashboard N+1 Request Bottleneck
**Learning:** The dashboard was firing an API request for every vehicle (up to 200) to fetch its visits summary on load. This $O(N)$ request pattern causes severe performance degradation and potential rate-limiting.
**Action:** Implement lazy loading for on-demand details. Trigger API calls only when a specific UI element (e.g., vehicle card) is expanded, and provide fallback calculations from local data to maintain a responsive UI.
