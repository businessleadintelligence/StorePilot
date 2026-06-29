import { GoogleApiError } from "../shared/google-api-error";
import { googleHttpRequest } from "../shared/google-http";
import {
  buildPageSpeedRunUrls,
  type PageSpeedStrategy,
} from "./pagespeed-query-builder";
import {
  buildPageSpeedRawReport,
  type PageSpeedRawReport,
} from "./pagespeed-parser";

type PageSpeedApiResponse = Parameters<typeof buildPageSpeedRawReport>[0]["desktop"];

type PageSpeedClientDeps = {
  runPageSpeed: typeof runPageSpeedRequest;
};

const defaultDeps: PageSpeedClientDeps = {
  runPageSpeed: runPageSpeedRequest,
};

let clientDeps: PageSpeedClientDeps = defaultDeps;

export function configurePageSpeedClientDeps(overrides: Partial<PageSpeedClientDeps>): void {
  clientDeps = { ...defaultDeps, ...overrides };
}

export function resetPageSpeedClientDeps(): void {
  clientDeps = defaultDeps;
}

async function runPageSpeedRequest(input: {
  pageUrl: string;
  strategy: PageSpeedStrategy;
  accessToken: string;
}): Promise<PageSpeedApiResponse> {
  const urls = buildPageSpeedRunUrls(input.pageUrl);
  const requestUrl = input.strategy === "desktop" ? urls.desktopUrl : urls.mobileUrl;

  const response = await googleHttpRequest<PageSpeedApiResponse>({
    url: requestUrl,
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
    rateLimitKey: `pagespeed:${input.strategy}:${input.pageUrl}`,
    timeoutMs: 30_000,
  });

  return response.data;
}

export async function fetchPageSpeedInsightsReport(input: {
  pageUrl: string;
  accessToken: string;
}): Promise<PageSpeedRawReport> {
  if (!input.pageUrl.trim()) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "PageSpeed target URL is required",
      retryable: false,
    });
  }

  const [desktop, mobile] = await Promise.all([
    clientDeps.runPageSpeed({
      pageUrl: input.pageUrl,
      strategy: "desktop",
      accessToken: input.accessToken,
    }),
    clientDeps.runPageSpeed({
      pageUrl: input.pageUrl,
      strategy: "mobile",
      accessToken: input.accessToken,
    }),
  ]);

  return buildPageSpeedRawReport({
    pageUrl: input.pageUrl,
    desktop,
    mobile,
  });
}
