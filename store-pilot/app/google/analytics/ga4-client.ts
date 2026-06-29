import {
  buildGa4DateRanges,
  buildGa4ReportQueries,
  toGa4PropertyResourceName,
} from "./ga4-query-builder";
import {
  buildGa4RawReport,
  type Ga4FetchedReports,
  type Ga4RawReport,
} from "./ga4-parser";
import type { Ga4RunReportRequest } from "./ga4-query-builder";
import { GoogleApiError } from "../shared/google-api-error";
import { googleHttpRequest } from "../shared/google-http";

type Ga4RunReportResponse = Ga4FetchedReports["summary"];

type FetchGa4ReportInput = {
  propertyId: string;
  accessToken: string;
  referenceDate?: Date;
};

type Ga4ClientDeps = {
  runReport: typeof runGa4ReportRequest;
};

const defaultDeps: Ga4ClientDeps = {
  runReport: runGa4ReportRequest,
};

let clientDeps: Ga4ClientDeps = defaultDeps;

export function configureGa4ClientDeps(overrides: Partial<Ga4ClientDeps>): void {
  clientDeps = { ...defaultDeps, ...overrides };
}

export function resetGa4ClientDeps(): void {
  clientDeps = defaultDeps;
}

async function runGa4ReportRequest(input: {
  propertyId: string;
  accessToken: string;
  request: Ga4RunReportRequest;
}): Promise<Ga4RunReportResponse> {
  const property = toGa4PropertyResourceName(input.propertyId);
  const response = await googleHttpRequest<Ga4RunReportResponse>({
    url: `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: input.request,
    rateLimitKey: `ga4:${property}`,
  });

  return response.data;
}

export async function fetchGa4AnalyticsReport(input: FetchGa4ReportInput): Promise<Ga4RawReport> {
  if (!input.propertyId) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google Analytics property ID is required",
      retryable: false,
    });
  }

  const queries = buildGa4ReportQueries(input.referenceDate);
  const dateRanges = buildGa4DateRanges(input.referenceDate);

  const [summary, channels, landingPages, devices, countries] = await Promise.all([
    clientDeps.runReport({
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      request: queries.summary,
    }),
    clientDeps.runReport({
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      request: queries.channels,
    }),
    clientDeps.runReport({
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      request: queries.landingPages,
    }),
    clientDeps.runReport({
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      request: {
        dateRanges: queries.channels.dateRanges,
        metrics: [{ name: "sessions" }],
        dimensions: [{ name: "deviceCategory" }],
        limit: "10",
      },
    }),
    clientDeps.runReport({
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      request: {
        dateRanges: queries.channels.dateRanges,
        metrics: [{ name: "sessions" }],
        dimensions: [{ name: "country" }],
        limit: "10",
      },
    }),
  ]);

  const fetched: Ga4FetchedReports = {
    propertyId: input.propertyId,
    dateRanges,
    summary,
    channels,
    landingPages,
    devices,
    countries,
  };

  return buildGa4RawReport(fetched);
}
