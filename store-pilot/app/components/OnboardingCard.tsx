import type { MerchantOnboardingLoaderData } from "../lib/onboarding-display";
import {
  getOnboardingPhaseDisplays,
  getPhaseIconCharacter,
} from "../lib/onboarding-display";

type OnboardingCardProps = {
  onboarding: MerchantOnboardingLoaderData;
};

export function OnboardingCard({ onboarding }: OnboardingCardProps) {
  const phases = getOnboardingPhaseDisplays({
    status: onboarding.status,
    progressPercent: onboarding.progressPercent,
    progressLabel: onboarding.progressLabel,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    blockedReason: onboarding.ordersBlockedDisplay ? "access_denied" : null,
    blockedMessage: onboarding.ordersBlockedDisplay?.primary ?? null,
    currentJobId: null,
    startedAt: onboarding.startedAt ? new Date(onboarding.startedAt) : null,
    completedAt: onboarding.completedAt
      ? new Date(onboarding.completedAt)
      : null,
  });
  const blockedDisplay = onboarding.ordersBlockedDisplay;
  const progressPercent = Math.max(
    0,
    Math.min(100, onboarding.progressPercent),
  );

  return (
    <s-section heading="Store setup in progress">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-stack gap="small-200">
            <s-text type="strong">
              {onboarding.progressLabel ?? "Setting up your store"}
            </s-text>
            <s-text color="subdued">
              StorePilot is syncing your Shopify data so your dashboard can go
              live.
            </s-text>
          </s-stack>

          <s-stack gap="small-200">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text color="subdued">Progress</s-text>
              <s-text color="subdued">{progressPercent}%</s-text>
            </s-stack>
            <s-box padding="small-100" background="subdued" borderRadius="base">
              <div
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Store setup progress"
                style={{
                  height: "8px",
                  borderRadius: "999px",
                  background: "var(--p-color-bg-surface-secondary, #e3e3e3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: "var(--p-color-bg-fill-success, #29845a)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </s-box>
          </s-stack>

          <s-stack gap="small-200">
            <s-text type="strong">Setup phases</s-text>
            {phases.map((phase) => (
              <s-stack
                key={phase.key}
                direction="inline"
                gap="small-200"
                alignItems="center"
              >
                <s-text>{getPhaseIconCharacter(phase.icon)}</s-text>
                <s-text>{phase.label}</s-text>
              </s-stack>
            ))}
          </s-stack>

          {blockedDisplay ? (
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">{blockedDisplay.heading}</s-text>
                <s-paragraph>{blockedDisplay.primary}</s-paragraph>
                <s-paragraph color="subdued">{blockedDisplay.secondary}</s-paragraph>
              </s-stack>
            </s-box>
          ) : null}
        </s-stack>
      </s-box>
    </s-section>
  );
}
