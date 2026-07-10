# RC2.5 File Inventory

**Date:** 2026-07-10
**Pending paths:** 280

## Summary

| Category | Count | Should ship |
|----------|-------|-------------|
| Configuration | 3 | All YES |
| Documentation | 84 | All YES |
| Infrastructure | 3 | All YES |
| Migration | 14 | All YES |
| Production Code | 138 | All YES |
| Scripts | 2 | All YES |
| Temporary | 1 | None |
| Tests | 35 | All YES |

## Configuration (3)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `.cursor/rules/billing-single-source-of-truth.mdc` | YES | Platform | Project and IDE rules | Low |
| `package.json` | YES | Platform | Project and IDE rules | Low |
| `prisma/schema.prisma` | YES | Database | Project and IDE rules | Low |

## Documentation (84)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `docs/ADAPTIVE_SCORE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/AI_COST_CONTROL.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/AI_PLATFORM_FOUNDATION.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/audit/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BASELINE_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/billing/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BOOTSTRAP_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BOOTSTRAP_INTELLIGENCE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BOOTSTRAP_SYNC_AUDIT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BUSINESS_CONTEXT_BUILDER.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BUSINESS_DNA.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BUSINESS_DNA_V3.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BUSINESS_MEMORY.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BUSINESS_STABILITY.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/BUSINESS_TIMELINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/CAUSAL_GRAPH.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/CAUSAL_INTELLIGENCE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/CAUSAL_REASONING.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/certification/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/CONFIDENCE_EVOLUTION.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/CONFIDENCE_SEEDS.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/DAILY_OPERATING_PLAN.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/DATABASE_SCALABILITY_REPORT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/DECISION_JOURNAL.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/DECISION_MODEL.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EVIDENCE_MODEL.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXECUTIVE_BRIEFING.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXECUTIVE_COO.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXECUTIVE_DECISION_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXPERIMENT_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXPERIMENT_DATABASE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXPERIMENT_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXPERIMENT_INTELLIGENCE_PLATFORM.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXPERIMENT_OBJECT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/EXPERIMENT_PLANNER.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/FACT_GENERATION.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/GRAPH_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/GRAPH_INTEGRITY.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/GRAPH_QUERY_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/GRAPH_RELATIONSHIPS.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/GRAPH_SCHEMA.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/GRAPH_VERSIONING.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/hardening/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/HISTORICAL_INTELLIGENCE_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/infrastructure/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/JOB_LIFECYCLE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/KNOWLEDGE_INGESTION_PLATFORM.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/LEARNING_READINESS.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/LEARNING_VELOCITY.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/MERCHANT_BEHAVIOR_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/MERCHANT_INTELLIGENCE_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/MERCHANT_INTELLIGENCE_PLATFORM.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/MERCHANT_TIMELINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/MODEL_ROUTING.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/OAUTH_CONFIGURATION_AUDIT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/OPERATIONAL_READINESS.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/OPERATIONS_QUEUE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PATTERN_SEEDS.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PERSONALIZATION_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PREDICTION_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PREDICTION_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PREVENTION_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PRISMA_AUDIT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/production/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/PROMPT_REGISTRY.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/QUICK_WIN_SCORING.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/QUICK_WINS_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/release/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/remediation/` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/ROOT_CAUSE_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/ROOT_CAUSE_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/ROOT_CAUSE_OBJECT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/SHOPIFY_INSTALLATION_REPORT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/SHOPIFY_NORMALIZATION.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/SIGNAL_CORRELATION.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/STORE_KNOWLEDGE_GRAPH.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/STORE_PROFILER.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/STRUCTURED_OUTPUT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/SYNC_PIPELINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/TRIAL_VALUE_ENGINE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/WINNER_SELECTION.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/WORKER_ARCHITECTURE.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/WORKER_INFRASTRUCTURE_REPORT.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |
| `docs/WORKER_MIGRATION_PLAN.md` | YES | Documentation | Release certification and audit evidence | Low-Medium |

