import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";
import { isReactRouterDataRequest } from "../lib/react-router-request.server";
import {
  getProductDetailWorkspaceData,
  resolveStoreContext,
} from "../services/intelligence-workspace.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const ctx = await resolveStoreContext(request);
  if (!ctx || !params.id) {
    return { workspace: null, searchResults: [], timeline: [], currency: "USD" };
  }
  if (!isReactRouterDataRequest(request)) {
    return {
      workspace: null,
      searchResults: [],
      timeline: [],
      currency: ctx.currency,
      deferWorkspaceLoad: true,
    };
  }
  return getProductDetailWorkspaceData(ctx, params.id);
};

export default function ProductDetailWorkspaceRoute() {
  return <IntelligenceWorkspaceRoute />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
