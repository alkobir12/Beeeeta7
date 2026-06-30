## 2026-06-30 - Supabase Statistics Optimization
**Learning:** The dashboard statistics were fetching entire tables (transactions, customers, vehicles) into memory to perform simple counts and date-range summations. This creates a massive performance bottleneck as the database grows.
**Action:** Push filtering (date ranges) and counting (active items) to the database layer using Supabase's `gte`, `lt`, and `count='exact'` features.
