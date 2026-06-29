import type { SeoIntelligenceScores } from "./seo-intelligence-scores-tool";

export function calculateSeoIntelligenceHealthScore(input: {
  scores: SeoIntelligenceScores;
  criticalIssueCount: number;
}): number {
  let score = input.scores.seoScore;
  score -= Math.min(input.criticalIssueCount, 12) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifySeoHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "weak";
}

export function buildSeoHealthExplanation(input: {
  seoHealthScore: number;
  scores: SeoIntelligenceScores;
  criticalIssueCount: number;
}): {
  score: number;
  summary: string;
  drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }>;
} {
  const drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }> = [];

  if (input.scores.contentScore >= 75) {
    drivers.push({ factor: "Content quality", direction: "positive", detail: "Metadata and page depth are healthy." });
  } else {
    drivers.push({ factor: "Content quality", direction: "negative", detail: "Thin or incomplete merchant content is limiting organic upside." });
  }

  if (input.scores.technicalSeoScore >= 75) {
    drivers.push({ factor: "Technical SEO", direction: "positive", detail: "Canonical, heading, and metadata foundations are stable." });
  } else {
    drivers.push({ factor: "Technical SEO", direction: "negative", detail: "Technical gaps are reducing crawl efficiency and clarity." });
  }

  if (input.scores.coreWebVitalsScore >= 75) {
    drivers.push({ factor: "Core Web Vitals", direction: "positive", detail: "Page experience signals are supporting search visibility." });
  } else {
    drivers.push({ factor: "Core Web Vitals", direction: "negative", detail: "LCP, CLS, or INP need improvement for stronger rankings." });
  }

  if (input.criticalIssueCount > 0) {
    drivers.push({
      factor: "Critical issues",
      direction: "negative",
      detail: `${input.criticalIssueCount} critical SEO issue(s) require immediate attention.`,
    });
  }

  const band = classifySeoHealthBand(input.seoHealthScore);
  const summary =
    band === "strong"
      ? "Organic foundations are strong with targeted opportunities for incremental growth."
      : band === "watch"
        ? "SEO health is mixed; quick wins and technical fixes can unlock meaningful visibility gains."
        : "SEO health is weak; prioritize indexability, metadata, and page experience fixes first.";

  return { score: input.seoHealthScore, summary, drivers };
}
