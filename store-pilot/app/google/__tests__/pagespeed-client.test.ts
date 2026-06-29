import { beforeEach, describe, expect, it } from "vitest";

import {
  buildPageSpeedRunUrl,
  buildPageSpeedRunUrls,
  normalizeSearchConsoleSiteToStorefrontUrl,
  resolvePageSpeedStoreUrl,
} from "../pagespeed/pagespeed-query-builder";
import {
  configurePageSpeedClientDeps,
  fetchPageSpeedInsightsReport,
  resetPageSpeedClientDeps,
} from "../pagespeed/pagespeed-client";
import { GoogleApiError } from "../shared/google-api-error";

describe("PageSpeed query builder", () => {
  it("builds desktop and mobile API URLs with categories", () => {
    const urls = buildPageSpeedRunUrls("https://store.example.com/");

    expect(urls.desktopUrl).toContain("strategy=desktop");
    expect(urls.mobileUrl).toContain("strategy=mobile");
    expect(urls.desktopUrl).toContain("category=PERFORMANCE");
    expect(urls.desktopUrl).toContain(encodeURIComponent("https://store.example.com/"));
  });

  it("builds a single strategy URL", () => {
    const url = buildPageSpeedRunUrl({
      pageUrl: "https://store.example.com/",
      strategy: "mobile",
    });

    expect(url).toContain("strategy=mobile");
    expect(url).toContain("category=SEO");
  });

  it("resolves storefront URLs from Search Console and Shopify domain", () => {
    expect(
      resolvePageSpeedStoreUrl({
        searchConsoleSiteUrl: "sc-domain:store.example.com",
      }),
    ).toBe("https://store.example.com");

    expect(
      resolvePageSpeedStoreUrl({
        shopifyDomain: "store.myshopify.com",
      }),
    ).toBe("https://store.myshopify.com");
  });

  it("normalizes Search Console domain properties", () => {
    expect(normalizeSearchConsoleSiteToStorefrontUrl("sc-domain:example.com")).toBe(
      "https://example.com",
    );
  });
});

describe("PageSpeed client", () => {
  beforeEach(() => {
    resetPageSpeedClientDeps();
  });

  it("fetches desktop and mobile reports in parallel", async () => {
    const strategies: string[] = [];

    configurePageSpeedClientDeps({
      runPageSpeed: async ({ strategy }) => {
        strategies.push(strategy);
        return {
          lighthouseResult: {
            categories: { performance: { score: strategy === "desktop" ? 0.9 : 0.8 } },
            audits: {
              "largest-contentful-paint": { numericValue: 2000 },
              "cumulative-layout-shift": { numericValue: 0.05 },
              "interaction-to-next-paint": { numericValue: 150 },
            },
          },
        };
      },
    });

    const report = await fetchPageSpeedInsightsReport({
      pageUrl: "https://store.example.com/",
      accessToken: "access-token",
    });

    expect(strategies.sort()).toEqual(["desktop", "mobile"]);
    expect(report.pageUrl).toBe("https://store.example.com/");
    expect(report.desktop.categoryScores.performance).toBe(0.9);
    expect(report.mobile.categoryScores.performance).toBe(0.8);
  });

  it("rejects missing URLs", async () => {
    await expect(
      fetchPageSpeedInsightsReport({
        pageUrl: "   ",
        accessToken: "access-token",
      }),
    ).rejects.toMatchObject({ code: "missing_property" });
  });

  it("propagates API failures", async () => {
    configurePageSpeedClientDeps({
      runPageSpeed: async () => {
        throw new GoogleApiError({
          code: "quota_exceeded",
          message: "quota exceeded",
          retryable: true,
        });
      },
    });

    await expect(
      fetchPageSpeedInsightsReport({
        pageUrl: "https://store.example.com/",
        accessToken: "access-token",
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});
