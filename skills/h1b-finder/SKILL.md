---
name: h1b-finder
description: "Search H1B sponsor rankings, salaries, and approval rates from H1B Friendly (FY2025)."
---

# H1B Finder Skill

Use this skill to query H1B sponsorship data for specific job titles, locations, or companies.

## Search Rankings

Query the top H1B sponsors:
```bash
curl -s "https://h1bfriendly.com/api/v1/rankings?job_title=Software%20Engineer&limit=5" | jq
```

## Get Market Summary

Get high-level totals and trends for a specific role:
```bash
curl -s "https://h1bfriendly.com/api/v1/rankings/summary?job_title=Data%20Scientist" | jq
```

## Grounding & Contracts

All data is grounded in DOL LCA Disclosure Data (FY2025). 
Refer to the [Metric Contract](https://github.com/ewangchong/h1bfriendly.com/wiki/Data-and-Metric-Contract) for canonical definitions of approvals, filings, and salary sanity bounds.
