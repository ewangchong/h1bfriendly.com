# Production Edge Performance & Observability Baseline

**Date:** April 2026  
**Related Issue:** #26

## 1. Edge & Observability Configuration
*   **Domain Handling:** Stable. Requests to `h1bfinder.com` cleanly and quickly 301 redirect to `www.h1bfinder.com` (verified TTFB is ~70ms for the redirect). 
*   **TLS/Caddy Stability:** Caddy is acting as a stable ingress reverse proxy for both Next.js and the backend. It handles gzip/zstd compression smoothly.
*   **Access Logs:** Access logs are correctly enabled in the `Caddyfile` using:
    ```caddyfile
    log {
        output stdout
        format console
        level INFO
    }
    ```
    *Usability Note:* These logs are reliably output to the Docker container console and can be ingested by any standardized container logging stack (e.g., Datadog, AWS CloudWatch, PromTail) for traffic diagnosis in production.

## 2. Core Route Latency Snapshot
*(Measurements taken directly against the live production server via CURL, values are approximate)*

| Route / Endpoint | HTTP Status | TTFB (s) | Total Time (s) | Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `GET /` (Homepage) | 200 | 0.31s | 0.40s | **Healthy** - Quick response |
| `GET /plan` | 200 | 0.20s | 0.22s | **Healthy** - Good static/cached delivery |
| `GET /titles` | 200 | 1.74s | 1.82s | **Warning** - Noticeable delay |
| `GET /companies` | 200 | 4.55s | 4.92s | **Critical** - Unacceptable user delay |
| `GET /api/v1/rankings` | 200 | 38.45s | 38.45s | **Critical Bottleneck** - Severe database querying / aggregation delay |

## 3. Bottlenecks & Next Fixes
The primary instability vector is backend aggregations rather than edge or networking issues. 

**Bottlenecks:**
1.  **Database Aggregation (`/api/v1/rankings`):** An alarming ~38-second latency means the endpoint is doing heavy, unindexed, or uncached analytical SQL operations across a very large H1B dataset. 
2.  **Server-Side Rendering on listing pages (`/companies`, `/titles`):** The Next.js pages taking ~1.8s to 4.9s suggests they are blocking on slow API calls (likely rankings/titles summaries) or heavy SSR computations before painting.

**Concrete Next Actions:**
*   **Fix 1:** Implement Redis caching or Postgres Materialized Views to cache the results of `/api/v1/rankings` immediately. We cannot serve live `GROUP BY` rollups on the entire LCA dataset per request.
*   **Fix 2:** Add `Cache-Control` max-age headers to `/companies` and `/titles` Next.js routes, or move to Incremental Static Regeneration (ISR) so that the pages load from CDN edge nodes instantly.
