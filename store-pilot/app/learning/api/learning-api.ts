import prisma from "../../db.server";
import type {
  LearningBootstrapStatus,
  LearningReadinessUiData,
} from "../shared/types";
import { LEARNING_DOMAIN_LABELS, LEARNING_STAGE_LABELS } from "../shared/types";

export async function getLearningProfile(storeId: string) {
  return prisma.storeLearningProfile.findUnique({ where: { storeId } });
}

export async function getLearningReadiness(storeId: string) {
  return prisma.learningReadiness.findUnique({ where: { storeId } });
}

export async function getLearningEta(storeId: string) {
  return prisma.learningEta.findUnique({ where: { storeId } });
}

export async function getLearningVelocities(storeId: string) {
  return prisma.learningVelocity.findMany({
    where: { storeId },
    orderBy: { domain: "asc" },
  });
}

export async function getLearningPriorities(storeId: string) {
  return prisma.learningPriority.findMany({
    where: { storeId },
    orderBy: { priorityOrder: "asc" },
  });
}

export async function getBootstrapStatus(storeId: string): Promise<LearningBootstrapStatus | null> {
  const [profile, readiness, eta] = await Promise.all([
    getLearningProfile(storeId),
    getLearningReadiness(storeId),
    getLearningEta(storeId),
  ]);

  if (!profile && !readiness) {
    return null;
  }

  return {
    storeId,
    bootstrapStatus: profile?.bootstrapStatus ?? "pending",
    profiledAt: profile?.profiledAt?.toISOString() ?? null,
    stage: readiness?.stage ?? "initializing",
    overallConfidencePercent: readiness?.overallConfidencePercent ?? 0,
    totalEstimatedMinutes: eta?.totalEstimatedMinutes ?? profile?.expectedLearningDurationMinutes ?? 0,
    estimatedCompletionAt: eta?.estimatedCompletionAt?.toISOString() ?? null,
    merchantHeadline:
      eta?.merchantHeadline ??
      "StorePilot is preparing to analyze your business history.",
  };
}

export async function getLearningReadinessForUi(
  storeId: string,
  onboardingPhase?: {
    products?: string;
    inventory?: string;
    orders?: string;
  },
): Promise<LearningReadinessUiData | null> {
  const [readiness, eta, velocities] = await Promise.all([
    getLearningReadiness(storeId),
    getLearningEta(storeId),
    getLearningVelocities(storeId),
  ]);

  if (!readiness) {
    return null;
  }

  const velocityByDomain = new Map(velocities.map((row) => [row.domain, row]));
  const domainConfidence: Array<{
    domain: keyof typeof LEARNING_DOMAIN_LABELS;
    confidence: number;
  }> = [
    { domain: "inventory", confidence: readiness.inventoryConfidence },
    { domain: "products", confidence: readiness.productsConfidence },
    { domain: "pricing", confidence: readiness.pricingConfidence },
    { domain: "seo", confidence: readiness.seoConfidence },
    { domain: "collections", confidence: readiness.collectionsConfidence },
    { domain: "operations", confidence: readiness.operationsConfidence },
    { domain: "seasonality", confidence: readiness.seasonalityConfidence },
  ];

  return {
    stage: readiness.stage,
    stageLabel: LEARNING_STAGE_LABELS[readiness.stage],
    overallConfidencePercent: readiness.overallConfidencePercent,
    merchantMessage: readiness.merchantMessage,
    stageExplanation: readiness.stageExplanation,
    estimatedCompletionMinutes: eta?.totalEstimatedMinutes ?? 0,
    estimatedCompletionAt: eta?.estimatedCompletionAt?.toISOString() ?? null,
    historyMonthsDisplay: eta?.historyMonthsDisplay ?? 12,
    merchantHeadline:
      eta?.merchantHeadline ?? "StorePilot is analyzing your business history.",
    domains: domainConfidence.map(({ domain, confidence }) => {
      const velocity = velocityByDomain.get(domain);
      return {
        domain,
        label: LEARNING_DOMAIN_LABELS[domain],
        confidencePercent: confidence,
        velocity: velocity?.velocity ?? "medium",
        statusLabel: velocity?.statusLabel ?? "Learning",
      };
    }),
    importSteps: buildImportSteps(readiness.stage, onboardingPhase),
    executiveCooReady: readiness.executiveCooReady,
    predictionReady: readiness.predictionReady,
    experimentReady: readiness.experimentReady,
    merchantIntelligenceReady: readiness.merchantIntelligenceReady,
  };
}

function buildImportSteps(
  stage: LearningReadinessUiData["stage"],
  onboardingPhase?: {
    products?: string;
    inventory?: string;
    orders?: string;
  },
): LearningReadinessUiData["importSteps"] {
  const mapStatus = (phase?: string): "pending" | "running" | "complete" => {
    if (phase === "completed") return "complete";
    if (phase === "running" || phase === "queued") return "running";
    return "pending";
  };

  const businessDnaStatus: "pending" | "running" | "complete" =
    stage === "initializing" || stage === "historical_import"
      ? "running"
      : stage === "learning"
        ? "running"
        : "pending";

  return [
    { key: "products", label: "Products", status: mapStatus(onboardingPhase?.products) },
    { key: "orders", label: "Orders", status: mapStatus(onboardingPhase?.orders) },
    { key: "inventory", label: "Inventory", status: mapStatus(onboardingPhase?.inventory) },
    { key: "collections", label: "Collections", status: mapStatus(onboardingPhase?.products) },
    { key: "business_dna", label: "Business DNA", status: businessDnaStatus },
  ];
}
