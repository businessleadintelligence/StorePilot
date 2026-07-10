# Personalization Engine

Module: `app/merchant-intelligence/personalization/personalization-engine.ts`

Adapts Executive COO priorities per merchant.

Example: merchant repeatedly rejects pricing → deprioritize pricing, prioritize SEO/inventory/collections.

Stored in `personalization_profiles` with priority and deprioritized domain lists.

Future COO consumes `merchantIntelligence.priorityDomains` and `deprioritizedDomains`.
