import type {
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createFeatureGatedWorkspaceLoader,
  getExperimentsWorkspaceData,
} from "../services/intelligence-workspace.server";
import { handleExperimentWorkspaceAction } from "../services/intelligence-workspace-actions.server";
import { renderIntelligenceWorkspace } from "../services/intelligence-workspace-views";

export const loader = createFeatureGatedWorkspaceLoader({
  feature: "experiment_workspace",
  builder: getExperimentsWorkspaceData,
});

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleExperimentWorkspaceAction(request);
};

export default function ExperimentsWorkspaceRoute() {
  const data = useLoaderData<typeof loader>();
  return renderIntelligenceWorkspace(data);
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
