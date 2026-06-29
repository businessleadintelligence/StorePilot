import type { ConnectorId } from "./connector.types";

export type ConnectorDataQualityWarning = {
  code: string;
  connectorId: ConnectorId;
  message: string;
  impacts: string[];
};

const GOOGLE_ANALYTICS_MISSING_WARNING: ConnectorDataQualityWarning = {
  code: "google_analytics_missing",
  connectorId: "ga4",
  message: "Google Analytics is not connected.",
  impacts: [
    "Revenue Intelligence accuracy reduced",
    "Growth Intelligence accuracy reduced",
    "Executive COO confidence reduced",
  ],
};

const SEARCH_CONSOLE_MISSING_WARNING: ConnectorDataQualityWarning = {
  code: "search_console_missing",
  connectorId: "gsc",
  message: "Google Search Console is not connected.",
  impacts: [
    "SEO recommendations are based on catalog only",
    "Organic traffic analysis unavailable",
    "Search visibility unavailable",
  ],
};

const PAGESPEED_MISSING_WARNING: ConnectorDataQualityWarning = {
  code: "pagespeed_missing",
  connectorId: "pagespeed",
  message: "Google PageSpeed Insights is not connected.",
  impacts: [
    "Performance recommendations are limited",
    "Core Web Vitals unavailable",
    "Store speed analysis incomplete",
  ],
};

const CLARITY_MISSING_WARNING: ConnectorDataQualityWarning = {
  code: "clarity_missing",
  connectorId: "clarity",
  message: "Microsoft Clarity is not connected.",
  impacts: [
    "Behavior analysis unavailable",
    "UX recommendations limited",
    "User interaction metrics unavailable",
  ],
};

export function buildConnectorDataQualityWarnings(input: {
  presentConnectorIds: ConnectorId[];
  googleAnalyticsSkipped?: boolean;
}): ConnectorDataQualityWarning[] {
  const warnings: ConnectorDataQualityWarning[] = [];
  const hasGa4 = input.presentConnectorIds.includes("ga4");
  const hasGsc = input.presentConnectorIds.includes("gsc");
  const hasPageSpeed = input.presentConnectorIds.includes("pagespeed");
  const hasClarity = input.presentConnectorIds.includes("clarity");

  if (!hasGa4) {
    warnings.push(GOOGLE_ANALYTICS_MISSING_WARNING);
  }

  if (input.googleAnalyticsSkipped && !hasGa4) {
    warnings.push({
      ...GOOGLE_ANALYTICS_MISSING_WARNING,
      code: "google_analytics_skipped",
      message: "Google Analytics setup was skipped during onboarding.",
    });
  }

  if (!hasGsc) {
    warnings.push(SEARCH_CONSOLE_MISSING_WARNING);
  }

  if (!hasPageSpeed) {
    warnings.push(PAGESPEED_MISSING_WARNING);
  }

  if (!hasClarity) {
    warnings.push(CLARITY_MISSING_WARNING);
  }

  return warnings;
}

export function applyGoogleAnalyticsMissingPenalty(score: number, hasGa4: boolean): number {
  if (hasGa4) return score;
  return Math.max(0, score - 12);
}

export function applySearchConsoleMissingPenalty(score: number, hasGsc: boolean): number {
  if (hasGsc) return score;
  return Math.max(0, score - 10);
}

export function applyPageSpeedMissingPenalty(score: number, hasPageSpeed: boolean): number {
  if (hasPageSpeed) return score;
  return Math.max(0, score - 8);
}

export function applyClarityMissingPenalty(score: number, hasClarity: boolean): number {
  if (hasClarity) return score;
  return Math.max(0, score - 8);
}

export function applyConnectorMissingPenalties(
  score: number,
  presentConnectorIds: ConnectorId[],
): number {
  const present = new Set(presentConnectorIds);
  let next = applyGoogleAnalyticsMissingPenalty(score, present.has("ga4"));
  next = applySearchConsoleMissingPenalty(next, present.has("gsc"));
  next = applyPageSpeedMissingPenalty(next, present.has("pagespeed"));
  next = applyClarityMissingPenalty(next, present.has("clarity"));
  return next;
}
