# H1Bfriend Metric Contract

This document defines the shared data contract for rankings, companies, plan output, and chat context.

## Canonical definitions

- **filings**
  - Count every LCA row in scope for the selected filter set and fiscal year.
- **approvals**
  - Count every row whose `case_status ILIKE 'CERTIFIED%'`.
  - This includes statuses such as `CERTIFIED` and `CERTIFIED-WITHDRAWN`.
- **avg_salary**
  - Annualize `wage_rate_of_pay_from` using `wage_unit_of_pay` conversion.
  - Conversion table:
    - Year → ×1
    - Month → ×12
    - Bi-Weekly → ×26
    - Week → ×52
    - Hour → ×2080
  - Exclude salary values outside the sanity range **10,000 to 5,000,000** from averages.
- **year_scope**
  - Cross-endpoint comparisons are valid only when the exact same `fiscal_year` and user filters are applied.

## Cross-endpoint expectations

For a fixed year/filter set:

1. `GET /api/v1/rankings`
   - company-level aggregations must roll up to the same totals used by summary/chat context.
2. `GET /api/v1/rankings/summary`
   - totals must match the same filtered dataset used by rankings.
3. Company pages / company endpoint aggregations
   - a company's filings and approvals for a given year must match that company's slice in rankings.
4. Chat context
   - yearly totals and top-company counts must be derived from the same contract above.

## Source of truth in code

- Backend code: `apps/backend/src/metricsContract.ts`
- Backend tests: `apps/backend/src/metricsContract.test.ts`
- Frontend reference: `apps/web/lib/metricContract.ts`

## CI enforcement

GitHub Actions runs backend build + tests, including contract tests, on every PR and push to `main`.
Any contract drift should fail CI before deploy.
