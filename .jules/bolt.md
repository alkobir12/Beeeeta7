## 2026-06-14 - [Database-level statistics optimization]
**Learning:** Fetching all records (transactions, vehicles, customers) from Supabase and filtering in Python is a major bottleneck as the database grows.
**Action:** Use Supabase's `count` functionality for totals and push time-based filtering to the database layer via `gte` and `lt` operators. Fetch only necessary columns to reduce bandwidth and memory usage.
