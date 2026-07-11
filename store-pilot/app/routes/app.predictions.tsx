import type { HeadersFunction } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createFeatureGatedWorkspaceLoader,
  getPredictionsWorkspaceData,
} from "../services/intelligence-workspace.server";
import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";

export const loader = createFeatureGatedWorkspaceLoader({
  feature: "prediction_workspace",
  builder: getPredictionsWorkspaceData,
});

export default function PredictionsWorkspaceRoute() {
  return <IntelligenceWorkspaceRoute />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
