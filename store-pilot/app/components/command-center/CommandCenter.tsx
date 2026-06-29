import { Form } from "react-router";

import type { CommandCenterData } from "../../services/command-center.types";
import type { ExecutiveRecommendationView } from "../../services/executive-dashboard.types";
import { formatCurrency, formatDurationMs, formatRelativeTime } from "../../lib/format";
import { CommandCenterChart } from "./CommandCenterChart";
import { HealthRing } from "./HealthRing";
import styles from "./command-center.module.css";

type CommandCenterProps = {
  data: CommandCenterData;
  onOpenRecommendation: (recommendation: ExecutiveRecommendationView) => void;
};

function toneClass(tone: "success" | "warning" | "danger" | "info"): string {
  if (tone === "success") {
    return styles.toneSuccess;
  }

  if (tone === "warning") {
    return styles.toneWarning;
  }

  if (tone === "danger") {
    return styles.toneDanger;
  }

  return styles.toneInfo;
}

function timelineDotClass(tone: "success" | "warning" | "danger" | "info"): string {
  if (tone === "success") {
    return styles.timelineDotSuccess;
  }

  if (tone === "warning") {
    return styles.timelineDotWarning;
  }

  if (tone === "danger") {
    return styles.timelineDotDanger;
  }

  return styles.timelineDotInfo;
}

function sumImpact(recommendation: ExecutiveRecommendationView): number {
  return (
    (recommendation.estimatedImpact.revenueRecovered ?? 0) +
    (recommendation.estimatedImpact.revenueOpportunity ?? 0) +
    (recommendation.estimatedImpact.estimatedLostSales ?? 0) +
    (recommendation.estimatedImpact.marginImprovement ?? 0) +
    (recommendation.estimatedImpact.inventoryCostSaved ?? 0)
  );
}

