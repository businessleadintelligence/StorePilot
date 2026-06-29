export const AUTOMATION_STATUSES = [
  "draft",
  "prepared",
  "waiting_approval",
  "approved",
  "executing",
  "executed",
  "verifying",
  "verified",
  "archived",
  "cancelled",
] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export type AutomationRiskLevel = "low" | "medium" | "high" | "critical";

export type AutomationSourceType = "operation" | "executive_decision" | "recommendation";

export type AutomationPreviewChange = {
  field: string;
  before: string | null;
  after: string;
};

export type AutomationPreview = {
  title: string;
  summary: string;
  products: string[];
  expectedChanges: AutomationPreviewChange[];
  estimatedTimeSavedMinutes: number;
  noChangesExecuted: true;
};

export type AutomationRollbackPlan = {
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  rollbackSteps: string[];
};

export type AutomationVerificationRule = {
  id: string;
  label: string;
  metric: string;
  target: string;
  satisfied: boolean;
};

export type AutomationTimeline = {
  created: string | null;
  prepared: string | null;
  waitingApproval: string | null;
  approved: string | null;
  executing: string | null;
  executed: string | null;
  verifying: string | null;
  verified: string | null;
  archived: string | null;
  cancelled: string | null;
};

export type StoreAutomation = {
  id: string;
  storeId: string;
  automationKey: string;
  title: string;
  summary: string;
  status: AutomationStatus;
  templateId: string;
  sourceType: AutomationSourceType;
  sourceId: string;
  operationId: string | null;
  riskLevel: AutomationRiskLevel;
  riskFactors: string[];
  preview: AutomationPreview;
  rollbackPlan: AutomationRollbackPlan;
  verificationRules: AutomationVerificationRule[];
  approvalRequired: true;
  merchantApproved: boolean;
  merchantRejected: boolean;
  changeRequestNote: string | null;
  timeline: AutomationTimeline;
  estimatedTimeSavedMinutes: number;
  revenueInfluenced: number;
  createdAt: string;
  updatedAt: string;
};

export type AutomationHistoryEvent = {
  id: string;
  automationId: string;
  eventType: string;
  message: string;
  at: string;
  payload?: Record<string, unknown>;
};

export type AutomationNotification = {
  id: string;
  automationId: string;
  type: string;
  title: string;
  message: string;
  at: string;
  read: boolean;
};

export type AutomationLearningProfile = {
  approvedCategories: string[];
  rejectedCategories: string[];
  delayedCategories: string[];
  preferredTemplates: string[];
  approvalRate: number;
};

export type AutomationStoreSnapshot = {
  automations: StoreAutomation[];
  history: AutomationHistoryEvent[];
  notifications: AutomationNotification[];
  learning: AutomationLearningProfile;
};

export type CreateAutomationInput = {
  storeId: string;
  title: string;
  summary?: string;
  templateId?: string;
  sourceType: AutomationSourceType;
  sourceId: string;
  operationId?: string | null;
  products?: string[];
  payload?: Record<string, unknown>;
  revenueInfluenced?: number;
};

export type AutomationMetrics = {
  automationsPrepared: number;
  automationsApproved: number;
  approvalRate: number;
  executionRate: number;
  verificationRate: number;
  merchantTimeSavedMinutes: number;
  revenueInfluenced: number;
  operationsAutomated: number;
  merchantApprovalRate: number;
};

export type AutomationChartData = {
  successRate: Array<{ label: string; value: number }>;
  approvalFunnel: Array<{ label: string; value: number }>;
  executionTimeline: Array<{ label: string; value: number }>;
  riskDistribution: Array<{ label: string; value: number }>;
  automationTypes: Array<{ label: string; value: number }>;
  verificationSuccess: Array<{ label: string; value: number }>;
  automationHeatmap: Array<{ label: string; value: number }>;
  timeSaved: Array<{ label: string; value: number }>;
  roiDelivered: Array<{ label: string; value: number }>;
  merchantApprovalRate: Array<{ label: string; value: number }>;
};

export type AutomationCenterData = {
  pendingApprovals: StoreAutomation[];
  automationQueue: StoreAutomation[];
  executionTimeline: AutomationHistoryEvent[];
  verificationQueue: StoreAutomation[];
  automationHistory: AutomationHistoryEvent[];
  riskAnalysis: Array<{ automationId: string; title: string; riskLevel: AutomationRiskLevel; factors: string[] }>;
  metrics: AutomationMetrics;
  charts: AutomationChartData;
  notifications: AutomationNotification[];
};
