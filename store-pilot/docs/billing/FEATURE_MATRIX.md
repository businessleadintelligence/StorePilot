# Feature Matrix

Defined in `app/billing/plan-registry.ts` → `FEATURE_REGISTRY`.

| Feature | Minimum plan |
|---------|----------------|
| executive_briefing | starter |
| business_memory | starter |
| knowledge_graph | starter |
| root_cause | starter |
| daily_operating_plan | starter |
| weekly_executive_report | starter |
| executive_workspace | starter |
| decision_timeline | starter |
| privacy_center | starter |
| timeline | starter |
| operations_queue | starter |
| prediction_engine | growth |
| experiment_engine | growth |
| merchant_intelligence | growth |
| business_stability | growth |
| adaptive_learning | growth |
| prediction_workspace | growth |
| experiment_workspace | growth |
| priority_worker | growth |
| priority_support | growth |
| priority_ai | scale |
| api_access | scale |
| white_glove | scale |
| beta_features | scale |

## API

- `isFeatureAvailable(planSlug, featureKey)`
- `getFeatureAvailability(planSlug, featureKey)`
- `isStoreFeatureAvailable(storeId, featureKey)` (server)

## UI

Locked workspaces render `FeatureUpgradePanel` with **Available on {Plan}** messaging — never 403 or hidden nav.
