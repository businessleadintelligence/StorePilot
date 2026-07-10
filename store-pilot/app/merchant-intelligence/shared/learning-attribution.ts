import type { LearningUpdateType, MerchantActionType } from "@prisma/client";

import type { LearningAttributionRecord } from "../shared/types";

export function buildLearningAttribution(input: {
  attributionKey: string;
  businessOutcome: string;
  journalKey: string;
  evidenceIds: string[];
  graphNodeIds: string[];
  merchantAction: MerchantActionType;
  learningUpdateType: LearningUpdateType;
  memoryVersionNumber: number;
  dnaVersionNumber: number;
  futureImpact?: Record<string, unknown>;
}): LearningAttributionRecord {
  return {
    attributionKey: input.attributionKey,
    businessOutcome: input.businessOutcome,
    journalKey: input.journalKey,
    evidenceIds: input.evidenceIds,
    graphNodeIds: input.graphNodeIds,
    merchantAction: input.merchantAction,
    learningUpdateType: input.learningUpdateType,
    memoryVersionNumber: input.memoryVersionNumber,
    dnaVersionNumber: input.dnaVersionNumber,
    attributionJson: {
      chain: [
        "Business Outcome",
        "Decision Journal Entry",
        "Evidence IDs",
        "Knowledge Graph Nodes",
        "Merchant Action",
        "Learning Update",
        "Business Memory Version",
        "Future Recommendation",
      ],
      futureImpact: input.futureImpact ?? {},
      createdAt: new Date().toISOString(),
    },
  };
}

export function formatAttributionChain(attribution: LearningAttributionRecord): string[] {
  return [
    `Outcome: ${attribution.businessOutcome}`,
    `Journal: ${attribution.journalKey}`,
    `Evidence: ${attribution.evidenceIds.length} items`,
    `Graph nodes: ${attribution.graphNodeIds.length}`,
    `Action: ${attribution.merchantAction}`,
    `Update: ${attribution.learningUpdateType}`,
    `Memory v${attribution.memoryVersionNumber}`,
    `DNA v${attribution.dnaVersionNumber}`,
  ];
}
