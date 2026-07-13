import type { HeadersFunction } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createIntelligenceWorkspaceLoader,
  getDomainWorkspaceData,
} from "../services/intelligence-workspace.server";
import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";

export const loader = createIntelligenceWorkspaceLoader((ctx, request) =>
  getDomainWorkspaceData(ctx, "seo", request),
);

export default function WorkspaceRoute() {
  return <IntelligenceWorkspaceRoute title="SEO Intelligence" />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
