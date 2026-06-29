export const PAGESPEED_API_BASE =
  "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

export const PAGESPEED_CATEGORIES = [
  "PERFORMANCE",
  "ACCESSIBILITY",
  "BEST_PRACTICES",
  "SEO",
] as const;

export type PageSpeedStrategy = "desktop" | "mobile";

export type PageSpeedCategory = (typeof PAGESPEED_CATEGORIES)[number];

export function normalizePageSpeedUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function normalizeSearchConsoleSiteToStorefrontUrl(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return normalizePageSpeedUrl(siteUrl.slice("sc-domain:".length));
  }

  return normalizePageSpeedUrl(siteUrl);
}

export function resolvePageSpeedStoreUrl(input: {
  pageUrl?: string;
  searchConsoleSiteUrl?: string | null;
  shopifyDomain?: string | null;
}): string | null {
  if (input.pageUrl?.trim()) {
    return normalizePageSpeedUrl(input.pageUrl);
  }

  if (input.searchConsoleSiteUrl?.trim()) {
    return normalizeSearchConsoleSiteToStorefrontUrl(input.searchConsoleSiteUrl);
  }

  if (input.shopifyDomain?.trim()) {
    return normalizePageSpeedUrl(input.shopifyDomain);
  }

  return null;
}

export function buildPageSpeedRunUrl(input: {
  pageUrl: string;
  strategy: PageSpeedStrategy;
  categories?: readonly PageSpeedCategory[];
}): string {
  const url = new URL(PAGESPEED_API_BASE);
  url.searchParams.set("url", input.pageUrl);
  url.searchParams.set("strategy", input.strategy);

  for (const category of input.categories ?? PAGESPEED_CATEGORIES) {
    url.searchParams.append("category", category);
  }

  return url.toString();
}

export function buildPageSpeedRunUrls(pageUrl: string): {
  desktopUrl: string;
  mobileUrl: string;
} {
  return {
    desktopUrl: buildPageSpeedRunUrl({ pageUrl, strategy: "desktop" }),
    mobileUrl: buildPageSpeedRunUrl({ pageUrl, strategy: "mobile" }),
  };
}
