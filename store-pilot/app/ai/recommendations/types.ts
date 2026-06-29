export type RecommendationStatus =
  | "open"
  | "viewed"
  | "implemented"
  | "dismissed"
  | "verified"
  | "closed";

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  "open",
  "viewed",
  "implemented",
  "dismissed",
  "verified",
  "closed",
];

export type RecommendationUpsertInput = {
  storeId: string;
  agentId: string;
  runId: string;
  subjectKey: string;
  stableId: string;
  title: string;
  summary: string;
  category: string;
  priority: number;
  confidence: number;
  payloadJson: Record<string, unknown>;
};

export type RecommendationEngine = {
  upsertMany(input: RecommendationUpsertInput[]): Promise<RecommendationUpsertInput[]>;
  updateStatus(input: {
    storeId: string;
    stableId: string;
    status: RecommendationStatus;
  }): Promise<void>;
  listOpen(input: { storeId: string; subjectKey: string }): Promise<RecommendationUpsertInput[]>;
};

export function createRecommendationEngine(deps: {
  upsertMany: RecommendationEngine["upsertMany"];
  updateStatus: RecommendationEngine["updateStatus"];
  listOpen: RecommendationEngine["listOpen"];
}): RecommendationEngine {
  return deps;
}
