import { buildRecommendationStableId } from "../cache/fingerprint";
import type { RecommendationCandidate } from "../validation/recommendation-validator";
import type { RecommendationRepository } from "../persistence/types";
import type { RecommendationEngine } from "./types";

export function createRecommendationEngineFromRepository(
  repository: RecommendationRepository,
): RecommendationEngine {
  return {
    upsertMany: async (input) => {
      const records = await repository.upsertMany(
        input.map((entry) => ({
          ...entry,
          status: "open",
        })),
      );

      return records.map((record) => ({
        storeId: record.storeId,
        agentId: record.agentId,
        runId: record.runId,
        subjectKey: record.subjectKey,
        stableId: record.stableId,
        title: record.title,
        summary: record.summary,
        category: record.category,
        priority: record.priority,
        confidence: record.confidence,
        payloadJson: record.payloadJson,
      }));
    },
    updateStatus: async (input) => {
      await repository.updateStatus(input);
    },
    listOpen: async (input) => {
      const records = await repository.listBySubject({
        storeId: input.storeId,
        subjectKey: input.subjectKey,
        statuses: ["open", "viewed"],
      });

      return records.map((record) => ({
        storeId: record.storeId,
        agentId: record.agentId,
        runId: record.runId,
        subjectKey: record.subjectKey,
        stableId: record.stableId,
        title: record.title,
        summary: record.summary,
        category: record.category,
        priority: record.priority,
        confidence: record.confidence,
        payloadJson: record.payloadJson,
      }));
    },
  };
}

export function mapCandidatesToRecommendations(input: {
  storeId: string;
  agentId: string;
  runId: string;
  subjectKey: string;
  candidates: RecommendationCandidate[];
}) {
  return input.candidates.map((candidate) => ({
    storeId: input.storeId,
    agentId: input.agentId,
    runId: input.runId,
    subjectKey: input.subjectKey,
    stableId: buildRecommendationStableId({
      storeId: input.storeId,
      agentId: input.agentId,
      subjectKey: input.subjectKey,
      category: candidate.category,
      title: candidate.title,
    }),
    title: candidate.title,
    summary: candidate.summary,
    category: candidate.category,
    priority: candidate.priority,
    confidence: candidate.confidence,
    payloadJson: candidate.payload ?? {},
  }));
}
