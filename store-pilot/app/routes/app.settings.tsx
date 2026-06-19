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

export default function SettingsPage() {
  return (
    <s-page heading="Settings">

      <s-section heading="Briefing Preferences">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Daily COO briefing schedule</s-text>
              <s-badge>Daily</s-badge>
            </s-stack>
            <s-text-field
              label="Briefing delivery time"
              value="Not configured"
              disabled
            />
            <s-text-field
              label="Timezone"
              value="Not configured"
              disabled
            />
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Briefing schedule not configured yet.</s-text>
                <s-paragraph color="subdued">
                  Your daily COO briefing delivery time will take effect once
                  StorePilot monitoring is enabled.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Integrations">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text type="strong">Connected services</s-text>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Shopify</s-text>
                  <s-badge tone="success">Connected</s-badge>
                </s-stack>
                <s-paragraph color="subdued">
                  Your Shopify store is linked and ready for analysis.
                </s-paragraph>
              </s-stack>
            </s-box>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Google Analytics 4</s-text>
                  <s-badge tone="warning">Not connected</s-badge>
                </s-stack>
                <s-paragraph color="subdued">
                  Optional. Unlocks traffic and checkout anomaly detection.
                </s-paragraph>
                <s-button disabled>Connect GA4</s-button>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Notifications">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Critical alerts</s-text>
              <s-badge tone="critical">Alerts</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">
                  Critical alert preferences will appear here.
                </s-text>
                <s-paragraph color="subdued">
                  StorePilot sends alerts for high-impact issues only to avoid
                  alert fatigue.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Account & Plan">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Subscription</s-text>
              <s-badge>Starter</s-badge>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Current plan: Starter</s-text>
                <s-paragraph color="subdued">
                  Trial status: Not started
                </s-paragraph>
                <s-paragraph color="subdued">
                  Plan changes and billing are managed through Shopify.
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Configuration Help">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text color="subdued">Settings reference panel</s-text>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Configuration overview</s-text>
                <s-paragraph color="subdued">
                  These settings control how StorePilot communicates with you
                  and which data sources power your operational intelligence.
                </s-paragraph>
              </s-stack>
            </s-box>
            <s-unordered-list>
              <s-list-item>Briefing delivery time</s-list-item>
              <s-list-item>Timezone</s-list-item>
              <s-list-item>GA4 connection</s-list-item>
              <s-list-item>Plan and billing</s-list-item>
              <s-list-item>Critical alerts</s-list-item>
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
