import { AIPlatformError } from "../core/ai-errors";
import { COLLABORATION_SOURCE_AGENTS } from "../collaboration/collaboration-types";
import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";
import {
  EXECUTIVE_COO_FOCUS_AREAS,
  executiveCooEnrichedSchema,
  type ExecutiveCooOutput,
} from "../schemas/executive-coo";
import { getExecutiveCooExecutionContext } from "./agent-execution-context";
import { mutateAndEnrichExecutiveCooOutput } from "./executive-coo-enrichment";
import {
  buildExecutiveCooEvidenceCatalog,
  sectionScoreForFocusArea,
  validateExecutiveCooEvidenceKeys,
} from "./executive-coo-evidence";

const VAGUE_PATTERNS = [
  /^improve operations$/i,
  /^fix operations$/i,
  /^optimize store$/i,
  /^grow revenue$/i,
  /^increase revenue$/i,
  /^increase sales$/i,
  /^boost performance$/i,
  /^prioritize everything$/i,
];

export function isVagueExecutiveCooText(value: string): boolean {
  const normalized = value.trim();
  return VAGUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export const isVagueExecutiveCooPriorityText = isVagueExecutiveCooText;

function hasCircularDependencies(
  priorities: Array<{ id: string; dependsOn?: string[] }>,
): boolean {
  const graph = new Map(priorities.map((priority) => [priority.id, priority.dependsOn ?? []]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dependency of graph.get(node) ?? []) {
      if (!graph.has(dependency)) continue;
      if (dfs(dependency)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const id of graph.keys()) {
    if (dfs(id)) return true;
  }

  return false;
}

function hasPriorityConflicts(
  priorities: ExecutiveCooOutput["topPriorities"],
): boolean {
  const byExecutionOrder = new Map<number, ExecutiveCooOutput["topPriorities"]>();

  for (const priority of priorities) {
    const bucket = byExecutionOrder.get(priority.executionOrder) ?? [];
    bucket.push(priority);
    byExecutionOrder.set(priority.executionOrder, bucket);
  }

  for (const bucket of byExecutionOrder.values()) {
    if (bucket.length < 2) continue;

    const prioritiesAtOrder = new Set(bucket.map((item) => item.priority));
    if (prioritiesAtOrder.size > 1 && bucket.some((item) => item.priority <= 2)) {
      return true;
    }

    const sourceIds = bucket.flatMap((item) => item.sourceRecommendationIds);
    const uniqueSourceIds = new Set(sourceIds);
    if (uniqueSourceIds.size !== sourceIds.length) {
      return true;
    }
  }

  return false;
}

function priorityContradictsFacts(
  facts: ExecutiveCooFacts,
  priority: ExecutiveCooOutput["topPriorities"][number],
): boolean {
  const sectionScore = sectionScoreForFocusArea(facts, priority.focusArea);

  if (sectionScore >= 92 && priority.focusArea !== "Strategic Planning") {
    return true;
  }

  if (
    priority.focusArea === "Inventory" &&
    facts.inventoryRisk <= 20 &&
    facts.strategySignals.criticalInventoryIssues === 0
  ) {
    return true;
  }

  if (
    priority.focusArea === "Growth" &&
    facts.growthScore < 40 &&
    priority.supportingAgents.every((agent) => agent !== "growth_intelligence")
  ) {
    return true;
  }

  return false;
}

function findingContradictsFacts(
  facts: ExecutiveCooFacts,
  finding: ExecutiveCooOutput["findings"][number],
): boolean {
  const sectionScore = sectionScoreForFocusArea(facts, finding.focusArea);
  return finding.severity === "critical" && sectionScore >= 85;
}

export function validateExecutiveCooBusinessRules(
  facts: ExecutiveCooFacts,
  output: ExecutiveCooOutput,
): void {
  if (output.operationsHealthScore !== facts.operationsHealthScore) {
    throw AIPlatformError.businessRuleValidation("health_score_mismatch");
  }

  if (output.topPriorities.length === 0) {
    throw AIPlatformError.businessRuleValidation("empty_priorities");
  }

  const priorityIds = new Set<string>();
  const priorityTitles = new Set<string>();

  for (const priority of output.topPriorities) {
    if (priorityIds.has(priority.id)) {
      throw AIPlatformError.businessRuleValidation("duplicate_priority_id");
    }

    priorityIds.add(priority.id);

    const titleKey = `${priority.focusArea}:${priority.title.trim().toLowerCase()}`;
    if (priorityTitles.has(titleKey)) {
      throw AIPlatformError.businessRuleValidation("duplicate_priority");
    }
    priorityTitles.add(titleKey);

    if (!EXECUTIVE_COO_FOCUS_AREAS.includes(priority.focusArea)) {
      throw AIPlatformError.businessRuleValidation("unknown_focus_area");
    }

    for (const agent of priority.supportingAgents) {
      if (!COLLABORATION_SOURCE_AGENTS.includes(agent)) {
        throw AIPlatformError.businessRuleValidation("unknown_supporting_agent");
      }
    }

    for (const recommendationId of priority.sourceRecommendationIds) {
      if (!facts.knownRecommendationIds.includes(recommendationId)) {
        throw AIPlatformError.businessRuleValidation("unknown_source_recommendation");
      }
    }

    if (priority.evidenceKeys.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_evidence_keys");
    }

    if (priority.merchantAction.length === 0) {
      throw AIPlatformError.businessRuleValidation("missing_merchant_action");
    }

    if (!priority.verificationCriteria?.trim()) {
      throw AIPlatformError.businessRuleValidation("missing_verification");
    }

    if (!priority.executionOrder || priority.executionOrder < 1) {
      throw AIPlatformError.businessRuleValidation("missing_execution_order");
    }

    if (
      priority.priority < 1 ||
      priority.priority > 5 ||
      priority.confidence < 0 ||
      priority.confidence > 1
    ) {
      throw AIPlatformError.businessRuleValidation("invalid_priority_or_confidence");
    }

    if (
      isVagueExecutiveCooText(priority.title) ||
      isVagueExecutiveCooText(priority.reason) ||
      priority.merchantAction.some((action) => isVagueExecutiveCooText(action))
    ) {
      throw AIPlatformError.businessRuleValidation("vague_priority");
    }

    if (priorityContradictsFacts(facts, priority)) {
      throw AIPlatformError.businessRuleValidation("contradictory_plan");
    }

    if (facts.implementedPriorityIds.includes(priority.id)) {
      throw AIPlatformError.businessRuleValidation("implemented_priority_regenerated");
    }

    for (const dependencyId of priority.dependsOn ?? []) {
      if (!output.topPriorities.some((item) => item.id === dependencyId)) {
        throw AIPlatformError.businessRuleValidation("unknown_dependency");
      }
      if (dependencyId === priority.id) {
        throw AIPlatformError.businessRuleValidation("circular_dependency");
      }
    }
  }

  if (hasCircularDependencies(output.topPriorities)) {
    throw AIPlatformError.businessRuleValidation("circular_dependency");
  }

  if (hasPriorityConflicts(output.topPriorities)) {
    throw AIPlatformError.businessRuleValidation("priority_conflict");
  }

  for (const finding of output.findings) {
    if (!EXECUTIVE_COO_FOCUS_AREAS.includes(finding.focusArea)) {
      throw AIPlatformError.businessRuleValidation("unknown_focus_area");
    }

    if (findingContradictsFacts(facts, finding)) {
      throw AIPlatformError.businessRuleValidation("contradictory_finding");
    }
  }

  const catalog =
    getExecutiveCooExecutionContext()?.evidenceCatalog ?? buildExecutiveCooEvidenceCatalog(facts);

  for (const priority of output.topPriorities) {
    try {
      validateExecutiveCooEvidenceKeys(priority.evidenceKeys, catalog);
    } catch {
      throw AIPlatformError.businessRuleValidation("invalid_evidence");
    }
  }

  const executionContext = getExecutiveCooExecutionContext();
  if (executionContext) {
    for (const priority of output.topPriorities) {
      if (executionContext.recommendationMemory.implementedIds.has(priority.id)) {
        throw AIPlatformError.businessRuleValidation("implemented_priority_regenerated");
      }
    }
  }

  const enriched = mutateAndEnrichExecutiveCooOutput({
    facts,
    output,
    executionContext,
  });

  const parsed = executiveCooEnrichedSchema.safeParse(enriched);
  if (!parsed.success) {
    throw AIPlatformError.businessRuleValidation("enrichment_validation_failed");
  }
}

export function extractExecutiveCooPriorities(output: ExecutiveCooOutput) {
  const executionContext = getExecutiveCooExecutionContext();
  const priorities = output.topPriorities as Array<
    ExecutiveCooOutput["topPriorities"][number] & {
      priority?: number;
      priorityScore?: number;
      group?: string;
      tasks?: string[];
      priorityTimeline?: Record<string, unknown>;
      evidence?: string[];
      verification?: Record<string, unknown>;
      estimatedImpactMetrics?: Record<string, unknown>;
    }
  >;

  return priorities
    .filter((priority) => {
      if (executionContext?.recommendationMemory.implementedIds.has(priority.id)) {
        return false;
      }

      if (executionContext?.recommendationMemory.openIds.has(priority.id)) {
        return false;
      }

      if (executionContext?.recommendationMemory.snoozedIds.has(priority.id)) {
        return false;
      }

      return true;
    })
    .map((priority) => {
      let priorityLevel = priority.priority ?? 3;

      if (executionContext?.recommendationMemory.dismissedIds.has(priority.id)) {
        priorityLevel = Math.min(5, priorityLevel + 1);
      }

      if (executionContext?.recommendationMemory.ignoredIds.has(priority.id)) {
        priorityLevel = Math.min(5, priorityLevel + 1);
      }

      return {
        category: priority.focusArea,
        title: priority.title,
        summary: priority.reason,
        priority: priorityLevel,
        confidence: priority.confidence,
        payload: priority as unknown as Record<string, unknown>,
      };
    });
}
