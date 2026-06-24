## 2026-06-24 - Dashboard N+1 API and Iteration Optimization
**Learning:** The dashboard had a significant N+1 bottleneck where every vehicle card triggered a separate visit summary fetch on load. Consolidating array iterations from multiple `.filter()` calls into a single `.forEach()` significantly improves frontend responsiveness for large datasets.
**Action:** Always implement lazy loading for secondary details triggered by UI actions (like card expansion) and use a single (N)$ pass for complex statistics instead of multiple chained filter/map operations.
