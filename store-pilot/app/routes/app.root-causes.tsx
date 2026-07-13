import type { HeadersFunction } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createIntelligenceWorkspaceLoader,
  getRootCausesWorkspaceData,
} from "../services/intelligence-workspace.server";
import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";

export const loader = createIntelligenceWorkspaceLoader(getRootCausesWorkspaceData);

export default function WorkspaceRoute() {
  return <IntelligenceWorkspaceRoute title="Root Cause" />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
