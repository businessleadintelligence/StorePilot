import { buildSubjectKey } from "../ai/cache/fingerprint";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AgentId } from "../ai/agents/agent-definition";

const persistence = createPrismaAIPersistence();

export async function getLatestAgentResult(input: {
  storeId: string;
  agentId: AgentId | string;
  subjectKey?: string;
  context?: Record<string, unknown>;
  inputFingerprint?: string;
}) {
  const subjectKey =
    input.subjectKey ??
    (input.context ? buildSubjectKey(String(input.agentId), input.context) : undefined);

  if (!input.inputFingerprint || !subjectKey) {
    return null;
  }

  return persistence.results.findLatestSuccess({
    storeId: input.storeId,
    agentId: String(input.agentId),
    inputFingerprint: input.inputFingerprint,
  });
}

export async function getAgentRunById(runId: string) {
  return persistence.runs.findById(runId);
}

export async function listRecommendationsForSubject(input: {
  storeId: string;
  subjectKey: string;
  statuses?: string[];
}) {
  return persistence.recommendations.listBySubject(input);
}

export async function updateRecommendationStatus(input: {
  storeId: string;
  stableId: string;
  status: string;
}) {
  return persistence.recommendations.updateStatus(input);
}

export { buildSubjectKey };
