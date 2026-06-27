# Bolt's Journal

## 2026-06-27 - Single Pass Stats and Lazy Loading Pattern
**Learning:** Found that the dashboard was performing multiple O(N) passes (filter then length) over the vehicle list for every statistic card, and eagerly fetching visits for every vehicle regardless of visibility.
**Action:** Consolidate array iterations into a single O(N) loop and implement lazy-loading triggered by card expansion with local UI fallbacks.
