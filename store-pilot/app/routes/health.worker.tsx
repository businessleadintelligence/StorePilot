import type { HeadersFunction } from "react-router";

import { getWorkerInfrastructureHealth } from "../services/worker-health.server";

export function headers(): ReturnType<HeadersFunction> {
  return {
    "Cache-Control": "no-store",
  };
}

export const loader = async () => {
  const health = await getWorkerInfrastructureHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
};
