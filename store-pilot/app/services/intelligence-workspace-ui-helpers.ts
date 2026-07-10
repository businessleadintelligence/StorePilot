import { WORKSPACE_ROUTES } from "../intelligence-ui/constants";
import type {
  ActionCenterItem,
  CrossLinkView,
  EvidenceItemView,
  IntelligenceEntityView,
} from "../intelligence-ui/types";

export function jsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function evidenceFromIds(ids: string[], source: string): EvidenceItemView[] {
  return ids.map((id) => ({ id, label: id, source }));
}

export function defaultRelatedLinks(): CrossLinkView[] {
  return [
    { label: "Root Causes", href: WORKSPACE_ROUTES.rootCauses },
    { label: "Predictions", href: WORKSPACE_ROUTES.predictions },
    { label: "Experiments", href: WORKSPACE_ROUTES.experiments },
    { label: "Knowledge Graph", href: WORKSPACE_ROUTES.knowledgeGraph },
    { label: "Merchant Profile", href: WORKSPACE_ROUTES.merchantIntelligence },
    { label: "Timeline", href: WORKSPACE_ROUTES.timeline },
  ];
}

type NumericLike = number | string | { toString(): string };

type ExecutiveDecisionRow = {
  id: string;
  title: string;
  recommendation: string;
  confidence: NumericLike;
  estimatedRevenueImpact: NumericLike;
  severity: string;
  evidenceIds: unknown;
  graphNodeIds: unknown;
};

export function buildExecutiveEntities(decisions: ExecutiveDecisionRow[]): IntelligenceEntityView[] {
  return decisions.slice(0, 6).map((decision) => ({
    id: decision.id,
    entityType: "Executive Decision",
    title: decision.title,
    summary: decision.recommendation,
    confidencePercent: Math.round(Number(decision.confidence) * 100),
    revenueImpact: Number(decision.estimatedRevenueImpact),
    severity: decision.severity,
    evidenceIds: jsonArray(decision.evidenceIds),
    graphNodeIds: jsonArray(decision.graphNodeIds),
    memoryIds: [],
    relatedLinks: defaultRelatedLinks(),
  }));
}

export function buildExecutiveActions(decisions: ExecutiveDecisionRow[]): ActionCenterItem[] {
  return decisions.slice(0, 5).map((decision) => ({
    id: decision.id,
    title: decision.title,
    description: decision.recommendation,
    entityType: "decision",
    entityId: decision.id,
    confidencePercent: Math.round(Number(decision.confidence) * 100),
    revenueImpact: Number(decision.estimatedRevenueImpact),
  }));
}

type ExperimentUiRow = {
  experimentId: string;
  title: string;
  proposedChange: string;
  status: string;
  confidencePercent: number;
  expectedMonthlyGain: number;
};

export function buildExperimentActions(items: ExperimentUiRow[]): ActionCenterItem[] {
  return items
    .filter((item) => item.status === "shadow_simulated" || item.status === "suggested")
    .slice(0, 8)
    .map((item) => ({
      id: item.experimentId,
      title: item.title,
      description: item.proposedChange,
      entityType: "experiment",
      entityId: item.experimentId,
      confidencePercent: item.confidencePercent,
      revenueImpact: item.expectedMonthlyGain,
    }));
}
