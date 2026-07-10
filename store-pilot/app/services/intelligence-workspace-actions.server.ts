import type { ActionFunctionArgs } from "react-router";

import { approveExperiment, dismissExperiment } from "../experiments/api/experiment-api";
import { resolveStoreContext } from "./intelligence-workspace.server";

export async function handleExperimentWorkspaceAction(request: ActionFunctionArgs["request"]) {
  const ctx = await resolveStoreContext(request);
  if (!ctx) {
    return Response.json({ ok: false, error: "missing_store" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const experimentId = String(formData.get("experimentId") ?? "");

  if (!experimentId) {
    return Response.json({ ok: false, error: "missing_experiment" }, { status: 400 });
  }

  if (intent === "approve") {
    await approveExperiment(ctx.storeId, experimentId);
    return Response.json({ ok: true });
  }

  if (intent === "dismiss") {
    await dismissExperiment(ctx.storeId, experimentId);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "unsupported_intent" }, { status: 400 });
}
