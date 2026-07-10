import type { MerchantIntelligenceUiData } from "../shared/types";

type AdaptiveScoreCardProps = {
  score: number;
};

export function AdaptiveScoreCard({ score }: AdaptiveScoreCardProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">Adaptive Intelligence</s-text>
          <s-badge tone={score >= 70 ? "success" : score >= 50 ? "warning" : "critical"}>
            {score}/100
          </s-badge>
        </s-stack>
        <s-text color="subdued">
          How well StorePilot learns from your decisions and business outcomes.
        </s-text>
      </s-stack>
    </s-box>
  );
}

type MerchantBehaviorCardProps = {
  behavior: NonNullable<MerchantIntelligenceUiData["behaviorProfile"]>;
};

export function MerchantBehaviorCard({ behavior }: MerchantBehaviorCardProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">Merchant behavior profile</s-text>
        <s-text color="subdued">
          Pricing acceptance: {Math.round(behavior.acceptsPricingChanges * 100)}% · SEO engagement:{" "}
          {Math.round((1 - behavior.ignoresSeo) * 100)}% · Risk preference:{" "}
          {behavior.prefersLowRisk > 0.6 ? "Low" : "Balanced"}
        </s-text>
      </s-stack>
    </s-box>
  );
}

type PersonalizationInsightsProps = {
  personalization: NonNullable<MerchantIntelligenceUiData["personalization"]>;
};

export function PersonalizationInsights({ personalization }: PersonalizationInsightsProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">Personalization</s-text>
        <s-text color="subdued">Style: {personalization.decisionStyle}</s-text>
        <s-text color="subdued">
          Priority: {personalization.priorityDomains.join(", ") || "Balanced"}
        </s-text>
        {personalization.deprioritizedDomains.length > 0 ? (
          <s-text color="subdued">
            Deprioritized: {personalization.deprioritizedDomains.join(", ")}
          </s-text>
        ) : null}
      </s-stack>
    </s-box>
  );
}

type TimelineViewerProps = {
  events: MerchantIntelligenceUiData["recentTimeline"];
};

export function TimelineViewer({ events }: TimelineViewerProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">Merchant timeline</s-text>
        {events.length === 0 ? (
          <s-text color="subdued">No timeline events yet.</s-text>
        ) : (
          events.map((event) => (
            <s-text key={`${event.eventCategory}:${event.title}`} color="subdued">
              {event.title} ({event.eventCategory})
            </s-text>
          ))
        )}
      </s-stack>
    </s-box>
  );
}

type LearningProgressCardProps = {
  stage: string;
  dnaVersion: number;
  journalCount: number;
};

export function LearningProgressCard({ stage, dnaVersion, journalCount }: LearningProgressCardProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">Learning progress</s-text>
        <s-text color="subdued">Stage: {stage}</s-text>
        <s-text color="subdued">Business DNA v{dnaVersion}</s-text>
        <s-text color="subdued">{journalCount}+ decision journal entries</s-text>
      </s-stack>
    </s-box>
  );
}
