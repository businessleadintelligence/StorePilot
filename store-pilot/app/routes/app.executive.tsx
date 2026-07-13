import type { HeadersFunction } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";
import {
  createIntelligenceWorkspaceLoader,
  getExecutiveWorkspaceData,
} from "../services/intelligence-workspace.server";

export const loader = createIntelligenceWorkspaceLoader(getExecutiveWorkspaceData);

export default function ExecutiveIntelligenceRoute() {
  return <IntelligenceWorkspaceRoute title="Executive Intelligence" />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
