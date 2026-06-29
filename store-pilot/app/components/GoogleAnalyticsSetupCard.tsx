import type { GoogleIntegrationPublicView } from "../types/store-dashboard";

type GoogleAnalyticsSetupCardProps = {
  integration: GoogleIntegrationPublicView;
};

export function GoogleAnalyticsSetupCard({ integration }: GoogleAnalyticsSetupCardProps) {
  if (integration.connected || integration.googleAnalyticsSkipped) {
    return null;
  }

  return (
    <s-section heading="Optional setup: Google Analytics">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-text type="strong">Connect Google Analytics for richer revenue intelligence</s-text>
          <s-paragraph color="subdued">
            Optional. Connecting GA4 improves revenue, growth, and executive confidence scores.
            You can skip this step and connect later from Settings.
          </s-paragraph>
          <s-stack direction="inline" gap="base">
            <form method="post" action="/app/settings">
              <input type="hidden" name="intent" value="connect-google" />
              <s-button variant="primary" type="submit" disabled={!integration.configured}>
                Connect Google
              </s-button>
            </form>
            <form method="post" action="/app/settings">
              <input type="hidden" name="intent" value="skip-google-analytics" />
              <s-button type="submit">Skip for now</s-button>
            </form>
          </s-stack>
          {!integration.configured ? (
            <s-paragraph color="subdued">
              Google OAuth is not configured in this environment.
            </s-paragraph>
          ) : null}
        </s-stack>
      </s-box>
    </s-section>
  );
}
