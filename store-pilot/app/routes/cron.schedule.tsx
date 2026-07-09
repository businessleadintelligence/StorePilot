import type { HeadersFunction, LoaderFunctionArgs } from "react-router";

import { listAllProductionSchedules } from "../services/cron-scheduler.server";

export function headers(): ReturnType<HeadersFunction> {
  return {
    "Cache-Control": "no-store",
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  const schedules = listAllProductionSchedules();

  if (format === "vercel") {
    return Response.json({
      crons: schedules.map((schedule) => ({
        path: schedule.path,
        schedule: schedule.schedule,
      })),
    });
  }

  return Response.json({
    service: "store-pilot",
    mode: "cron-schedule",
    timestamp: new Date().toISOString(),
    count: schedules.length,
    schedules,
  });
};
