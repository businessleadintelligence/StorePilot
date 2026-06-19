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

export default function TimelinePage() {
  return (
    <s-page heading="Business Timeline">

      <s-section heading="Recent Activity">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Latest store events</s-text>
              <s-badge>Activity</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No business events detected yet.</s-text>
                <s-paragraph color="subdued">
                  Revenue changes, inventory alerts, and operational milestones
                  will appear here as StorePilot monitors your store.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Issue History">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Detected issues</s-text>
              <s-badge tone="warning">Issues</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">
                  Issue events will appear here when StorePilot begins monitoring.
                </s-text>
                <s-paragraph color="subdued">
                  Anomaly detections and priority issues will be logged
                  chronologically in this section.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Resolution History">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Completed actions</s-text>
              <s-badge tone="success">Resolved</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">
                  Resolved issues and completed actions will appear here.
                </s-text>
                <s-paragraph color="subdued">
                  Recommendation completions and issue resolutions will be
                  recorded here for audit and reference.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Timeline Information">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text color="subdued">Timeline details panel</s-text>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Select an event to view details</s-text>
                <s-paragraph color="subdued">
                  Event context, severity, and status will appear here when
                  an event is selected from the timeline.
                </s-paragraph>
              </s-stack>
            </s-box>
            <s-unordered-list>
              <s-list-item>Event Type</s-list-item>
              <s-list-item>Severity</s-list-item>
              <s-list-item>Timestamp</s-list-item>
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
