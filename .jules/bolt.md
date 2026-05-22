## 2026-05-22 - [Eliminating N+1 on Dashboard]
**Learning:** The Dashboard was fetching vehicle details and then sequentially fetching visits for each vehicle to calculate summaries. This resulted in O(N) network requests. Moving this logic to the backend using batch queries for visits reduced it to O(1) network requests from the frontend.
**Action:** Always check for loops in `useEffect` or map functions that trigger API calls per item. Batch these on the backend where data relationships are easier to join efficiently.
