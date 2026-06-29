export const CLARITY_EXPORT_API_BASE =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

export const CLARITY_DIMENSIONS = [
  "Browser",
  "Device",
  "Country/Region",
  "OS",
  "Source",
  "Medium",
  "Campaign",
  "Channel",
  "URL",
] as const;

export type ClarityDimension = (typeof CLARITY_DIMENSIONS)[number];

export type ClarityNumOfDays = 1 | 2 | 3;

export type ClarityInsightsQuery = {
  numOfDays: ClarityNumOfDays;
  dimension1?: ClarityDimension;
  dimension2?: ClarityDimension;
  dimension3?: ClarityDimension;
};

export function sanitizeClarityPagePath(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "/";

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;

  try {
    const parsed = new URL(
      withoutQuery.startsWith("http://") || withoutQuery.startsWith("https://")
        ? withoutQuery
        : `https://storefront.local${withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`}`,
    );
    return parsed.pathname || "/";
  } catch {
    return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  }
}

export function buildClarityInsightsUrl(query: ClarityInsightsQuery): string {
  const url = new URL(CLARITY_EXPORT_API_BASE);
  url.searchParams.set("numOfDays", String(query.numOfDays));

  if (query.dimension1) {
    url.searchParams.set("dimension1", query.dimension1);
  }
  if (query.dimension2) {
    url.searchParams.set("dimension2", query.dimension2);
  }
  if (query.dimension3) {
    url.searchParams.set("dimension3", query.dimension3);
  }

  return url.toString();
}

export function buildClarityAggregateInsightsUrl(numOfDays: ClarityNumOfDays = 3): string {
  return buildClarityInsightsUrl({ numOfDays });
}

export function buildClarityPageInsightsUrl(numOfDays: ClarityNumOfDays = 3): string {
  return buildClarityInsightsUrl({ numOfDays, dimension1: "URL" });
}

export function buildClarityDeviceInsightsUrl(numOfDays: ClarityNumOfDays = 3): string {
  return buildClarityInsightsUrl({ numOfDays, dimension1: "Device" });
}

export function buildClarityBrowserInsightsUrl(numOfDays: ClarityNumOfDays = 3): string {
  return buildClarityInsightsUrl({ numOfDays, dimension1: "Browser" });
}

export function buildClarityCountryInsightsUrl(numOfDays: ClarityNumOfDays = 3): string {
  return buildClarityInsightsUrl({ numOfDays, dimension1: "Country/Region" });
}
