import { randomUUID, createHash } from "node:crypto";
import type {
  CreateOperationInput,
  MerchantLearningProfile,
  OperationHistoryEvent,
  OperationNotification,
  OperationsStoreSnapshot,
  StoreOperation,
} from "./operations-types";

export type OperationsPersistence = {
  loadSnapshot(storeId: string): Promise<OperationsStoreSnapshot>;
  saveSnapshot(storeId: string, snapshot: OperationsStoreSnapshot): Promise<void>;
};

function defaultLearning(): MerchantLearningProfile {
  return {
    fastCategories: [],
    delayedCategories: [],
    preferredBatchSize: 3,
    prefersEvenings: false,
    ignoresWeekends: true,
    averageCompletionMinutes: 45,
  };
}

function emptySnapshot(): OperationsStoreSnapshot {
  return {
    operations: [],
    history: [],
    notifications: [],
    learning: defaultLearning(),
  };
}

export function buildOperationKey(sourceType: string, sourceId: string): string {
  return createHash("sha256").update(`${sourceType}:${sourceId}`).digest("hex").slice(0, 32);
}

const memoryStore = new Map<string, OperationsStoreSnapshot>();

export function createInMemoryOperationsPersistence(): OperationsPersistence {
  return {
    async loadSnapshot(storeId) {
      return structuredClone(memoryStore.get(storeId) ?? emptySnapshot());
    },
    async saveSnapshot(storeId, snapshot) {
      memoryStore.set(storeId, structuredClone(snapshot));
    },
  };
}

export function createPrismaOperationsPersistence(): OperationsPersistence {
  return createInMemoryOperationsPersistence();
}

export async function loadOperationsSnapshot(
  storeId: string,
  persistence = createInMemoryOperationsPersistence(),
): Promise<OperationsStoreSnapshot> {
  return persistence.loadSnapshot(storeId);
}

export async function saveOperationsSnapshot(
  storeId: string,
  snapshot: OperationsStoreSnapshot,
  persistence = createInMemoryOperationsPersistence(),
): Promise<void> {
  await persistence.saveSnapshot(storeId, snapshot);
}

export function upsertOperationInSnapshot(input: {
  snapshot: OperationsStoreSnapshot;
  operation: StoreOperation;
  historyEvent?: OperationHistoryEvent;
  notification?: OperationNotification;
}): OperationsStoreSnapshot {
  const operations = [
    input.operation,
    ...input.snapshot.operations.filter((operation) => operation.id !== input.operation.id),
  ];

  return {
    operations,
    history: input.historyEvent ? [input.historyEvent, ...input.snapshot.history] : input.snapshot.history,
    notifications: input.notification
      ? [input.notification, ...input.snapshot.notifications]
      : input.snapshot.notifications,
    learning: input.snapshot.learning,
  };
}

export function createOperationRecord(input: {
  storeId: string;
  createInput: CreateOperationInput;
  templateId: string;
  tasks: StoreOperation["tasks"];
  checklist: string[];
  verificationRules: StoreOperation["verificationRules"];
  priority: StoreOperation["priority"];
  priorityScore: number;
}): StoreOperation {
  const now = new Date().toISOString();
  const operationKey = buildOperationKey(input.createInput.sourceType, input.createInput.sourceId);

  return {
    id: randomUUID(),
    storeId: input.storeId,
    operationKey,
    title: input.createInput.title,
    summary: input.createInput.summary ?? input.createInput.title,
    status: "pending",
    kanbanColumn: "planned",
    priority: input.priority,
    priorityScore: input.priorityScore,
    difficulty: input.createInput.difficulty ?? "Medium",
    estimatedMinutes: input.createInput.estimatedMinutes ?? 45,
    estimatedRemainingMinutes: input.createInput.estimatedMinutes ?? 45,
    owner: "merchant",
    templateId: input.templateId,
    sourceType: input.createInput.sourceType,
    sourceId: input.createInput.sourceId,
    sourceRecommendationIds: input.createInput.sourceRecommendationIds ?? [],
    agentsInvolved: input.createInput.agentsInvolved ?? [],
    progressPercent: 0,
    blockedReason: null,
    verificationStatus: "pending",
    verificationRules: input.verificationRules,
    tasks: input.tasks,
    checklist: input.checklist,
    timeline: {
      created: now,
      approved: null,
      started: null,
      paused: null,
      completed: null,
      verified: null,
      archived: null,
    },
    scheduledFor: input.createInput.scheduledFor ?? null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    verifiedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    expectedRevenueImpact: input.createInput.expectedRevenueImpact ?? 0,
    expectedInventoryImpact: input.createInput.expectedInventoryImpact ?? 0,
  };
}