## Infrastructure (3)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `Dockerfile.worker` | YES | Platform | Worker and cron deployment | Medium |
| `railway.toml` | YES | Platform | Worker and cron deployment | Medium |
| `vercel.json` | YES | Platform | Worker and cron deployment | Medium |

## Migration (14)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `prisma/migrations/20260709143000_worker_infrastructure/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260709160000_ai_platform_foundation/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260709183000_knowledge_ingestion_platform/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260709210000_knowledge_graph_platform/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260709220000_learning_bootstrap_platform/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260709230000_historical_intelligence_engine/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260709240000_quick_wins_engine/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710000000_executive_decision_engine/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710010000_root_cause_engine/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710020000_prediction_prevention_engine/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710030000_experiment_intelligence_platform/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710040000_merchant_intelligence_platform/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710120000_privacy_hardening/` | YES | Database | Schema extension for intelligence platform | High |
| `prisma/migrations/20260710130000_billing_unification/` | YES | Database | Schema extension for intelligence platform | High |

## Production Code (138)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `app/ai/foundation/` | YES | AI Foundation | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/ai/index.ts` | YES | AI Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/ai/orchestrator/ai-orchestrator.server.ts` | YES | AI Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/ai/persistence/prisma-persistence.ts` | YES | AI Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/ai/prompts/DailyOperatingPlan.md` | YES | AI Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/ai/prompts/ExecutiveBriefing.md` | YES | AI Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/ai/prompts/RootCauseExplanation.md` | YES | AI Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-config-validator.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-dashboard.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-engine.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-entitlements.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-limits.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-onboarding.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-service.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-types.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-usage.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/billing-validator.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/feature-gates.server.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/feature-gate-view.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/plan-config.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/plan-registry.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/shopify-billing.server.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/billing/website-pricing.server.ts` | YES | Billing | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/billing/BillingDashboard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/billing/FeatureGate.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/dashboard/` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/ExecutiveBriefCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/HealthScoreCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/InsightsCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/KnowledgeReadinessCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/LearningBootstrapCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/MetricsOverviewCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/QuickWinsCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/RecommendationsCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/components/SyncStatusCard.tsx` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/connectors/google/ga4.connector.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/connectors/google/pagespeed.connector.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/connectors/google/search-console.connector.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/connectors/microsoft/clarity.connector.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/connectors/support/` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/db.server.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/executive/` | YES | Executive | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/experiments/` | YES | Experiment | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/intelligence/` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/intelligence-ui/` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/knowledge/` | YES | Knowledge Graph | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/learning/` | YES | Learning | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/json-pii-guard.server.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/merchant-identity.server.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/onboarding-display.ts` | YES | Worker/Queue | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/order-query-filters.server.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/privacy-retention.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/shopify-app-config.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/lib/sync-display.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/merchant-intelligence/` | YES | Merchant Intelligence | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/prediction/` | YES | Prediction | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/root-cause/` | YES | Root Cause | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/api.pricing.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app._index.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.business-memory.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.collections.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.coo.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.executive.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.experiments.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.inventory.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.knowledge-graph.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.merchant-intelligence.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.predictions.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.pricing.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.products.$id.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.products.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.root-causes.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.seo.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.timeline.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/app.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/health.worker.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/routes/webhooks.app.uninstalled.tsx` | YES | Routes | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/access-control-types.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/ai-cost-control.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/clarity-integration.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/command-center.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/cron-jobs.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/cron-scheduler.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/encrypted-session-storage.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/entitlements.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/executive-coo-facts.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/executive-dashboard.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/executive-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/experiment-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/gdpr.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/gdpr-store-deletion.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/google-integration.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/growth-intelligence-facts.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/intelligence-workspace.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/intelligence-workspace-actions.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/intelligence-workspace-types.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/intelligence-workspace-ui-helpers.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/intelligence-workspace-views.tsx` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/inventory.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/job.server.ts` | YES | Worker/Queue | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/knowledge-graph-webhook.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/knowledge-readiness-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/learning-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/merchant-intelligence-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/metrics.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/monitoring.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/onboarding.server.ts` | YES | Worker/Queue | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/onboarding-display-state.server.ts` | YES | Worker/Queue | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/onboarding-ui.server.ts` | YES | Worker/Queue | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/orders.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/prediction-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/pricing-intelligence-facts.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/privacy-retention.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/product.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/quick-wins-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/root-cause-ui.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/scope-drift-monitor.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/startup-readiness.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/store-audit-facts.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/store-entitlements-loader.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/sync-status.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/token-migration.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/trend-intelligence-facts.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/user.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker.server.ts` | YES | Worker/Queue | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker-health.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker-in-flight.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker-metrics.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker-queue-tier.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker-registry.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/services/worker-runtime.server.ts` | YES | Core Services | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/shopify.server.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/shopify-automation/shopify-executor.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `app/shopify-automation/shopify-idempotency.ts` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `docs.zip` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `eslint-audit-output.txt` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `packages/` | YES | Platform | Intelligence platform / Phase C.2 remediation | Low-Medium |
| `prisma/seed.ts` | YES | Database | Intelligence platform / Phase C.2 remediation | Low-Medium |

