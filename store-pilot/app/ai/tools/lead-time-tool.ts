export function estimateLeadTimeDays(input: {
  velocity: number;
  reorderUrgency: number;
}): number {
  if (input.reorderUrgency <= 1) {
    return 7;
  }

  if (input.velocity >= 2) {
    return 10;
  }

  if (input.velocity >= 0.5) {
    return 14;
  }

  return 21;
}

export function calculateReorderByDate(input: {
  runOutDate: string | null;
  leadTimeDays: number;
  computedAt: string;
}): string | null {
  if (!input.runOutDate) {
    return null;
  }

  const runOut = Date.parse(input.runOutDate);
  if (Number.isNaN(runOut)) {
    return null;
  }

  const reorderAt = new Date(runOut - input.leadTimeDays * 24 * 60 * 60 * 1000);
  return reorderAt.toISOString();
}

export function isReorderOverdue(input: {
  runOutDate: string | null;
  leadTimeDays: number;
  computedAt: string;
}): boolean {
  const reorderBy = calculateReorderByDate(input);
  if (!reorderBy) {
    return false;
  }

  return Date.parse(reorderBy) <= Date.parse(input.computedAt);
}
