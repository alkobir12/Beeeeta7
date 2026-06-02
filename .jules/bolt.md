## 2025-02-11 - Lazy Loading on Dashboard
**Learning:** The dashboard previously used an N+1 fetching pattern for vehicle summaries, causing many redundant API calls on mount.
**Action:** Always prefer lazy-loading for expensive secondary data that is only visible when an item is expanded or interacted with.
