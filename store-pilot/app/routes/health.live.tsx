import type { HeadersFunction } from "react-router";

import { getLivenessReport } from "../services/monitoring.server";

export function headers(): ReturnType<HeadersFunction> {
  return {
    "Cache-Control": "no-store",
  };
}

export const loader = async () => {
  return Response.json(getLivenessReport());
};
