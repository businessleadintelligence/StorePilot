export type ExecutiveExecutionOrderItem = {
  id: string;
  priorityScore: number;
  dependsOn: string[];
  blockedBy: string[];
  estimatedMinutes: number;
};

export function deriveExecutionOrder(input: {
  items: ExecutiveExecutionOrderItem[];
}): {
  executionOrder: string[];
  parallelizable: string[][];
  blockedItems: string[];
} {
  const byId = new Map(input.items.map((item) => [item.id, item]));
  const completed = new Set<string>();
  const executionOrder: string[] = [];
  const blockedItems = new Set<string>();
  const parallelizable: string[][] = [];

  let safety = input.items.length * 3;
  while (executionOrder.length < input.items.length && safety > 0) {
    safety -= 1;
    const ready = input.items
      .filter((item) => !executionOrder.includes(item.id))
      .filter((item) => item.dependsOn.every((dep) => completed.has(dep) || !byId.has(dep)))
      .filter((item) => item.blockedBy.length === 0)
      .sort(
        (left, right) =>
          right.priorityScore - left.priorityScore ||
          left.estimatedMinutes - right.estimatedMinutes,
      );

    if (ready.length === 0) {
      for (const item of input.items) {
        if (!executionOrder.includes(item.id)) blockedItems.add(item.id);
      }
      break;
    }

    const batch = ready.slice(0, 2).map((item) => item.id);
    if (batch.length > 1) parallelizable.push(batch);
    for (const id of batch) {
      executionOrder.push(id);
      completed.add(id);
    }
  }

  return { executionOrder, parallelizable, blockedItems: [...blockedItems] };
}
