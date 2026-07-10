import type { LearningPriorityDomain } from "@prisma/client";

import { LEARNING_PRIORITY_ORDER } from "../../shared/constants";
import type { LearningPriorityAssignment } from "../../shared/types";

export function buildLearningPriorities(): LearningPriorityAssignment[] {
  return LEARNING_PRIORITY_ORDER.map((domain, index) => ({
    domain,
    priorityOrder: index + 1,
  }));
}

export function getPriorityJobWeight(domain: LearningPriorityDomain): number {
  const index = LEARNING_PRIORITY_ORDER.indexOf(domain);
  return index >= 0 ? LEARNING_PRIORITY_ORDER.length - index : 1;
}

export function sortByLearningPriority<T extends { domain: LearningPriorityDomain }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      LEARNING_PRIORITY_ORDER.indexOf(left.domain) -
      LEARNING_PRIORITY_ORDER.indexOf(right.domain),
  );
}
