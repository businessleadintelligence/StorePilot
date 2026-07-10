import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { WORKSPACE_NAV, WORKSPACE_ROUTES } from "../intelligence-ui/constants";
import {
  authenticateAdminOnce,
  getSessionShop,
} from "../lib/request-auth.server";
import {
  getRequestLogContext,
  logRouteLoader,
} from "../lib/route-loader-log.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { route, requestId } = getRequestLogContext(request);

  try {
    const { session } = await authenticateAdminOnce(request);
    const shop = getSessionShop(session) ?? null;

    logRouteLoader("info", "App layout loader completed", {
      route,
      function: "loader",
      shop,
      requestId,
      operation: "app_layout_loaded",
    });

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop,
    };
  } catch (error) {
    logRouteLoader("error", "App layout loader failed", {
      route,
      function: "loader",
      requestId,
      operation: "app_layout_loader_failed",
      reason: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href={WORKSPACE_ROUTES.dashboard}>Dashboard</s-link>

        {WORKSPACE_NAV.map((item) => (
          <s-link key={item.href} href={item.href}>
            {item.label}
          </s-link>
        ))}

        <s-link href={WORKSPACE_ROUTES.coo}>COO Dashboard</s-link>
        <s-link href="/app/command-center">Command Center</s-link>
        <s-link href="/app/operations">Operations</s-link>
        <s-link href="/app/recommendations">Recommendations</s-link>
        <s-link href={WORKSPACE_ROUTES.settings}>Settings</s-link>
        <s-link href="/app/onboarding">Setup</s-link>
        <s-link href="/app/billing">Billing</s-link>
        <s-link href="/app/system-health">System Health</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
