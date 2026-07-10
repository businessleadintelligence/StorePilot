import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { WORKSPACE_NAV, WORKSPACE_ROUTES } from "../intelligence-ui/constants";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
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
