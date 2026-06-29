import type {
  CollaborationDependency,
  CollaborationRecommendationInput,
} from "./collaboration-types";
import { recommendationsShareProduct } from "./collaboration-utils";

export function detectCollaborationDependencies(
  recommendations: CollaborationRecommendationInput[],
): CollaborationDependency[] {
  const dependencies: CollaborationDependency[] = [];

  for (const recommendation of recommendations) {
    const haystack = `${recommendation.title} ${recommendation.category} ${recommendation.reason}`.toLowerCase();
    const dependsOn: string[] = [];

    if (/bundle|pair|attach|cross-sell|starter kit/.test(haystack)) {
      const inventoryPrereq = recommendations.find(
        (candidate) =>
          candidate.agentId === "inventory_intelligence" &&
          recommendationsShareProduct(candidate, recommendation) &&
          /stock|inventory|reorder|available/.test(
            `${candidate.title} ${candidate.reason}`.toLowerCase(),
          ),
      );
      if (inventoryPrereq) {
        dependsOn.push(inventoryPrereq.recommendationId);
      }

      const productPrereq = recommendations.find(
        (candidate) =>
          candidate.agentId === "product_intelligence" &&
          recommendationsShareProduct(candidate, recommendation),
      );
      if (productPrereq) {
        dependsOn.push(productPrereq.recommendationId);
      }
    }

    if (/campaign|promote|feature|homepage|collection|merchandis/.test(haystack)) {
      const availability = recommendations.find(
        (candidate) =>
          candidate.agentId === "inventory_intelligence" &&
          recommendationsShareProduct(candidate, recommendation),
      );
      if (availability) {
        dependsOn.push(availability.recommendationId);
      }
    }

    if (dependsOn.length > 0) {
      dependencies.push({
        id: `dependency:${recommendation.recommendationId}`,
        recommendationId: recommendation.recommendationId,
        dependsOn: [...new Set(dependsOn)],
        reason: "This executive action depends on prerequisite inventory, product, or campaign readiness.",
      });
    }
  }

  return detectCircularDependencies(dependencies);
}

export function detectCircularDependencies(
  dependencies: CollaborationDependency[],
): CollaborationDependency[] {
  const graph = new Map<string, string[]>();
  for (const dependency of dependencies) {
    graph.set(dependency.recommendationId, dependency.dependsOn);
  }

  for (const dependency of dependencies) {
    const visited = new Set<string>();
    const stack = [...dependency.dependsOn];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === dependency.recommendationId) {
        throw new Error("circular_dependency");
      }
      if (visited.has(current)) continue;
      visited.add(current);
      stack.push(...(graph.get(current) ?? []));
    }
  }

  return dependencies;
}
