import type { CollaborationExecutiveAction } from "../ai/collaboration/collaboration-types";
import type { CreateOperationInput, OperationsCenterData, StoreOperation } from "./operations-types";
import {
  buildTasksFromTemplate,
  getWorkflowTemplate,
  inferWorkflowTemplateId,
} from "./operations-workflows";
import {
  calculateOperationPriorityScore,
  inferPriorityFromSource,
  rankOperationsQueue,
} from "./operations-priority";
import { scheduleOperationForMerchant } from "./operations-scheduler";
import {
  validateCreateOperationInput,
  validateDuplicateOperation,
} from "./operations-validator";
import {
  createOperationRecord,
  loadOperationsSnapshot,
  saveOperationsSnapshot,
  upsertOperationInSnapshot,
  type OperationsPersistence,
} from "./operations-persistence";
import { appendOperationHistory } from "./operations-history";
import { buildOperationNotification } from "./operations-notifications";
import {
  buildAchievements,
  buildOperationsCharts,
  calculateOperationsMetrics,
} from "./operations-metrics";
import { bucketOperationsByCalendar, findOverdueOperations } from "./operations-scheduler";
import { KANBAN_COLUMNS, type KanbanColumn } from "./operations-types";

export function buildOperationFromExecutiveAction(action: CollaborationExecutiveAction): CreateOperationInput {
  return {
    storeId: "",
    title: action.title,
    summary: action.summary,
    sourceType: "executive_decision",
    sourceId: action.id,
    sourceRecommendationIds: action.sourceRecommendationIds,
    agentsInvolved: action.agentsInvolved,
    templateId: inferWorkflowTemplateId({ title: action.title, category: action.group }),
    priority: inferPriorityFromSource({ priority: action.priority, risk: action.risk }),
    difficulty: action.estimatedDifficulty,
    estimatedMinutes: 45,
    expectedRevenueImpact: action.estimatedRevenueImpact,
    expectedInventoryImpact: action.estimatedInventoryImpact,
    verificationRules: action.verificationCriteria
      ? [
          {
            id: "verification_primary",
            label: action.verificationCriteria,
            metric: "primary_outcome",
            target: ">0",
            satisfied: false,
          },
        ]
      : undefined,
  };
}

export function buildOperationFromRecommendation(input: {
  storeId: string;
  recommendationId: string;
  title: string;
  summary: string;
  category: string;
  priority: number;
  agentId: string;
  expectedRevenueImpact?: number;
}): CreateOperationInput {
  return {
    storeId: input.storeId,
    title: input.title,
    summary: input.summary,
    sourceType: "recommendation",
    sourceId: input.recommendationId,
    agentsInvolved: [input.agentId],
    templateId: inferWorkflowTemplateId({ title: input.title, category: input.category }),
    priority: inferPriorityFromSource({ priority: input.priority }),
    expectedRevenueImpact: input.expectedRevenueImpact ?? 0,
  };
}

export async function buildOperationsCenterData(input: {
  storeId: string;
  persistence?: OperationsPersistence;
}): Promise<OperationsCenterData> {
  const snapshot = await loadOperationsSnapshot(input.storeId, input.persistence);
  const activeOperations = snapshot.operations.filter((operation) => operation.status !== "archived");
  const queue = rankOperationsQueue(activeOperations.filter((operation) => operation.status !== "completed"));
  const metrics = calculateOperationsMetrics(activeOperations);
  const charts = buildOperationsCharts(activeOperations, metrics);
  const calendar = bucketOperationsByCalendar(activeOperations);
  const overdue = findOverdueOperations(activeOperations);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const kanban = KANBAN_COLUMNS.reduce(
    (columns, column) => {
      columns[column] = activeOperations.filter((operation) => operation.kanbanColumn === column);
      return columns;
    },
    {} as Record<KanbanColumn, StoreOperation[]>,
  );

  return {
    inbox: {
      waitingApproval: activeOperations.filter((operation) => operation.status === "pending"),
      inProgress: activeOperations.filter((operation) => operation.status === "in_progress"),
      blocked: activeOperations.filter((operation) => operation.status === "blocked"),
      needsVerification: activeOperations.filter((operation) => operation.status === "verification"),
      completedToday: activeOperations.filter((operation) => {
        if (!operation.completedAt) return false;
        return new Date(operation.completedAt) >= todayStart;
      }),
      overdue,
    },
    queue,
    kanban,
    calendar,
    verificationQueue: activeOperations.filter((operation) => operation.status === "verification"),
    metrics,
    charts,
    history: snapshot.history.slice(0, 50),
    notifications: snapshot.notifications.slice(0, 20),
    achievements: buildAchievements(metrics),
    todayOperations: calendar.today,
  };
}

export async function createOperationRecordForStore(input: {
  createInput: CreateOperationInput;
  persistence?: OperationsPersistence;
}): Promise<StoreOperation> {
  validateCreateOperationInput(input.createInput);
  const persistence = input.persistence ?? createInMemoryOperationsPersistence();
  const snapshot = await loadOperationsSnapshot(input.createInput.storeId, persistence);
  validateDuplicateOperation(snapshot.operations, input.createInput.sourceId);

  const templateId =
    input.createInput.templateId ??
    inferWorkflowTemplateId({ title: input.createInput.title, category: input.createInput.sourceType });
  const template = getWorkflowTemplate(templateId);
  const priority =
    input.createInput.priority ?? inferPriorityFromSource({ priority: "medium" });
  const priorityScore = calculateOperationPriorityScore({
    priority,
    expectedRevenueImpact: input.createInput.expectedRevenueImpact ?? 0,
    expectedInventoryImpact: input.createInput.expectedInventoryImpact ?? 0,
    difficulty: input.createInput.difficulty ?? template.difficulty,
    dueAt: null,
    blocked: false,
    learning: snapshot.learning,
    category: template.category,
  });

  let operation = createOperationRecord({
    storeId: input.createInput.storeId,
    createInput: input.createInput,
    templateId,
    tasks: buildTasksFromTemplate(templateId),
    checklist: template.checklist,
    verificationRules: input.createInput.verificationRules ?? template.verificationRules,
    priority,
    priorityScore,
  });

  operation = scheduleOperationForMerchant({ operation, learning: snapshot.learning });

  const historyEvent = {
    id: `${operation.id}:created:${Date.now()}`,
    operationId: operation.id,
    eventType: "created",
    message: `Operation created from ${operation.sourceType}`,
    at: new Date().toISOString(),
  };

  const notification = buildOperationNotification({
    operation,
    type: "operation_created",
    title: "Operation created",
    message: `${operation.title} is waiting for approval.`,
  });

  await saveOperationsSnapshot(
    input.createInput.storeId,
    upsertOperationInSnapshot({ snapshot, operation, historyEvent, notification }),
    persistence,
  );

  return operation;
}

function createInMemoryOperationsPersistence() {
  return require("./operations-persistence").createInMemoryOperationsPersistence();
}

export async function syncOperationsFromExecutiveDecisions(input: {
  storeId: string;
  executiveActions: CollaborationExecutiveAction[];
  persistence?: OperationsPersistence;
}): Promise<StoreOperation[]> {
  const created: StoreOperation[] = [];
  for (const action of input.executiveActions) {
    try {
      const operation = await createOperationRecordForStore({
        createInput: { ...buildOperationFromExecutiveAction(action), storeId: input.storeId },
        persistence: input.persistence,
      });
      created.push(operation);
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate_operation")) continue;
      throw error;
    }
  }
  return created;
}

export { appendOperationHistory };
