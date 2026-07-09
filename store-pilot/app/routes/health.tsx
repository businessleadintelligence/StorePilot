import type { HeadersFunction, LoaderFunctionArgs } from "react-router";

import {
  getLivenessReport,
  getMonitoringReport,
  getReadinessReport,
} from "../services/monitoring.server";

export function headers(): ReturnType<HeadersFunction> {
  return {
    "Cache-Control": "no-store",
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("ready") === "1") {
    const readiness = await getReadinessReport();
    return Response.json(readiness, { status: readiness.ok ? 200 : 503 });
  }

  if (url.searchParams.get("monitor") === "1") {
    const report = await getMonitoringReport();
    return Response.json(report, { status: report.ok ? 200 : 503 });
  }

  return Response.json(getLivenessReport());
};
