## 2025-05-15 - Dashboard N+1 API Bottleneck & Hoisting Patterns
**Learning:** The dashboard was eagerly fetching detailed visit summaries for every vehicle in the fleet on mount, creating an N+1 API bottleneck that grows with the data size. Additionally, configuration objects depending on the `t` (translation) hook were being recreated on every render, preventing efficient memoization.

**Action:**
1. Implement lazy loading for secondary details triggered by UI actions (like expanding a card) instead of bulk fetching on mount.
2. Use factory functions for hook-dependent constants (e.g., `const getConfig = (t) => ({...})`) and initialize them with `useMemo` to allow hoisting while maintaining reactivity to language changes.
3. Consolidate multiple array filtering passes into a single $O(N)$ iteration to reduce CPU overhead in statistics components.
