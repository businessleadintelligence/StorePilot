export * from "./store-audit-intelligence";

import { z } from "zod";
import {
  storeAuditIntelligenceEnrichedSchema,
  storeAuditIntelligenceSchema,
} from "./store-audit-intelligence";

export const storeAuditEnrichedOutputSchema = storeAuditIntelligenceEnrichedSchema.extend({
  overallAuditScore: z.number().int().min(0).max(100),
  quickWins: z.array(z.string().min(1)),
  criticalIssues: z.array(z.string().min(1)),
  longTermImprovements: z.array(z.string().min(1)),
  estimatedRevenueImpact: z.number().min(0),
  estimatedConversionImpact: z.number().min(0),
  navigationScore: z.number().int().min(0).max(100),
  trustScore: z.number().int().min(0).max(100),
  imageOptimizationScore: z.number().int().min(0).max(100),
  technicalSeoScore: z.number().int().min(0).max(100),
  policyScore: z.number().int().min(0).max(100),
  appBloatScore: z.number().int().min(0).max(100),
  merchantBestPracticesScore: z.number().int().min(0).max(100),
});

export type StoreAuditEnrichedOutput = z.infer<typeof storeAuditEnrichedOutputSchema>;

export function buildStoreAuditDeliverableFields(input: {
  storeHealthScore: number;
  navigationScore: number;
  trustScore: number;
  imageOptimizationScore: number;
  technicalSeoScore: number;
  policyScore: number;
  appBloatScore: number;
  merchantBestPracticesScore: number;
  recommendations: Array<{ id: string; title: string; group: string; priority: number }>;
  findings: Array<{ title: string; severity: string }>;
}): Pick<
  StoreAuditEnrichedOutput,
  | "overallAuditScore"
  | "quickWins"
  | "criticalIssues"
  | "longTermImprovements"
  | "estimatedRevenueImpact"
  | "estimatedConversionImpact"
  | "navigationScore"
  | "trustScore"
  | "imageOptimizationScore"
  | "technicalSeoScore"
  | "policyScore"
  | "appBloatScore"
  | "merchantBestPracticesScore"
> {
  const quickWins = input.recommendations
    .filter((item) => item.group === "Quick Wins")
    .map((item) => item.title);
  const criticalIssues = input.findings
    .filter((item) => item.severity === "critical" || item.severity === "high")
    .map((item) => item.title);
  const longTermImprovements = input.recommendations
    .filter((item) => item.group === "Long-Term CRO")
    .map((item) => item.title);

  return {
    overallAuditScore: input.storeHealthScore,
    quickWins,
    criticalIssues,
    longTermImprovements,
    estimatedRevenueImpact: input.recommendations.reduce(
      (total, item) => total + Math.max(0, 6 - item.priority) * 2500,
      0,
    ),
    estimatedConversionImpact: Number(
      (
        input.recommendations.reduce((total, item) => total + Math.max(0, 6 - item.priority) * 0.4, 0) /
        Math.max(1, input.recommendations.length)
      ).toFixed(2),
    ),
    navigationScore: input.navigationScore,
    trustScore: input.trustScore,
    imageOptimizationScore: input.imageOptimizationScore,
    technicalSeoScore: input.technicalSeoScore,
    policyScore: input.policyScore,
    appBloatScore: input.appBloatScore,
    merchantBestPracticesScore: input.merchantBestPracticesScore,
  };
}

export { storeAuditIntelligenceSchema as storeAuditIntelligenceDeliverableSchema };
