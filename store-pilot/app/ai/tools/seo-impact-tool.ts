import type { SeoEstimatedImpact } from "../schemas/seo-intelligence";

export function estimateSeoImpact(input: {
  category: string;
  confidence: number;
  sectionScore: number;
}): SeoEstimatedImpact {
  const lift = Number(((100 - input.sectionScore) * input.confidence * 0.18).toFixed(2));
  const trafficCategories = new Set([
    "Content",
    "Metadata",
    "Products",
    "Collections",
    "Internal Linking",
    "Search Visibility",
  ]);
  const technicalCategories = new Set([
    "Technical SEO",
    "Core Web Vitals",
    "Indexability",
    "Structured Data",
    "Schema",
    "Canonical",
  ]);

  return {
    trafficGain: trafficCategories.has(input.category) ? lift : null,
    revenueGain: input.category === "Conversion SEO" ? lift : null,
    visibilityLift: input.category === "Metadata" || input.category === "Content" ? lift / 100 : null,
    ctrLift: input.category === "Metadata" ? lift / 100 : null,
    indexabilityImprovement: technicalCategories.has(input.category) ? Math.round(lift * 5) : null,
  };
}

export function hasSeoDeterministicImpact(impact: SeoEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function estimateSeoTrafficGain(impact: SeoEstimatedImpact, sectionScore: number): number {
  const base = (100 - sectionScore) * 12;
  return Math.round(base + (impact.trafficGain ?? 0) * 80 + (impact.visibilityLift ?? 0) * 500);
}

export function estimateSeoRevenueImpact(trafficGain: number): number {
  return Math.round(trafficGain * 0.35);
}
