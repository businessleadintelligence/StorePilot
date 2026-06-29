export const OPERATION_STATUSES = [
  "pending",
  "approved",
  "in_progress",
  "paused",
  "blocked",
  "verification",
  "completed",
  "verified",
  "archived",
] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const KANBAN_COLUMNS = [
  "planned",
  "approved",
  "in_progress",
  "blocked",
  "verification",
  "completed",
] as const;

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export type OperationPriority = "critical" | "high" | "medium" | "low";

export type OperationSourceType =
  | "executive_decision"
  | "collaboration"
  | "recommendation";

export type OperationTask = {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  order: number;
};

export type OperationVerificationRule = {
  id: string;
  label: string;
  metric: string;
  target: string;
  satisfied: boolean;
};

export type OperationTimeline = {
  created: string | null;
  approved: string | null;
  started: string | null;
  paused: string | null;
  completed: string | null;
  verified: string | null;
  archived: string | null;
};

export type StoreOperation = {
  id: string;
  storeId: string;
  operationKey: string;
  title: string;
  summary: string;
  status: OperationStatus;
  kanbanColumn: KanbanColumn;
  priority: OperationPriority;
  priorityScore: number;
  difficulty: string;
  estimatedMinutes: number;
  estimatedRemainingMinutes: number;
  owner: string;
  templateId: string;
  sourceType: OperationSourceType;
  sourceId: string;
  sourceRecommendationIds: string[];
  agentsInvolved: string[];
  progressPercent: number;
  blockedReason: string | null;
  verificationStatus: "pending" | "passed" | "failed";
  verificationRules: OperationVerificationRule[];
  tasks: OperationTask[];
  checklist: string[];
  timeline: OperationTimeline;
  scheduledFor: string | null;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expectedRevenueImpact: number;
  expectedInventoryImpact: number;
};

export type OperationHistoryEvent = {
  id: string;
  operationId: string;
  eventType: string;
  message: string;
  at: string;
  payload?: Record<string, unknown>;
};

export type OperationNotification = {
  id: string;
  operationId: string;
  type: string;
  title: string;
  message: string;
  at: string;
  read: boolean;
};

export type MerchantLearningProfile = {
  fastCategories: string[];
  delayedCategories: string[];
  preferredBatchSize: number;
  prefersEvenings: boolean;
  ignoresWeekends: boolean;
  averageCompletionMinutes: number;
};

export type OperationsStoreSnapshot = {
  operations: StoreOperation[];
  history: OperationHistoryEvent[];
  notifications: OperationNotification[];
  learning: MerchantLearningProfile;
};

export type OperationsInboxSection = {
  waitingApproval: StoreOperation[];
  inProgress: StoreOperation[];
  blocked: StoreOperation[];
  needsVerification: StoreOperation[];
  completedToday: StoreOperation[];
  overdue: StoreOperation[];
};

export type OperationsCalendarBucket = {
  today: StoreOperation[];
  tomorrow: StoreOperation[];
  thisWeek: StoreOperation[];
  later: StoreOperation[];
};

export type OperationsMetrics = {
  executionRate: number;
  completionRate: number;
  verificationSuccessRate: number;
  averageCompletionMinutes: number;
  revenueGenerated: number;
  inventoryReduced: number;
  merchantProductivity: number;
};

export type OperationsChartData = {
  burnDown: Array<{ label: string; value: number }>;
  completionVelocity: Array<{ label: string; value: number }>;
  verificationFunnel: Array<{ label: string; value: number }>;
  executionHeatmap: Array<{ label: string; value: number }>;
  kanbanFlow: Array<{ label: string; value: number }>;
  revenueDelivered: Array<{ label: string; value: number }>;
  timeAllocation: Array<{ label: string; value: number }>;
  productivityTrend: Array<{ label: string; value: number }>;
  capacityGauge: Array<{ label: string; value: number }>;
  weeklyProgress: Array<{ label: string; value: number }>;
};

export type OperationsCenterData = {
  inbox: OperationsInboxSection;
  queue: StoreOperation[];
  kanban: Record<KanbanColumn, StoreOperation[]>;
  calendar: OperationsCalendarBucket;
  verificationQueue: StoreOperation[];
  metrics: OperationsMetrics;
  charts: OperationsChartData;
  history: OperationHistoryEvent[];
  notifications: OperationNotification[];
  achievements: string[];
  todayOperations: StoreOperation[];
};

export type CreateOperationInput = {
  storeId: string;
  title: string;
  summary?: string;
  sourceType: OperationSourceType;
  sourceId: string;
  sourceRecommendationIds?: string[];
  agentsInvolved?: string[];
  templateId?: string;
  priority?: OperationPriority;
  difficulty?: string;
  estimatedMinutes?: number;
  verificationRules?: OperationVerificationRule[];
  expectedRevenueImpact?: number;
  expectedInventoryImpact?: number;
  scheduledFor?: string | null;
};
