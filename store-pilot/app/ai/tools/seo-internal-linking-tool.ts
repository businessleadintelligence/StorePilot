export function analyzeSeoInternalLinking(input: {
  collectionCount: number;
  activeProductCount: number;
  navigationDepthProxy: number;
}): { score: number; issues: string[] } {
  const issues: string[] = [];
  const scoreProxy = Math.min(
    100,
    50 + input.collectionCount * 5 + Math.min(30, input.activeProductCount) - input.navigationDepthProxy * 8,
  );
  if (scoreProxy < 65) issues.push("internal_linking_weak_navigation");
  if (input.collectionCount < 2) issues.push("internal_linking_missing_collections");
  return { score: Math.max(0, scoreProxy), issues };
}
