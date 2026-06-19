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

export default function RecommendationsPage() {
  return (
    <s-page heading="Recommendations">

      <s-section heading="Detect">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Operational issue detection</s-text>
              <s-badge tone="critical">Detect</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No operational issues detected yet.</s-text>
                <s-paragraph color="subdued">
                  StorePilot will identify revenue leaks, inventory risks,
                  conversion drops, and refund spikes before they impact your
                  business.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Explain">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Issue cause analysis</s-text>
              <s-badge tone="warning">Explain</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">
                  Issue explanations will appear here after StorePilot begins monitoring.
                </s-text>
                <s-paragraph color="subdued">
                  StorePilot explains why each issue happened — in business
                  language, not raw metrics.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Recommend">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Recommended actions</s-text>
              <s-badge tone="success">Recommend</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No recommendations available yet.</s-text>
                <s-paragraph color="subdued">
                  Complete recommendations with estimated revenue impact and
                  specific actions will appear here when issues are detected.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Recommendation Details">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text color="subdued">Recommendation details panel</s-text>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Select a recommendation to view details</s-text>
                <s-paragraph color="subdued">
                  Every StorePilot recommendation includes a complete set of
                  information so you can act without further analysis.
                </s-paragraph>
              </s-stack>
            </s-box>
            <s-unordered-list>
              <s-list-item>Problem</s-list-item>
              <s-list-item>Likely Cause</s-list-item>
              <s-list-item>Estimated Revenue Impact</s-list-item>
              <s-list-item>Recommended Action</s-list-item>
              <s-list-item>Confidence Score</s-list-item>
            </s-unordered-list>
            <s-text color="subdued">Tracking status</s-text>
            <s-unordered-list>
              <s-list-item>Pending</s-list-item>
              <s-list-item>Accepted</s-list-item>
              <s-list-item>Ignored</s-list-item>
              <s-list-item>Completed</s-list-item>
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
