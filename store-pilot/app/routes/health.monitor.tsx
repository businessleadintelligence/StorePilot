import type { HeadersFunction } from "react-router";

import { getMonitoringReport } from "../services/monitoring.server";

export function headers(): ReturnType<HeadersFunction> {
  return {
    "Cache-Control": "no-store",
  };
}

export const loader = async () => {
  const report = await getMonitoringReport();
  return Response.json(report, { status: report.ok ? 200 : 503 });
};
