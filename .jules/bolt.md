# Bolt's Journal - Critical Learnings

## 2025-05-15 - [Dashboard Performance Optimization]
**Learning:** Found that multiple redundant passes over a large dataset using `.filter().length` (O(M*N)) can be significantly improved by using a single `.reduce()` pass (O(N)). Additionally, React components with search/filter inputs should always memoize the filtered list to avoid O(N) work on every re-render (e.g. when typing or side-panels open).
**Action:** Always look for consolidated reduction opportunities when multiple statistics are derived from the same array. Ensure filtered lists are memoized.

## 2025-05-15 - [Environment & Lockfiles]
**Learning:** Running `yarn` or `npm install` in some sandbox environments might auto-update the lockfile with massive, unrelated dependency changes.
**Action:** Always check `git status` and `git diff` before submitting to ensure no accidental lockfile or build artifact changes are included.
