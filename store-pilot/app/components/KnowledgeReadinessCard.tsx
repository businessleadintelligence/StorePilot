import type { KnowledgeReadinessUiData } from "../services/knowledge-readiness-ui.server";

type KnowledgeReadinessCardProps = {
  readiness: KnowledgeReadinessUiData;
};

export function KnowledgeReadinessCard({ readiness }: KnowledgeReadinessCardProps) {
  return (
    <s-section heading="AI knowledge readiness">
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
              StorePilot is learning your business ({readiness.overallPercent}% ready)
            </s-text>
            <s-text color="subdued">
              Intelligence domains become available as operational evidence is collected.
            </s-text>
          </s-stack>

          <s-stack gap="small-200">
            {readiness.domains.map((domain) => (
              <s-stack key={domain.domain} gap="small-100">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text>{domain.label}</s-text>
                  <s-text color="subdued">{domain.percent}%</s-text>
                </s-stack>
                <s-box padding="small-100" background="subdued" borderRadius="base">
                  <div
                    role="progressbar"
                    aria-valuenow={domain.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${domain.label} readiness`}
                    style={{
                      height: "6px",
                      borderRadius: "999px",
                      background: "var(--p-color-bg-surface-secondary, #e3e3e3)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, domain.percent))}%`,
                        height: "100%",
                        borderRadius: "999px",
                        background: "var(--p-color-bg-fill-info, #005bd3)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </s-box>
              </s-stack>
            ))}
          </s-stack>
        </s-stack>
      </s-box>
    </s-section>
  );
}
