import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { IntelligenceWorkspaceRoute } from "../components/intelligence/IntelligenceWorkspaceRoute";
import {
  createIntelligenceWorkspaceLoader,
  getProductDetailWorkspaceData,
} from "../services/intelligence-workspace.server";

export const loader = async (args: LoaderFunctionArgs) => {
  const productId = args.params.id;
  if (!productId) {
    return {
      workspace: null,
      searchResults: [],
      timeline: [],
      currency: "USD",
    };
  }

  const innerLoader = createIntelligenceWorkspaceLoader((ctx, request) =>
    getProductDetailWorkspaceData(ctx, productId, request),
  );
  return innerLoader(args);
};

export default function ProductDetailWorkspaceRoute() {
  return <IntelligenceWorkspaceRoute title="Product Detail" />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
