import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { isAuthorizedCronRequest } from "../services/cron-auth.server";
import { dispatchCronJob, getCronSchedule } from "../services/cron-scheduler.server";

function methodNotAllowedResponse(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}

function unauthorizedResponse(reason: string): Response {
  return Response.json(
    {
      success: false,
      error: "Unauthorized",
      reason,
    },
    { status: 401 },
  );
}

function notFoundResponse(jobId: string): Response {
  return Response.json(
    {
      success: false,
      error: "Unknown cron job",
      jobId,
    },
    { status: 404 },
  );
}

async function handleCronDispatch(
  request: Request,
  jobId: string,
): Promise<Response> {
  const authorization = isAuthorizedCronRequest(request);
  if (!authorization.authorized) {
    return unauthorizedResponse(authorization.reason ?? "unauthorized");
  }

  if (!getCronSchedule(jobId)) {
    return notFoundResponse(jobId);
  }

  const dispatch = await dispatchCronJob(jobId);

  return Response.json(
    {
      success: dispatch.ok,
      ...dispatch,
    },
    { status: dispatch.ok ? 200 : 500 },
  );
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const jobId = params.jobId?.trim();
  if (!jobId) {
    return Response.json({ success: false, error: "missing_job_id" }, { status: 400 });
  }

  return handleCronDispatch(request, jobId);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const jobId = params.jobId?.trim();
  if (!jobId) {
    return Response.json({ success: false, error: "missing_job_id" }, { status: 400 });
  }

  return handleCronDispatch(request, jobId);
};
