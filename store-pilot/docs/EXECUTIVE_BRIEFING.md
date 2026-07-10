# Executive Briefing

Daily executive summary shown on merchant login.

## Structure

```
Good morning. Here's your overnight business briefing.

Sections:
- Revenue Summary
- Operational Readiness
- Inventory Risks
- Pricing Opportunities
- SEO Status
- Growth Signals
- Refund Watch

Top Priority
Today's Focus
Business Outlook
```

## Generation

Deterministic fallback always available. AI enhancement via Foundation `executive_reasoning` when `AI_PLATFORM_ENABLED=true`.

## Persistence

`executive_briefings` keyed by `(storeId, briefingDate)`.

## Cron

`daily-operating-plan` cron (06:00) enqueues `executive_brief_generate` → schedules `executive_coo_generate`.
