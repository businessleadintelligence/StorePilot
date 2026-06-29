import type { ProductionDashboardData, ProductionSubsystemHealth } from "../../production/production-types";
import { polarisToneFromLevel } from "../../production/production-status";

type SystemHealthDashboardProps = {
  dashboard: ProductionDashboardData;
};

function SubsystemGrid({ items }: { items: ProductionSubsystemHealth[] }) {
  return (
    <s-grid gridTemplateColumns="@container (inline-size > 700px) repeat(3, 1fr), 1fr" gap="base">
      {items.map((item) => (
        <s-grid-item key={item.id}>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack gap="small-200">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text type="strong">{item.label}</s-text>
                <s-badge tone={polarisToneFromLevel(item.level)}>{item.level}</s-badge>
              </s-stack>
              <s-text color="subdued">Score: {item.healthScore}</s-text>
              {item.lastSync ? (
                <s-text color="subdued">Last sync: {item.lastSync}</s-text>
              ) : null}
              {item.lastError ? <s-text tone="critical">{item.lastError}</s-text> : null}
              {item.recoverySuggestion ? (
                <s-text color="subdued">{item.recoverySuggestion}</s-text>
              ) : null}
            </s-stack>
          </s-box>
        </s-grid-item>
      ))}
    </s-grid>
  );
}

export function SystemHealthDashboard({ dashboard }: SystemHealthDashboardProps) {
  return (
    <s-page heading="System Health">
      <s-section heading="Overall Platform Health">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text type="strong">Platform status</s-text>
            <s-badge tone={dashboard.settingsBadge.tone}>{dashboard.settingsBadge.label}</s-badge>
            <s-text color="subdued">Score: {dashboard.overallHealthScore}</s-text>
            <s-text color="subdued">Level: {dashboard.overallLevel}</s-text>
            <s-text color="subdued">Computed in {dashboard.aggregationDurationMs}ms</s-text>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Connector Status">
        <SubsystemGrid items={dashboard.sections.connectors} />
      </s-section>

      <s-section heading="Sync Timeline">
        <s-stack gap="small-200">
          {dashboard.syncTimeline.slice(0, 12).map((entry) => (
            <s-box key={entry.label} padding="small-200" background="subdued" borderRadius="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text>{entry.label}</s-text>
                <s-badge tone={polarisToneFromLevel(entry.level)}>{entry.level}</s-badge>
                <s-text color="subdued">{entry.at ?? "Never"}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Webhook Health">
        <SubsystemGrid items={dashboard.sections.pipelines.filter((item) => item.id === "webhooks")} />
      </s-section>

      <s-section heading="Background Jobs">
        <SubsystemGrid
          items={dashboard.sections.pipelines.filter((item) => item.id === "background_jobs")}
        />
      </s-section>

      <s-section heading="AI Platform">
        <SubsystemGrid items={dashboard.sections.platforms.filter((item) => item.id === "ai_platform")} />
      </s-section>

      <s-section heading="Automation">
        <SubsystemGrid
          items={dashboard.sections.platforms.filter((item) => item.id === "automation")}
        />
      </s-section>

      <s-section heading="Operations">
        <SubsystemGrid
          items={dashboard.sections.platforms.filter((item) => item.id === "operations")}
        />
      </s-section>

      <s-section heading="Security">
        <SubsystemGrid
          items={dashboard.sections.infrastructure.filter((item) => item.id === "security")}
        />
      </s-section>

      <s-section heading="Performance">
        <SubsystemGrid
          items={dashboard.sections.infrastructure.filter((item) => item.id === "performance")}
        />
      </s-section>

      <s-section heading="Data Quality">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-text type="strong">Store-wide score</s-text>
              <s-heading>{dashboard.dataQuality.score}</s-heading>
            </s-stack>
            <s-text color="subdued">
              Completeness {dashboard.dataQuality.completeness} · Freshness{" "}
              {dashboard.dataQuality.freshness} · Reliability {dashboard.dataQuality.reliability}
            </s-text>
            <s-stack gap="small-100">
              {dashboard.dataQuality.impactChain.map((line) => (
                <s-text key={line} color="subdued">
                  {line}
                </s-text>
              ))}
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Recent Alerts">
        <s-stack gap="small-200">
          {dashboard.alerts.length === 0 ? (
            <s-text color="subdued">No active alerts.</s-text>
          ) : (
            dashboard.alerts.slice(0, 10).map((alert) => (
              <s-box key={alert.id} padding="base" background="subdued" borderRadius="base">
                <s-stack gap="small-100">
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-badge
                      tone={
                        alert.severity === "critical" || alert.severity === "emergency"
                          ? "critical"
                          : alert.severity === "warning"
                            ? "warning"
                            : undefined
                      }
                    >
                      {alert.severity}
                    </s-badge>
                    <s-text type="strong">{alert.title}</s-text>
                  </s-stack>
                  <s-text color="subdued">{alert.message}</s-text>
                </s-stack>
              </s-box>
            ))
          )}
        </s-stack>
      </s-section>

      <s-section heading="Recovery Actions">
        <s-stack gap="small-200">
          {dashboard.recoveryActions.length === 0 ? (
            <s-text color="subdued">All monitored systems are within healthy thresholds.</s-text>
          ) : (
            dashboard.recoveryActions.map((action) => (
              <s-box key={action.id} padding="base" background="subdued" borderRadius="base">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-text>{action.label}</s-text>
                  {action.href ? <s-link href={action.href}>Open</s-link> : null}
                </s-stack>
              </s-box>
            ))
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}
