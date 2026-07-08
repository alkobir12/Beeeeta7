## 2025-05-14 - Dashboard Statistics Optimization
**Learning:** The statistics calculation in `get_stats` was performing full history table scans and in-memory filtering. This causes linear performance degradation as the workshop grows.
**Action:** Pushed filtering (date ranges) and counting (active items) to the database level (Supabase) and refactored backend aggregation into a single pass.
