import type {
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createFeatureGatedWorkspaceLoader,
  getExperimentsWorkspaceData,
} from "../services/intelligence-workspace.server";
import { handleExperimentWorkspaceAction } from "../services/intelligence-workspace-actions.server";
import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";

export const loader = createFeatureGatedWorkspaceLoader({
  feature: "experiment_workspace",
  builder: getExperimentsWorkspaceData,
});

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleExperimentWorkspaceAction(request);
};

export default function ExperimentsWorkspaceRoute() {
  return <IntelligenceWorkspaceRoute title="Experiments" />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
