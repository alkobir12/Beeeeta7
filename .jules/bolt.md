## 2026-02-11 - [Dashboard Performance & N+1 Resolution]
**Learning:** React components with heavy side effects in a loop (like fetching vehicle summaries for every item in a list) create significant N+1 API bottlenecks. Hoisting heavy calculations to the backend and using UI fallbacks with locally available data improves both actual and perceived performance.
**Action:** Always implement lazy loading for secondary details and use `useMemo` for list filtering with hoisted search terms.

## 2026-02-11 - [React Hook Hoisting & TDZ]
**Learning:** In large React components, state hooks must be declared before any `useEffect` or logic that consumes them to avoid `ReferenceError` due to the Temporal Dead Zone (TDZ).
**Action:** Maintain a strict order: State -> Effects -> Render logic.
