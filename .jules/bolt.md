## 2025-02-12 - Consolidating Frontend Statistics Calculation
**Learning:** Calculating dashboard statistics using multiple `.filter().length` calls results in multiple array iterations ((K \times N)$).
**Action:** Consolidate multiple statistics into a single loop pass ((N)$) using `.forEach()` or `.reduce()` to improve rendering performance for large datasets.

## 2025-02-12 - Lazy Loading Vehicle Summaries
**Learning:** Pre-fetching detailed summary data for every item in a list on mount creates an N+1 API call bottleneck ((N)$ network requests).
**Action:** Implement lazy loading triggered by UI actions (like card expansion) to reduce initial load time and network overhead from (N)$ to (1)$.

## 2025-02-12 - Backend Filtering vs Application Filtering
**Learning:** Fetching all records from a table (e.g., `transactions`) and filtering in Python code is inefficient as the dataset grows.
**Action:** Push filtering logic to the database layer (e.g., Supabase/PostgreSQL) using query parameters (`gte`, `lte`) to reduce payload size and backend memory usage.
