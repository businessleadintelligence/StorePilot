import type {
  CollaborationContext,
  CollaborationImpactMetrics,
  CollaborationMemoryState,
  CollaborationRecommendationInput,
  CollaborationSourceAgent,
} from "./collaboration-types";
import { COLLABORATION_SOURCE_AGENTS } from "./collaboration-types";
import { parseProductIdFromSubjectKey } from "./collaboration-utils";

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter(Boolean);
}

function parseImpact(payload: Record<string, unknown>): CollaborationImpactMetrics {
  const impact =
    (payload.estimatedImpactMetrics as Record<string, unknown> | undefined) ??
    (payload.estimatedImpact as Record<string, unknown> | undefined) ??
    {};

  return {
    revenueOpportunity: decimalToNumber(impact.revenueOpportunity),
    revenueRecovered: decimalToNumber(impact.revenueRecovered ?? impact.revenueOpportunity),
    inventoryReduction: decimalToNumber(impact.inventoryCostSaved ?? impact.inventoryReduction),
    conversionLift: decimalToNumber(impact.marginImprovement ?? impact.demandLift),
    ordersProtected: decimalToNumber(impact.ordersProtected ?? impact.unitsProtected),
  };
}

function mapRecommendationRecord(record: {
  stableId: string;
  agentId: string;
  subjectKey: string;
  title: string;
  summary: string;
  category: string;
  priority: number;
  confidence: unknown;
  status: string;
  payloadJson: unknown;
  productTitle?: string | null;
}): CollaborationRecommendationInput | null {
  if (!COLLABORATION_SOURCE_AGENTS.includes(record.agentId as CollaborationSourceAgent)) {
    return null;
  }

  const payload = (record.payloadJson as Record<string, unknown> | null) ?? {};
  const productId = parseProductIdFromSubjectKey(record.subjectKey);

  return {
    stableId: record.stableId,
    recommendationId: String(payload.id ?? record.stableId),
    agentId: record.agentId as CollaborationSourceAgent,
    subjectKey: record.subjectKey,
    productId,
    productTitle: record.productTitle ?? null,
    title: record.title,
    reason: String(payload.reason ?? record.summary),
    category: record.category,
    group: String(payload.group ?? record.category),
    priority: record.priority,
    priorityScore: decimalToNumber(payload.priorityScore),
    confidence: decimalToNumber(payload.confidence ?? record.confidence),
    difficulty: String(payload.difficulty ?? payload.estimatedDifficulty ?? "Medium"),
    status: record.status,
    evidence: asStringArray(payload.evidence),
    evidenceKeys: asStringArray(payload.evidenceKeys),
    merchantAction: asStringArray(payload.merchantAction),
    expectedResult: String(payload.expectedResult ?? ""),
    estimatedImpact: parseImpact(payload),
    verificationCriteria: String(payload.verificationCriteria ?? ""),
    timeline: String(payload.timeline ?? payload.estimatedTime ?? ""),
  };
}

export function buildCollaborationMemoryFromRecords(
  records: Array<{ status: string; payloadJson: unknown; stableId: string }>,
): CollaborationMemoryState {
  const memory: CollaborationMemoryState = {
    implementedIds: new Set(),
    dismissedIds: new Set(),
    ignoredIds: new Set(),
    snoozedIds: new Set(),
    openIds: new Set(),
    implementedExecutiveIds: new Set(),
    dismissedExecutiveIds: new Set(),
    merchantPreferences: {},
  };

  for (const record of records) {
    const payload = (record.payloadJson as Record<string, unknown> | null) ?? {};
    const recommendationId = String(payload.id ?? record.stableId);
    const executiveId = String(payload.executiveActionId ?? "");
    const status = record.status.toLowerCase();

    if (status === "implemented" || status === "verified" || status === "closed") {
      memory.implementedIds.add(recommendationId);
      if (executiveId) memory.implementedExecutiveIds.add(executiveId);
    }
    if (status === "dismissed") {
      memory.dismissedIds.add(recommendationId);
      if (executiveId) memory.dismissedExecutiveIds.add(executiveId);
    }
    if (status === "open" || status === "viewed") {
      memory.openIds.add(recommendationId);
    }
    if (payload.snoozedUntil) {
      memory.snoozedIds.add(recommendationId);
    }
    if (payload.feedback === "ignore") {
      memory.ignoredIds.add(recommendationId);
    }
  }

  return memory;
}

export type CollaborationContextLoader = {
  loadCollaborationContext(input: { storeId: string }): Promise<CollaborationContext>;
};

export function mapAgentResultSnapshot(record: {
  agentId: string;
  subjectKey: string;
  summary: string | null;
  confidence: unknown;
  resultJson: unknown;
  createdAt: Date;
}): CollaborationContext["agentResults"][number] | null {
  if (!COLLABORATION_SOURCE_AGENTS.includes(record.agentId as CollaborationSourceAgent)) {
    return null;
  }

  const resultJson = (record.resultJson as Record<string, unknown> | null) ?? {};
  const healthScore =
    resultJson.healthScore ??
    resultJson.trendHealthScore ??
    resultJson.storeHealthScore ??
    resultJson.inventoryHealthScore ??
    resultJson.bundleHealthScore ??
    null;

  return {
    agentId: record.agentId as CollaborationSourceAgent,
    subjectKey: record.subjectKey,
    summary: record.summary,
    healthScore: healthScore == null ? null : decimalToNumber(healthScore),
    confidence: record.confidence == null ? null : decimalToNumber(record.confidence),
    resultJson,
    createdAt: record.createdAt.toISOString(),
  };
}

export function buildCollaborationContextFromInputs(input: {
  storeId: string;
  recommendations: CollaborationRecommendationInput[];
  agentResults: CollaborationContext["agentResults"];
  memory: CollaborationMemoryState;
  storeMetrics: CollaborationContext["storeMetrics"];
}): CollaborationContext {
  return {
    storeId: input.storeId,
    subjectKey: `collaboration:${input.storeId}`,
    computedAt: new Date().toISOString(),
    recommendations: input.recommendations.filter(
      (item) =>
        ["open", "viewed"].includes(item.status) &&
        !input.memory.implementedIds.has(item.recommendationId) &&
        !input.memory.dismissedIds.has(item.recommendationId) &&
        !input.memory.snoozedIds.has(item.recommendationId),
    ),
    agentResults: input.agentResults,
    memory: input.memory,
    storeMetrics: input.storeMetrics,
  };
}

export { mapRecommendationRecord };
