export type ExecutiveCriticalPathItem = {
  id: string;
  title: string;
  priorityScore: number;
  estimatedMinutes: number;
  dependsOn: string[];
};

export function deriveExecutiveCriticalPath(input: {
  items: ExecutiveCriticalPathItem[];
  blockedIds: Set<string>;
}): {
  path: string[];
  totalMinutes: number;
  bottleneckId: string | null;
  depth: number;
} {
  const available = input.items.filter((item) => !input.blockedIds.has(item.id));
  const byId = new Map(available.map((item) => [item.id, item]));
  const visited = new Set<string>();
  const path: string[] = [];

  function canStart(item: ExecutiveCriticalPathItem): boolean {
    return item.dependsOn.every((dep) => visited.has(dep) || !byId.has(dep));
  }

  let safety = available.length * 2;
  while (visited.size < available.length && safety > 0) {
    safety -= 1;
    const candidates = available
      .filter((item) => !visited.has(item.id) && canStart(item))
      .sort(
        (left, right) =>
          right.priorityScore - left.priorityScore ||
          left.estimatedMinutes - right.estimatedMinutes,
      );

    if (candidates.length === 0) break;
    const next = candidates[0];
    visited.add(next.id);
    path.push(next.id);
  }

  const selected = path.map((id) => byId.get(id)).filter((item): item is ExecutiveCriticalPathItem => !!item);
  const totalMinutes = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const bottleneck = [...selected].sort(
    (left, right) => right.estimatedMinutes - left.estimatedMinutes || right.priorityScore - left.priorityScore,
  )[0];

  return {
    path,
    totalMinutes,
    bottleneckId: bottleneck?.id ?? null,
    depth: path.length,
  };
}
