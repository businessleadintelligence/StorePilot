import type { HeadersFunction } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  createFeatureGatedWorkspaceLoader,
  getMerchantIntelligenceWorkspaceData,
} from "../services/intelligence-workspace.server";
import { renderIntelligenceWorkspace } from "../services/intelligence-workspace-views";

export const loader = createFeatureGatedWorkspaceLoader({
  feature: "merchant_intelligence",
  builder: getMerchantIntelligenceWorkspaceData,
});

export default function MerchantIntelligenceWorkspaceRoute() {
  const data = useLoaderData<typeof loader>();
  return renderIntelligenceWorkspace(data);
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
