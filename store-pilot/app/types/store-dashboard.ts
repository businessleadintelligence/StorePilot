export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export type StoreHealthScore = {
  score: number;
  grade: HealthGrade;
  productsScore: number;
  inventoryScore: number;
  ordersScore: number;
  issues: string[];
};

export type StoreMetrics = {
  products: number;
  activeProducts: number;
  orders: number;
  grossRevenue: number;
  averageOrderValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryUnits: number;
};

export type ExecutiveBriefMetrics = {
  products: number;
  orders: number;
  grossRevenue: number;
  healthScore: number;
  grade: HealthGrade;
};

export type ExecutiveBrief = {
  headline: string;
  summary: string;
  metrics: ExecutiveBriefMetrics;
  highlights: string[];
  concerns: string[];
};

export type FounderOperationsSnapshot = {
  stores: {
    totalStores: number;
    activeStores: number;
    inactiveStores: number;
  };
  onboarding: {
    completed: number;
    running: number;
    failed: number;
    blocked: number;
    notStarted: number;
  };
  jobs: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    deadLetter: number;
  };
  webhooks: {
    processed: number;
    failed: number;
    pending: number;
  };
  workers: {
    staleJobs: number;
    stuckOnboarding: number;
    expiredLocks: number;
  };
  startupReadiness: {
    ready: boolean;
    checks: Array<{ id: string; ok: boolean; reason?: string }>;
  };
};

export type GoogleIntegrationPublicView = {
  connected: boolean;
  configured: boolean;
  email: string | null;
  analyticsPropertyId: string | null;
  analyticsPropertyName: string | null;
  searchConsoleSiteUrl: string | null;
  searchConsoleSiteName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  searchConsoleLastSyncAt: string | null;
  pageSpeedLastSyncAt: string | null;
  pageSpeedAvailable: boolean;
  isActive: boolean;
  needsPropertySelection: boolean;
  needsSearchConsolePropertySelection: boolean;
  googleAnalyticsSkipped: boolean;
};

export type StoreInsight = {
  id: string;
  category: "inventory" | "orders" | "products" | "health" | "onboarding";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
};

export type StoreInsightsResult = {
  insights: StoreInsight[];
};

export type StoreRecommendation = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  category: "inventory" | "orders" | "products" | "setup" | "health";
};

export type StoreRecommendationsResult = {
  recommendations: StoreRecommendation[];
  critical: number;
  warning: number;
  info: number;
};
