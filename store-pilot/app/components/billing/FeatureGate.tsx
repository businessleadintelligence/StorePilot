import type { ReactNode } from "react";
import type { FeatureGateViewModel } from "../../billing/billing-types";

type FeatureUpgradePanelProps = {
  gate: FeatureGateViewModel;
};

export function FeatureUpgradePanel({ gate }: FeatureUpgradePanelProps) {
  return (
    <s-section heading={gate.featureName}>
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-stack gap="base">
          <s-text type="strong">{gate.featureName}</s-text>
          <s-text color="subdued">
            Available on {gate.minimumPlanName}
          </s-text>
          <s-text>{gate.upgradeText}</s-text>
          <s-text color="subdued">
            Current plan: {gate.currentPlanName}
            {gate.upgradePriceUsd != null
              ? ` · Upgrade from $${gate.upgradePriceUsd}/month`
              : null}
          </s-text>
          <s-stack direction="inline" gap="base">
            <s-link href="/app/billing">
              <s-button>Upgrade Now</s-button>
            </s-link>
            <s-link href="/app/settings">View billing in Settings</s-link>
          </s-stack>
        </s-stack>
      </s-box>
    </s-section>
  );
}

type FeatureGateProps = {
  gate: FeatureGateViewModel;
  children: ReactNode;
};

export function FeatureGate({ gate, children }: FeatureGateProps) {
  if (!gate.available) {
    return <FeatureUpgradePanel gate={gate} />;
  }
  return <>{children}</>;
}

export function UpgradeModalSummary({ gate }: FeatureUpgradePanelProps) {
  return (
    <s-stack gap="small-200">
      <s-text type="strong">Upgrade to unlock {gate.featureName}</s-text>
      <s-text>Current plan: {gate.currentPlanName}</s-text>
      <s-text>Target plan: {gate.minimumPlanName}</s-text>
      {gate.upgradePriceUsd != null ? (
        <s-text>${gate.upgradePriceUsd}/month</s-text>
      ) : null}
      <s-text color="subdued">{gate.upgradeText}</s-text>
      <s-link href="/app/billing">
        <s-button>Upgrade</s-button>
      </s-link>
    </s-stack>
  );
}
