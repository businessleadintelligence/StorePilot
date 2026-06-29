import {
  buildClarityAggregateInsightsUrl,
  buildClarityBrowserInsightsUrl,
  buildClarityCountryInsightsUrl,
  buildClarityDeviceInsightsUrl,
  buildClarityPageInsightsUrl,
  type ClarityNumOfDays,
} from "./clarity-query-builder";
import {
  buildClarityRawReport,
  type ClarityApiResponse,
  type ClarityFetchedReports,
  type ClarityRawReport,
} from "./clarity-parser";
import { ClarityApiError } from "./clarity-api-error";
import { clarityHttpRequest } from "./clarity-http";

type ClarityClientDeps = {
  fetchInsights: typeof fetchClarityInsightsRequest;
};

const defaultDeps: ClarityClientDeps = {
  fetchInsights: fetchClarityInsightsRequest,
};

let clientDeps: ClarityClientDeps = defaultDeps;

export function configureClarityClientDeps(overrides: Partial<ClarityClientDeps>): void {
  clientDeps = { ...defaultDeps, ...overrides };
}

export function resetClarityClientDeps(): void {
  clientDeps = defaultDeps;
}

async function fetchClarityInsightsRequest(input: {
  url: string;
  apiToken: string;
}): Promise<ClarityApiResponse> {
  const response = await clarityHttpRequest<ClarityApiResponse>({
    url: input.url,
    headers: {
      Authorization: `Bearer ${input.apiToken}`,
    },
    timeoutMs: 30_000,
  });

  if (!Array.isArray(response.data)) {
    throw new ClarityApiError({
      code: "invalid_response",
      message: "Clarity API returned an unexpected response shape",
      retryable: false,
    });
  }

  return response.data;
}

export async function fetchClarityAnalyticsReport(input: {
  projectId: string;
  apiToken: string;
  numOfDays?: ClarityNumOfDays;
}): Promise<ClarityRawReport> {
  if (!input.projectId.trim()) {
    throw new ClarityApiError({
      code: "missing_project",
      message: "Microsoft Clarity project ID is required",
      retryable: false,
    });
  }

  if (!input.apiToken.trim()) {
    throw new ClarityApiError({
      code: "revoked_credentials",
      message: "Microsoft Clarity API token is required",
      retryable: false,
    });
  }

  const numOfDays = input.numOfDays ?? 3;

  const [aggregate, pages, devices, browsers, countries] = await Promise.all([
    clientDeps.fetchInsights({
      url: buildClarityAggregateInsightsUrl(numOfDays),
      apiToken: input.apiToken,
    }),
    clientDeps.fetchInsights({
      url: buildClarityPageInsightsUrl(numOfDays),
      apiToken: input.apiToken,
    }),
    clientDeps.fetchInsights({
      url: buildClarityDeviceInsightsUrl(numOfDays),
      apiToken: input.apiToken,
    }),
    clientDeps.fetchInsights({
      url: buildClarityBrowserInsightsUrl(numOfDays),
      apiToken: input.apiToken,
    }),
    clientDeps.fetchInsights({
      url: buildClarityCountryInsightsUrl(numOfDays),
      apiToken: input.apiToken,
    }),
  ]);

  const fetched: ClarityFetchedReports = {
    projectId: input.projectId,
    numOfDays,
    aggregate,
    pages,
    devices,
    browsers,
    countries,
  };

  return buildClarityRawReport(fetched);
}
