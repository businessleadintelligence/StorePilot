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

export default function IssuesPage() {
  return (
    <s-page heading="Issues Center">

      <s-section heading="Critical Issues">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Critical severity</s-text>
              <s-badge tone="critical">Critical</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No critical issues detected</s-text>
                <s-paragraph color="subdued">
                  High-severity store issues requiring immediate attention will
                  appear here when detected.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Warning Issues">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Warning severity</s-text>
              <s-badge tone="warning">Warning</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No warning issues detected</s-text>
                <s-paragraph color="subdued">
                  Medium-priority issues that should be reviewed will appear
                  here when detected.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Resolved Issues">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Recently resolved</s-text>
              <s-badge tone="success">Resolved</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No resolved issues</s-text>
                <s-paragraph color="subdued">
                  Issues that have been addressed will be listed here for
                  reference and audit history.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Issue Details">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text color="subdued">Issue details panel</s-text>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Select an issue to view details</s-text>
                <s-paragraph color="subdued">
                  Issue title, severity, impact, and recommended actions will
                  appear here when an issue is selected.
                </s-paragraph>
              </s-stack>
            </s-box>
            <s-unordered-list>
              <s-list-item>Severity</s-list-item>
              <s-list-item>Impact</s-list-item>
              <s-list-item>Status</s-list-item>
              <s-list-item>Recommended action</s-list-item>
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
