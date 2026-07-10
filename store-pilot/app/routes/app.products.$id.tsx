import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  getProductDetailWorkspaceData,
  resolveStoreContext,
} from "../services/intelligence-workspace.server";
import { renderIntelligenceWorkspace } from "../services/intelligence-workspace-views";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const ctx = await resolveStoreContext(request);
  if (!ctx || !params.id) {
    return { workspace: null, searchResults: [], timeline: [], currency: "USD" };
  }
  return getProductDetailWorkspaceData(ctx, params.id);
};

export default function ProductDetailWorkspaceRoute() {
  const data = useLoaderData<typeof loader>();
  return renderIntelligenceWorkspace(data);
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
