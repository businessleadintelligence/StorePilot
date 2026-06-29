export type SeoRuleStatus = "active" | "deprecated" | "draft";

export type SeoKnowledgeRule = {
  ruleId: string;
  ruleVersion: string;
  source: string;
  publishedDate: string;
  effectiveDate: string;
  status: SeoRuleStatus;
  importance: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  guidance: string;
};

export const SEO_KNOWLEDGE_RULE_SET_VERSION = "2026.06.1";

export const DEFAULT_SEO_KNOWLEDGE_RULES: SeoKnowledgeRule[] = [
  {
    ruleId: "google-title-quality",
    ruleVersion: "2026.06.1",
    source: "Google Search Central",
    publishedDate: "2026-03-01",
    effectiveDate: "2026-03-15",
    status: "active",
    importance: "critical",
    category: "Metadata",
    title: "Unique descriptive titles",
    guidance: "Every indexable page needs a unique, descriptive title that matches search intent.",
  },
  {
    ruleId: "google-meta-description",
    ruleVersion: "2026.06.1",
    source: "Google Search Central",
    publishedDate: "2026-03-01",
    effectiveDate: "2026-03-15",
    status: "active",
    importance: "high",
    category: "Metadata",
    title: "Useful meta descriptions",
    guidance: "Meta descriptions should summarize the page and encourage qualified clicks.",
  },
  {
    ruleId: "google-canonical",
    ruleVersion: "2026.06.1",
    source: "Google Search Central",
    publishedDate: "2026-02-10",
    effectiveDate: "2026-02-20",
    status: "active",
    importance: "critical",
    category: "Technical SEO",
    title: "Canonical consistency",
    guidance: "Duplicate or conflicting canonical signals reduce index clarity.",
  },
  {
    ruleId: "google-structured-data",
    ruleVersion: "2026.06.1",
    source: "Google Search Central",
    publishedDate: "2026-01-20",
    effectiveDate: "2026-02-01",
    status: "active",
    importance: "high",
    category: "Structured Data",
    title: "Valid product structured data",
    guidance: "Product pages should expose valid structured data for rich results eligibility.",
  },
  {
    ruleId: "google-core-web-vitals",
    ruleVersion: "2026.06.1",
    source: "Google Search Central",
    publishedDate: "2026-04-01",
    effectiveDate: "2026-04-15",
    status: "active",
    importance: "critical",
    category: "Core Web Vitals",
    title: "Pass Core Web Vitals thresholds",
    guidance: "LCP, CLS, and INP should remain within healthy thresholds on mobile.",
  },
  {
    ruleId: "storepilot-internal-linking",
    ruleVersion: "2026.06.1",
    source: "StorePilot SEO Rule Set",
    publishedDate: "2026-06-01",
    effectiveDate: "2026-06-01",
    status: "active",
    importance: "high",
    category: "Internal Linking",
    title: "Link high-value pages from navigation and collections",
    guidance: "Important revenue pages should be reachable within three clicks.",
  },
  {
    ruleId: "storepilot-content-depth",
    ruleVersion: "2026.06.1",
    source: "StorePilot SEO Rule Set",
    publishedDate: "2026-06-01",
    effectiveDate: "2026-06-01",
    status: "active",
    importance: "medium",
    category: "Content",
    title: "Avoid thin product and collection pages",
    guidance: "Pages with minimal copy struggle to rank for non-branded queries.",
  },
  {
    ruleId: "storepilot-image-alt-text",
    ruleVersion: "2026.06.1",
    source: "StorePilot SEO Rule Set",
    publishedDate: "2026-06-01",
    effectiveDate: "2026-06-01",
    status: "active",
    importance: "high",
    category: "Images",
    title: "Descriptive alt text on product images",
    guidance: "Alt text improves accessibility and image search visibility.",
  },
];

export function getActiveSeoKnowledgeRules(rules = DEFAULT_SEO_KNOWLEDGE_RULES): SeoKnowledgeRule[] {
  return rules.filter((rule) => rule.status === "active");
}

export function getSeoRuleById(ruleId: string, rules = DEFAULT_SEO_KNOWLEDGE_RULES): SeoKnowledgeRule | undefined {
  return rules.find((rule) => rule.ruleId === ruleId && rule.status === "active");
}

export function resolveRuleVersionForCategory(category: string, rules = DEFAULT_SEO_KNOWLEDGE_RULES): string {
  const match = getActiveSeoKnowledgeRules(rules).find((rule) => rule.category === category);
  return match?.ruleVersion ?? SEO_KNOWLEDGE_RULE_SET_VERSION;
}

export function resolvePrimaryRuleForCategory(
  category: string,
  rules = DEFAULT_SEO_KNOWLEDGE_RULES,
): SeoKnowledgeRule | undefined {
  return getActiveSeoKnowledgeRules(rules).find((rule) => rule.category === category);
}
