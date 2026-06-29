import {
  buildGscDateRanges,
  buildGscSearchAnalyticsQueries,
  encodeGscSiteUrl,
  type GscSearchAnalyticsRequest,
} from "./gsc-query-builder";
import {
  buildGscRawReport,
  type GscCoverageSummary,
  type GscFetchedReports,
  type GscRawReport,
  type GscSearchAnalyticsResponse,
} from "./gsc-parser";
import { GoogleApiError } from "../shared/google-api-error";
import { googleHttpRequest } from "../shared/google-http";

export type GscSiteSummary = {
  siteUrl: string;
  displayName: string;
  permissionLevel: string | null;
};

type GscClientDeps = {
  runSearchAnalytics: typeof runGscSearchAnalyticsRequest;
  fetchSiteCoverage: typeof fetchGscSiteCoverage;
  listSites: typeof listGscSitesRequest;
};

const defaultDeps: GscClientDeps = {
  runSearchAnalytics: runGscSearchAnalyticsRequest,
  fetchSiteCoverage: fetchGscSiteCoverage,
  listSites: listGscSitesRequest,
};

let clientDeps: GscClientDeps = defaultDeps;

export function configureGscClientDeps(overrides: Partial<GscClientDeps>): void {
  clientDeps = { ...defaultDeps, ...overrides };
}

export function resetGscClientDeps(): void {
  clientDeps = defaultDeps;
}

type GscSitesListResponse = {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
};

type GscSiteMetadataResponse = {
  siteUrl?: string;
  permissionLevel?: string;
};

async function runGscSearchAnalyticsRequest(input: {
  siteUrl: string;
  accessToken: string;
  request: GscSearchAnalyticsRequest;
}): Promise<GscSearchAnalyticsResponse> {
  const encodedSiteUrl = encodeGscSiteUrl(input.siteUrl);
  const response = await googleHttpRequest<GscSearchAnalyticsResponse>({
    url: `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: input.request,
    rateLimitKey: `gsc:${encodedSiteUrl}`,
  });

  return response.data;
}

async function fetchGscSiteCoverage(input: {
  siteUrl: string;
  accessToken: string;
}): Promise<GscCoverageSummary> {
  try {
    const encodedSiteUrl = encodeGscSiteUrl(input.siteUrl);
    const response = await googleHttpRequest<GscSiteMetadataResponse>({
      url: `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}`,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
      rateLimitKey: `gsc-site:${encodedSiteUrl}`,
    });

    const permissionLevel = response.data.permissionLevel ?? null;
    return {
      permissionLevel,
      siteVerified: permissionLevel !== null && permissionLevel !== "siteUnverifiedUser",
    };
  } catch (error) {
    if (error instanceof GoogleApiError && error.code === "permission_denied") {
      return {
        permissionLevel: null,
        siteVerified: false,
      };
    }

    throw error;
  }
}

async function listGscSitesRequest(accessToken: string): Promise<GscSiteSummary[]> {
  const response = await googleHttpRequest<GscSitesListResponse>({
    url: "https://www.googleapis.com/webmasters/v3/sites",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    rateLimitKey: "gsc-sites",
  });

  return (response.data.siteEntry ?? [])
    .filter((entry): entry is { siteUrl: string; permissionLevel?: string } => Boolean(entry.siteUrl))
    .map((entry) => ({
      siteUrl: entry.siteUrl,
      displayName: entry.siteUrl,
      permissionLevel: entry.permissionLevel ?? null,
    }));
}

export async function listGscSites(accessToken: string): Promise<GscSiteSummary[]> {
  return clientDeps.listSites(accessToken);
}

export async function fetchGscSearchConsoleReport(input: {
  siteUrl: string;
  accessToken: string;
  referenceDate?: Date;
}): Promise<GscRawReport> {
  if (!input.siteUrl) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Search Console site URL is required",
      retryable: false,
    });
  }

  const queries = buildGscSearchAnalyticsQueries(input.referenceDate);
  const dateRanges = buildGscDateRanges(input.referenceDate);

  const [
    summaryLast30Days,
    summaryLast7Days,
    summaryPreviousPeriod,
    queryRows,
    pageRows,
    countryRows,
    deviceRows,
    searchTypeRows,
    coverage,
  ] = await Promise.all([
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.summaryLast30Days,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.summaryLast7Days,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.summaryPreviousPeriod,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.queries,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.pages,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.countries,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.devices,
    }),
    clientDeps.runSearchAnalytics({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
      request: queries.searchTypes,
    }),
    clientDeps.fetchSiteCoverage({
      siteUrl: input.siteUrl,
      accessToken: input.accessToken,
    }),
  ]);

  if (!coverage.siteVerified) {
    throw new GoogleApiError({
      code: "permission_denied",
      message: "Search Console property is not verified or accessible",
      retryable: false,
    });
  }

  const fetched: GscFetchedReports = {
    siteUrl: input.siteUrl,
    dateRanges,
    summaryLast30Days,
    summaryLast7Days,
    summaryPreviousPeriod,
    queries: queryRows,
    pages: pageRows,
    countries: countryRows,
    devices: deviceRows,
    searchTypes: searchTypeRows,
    coverage,
  };

  return buildGscRawReport(fetched);
}

export { runGscSearchAnalyticsRequest };
