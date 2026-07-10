# Confidence Evolution

Module: `app/merchant-intelligence/confidence/confidence-evolution.ts`

Every confidence score evolves based on:

- Observation count
- Historical support (pattern seeds)
- Merchant validation rate
- Outcome accuracy
- Time decay
- Evidence quality
- Freshness
- Business stability

Stored in `adaptive_confidence` per domain. Never static. Never GPT.
