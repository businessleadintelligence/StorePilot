import type { z } from "zod";

export type RecommendationCandidate = {
  category: string;
  title: string;
  summary: string;
  priority: number;
  confidence: number;
  payload?: Record<string, unknown>;
};

export type RecommendationExtractionInput<TOutput> = {
  agentId: string;
  subjectKey: string;
  output: TOutput;
};

export type RecommendationExtractor<TOutput> = (
  input: RecommendationExtractionInput<TOutput>,
) => RecommendationCandidate[];

export function validateRecommendationCandidate(candidate: RecommendationCandidate): void {
  if (!candidate.title.trim()) {
    throw new Error("recommendation_title_required");
  }

  if (!candidate.summary.trim()) {
    throw new Error("recommendation_summary_required");
  }

  if (!Number.isFinite(candidate.priority) || candidate.priority < 1 || candidate.priority > 5) {
    throw new Error("recommendation_priority_out_of_range");
  }

  if (
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new Error("recommendation_confidence_out_of_range");
  }
}

export function validateRecommendations(candidates: RecommendationCandidate[]): void {
  for (const candidate of candidates) {
    validateRecommendationCandidate(candidate);
  }
}

export function extractRecommendationsFromSchemaOutput(
  output: Record<string, unknown>,
): RecommendationCandidate[] {
  const recommendations = output.recommendations;
  if (!Array.isArray(recommendations)) {
    return [];
  }

  return recommendations
    .map((entry): RecommendationCandidate | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return {
        category: String(record.category ?? record.id ?? "general"),
        title: String(record.title ?? record.action ?? "Recommendation"),
        summary: String(record.rationale ?? record.action ?? record.detail ?? ""),
        priority: Number(record.priority ?? 3),
        confidence: Number(record.confidence ?? 0.5),
        payload: record,
      };
    })
    .filter((entry): entry is RecommendationCandidate => entry !== null);
}

export type RecommendationValidator<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  extract: RecommendationExtractor<z.infer<TSchema>>;
};
