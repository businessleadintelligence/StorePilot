export const PRODUCTION_HEALTH_LEVELS = [
  "healthy",
  "warning",
  "critical",
  "offline",
  "unknown",
] as const;

export type ProductionHealthLevel = (typeof PRODUCTION_HEALTH_LEVELS)[number];

export const PRODUCTION_SUBSYSTEMS = [
  "shopify",
  "ga4",
  "search_console",
  "pagespeed",
  "clarity",
  "unified_metrics",
  "connector_cache",
  "webhooks",
  "background_jobs",
  "ai_platform",
  "automation",
  "operations",
  "oauth_tokens",
  "billing",
  "database",
  "worker_queue",
  "security",
  "performance",
  "data_quality",
] as const;

export type ProductionSubsystemId = (typeof PRODUCTION_SUBSYSTEMS)[number];

export type ProductionSubsystemHealth = {
  id: ProductionSubsystemId;
  label: string;
  level: ProductionHealthLevel;
  healthScore: number;
  lastSync: string | null;
  averageLatencyMs: number | null;
  failureCount: number;
  retryCount: number;
  lastError: string | null;
  recoverySuggestion: string | null;
  nextRetry: string | null;
  details: Record<string, string | number | boolean | null>;
};

export type ProductionAlertSeverity = "info" | "warning" | "critical" | "emergency";

export type ProductionAlert = {
  id: string;
  subsystemId: ProductionSubsystemId;
  severity: ProductionAlertSeverity;
  title: string;
  message: string;
  recoveryAction: string | null;
  createdAt: string;
  dismissed: boolean;
  resolved: boolean;
};

export type ProductionDataQualityExplanation = {
  score: number;
  completeness: number;
  freshness: number;
  reliability: number;
  missingConnectors: string[];
  staleConnectors: string[];
  impactChain: string[];
};

export type ProductionHealthSnapshot = {
  storeId: string;
  computedAt: string;
  aggregationDurationMs: number;
  overallLevel: ProductionHealthLevel;
  overallHealthScore: number;
  subsystems: ProductionSubsystemHealth[];
  dataQuality: ProductionDataQualityExplanation;
  alerts: ProductionAlert[];
  syncTimeline: Array<{ label: string; at: string | null; level: ProductionHealthLevel }>;
  recoveryActions: Array<{ id: string; label: string; href: string | null }>;
};

export type ProductionDashboardData = ProductionHealthSnapshot & {
  sections: {
    connectors: ProductionSubsystemHealth[];
    infrastructure: ProductionSubsystemHealth[];
    pipelines: ProductionSubsystemHealth[];
    platforms: ProductionSubsystemHealth[];
  };
  settingsBadge: {
    label: "Healthy" | "Needs Attention" | "Critical";
    tone: "success" | "warning" | "critical";
  };
};

export type ProductionNotificationRecord = ProductionAlert & {
  read: boolean;
};
