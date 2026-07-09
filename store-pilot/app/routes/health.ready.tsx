import type { HeadersFunction } from "react-router";

import { getReadinessReport } from "../services/monitoring.server";

export function headers(): ReturnType<HeadersFunction> {
  return {
    "Cache-Control": "no-store",
  };
}

export const loader = async () => {
  const readiness = await getReadinessReport();
  return Response.json(readiness, { status: readiness.ok ? 200 : 503 });
};
