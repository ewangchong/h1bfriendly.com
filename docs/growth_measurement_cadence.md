# Growth Measurement & Weekly Marketing Review Cadence

**Created:** April 2026
**Related Issue:** #19

## 1. KPI Definitions & Formulas

### Acquisition
| Metric                   | Formula / Source                                    | Leading? |
|--------------------------|-----------------------------------------------------|----------|
| Organic sessions         | GA4 → Sessions where source = organic               | Leading  |
| Social referral sessions | GA4 → Sessions where source = twitter / linkedin    | Leading  |
| Branded search demand    | GSC → Impressions for "h1bfinder" queries            | Lagging  |
| Landing page entry volume| GA4 → Entrances by page path                        | Leading  |

### Activation
| Metric                          | Formula / Source                                  | Leading? |
|---------------------------------|---------------------------------------------------|----------|
| Homepage CTA click-through rate | GA4 Event: `cta_click` / homepage pageviews       | Leading  |
| Plan starts                     | Backend: POST /api/v1/plan/generate count         | Leading  |
| Plan completions                | Backend: successful plan responses                | Leading  |
| AI Chat usage rate              | Backend: chat_logs count / total sessions         | Leading  |
| Email capture conversion rate   | job_alert_subscriptions / total sessions          | Lagging  |

### Retention / Quality
| Metric                  | Formula / Source                                    | Leading? |
|-------------------------|-----------------------------------------------------|----------|
| Returning visitor rate  | GA4 → Returning users / total users                 | Lagging  |
| Email open rate         | Email platform (if applicable)                      | Lagging  |
| Email click rate        | Email platform (if applicable)                      | Lagging  |
| Repeat tool usage       | Backend: users with >1 plan generation              | Lagging  |
| Referral / share actions| growth_events: referral_visit count                 | Leading  |

## 2. Source of Truth

| Metric Category | Primary Source            | Secondary Source |
|-----------------|---------------------------|------------------|
| Traffic         | Google Analytics 4        | Caddy access logs|
| Conversions     | Backend DB (growth_events, chat_logs, job_alert_subscriptions) | GA4 events |
| Referrals       | Backend DB (growth_events)| Admin dashboard (/admin/growth) |
| Search demand   | Google Search Console     | —                |
| Social          | X Analytics / LinkedIn Analytics | GA4 referrals |

## 3. Weekly Review Template

### Date: [YYYY-MM-DD]

#### Traffic Snapshot
| Metric         | This Week | Last Week | Δ      |
|----------------|-----------|-----------|--------|
| Total sessions |           |           |        |
| Organic        |           |           |        |
| Social         |           |           |        |
| Direct         |           |           |        |

#### Conversion Funnel
| Step                  | Count | Rate   |
|-----------------------|-------|--------|
| Homepage visits       |       |        |
| Plan starts           |       |   %    |
| Plan completions      |       |   %    |
| Email captures        |       |   %    |
| Referral shares       |       |   %    |

#### Top Performing Content
1. [Page/post with highest engagement]
2. [Page/post with highest conversions]
3. [Page/post with most traffic]

#### Funnel Leaks
- Where is the biggest drop-off?
- What hypothesis explains it?

#### Decisions
| Action                 | Decision          | Owner |
|------------------------|-------------------|-------|
| Double down on [X]     | Yes / No / Test   |       |
| Stop doing [Y]         | Yes / No          |       |
| New experiment [Z]     | Launch / Hold     |       |

## 4. Weekly Review Questions (Mandatory)

1. Which channels brought the most qualified visitors?
2. Which pages drove the most conversions into My Plan or AI Chat?
3. Which content formats created the strongest engagement?
4. Where is the funnel leaking most?
5. What should we double down on next week?

## 5. Decision Rules

| Signal                         | Action                           |
|--------------------------------|----------------------------------|
| Channel up >20% WoW           | Double down — increase frequency |
| Channel flat for 2 weeks       | Iterate — try new format/topic   |
| Channel down >20% for 2 weeks  | Stop or pivot entirely           |
| Conversion step <50% of prior  | Investigate UX/copy at that step |
| New content >2x avg engagement | Replicate format immediately     |

## 6. Review Cadence

- **Owner:** Product lead (ewangchong)
- **When:** Every Monday, 9am ET
- **Duration:** 15 minutes
- **Output:** Updated review template saved to `docs/weekly_reviews/[date].md`
- **Attendees:** Solo review for now; add team members as needed

## 7. Leading vs Lagging Priority

Focus weekly decisions on **leading indicators** first:
1. Landing page entry volume (are we attracting the right people?)
2. Plan starts (are they engaging with the core product?)
3. Referral share actions (are they telling others?)

Lagging indicators (branded search, returning visitors) validate strategy monthly but should not drive weekly pivots.
