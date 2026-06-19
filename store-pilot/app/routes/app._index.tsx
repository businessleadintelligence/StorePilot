import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";

import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="StorePilot">

      <s-section heading="AI COO Status">
        <s-query-container>
          <s-grid
            gridTemplateColumns="@container (inline-size > 900px) repeat(5, 1fr), @container (inline-size > 500px) repeat(2, 1fr), 1fr"
            gap="base"
          >
            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Store Health Score</s-text>
                  <s-heading>N/A</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Revenue At Risk</s-text>
                  <s-heading>N/A</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Revenue Opportunity</s-text>
                  <s-heading>N/A</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Critical Issues</s-text>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-heading>0</s-heading>
                    <s-badge tone="critical">Critical</s-badge>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Warning Issues</s-text>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-heading>0</s-heading>
                    <s-badge tone="warning">Warning</s-badge>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-grid-item>
          </s-grid>
        </s-query-container>
      </s-section>

      <s-section heading="Today's Executive Brief">
        <s-box
          padding="base"
          background="subdued"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge>Executive Brief</s-badge>
              <s-text color="subdued">Daily summary</s-text>
            </s-stack>
            <s-paragraph>
              Your executive brief will appear here after StorePilot completes
              its first analysis cycle.
            </s-paragraph>
            <s-paragraph color="subdued">
              This section will surface key performance highlights, operational
              risks, and recommended focus areas for the day.
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Priority Issues">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Active priority issues</s-text>
              <s-link href="/app/issues">View all issues</s-link>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No priority issues</s-text>
                <s-paragraph color="subdued">
                  Critical and high-priority store issues will be listed here
                  when detected.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Revenue Opportunities">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Identified opportunities</s-text>
              <s-link href="/app/recommendations">View recommendations</s-link>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No opportunities yet</s-text>
                <s-paragraph color="subdued">
                  Revenue opportunities will appear here after StorePilot
                  analyzes your store data.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Platform Status">
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text>StorePilot</s-text>
            <s-badge tone="success">Online</s-badge>
          </s-stack>
          <s-paragraph color="subdued">
            Operational intelligence platform
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Shopify Connected">
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text>Store connection</s-text>
            <s-badge tone="success">Connected</s-badge>
          </s-stack>
          <s-paragraph color="subdued">
            Your Shopify store is linked and ready for analysis.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Dashboard Shell V2">
        <s-stack gap="base">
          <s-badge>UI Shell</s-badge>
          <s-paragraph color="subdued">
            Dashboard layout preview. Metrics and briefings will be populated
            in future releases.
          </s-paragraph>
          <s-unordered-list>
            <s-list-item>AI COO Status</s-list-item>
            <s-list-item>Executive Brief</s-list-item>
            <s-list-item>Priority Issues</s-list-item>
            <s-list-item>Revenue Opportunities</s-list-item>
          </s-unordered-list>
        </s-stack>
      </s-section>

    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
