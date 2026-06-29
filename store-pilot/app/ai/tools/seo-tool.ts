export type SeoMetrics = {
  titleLength: number | null;
  descriptionLength: number | null;
  keywordCoverageScore: number | null;
};

export function buildSeoMetrics(input: {
  title?: string | null;
  description?: string | null;
  keywords?: string[];
}): SeoMetrics {
  return {
    titleLength: input.title?.length ?? null,
    descriptionLength: input.description?.length ?? null,
    keywordCoverageScore: input.keywords ? Math.min(100, input.keywords.length * 10) : null,
  };
}