function RecommendationCard({
  recommendation,
  onOpenRecommendation,
  currency,
}: {
  recommendation: ExecutiveRecommendationView;
  onOpenRecommendation: (recommendation: ExecutiveRecommendationView) => void;
  currency: string;
}) {
  const impactTotal = sumImpact(recommendation);

  return (
    <article
      className={`${styles.card} ${styles.recommendationCard}`}
      aria-label={recommendation.title}
    >
      <div className={styles.chipRow}>
        <span
          className={`${styles.chip} ${
            recommendation.group === "Critical Risks" ? styles.chipCritical : styles.chipSuccess
          }`}
        >
          Priority {recommendation.priority}
        </span>
        <span className={styles.chip}>{Math.round(recommendation.confidence * 100)}% confidence</span>
        <span className={styles.chip}>{recommendation.difficulty}</span>
      </div>

      <div>
        <h3 className={styles.sectionTitle}>{recommendation.title}</h3>
        <p className={styles.cardMeta}>{recommendation.reason}</p>
      </div>

      <div className={styles.cardMeta}>
        Estimated impact: {impactTotal > 0 ? formatCurrency(impactTotal, currency) : recommendation.businessImpact}
      </div>

      {recommendation.evidence.length > 0 ? (
        <div>
          <div className={styles.cardLabel}>Evidence</div>
          <ul className={styles.evidenceList}>
            {recommendation.evidence.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendation.tasks.length > 0 ? (
        <div>
          <div className={styles.cardLabel}>Tasks</div>
          <ul className={styles.taskList}>
            {recommendation.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.buttonRow}>
        <Form method="post">
          <input type="hidden" name="intent" value="implement" />
          <input type="hidden" name="stableId" value={recommendation.stableId} />
          <input type="hidden" name="subjectKey" value={recommendation.subjectKey} />
          <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`}>
            Implement
          </button>
        </Form>
        <Form method="post">
          <input type="hidden" name="intent" value="dismiss" />
          <input type="hidden" name="stableId" value={recommendation.stableId} />
          <input type="hidden" name="subjectKey" value={recommendation.subjectKey} />
          <button type="submit" className={styles.button}>
            Dismiss
          </button>
        </Form>
        <Form method="post">
          <input type="hidden" name="intent" value="snooze" />
          <input type="hidden" name="stableId" value={recommendation.stableId} />
          <input type="hidden" name="subjectKey" value={recommendation.subjectKey} />
          <button type="submit" className={styles.button}>
            Snooze
          </button>
        </Form>
        <button
          type="button"
          className={styles.button}
          onClick={() => onOpenRecommendation(recommendation)}
        >
          Details
        </button>
      </div>
    </article>
  );
}

export function CommandCenter({ data, onOpenRecommendation }: CommandCenterProps) {
  const openRecommendations = data.executive.recommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const spotlight = data.executive.productSpotlight;

  return (
    <div className={styles.dashboard}>
      <div className={styles.shell}>
        <header className={styles.hero} aria-label="AI Command Center header">
          <div className={styles.heroCopy}>
            <section className={styles.section} aria-label="AI briefing">
              <h1 className={styles.heroTitle}>
                {data.header.greeting}, {data.header.merchantName}
              </h1>
              <p className={styles.heroSubtitle}>{data.briefing.headline}</p>
              <ul className={styles.briefingList}>
                {data.briefing.paragraphs.map((paragraph) => (
                  <li key={paragraph}>{paragraph}</li>
                ))}
              </ul>
            </section>

            <div className={styles.heroStats}>
              <div className={styles.statTile}>
                <div className={styles.statValue}>{data.header.storeHealth} / 100</div>
                <div className={styles.statLabel}>Today&apos;s Store Health</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statValue}>{data.header.criticalIssues}</div>
                <div className={styles.statLabel}>Critical Issues</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statValue}>{data.header.opportunities}</div>
                <div className={styles.statLabel}>Opportunities</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statValue}>
                  +{formatCurrency(data.header.potentialRevenue, data.currency)}/month
                </div>
                <div className={styles.statLabel}>Potential Revenue</div>
              </div>
            </div>
          </div>

          <section className={styles.section} aria-label="Store health ring">
            <HealthRing ring={data.healthRing} />
          </section>
        </header>

        <div className={styles.layoutGrid}>
          <div className={styles.stack}>
            <section className={styles.section} aria-label="AI activity feed">
              <h2 className={styles.sectionTitle}>AI Activity Feed</h2>
              {data.activityFeed.length === 0 ? (
                <div className={styles.emptyState}>
                  Activity will appear after Product Intelligence runs and merchant actions are recorded.
                </div>
              ) : (
                <div className={styles.activityFeed}>
                  {data.activityFeed.map((item) => (
                    <article
                      key={item.id}
                      className={`${styles.activityItem} ${toneClass(item.tone)}`}
                      aria-label={item.title}
                    >
                      <div className={styles.activityHeader}>
                        <div>
                          <div className={styles.activityTitle}>{item.title}</div>
                          <div className={styles.cardMeta}>{item.detail}</div>
                        </div>
                        <div className={styles.cardMeta}>{formatRelativeTime(item.at)}</div>
                      </div>
                      <div className={styles.activityMetrics}>
                        {item.metrics.map((metric) => (
                          <div key={`${item.id}-${metric.label}`}>
                            <div className={styles.cardLabel}>{metric.label}</div>
                            <div>{metric.value}</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.section} aria-label="Executive snapshot">
              <h2 className={styles.sectionTitle}>Executive Snapshot</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Revenue</div>
                  <div className={styles.cardValue}>
                    {formatCurrency(data.executive.metrics.grossRevenue, data.currency)}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Orders</div>
                  <div className={styles.cardValue}>{data.executive.metrics.orders}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Refunds</div>
                  <div className={styles.cardValue}>
                    {formatCurrency(
                      data.charts.revenueVsRefunds.reduce((total, point) => total + point.refunds, 0),
                      data.currency,
                    )}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Inventory</div>
                  <div className={styles.cardValue}>{data.executive.metrics.inventoryUnits}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Store Health</div>
                  <div className={styles.cardValue}>{data.executive.summaryCards.storeHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.executive.summaryCards.openRecommendations}</div>
                </div>
              </div>
              <div className={styles.analyticsGrid} style={{ marginTop: 16 }}>
                <CommandCenterChart
                  title="Revenue trend"
                  points={data.executive.analytics.revenueTrend}
                  ariaLabel="Executive revenue trend chart"
                  formatValue={(value) => formatCurrency(value, data.currency)}
                />
                <CommandCenterChart
                  title="Inventory trend"
                  points={data.executive.analytics.inventoryTrend}
                  ariaLabel="Executive inventory trend chart"
                  variant="bar"
                />
              </div>
            </section>
          </div>

          <div className={styles.stack}>
            <section className={styles.section} aria-label="AI cost widget">
              <h2 className={styles.sectionTitle}>Today&apos;s AI Usage</h2>
              <div className={styles.costWidget}>
                <div className={styles.costRow}>
                  <span>Credits Used</span>
                  <strong>{data.costWidget.creditsUsed}</strong>
                </div>
                <div className={styles.costRow}>
                  <span>Remaining Credits</span>
                  <strong>{data.costWidget.remainingCredits}</strong>
                </div>
                <div className={styles.costRow}>
                  <span>Estimated Value Generated</span>
                  <strong>
                    {formatCurrency(data.costWidget.estimatedValueGenerated, data.currency)}
                  </strong>
                </div>
              </div>
            </section>

            <section className={styles.section} aria-label="Active AI agents">
              <h2 className={styles.sectionTitle}>Active AI Agents</h2>
              <div className={styles.agentGrid}>
                {data.agents.map((agent) => (
                  <article key={agent.id} className={`${styles.card} ${styles.agentCard}`}>
                    <div>
                      <div className={styles.sectionTitle}>{agent.name}</div>
                      <div
                        className={
                          agent.status === "healthy"
                            ? styles.agentStatusHealthy
                            : agent.status === "waiting"
                              ? styles.agentStatusWaiting
                              : styles.agentStatusSoon
                        }
                      >
                        {agent.healthLabel}
                      </div>
                    </div>
                    <p className={styles.cardMeta}>{agent.description}</p>
                    {agent.status === "coming_soon" ? (
                      <div className={styles.cardMeta}>Planned capability · not active yet</div>
                    ) : (
                      <>
                        <div className={styles.cardMeta}>
                          Last run: {agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : "Not yet"}
                        </div>
                        <div className={styles.cardMeta}>
                          Duration: {formatDurationMs(agent.durationMs)}
                        </div>
                        <div className={styles.cardMeta}>
                          Recommendations: {agent.recommendationCount ?? 0}
                        </div>
                        <div className={styles.cardMeta}>
                          Latency: {agent.latencyMs ? `${(agent.latencyMs / 1000).toFixed(1)} sec` : "—"}
                        </div>
                        <div className={styles.cardMeta}>
                          Cost: {agent.costUsd != null ? formatCurrency(agent.costUsd, data.currency) : "—"}
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.section} aria-label="Inventory Intelligence">
              <h2 className={styles.sectionTitle}>Inventory Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Inventory Health</div>
                  <div className={styles.cardValue}>{data.inventoryIntelligence.inventoryHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.inventoryIntelligence.openRecommendations}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Stockout Alerts</div>
                  <div className={styles.cardValue}>{data.inventoryIntelligence.stockoutAlerts}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Dead Stock Alerts</div>
                  <div className={styles.cardValue}>{data.inventoryIntelligence.deadStockAlerts}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Recent Executions</div>
                  <div className={styles.cardValue}>{data.inventoryIntelligence.recentExecutions}</div>
                </div>
              </div>
              {data.inventoryIntelligence.recommendationGroups.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Inventory recommendation groups"
                    points={data.inventoryIntelligence.recommendationGroups}
                    ariaLabel="Inventory recommendation groups chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.inventoryIntelligence.inventoryAlerts.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Inventory alerts"
                    points={data.inventoryIntelligence.inventoryAlerts}
                    ariaLabel="Inventory alerts chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.inventoryIntelligence.opportunityPipeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Inventory opportunity pipeline"
                    points={data.inventoryIntelligence.opportunityPipeline}
                    ariaLabel="Inventory opportunity pipeline chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.inventoryIntelligence.inventoryTrend.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Inventory trend"
                    points={data.inventoryIntelligence.inventoryTrend}
                    ariaLabel="Inventory trend chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Bundle Discovery">
              <h2 className={styles.sectionTitle}>Bundle Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Bundle Health</div>
                  <div className={styles.cardValue}>{data.bundleDiscovery.bundleHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.bundleDiscovery.openRecommendations}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Top Opportunities</div>
                  <div className={styles.cardValue}>{data.bundleDiscovery.topOpportunities}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Inventory Reduction</div>
                  <div className={styles.cardValue}>{data.bundleDiscovery.potentialInventoryReduction}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Potential Attach Rate</div>
                  <div className={styles.cardValue}>{data.bundleDiscovery.potentialAttachRate}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Recent Executions</div>
                  <div className={styles.cardValue}>{data.bundleDiscovery.recentExecutions}</div>
                </div>
              </div>
              {data.bundleDiscovery.recommendationGroups.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Bundle opportunity widget"
                    points={data.bundleDiscovery.recommendationGroups}
                    ariaLabel="Bundle recommendation groups chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Store Audit Intelligence">
              <h2 className={styles.sectionTitle}>Store Audit Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Overall Audit Score</div>
                  <div className={styles.cardValue}>{data.storeAudit.overallAuditScore}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Store Health</div>
                  <div className={styles.cardValue}>{data.storeAudit.storeHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Homepage Score</div>
                  <div className={styles.cardValue}>{data.storeAudit.homepageScore}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>SEO Score</div>
                  <div className={styles.cardValue}>{data.storeAudit.seoScore}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Accessibility Score</div>
                  <div className={styles.cardValue}>{data.storeAudit.accessibilityScore}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Performance Score</div>
                  <div className={styles.cardValue}>{data.storeAudit.performanceScore}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.storeAudit.openRecommendations}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Critical Issues</div>
                  <div className={styles.cardValue}>{data.storeAudit.criticalIssues}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Recent Executions</div>
                  <div className={styles.cardValue}>{data.storeAudit.recentExecutions}</div>
                </div>
              </div>
              {data.storeAudit.quickWins.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Quick Wins"
                    points={data.storeAudit.quickWins}
                    ariaLabel="Store audit quick wins chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.storeAudit.criticalIssueFeed.length > 0 ? (
                <ul className={styles.list} aria-label="Critical issue feed">
                  {data.storeAudit.criticalIssueFeed.map((issue) => (
                    <li key={issue.id}>
                      {issue.title} · {issue.category}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.storeAudit.healthTrend.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Health Trend"
                    points={data.storeAudit.healthTrend}
                    ariaLabel="Store audit health trend chart"
                  />
                </div>
              ) : null}
              {data.storeAudit.categoryBreakdown.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Category Breakdown"
                    points={data.storeAudit.categoryBreakdown}
                    ariaLabel="Store audit category breakdown chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.storeAudit.recommendationGroups.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Audit opportunity pipeline"
                    points={data.storeAudit.opportunityPipeline}
                    ariaLabel="Store audit opportunity pipeline chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.storeAudit.seoWidgets.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="SEO widgets"
                    points={data.storeAudit.seoWidgets}
                    ariaLabel="Store audit SEO widgets chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.storeAudit.accessibilityWidgets.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Accessibility widgets"
                    points={data.storeAudit.accessibilityWidgets}
                    ariaLabel="Store audit accessibility widgets chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.storeAudit.performanceWidgets.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Performance widgets"
                    points={data.storeAudit.performanceWidgets}
                    ariaLabel="Store audit performance widgets chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Trend Intelligence">
              <h2 className={styles.sectionTitle}>Trend Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Trend Health</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.trendHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Direction</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.trendDirection}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Emerging Products</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.emergingCount}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Declining Products</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.decliningCount}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Growth Alerts</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.growthAlerts}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Decline Alerts</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.declineAlerts}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.openRecommendations}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Recent Executions</div>
                  <div className={styles.cardValue}>{data.trendIntelligence.recentExecutions}</div>
                </div>
              </div>
              {data.trendIntelligence.momentumCharts.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Momentum charts"
                    points={data.trendIntelligence.momentumCharts}
                    ariaLabel="Trend momentum charts"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.trendIntelligence.opportunityPipeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Trend pipeline"
                    points={data.trendIntelligence.opportunityPipeline}
                    ariaLabel="Trend opportunity pipeline chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="SEO Intelligence">
              <h2 className={styles.sectionTitle}>SEO Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>SEO Health</div>
                  <div className={styles.cardValue}>{data.seoIntelligence.seoHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Organic Opportunity</div>
                  <div className={styles.cardValue}>{data.seoIntelligence.organicOpportunity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Search Visibility</div>
                  <div className={styles.cardValue}>{data.seoIntelligence.searchVisibility}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Core Web Vitals</div>
                  <div className={styles.cardValue}>{data.seoIntelligence.coreWebVitals}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.seoIntelligence.openRecommendations}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Critical SEO Issues</div>
                  <div className={styles.cardValue}>{data.seoIntelligence.criticalIssues}</div>
                </div>
              </div>
              {data.seoIntelligence.quickWins.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Quick Wins"
                    points={data.seoIntelligence.quickWins}
                    ariaLabel="SEO quick wins chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.seoIntelligence.criticalSeoFeed.length > 0 ? (
                <ul className={styles.actionList} style={{ marginTop: 16 }}>
                  {data.seoIntelligence.criticalSeoFeed.map((issue) => (
                    <li key={issue.id}>
                      {issue.title} · {issue.category}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.seoIntelligence.seoTimeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="SEO Timeline"
                    points={data.seoIntelligence.seoTimeline}
                    ariaLabel="SEO timeline chart"
                  />
                </div>
              ) : null}
              {data.seoIntelligence.organicGrowth.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Organic Growth"
                    points={data.seoIntelligence.organicGrowth}
                    ariaLabel="Organic growth chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.seoIntelligence.trendHistory.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Trend History"
                    points={data.seoIntelligence.trendHistory}
                    ariaLabel="SEO trend history chart"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Pricing Strategy Intelligence">
              <h2 className={styles.sectionTitle}>Pricing Strategy Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Pricing Health</div>
                  <div className={styles.cardValue}>{data.pricingIntelligence.pricingHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Margin</div>
                  <div className={styles.cardValue}>{data.pricingIntelligence.marginPercent}%</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Profit Opportunity</div>
                  <div className={styles.cardValue}>{data.pricingIntelligence.profitOpportunity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Revenue Opportunity</div>
                  <div className={styles.cardValue}>{data.pricingIntelligence.revenueOpportunity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Open Recommendations</div>
                  <div className={styles.cardValue}>{data.pricingIntelligence.openRecommendations}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Critical Pricing Risks</div>
                  <div className={styles.cardValue}>{data.pricingIntelligence.criticalPricingRisks}</div>
                </div>
              </div>
              {data.pricingIntelligence.criticalPricingFeed.length > 0 ? (
                <ul className={styles.actionList} style={{ marginTop: 16 }}>
                  {data.pricingIntelligence.criticalPricingFeed.map((issue) => (
                    <li key={issue.id}>
                      {issue.title} · {issue.category}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.pricingIntelligence.pricingTimeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Pricing Timeline"
                    points={data.pricingIntelligence.pricingTimeline}
                    ariaLabel="Pricing timeline chart"
                  />
                </div>
              ) : null}
              {data.pricingIntelligence.marginTrend.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Margin Trend"
                    points={data.pricingIntelligence.marginTrend}
                    ariaLabel="Margin trend chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.pricingIntelligence.recommendationGroups.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Recommendation Groups"
                    points={data.pricingIntelligence.recommendationGroups}
                    ariaLabel="Pricing recommendation groups chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.pricingIntelligence.opportunityPipeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Opportunity Pipeline"
                    points={data.pricingIntelligence.opportunityPipeline}
                    ariaLabel="Pricing opportunity pipeline chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Revenue Growth Intelligence">
              <h2 className={styles.sectionTitle}>Revenue Growth Intelligence</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Growth Score</div>
                  <div className={styles.cardValue}>{data.growthIntelligence.growthScore}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Monthly Revenue Opportunity</div>
                  <div className={styles.cardValue}>{data.growthIntelligence.monthlyRevenueOpportunity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>AOV Opportunity</div>
                  <div className={styles.cardValue}>{data.growthIntelligence.aovOpportunity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Repeat Purchase Opportunity</div>
                  <div className={styles.cardValue}>{data.growthIntelligence.repeatPurchaseOpportunity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Expansion Readiness</div>
                  <div className={styles.cardValue}>{data.growthIntelligence.expansionReadiness}</div>
                </div>
              </div>
              {data.growthIntelligence.criticalGrowthFeed.length > 0 ? (
                <ul className={styles.actionList} style={{ marginTop: 16 }}>
                  {data.growthIntelligence.criticalGrowthFeed.map((issue) => (
                    <li key={issue.id}>
                      {issue.title} · {issue.category}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.growthIntelligence.campaignTimeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Campaign Timeline"
                    points={data.growthIntelligence.campaignTimeline}
                    ariaLabel="Growth campaign timeline chart"
                  />
                </div>
              ) : null}
              {data.growthIntelligence.growthTrend.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Growth Trend"
                    points={data.growthIntelligence.growthTrend}
                    ariaLabel="Growth trend chart"
                  />
                </div>
              ) : null}
              {data.growthIntelligence.recommendationGroups.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Recommendation Groups"
                    points={data.growthIntelligence.recommendationGroups}
                    ariaLabel="Growth recommendation groups chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.growthIntelligence.opportunityPipeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Opportunity Pipeline"
                    points={data.growthIntelligence.opportunityPipeline}
                    ariaLabel="Growth opportunity pipeline chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Executive COO">
              <h2 className={styles.sectionTitle}>Executive COO</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Today&apos;s Priority</div>
                  <div className={styles.cardMeta}>
                    {data.executiveCoo.todaysPriority ?? "No executive priority yet"}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Business Health</div>
                  <div className={styles.cardValue}>{data.executiveCoo.businessHealth}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Executive Confidence</div>
                  <div className={styles.cardValue}>{data.executiveCoo.executiveConfidence}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Merchant Capacity</div>
                  <div className={styles.cardValue}>{data.executiveCoo.merchantCapacity}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Business Momentum</div>
                  <div className={styles.cardValue}>{data.executiveCoo.businessMomentum}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Critical Path</div>
                  <div className={styles.cardValue}>{data.executiveCoo.criticalPathLength}</div>
                </div>
              </div>
              {data.executiveCoo.criticalPriorityFeed.length > 0 ? (
                <ul className={styles.actionList} style={{ marginTop: 16 }}>
                  {data.executiveCoo.criticalPriorityFeed.map((issue) => (
                    <li key={issue.id}>
                      {issue.title} · {issue.category}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.executiveCoo.executionTimeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Execution Timeline"
                    points={data.executiveCoo.executionTimeline}
                    ariaLabel="Executive COO execution timeline chart"
                  />
                </div>
              ) : null}
              {data.executiveCoo.businessHealthTrend.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Business Health Trend"
                    points={data.executiveCoo.businessHealthTrend}
                    ariaLabel="Executive COO business health trend chart"
                  />
                </div>
              ) : null}
              {data.executiveCoo.focusAreaGroups.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Focus Area Groups"
                    points={data.executiveCoo.focusAreaGroups}
                    ariaLabel="Executive COO focus area groups chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.executiveCoo.opportunityPipeline.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Opportunity Pipeline"
                    points={data.executiveCoo.opportunityPipeline}
                    ariaLabel="Executive COO opportunity pipeline chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Executive Decisions">
              <h2 className={styles.sectionTitle}>Executive Decisions</h2>
              <div className={styles.executiveGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Top Decision</div>
                  <div className={styles.cardMeta}>
                    {data.executiveDecisions.topDecision ?? "No executive decision yet"}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>AI Consensus Score</div>
                  <div className={styles.cardValue}>
                    {Math.round(data.executiveDecisions.consensusScore * 100)}%
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Conflicts</div>
                  <div className={styles.cardValue}>{data.executiveDecisions.conflictCount}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Dependencies</div>
                  <div className={styles.cardValue}>{data.executiveDecisions.dependencyCount}</div>
                </div>
              </div>
              {data.executiveDecisions.decisions.length > 0 ? (
                <ul className={styles.actionList} style={{ marginTop: 16 }}>
                  {data.executiveDecisions.decisions.slice(0, 5).map((decision) => (
                    <li key={decision.id}>
                      {decision.title}
                      {decision.hasConflict ? " · Conflict" : ""}
                      {decision.hasDependency ? " · Dependency" : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.executiveDecisions.charts.consensusGauge.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Consensus gauge"
                    points={data.executiveDecisions.charts.consensusGauge}
                    ariaLabel="Executive consensus gauge"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.executiveDecisions.charts.agentInfluenceRadar.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Agent influence radar"
                    points={data.executiveDecisions.charts.agentInfluenceRadar}
                    ariaLabel="Agent influence radar chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.executiveDecisions.charts.conflictHeatmap.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="Conflict heatmap"
                    points={data.executiveDecisions.charts.conflictHeatmap}
                    ariaLabel="Conflict heatmap chart"
                    variant="bar"
                  />
                </div>
              ) : null}
              {data.executiveDecisions.charts.roiWaterfall.some((item) => item.value > 0) ? (
                <div style={{ marginTop: 16 }}>
                  <CommandCenterChart
                    title="ROI waterfall"
                    points={data.executiveDecisions.charts.roiWaterfall}
                    ariaLabel="Executive ROI waterfall chart"
                    variant="bar"
                  />
                </div>
              ) : null}
            </section>
          </div>
        </div>

        {spotlight ? (
          <section className={`${styles.section} ${styles.spotlight}`} aria-label="Product spotlight">
            <div>
              <h2 className={styles.sectionTitle}>Product Spotlight</h2>
              <h3 className={styles.heroTitle}>{spotlight.title}</h3>
              <p className={styles.heroSubtitle}>
                Best opportunity from persisted Product Intelligence results.
              </p>
              <div className={styles.spotlightMetrics}>
                <div className={styles.metricTile}>
                  <div className={styles.cardLabel}>Health Score</div>
                  <div className={styles.cardValue}>{spotlight.healthScore ?? "—"}</div>
                </div>
                <div className={styles.metricTile}>
                  <div className={styles.cardLabel}>Trend</div>
                  <div className={styles.cardMeta}>{spotlight.revenueTrend}</div>
                </div>
                <div className={styles.metricTile}>
                  <div className={styles.cardLabel}>Revenue Impact</div>
                  <div className={styles.cardValue}>
                    {formatCurrency(spotlight.expectedRevenueImpact, data.currency)}
                  </div>
                </div>
                <div className={styles.metricTile}>
                  <div className={styles.cardLabel}>Velocity</div>
                  <div className={styles.cardValue}>{spotlight.velocity ?? "—"}</div>
                </div>
                <div className={styles.metricTile}>
                  <div className={styles.cardLabel}>Inventory</div>
                  <div className={styles.cardValue}>{spotlight.inventoryDays ?? "—"} days</div>
                </div>
                <div className={styles.metricTile}>
                  <div className={styles.cardLabel}>Impact</div>
                  <div className={styles.cardMeta}>{spotlight.opportunity ?? spotlight.risk ?? "—"}</div>
                </div>
              </div>
              {spotlight.recommendations[0] ? (
                <div className={styles.cardMeta}>
                  Primary recommendation: {spotlight.recommendations[0].title}
                </div>
              ) : null}
              {spotlight.recommendations[0] ? (
                <div className={styles.buttonRow} style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    onClick={() => onOpenRecommendation(spotlight.recommendations[0])}
                  >
                    View Details
                  </button>
                </div>
              ) : null}
            </div>
            <div>
              <div className={styles.cardLabel}>Recommendations</div>
              <ul className={styles.actionList}>
                {spotlight.recommendations.map((item) => (
                  <li key={item.stableId}>{item.title}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-label="Opportunity pipeline">
          <h2 className={styles.sectionTitle}>Opportunity Pipeline</h2>
          <div className={styles.pipeline}>
            {(
              [
                ["Critical", data.pipeline.critical],
                ["High", data.pipeline.high],
                ["Medium", data.pipeline.medium],
                ["Low", data.pipeline.low],
              ] as const
            ).map(([label, items]) => (
              <div key={label} className={styles.pipelineColumn} aria-label={`${label} priority pipeline`}>
                <div className={styles.pipelineHeader}>{label}</div>
                {items.length === 0 ? (
                  <div className={styles.emptyState}>No items</div>
                ) : (
                  items.map((item) => (
                    <div key={item.stableId} className={styles.pipelineCard}>
                      <div>{item.title}</div>
                      <div className={styles.cardMeta}>
                        {formatCurrency(sumImpact(item), data.currency)} ·{" "}
                        {Math.round(item.confidence * 100)}% confidence
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-label="AI recommendation feed">
          <h2 className={styles.sectionTitle}>AI Recommendation Feed</h2>
          {openRecommendations.length === 0 ? (
            <div className={styles.emptyState}>
              Recommendations will appear here after Product Intelligence analysis runs.
            </div>
          ) : (
            <div className={styles.recommendationGrid}>
              {openRecommendations.slice(0, 8).map((recommendation) => (
                <RecommendationCard
                  key={recommendation.stableId}
                  recommendation={recommendation}
                  onOpenRecommendation={onOpenRecommendation}
                  currency={data.currency}
                />
              ))}
            </div>
          )}
        </section>

        <section className={styles.section} aria-label="AI timeline">
          <h2 className={styles.sectionTitle}>AI Timeline</h2>
          {data.aiTimeline.length === 0 ? (
            <div className={styles.emptyState}>Timeline events will appear as AI runs and actions are recorded.</div>
          ) : (
            <div className={styles.timeline}>
              {data.aiTimeline.map((event) => (
                <div key={event.id} className={styles.timelineItem}>
                  <div className={styles.timelineTime}>{event.timeLabel}</div>
                  <div className={`${styles.timelineDot} ${timelineDotClass(event.tone)}`} aria-hidden="true" />
                  <div>
                    <div>{event.title}</div>
                    <div className={styles.cardMeta}>
                      {event.detail} · {new Date(event.at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section} aria-label="Command center analytics">
          <h2 className={styles.sectionTitle}>Store Intelligence Charts</h2>
          <div className={styles.analyticsGrid}>
            <CommandCenterChart
              title="Revenue trend"
              points={data.charts.revenueTrend}
              ariaLabel="Revenue trend chart"
              formatValue={(value) => formatCurrency(value, data.currency)}
            />
            <CommandCenterChart
              title="Revenue vs refunds"
              points={data.charts.revenueVsRefunds.map((point) => ({
                label: point.label,
                value: point.revenue,
              }))}
              secondaryPoints={data.charts.revenueVsRefunds.map((point) => ({
                label: point.label,
                value: point.refunds,
              }))}
              secondaryLabel="Refunds"
              ariaLabel="Revenue versus refunds chart"
              formatValue={(value) => formatCurrency(value, data.currency)}
            />
            <CommandCenterChart
              title="Top products"
              points={data.charts.topProducts}
              ariaLabel="Top products chart"
              variant="bar"
            />
            <CommandCenterChart
              title="Bottom products"
              points={data.charts.bottomProducts}
              ariaLabel="Bottom products chart"
              variant="bar"
            />
            <CommandCenterChart
              title="Health score history"
              points={data.charts.healthScoreHistory}
              ariaLabel="Health score history chart"
            />
            <CommandCenterChart
              title="Recommendation categories"
              points={data.charts.recommendationCategories}
              ariaLabel="Recommendation categories chart"
              variant="bar"
            />
            <CommandCenterChart
              title="Inventory aging"
              points={data.charts.inventoryAge}
              ariaLabel="Inventory aging chart"
              variant="bar"
            />
            <CommandCenterChart
              title="Recommendation status distribution"
              points={data.charts.recommendationStatus}
              ariaLabel="Recommendation status distribution chart"
              variant="bar"
            />
            <CommandCenterChart
              title="Revenue opportunity funnel"
              points={data.charts.revenueOpportunityFunnel}
              ariaLabel="Revenue opportunity funnel chart"
              variant="bar"
            />
            <CommandCenterChart
              title="Store health breakdown"
              points={data.charts.storeHealthBreakdown}
              ariaLabel="Store health breakdown chart"
              variant="bar"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
