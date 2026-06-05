## 2025-05-15 - Dashboard N+1 API Call Bottleneck
**Learning:** The dashboard was fetching detailed visit summaries for every vehicle card (up to 200) simultaneously on initial load, causing a significant network bottleneck and slowing down the interactive state of the application.
**Action:** Implemented lazy loading for secondary data. Detailed summaries are now only fetched when a specific card is expanded. Local vehicle data (parts list) is used as a fallback for the service type label to maintain informative UI while loading.