## Scripts (2)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `scripts/copy-vercel-prompts.mjs` | YES | Platform | Build and worker entrypoints | Low-Medium |
| `scripts/worker.ts` | YES | Platform | Build and worker entrypoints | Low-Medium |

## Temporary (1)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `_typecheck.log` | NO | Platform | Local diagnostic artifact — remove | None |

## Tests (35)

| Path | Should ship | Owner | Reason | Risk |
|------|-------------|-------|--------|------|
| `app/billing/__tests__/billing-config-consistency.test.ts` | YES | Billing | Regression coverage for RC1 gates | Low-Medium |
| `app/billing/__tests__/billing-unification.test.ts` | YES | Billing | Regression coverage for RC1 gates | Low-Medium |
| `app/components/billing/__tests__/BillingDashboard.test.ts` | YES | Platform | Regression coverage for RC1 gates | Low-Medium |
| `app/lib/__tests__/production-hardening.test.ts` | YES | Platform | Regression coverage for RC1 gates | Low-Medium |
| `app/routes/__tests__/f42-cron-worker.test.ts` | YES | Routes | Regression coverage for RC1 gates | Low-Medium |
| `app/routes/__tests__/f56-executive-dashboard.test.ts` | YES | Routes | Regression coverage for RC1 gates | Low-Medium |
| `app/routes/__tests__/f56-executive-dashboard.test.tsx` | YES | Routes | Regression coverage for RC1 gates | Low-Medium |
| `app/routes/__tests__/f57-command-center.test.ts` | YES | Routes | Regression coverage for RC1 gates | Low-Medium |
| `app/routes/__tests__/intelligence-workspace.test.ts` | YES | Routes | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/circular-dependencies.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/command-center.server.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/cron-scheduler.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/database-retry.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/executive-dashboard-inventory.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f33-job-service.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f34-onboarding-state-machine.test.ts` | YES | Worker/Queue | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f35-job-reliability.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f37-worker-engine.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f38-worker-reliability-hardening.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f45-onboarding-ui.test.ts` | YES | Worker/Queue | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f52-billing.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f53-entitlements.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f54-ai-cost-control.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f612-critical-remediation.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f61-billing-enforcement.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f620-critical-elimination.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/f66-fix-d1.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/foundation-prompt-validation.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/gdpr-store-deletion.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/intelligence-pipeline-chain.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/monitoring.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/privacy-hardening.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/setup/vitest.setup.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/worker-graceful-shutdown.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |
| `app/services/__tests__/worker-infrastructure.test.ts` | YES | Core Services | Regression coverage for RC1 gates | Low-Medium |

