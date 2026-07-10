import type {
  DailyOperatingPlanPayload,
  DecisionCardPayload,
  ExecutiveBriefingPayload,
} from "./shared/types";

export type ExecutiveDashboardUiData = {
  briefing: ExecutiveBriefingPayload | null;
  operatingPlan: DailyOperatingPlanPayload | null;
  decisionCards: DecisionCardPayload[];
  operationalReadinessScore: number;
  executiveCooReady: boolean;
  currency: string;
};

export {
  getExecutiveBriefing,
  getDailyOperatingPlan,
  getExecutiveDecisions,
  getOperationsQueue,
  getOperationalReadiness,
  getBusinessContext,
  getDecisionCards,
  getDecisionTimeline,
} from "./api/executive-api";

export {
  runExecutiveDecisionEngine,
} from "./decision-engine/decision-engine";

export {
  scheduleExecutiveDecisionJob,
  scheduleExecutiveCooJob,
  executeExecutiveDecisionJob,
  executeExecutiveCooGenerateJob,
} from "./scheduler/executive-scheduler";

export { runExecutiveCoo } from "./coo/coo-service";

export { buildBusinessContext } from "./business-context/business-context-builder";
export { computeOperationalReadiness } from "./executive-score/operational-readiness";

export type {
  ExecutiveDecisionRecord,
  BusinessContextPayload,
  ExecutiveBriefingPayload,
  DailyOperatingPlanPayload,
  DecisionCardPayload,
} from "./shared/types";
