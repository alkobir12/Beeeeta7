## 2025-05-15 - Dashboard N+1 API Call & Single-Pass Stats Optimization
**Learning:** Identifying N+1 API calls in React components where data is fetched for every item in a list upon mount. Also, multiple array iterations (.filter().length) for dashboard statistics can be consolidated into a single O(N) pass.
**Action:** Implement lazy loading for secondary data triggered by UI interactions (like expansion). Use forEach to calculate all dashboard metrics in one loop. Push filtering to the database layer (backend) whenever possible to reduce payload size.
