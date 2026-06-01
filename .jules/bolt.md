# Bolt's Performance Journal ⚡

## 2026-02-11 - Dashboard N+1 Fetching and Redundant Traversals
**Learning:** The dashboard was eagerly fetching visit details for every vehicle on mount, creating an N+1 API bottleneck that scaled poorly with workshop size. Additionally, statistics were being calculated by traversing the primary dataset 7+ times (using multiple .filter().length calls).
**Action:** Implement lazy loading for secondary data triggered by UI interactions (e.g., expanding a card). Consolidate multiple O(N) traversals into a single O(N) .reduce() pass to minimize CPU cycles and intermediate array allocations. Use locally available data as a UI fallback while detailed async data is being fetched to improve perceived performance.
