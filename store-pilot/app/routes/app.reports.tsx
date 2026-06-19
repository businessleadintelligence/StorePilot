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

export default function ReportsPage() {
  return (
    <s-page heading="COO Reports">

      <s-section heading="Daily COO Briefing">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Daily executive summary</s-text>
              <s-badge>Daily</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No daily briefing available yet.</s-text>
                <s-paragraph color="subdued">
                  Your daily COO briefing will appear here once StorePilot
                  completes its first analysis cycle.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Weekly COO Report">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Weekly business review</s-text>
              <s-badge tone="warning">Weekly</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No weekly report available yet.</s-text>
                <s-paragraph color="subdued">
                  Weekly COO reports will summarize revenue trends, operational
                  performance, recommendations, opportunities, and risks.
                </s-paragraph>
                <s-paragraph color="subdued">
                  Available in Growth and Agency plans when reporting is enabled.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Monthly Executive Review">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Monthly ROI summary</s-text>
              <s-badge tone="success">Monthly</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No executive review available yet.</s-text>
                <s-paragraph color="subdued">
                  Monthly executive reviews will highlight ROI, business impact,
                  and the value StorePilot has generated for your store.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Report Details">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text color="subdued">Report details panel</s-text>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Select a report to view details</s-text>
                <s-paragraph color="subdued">
                  Report type, generation date, and summary will appear here
                  when a report is selected.
                </s-paragraph>
              </s-stack>
            </s-box>
            <s-unordered-list>
              <s-list-item>Report Type</s-list-item>
              <s-list-item>Generated Date</s-list-item>
              <s-list-item>Summary</s-list-item>
              <s-list-item>Status</s-list-item>
            </s-unordered-list>
          </s-stack>
        </s-box>
      </s-section>

    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
