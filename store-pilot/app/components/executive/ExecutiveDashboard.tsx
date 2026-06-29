import { useState } from "react";
import { Form } from "react-router";

import {
  EXECUTIVE_RECOMMENDATION_GROUPS,
  type ExecutiveDashboardData,
  type ExecutiveRecommendationGroup,
  type ExecutiveRecommendationView,
} from "../../services/executive-dashboard.types";
import { formatCurrency } from "../../lib/format";
import { ExecutiveChart } from "./ExecutiveChart";
import styles from "./executive-dashboard.module.css";

type ExecutiveDashboardProps = {
  dashboard: ExecutiveDashboardData;
  onOpenRecommendation: (recommendation: ExecutiveRecommendationView) => void;
};

const SUMMARY_CARD_CONFIG = [
  { key: "storeHealth", label: "Store Health" },
  { key: "revenueHealth", label: "Revenue Health" },
  { key: "inventoryHealth", label: "Inventory Health" },
  { key: "growthScore", label: "Growth Score" },
  { key: "aiConfidence", label: "AI Confidence", format: (value: number) => `${Math.round(value * 100)}%` },
  { key: "openRecommendations", label: "Open Recommendations" },
  { key: "highPriorityTasks", label: "High Priority Tasks" },
] as const;

function RecommendationCard({
  recommendation,
  onOpenRecommendation,
}: {
  recommendation: ExecutiveRecommendationView;
  onOpenRecommendation: (recommendation: ExecutiveRecommendationView) => void;
}) {
  const impactTotal =
    (recommendation.estimatedImpact.revenueRecovered ?? 0) +
    (recommendation.estimatedImpact.revenueOpportunity ?? 0) +
    (recommendation.estimatedImpact.estimatedLostSales ?? 0);

  return (
    <article className={`${styles.card} ${styles.recommendationCard}`} aria-label={recommendation.title}>
      <div className={styles.chipRow}>
        <span
          className={`${styles.chip} ${
            recommendation.group === "Critical Risks" ? styles.chipCritical : styles.chipSuccess
          }`}
        >
          {recommendation.group}
        </span>
        <span className={styles.chip}>Priority {recommendation.priority}</span>
        <span className={styles.chip}>{Math.round(recommendation.confidence * 100)}% confidence</span>
        <span className={styles.chip}>{recommendation.difficulty}</span>
      </div>

      <div>
        <h3 className={styles.sectionTitle}>{recommendation.title}</h3>
        <p className={styles.cardMeta}>{recommendation.reason}</p>
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

      <div className={styles.cardMeta}>
        Estimated impact: {impactTotal > 0 ? formatCurrency(impactTotal) : recommendation.businessImpact}
      </div>

      {recommendation.merchantAction.length > 0 ? (
        <div>
          <div className={styles.cardLabel}>Merchant actions</div>
          <ul className={styles.actionList}>
            {recommendation.merchantAction.map((action) => (
              <li key={action}>{action}</li>
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
          View Details
        </button>
      </div>
    </article>
  );
}

export function ExecutiveDashboard({ dashboard, onOpenRecommendation }: ExecutiveDashboardProps) {
  const [activeGroup, setActiveGroup] = useState<ExecutiveRecommendationGroup>("Critical Risks");
  const activeRecommendations = dashboard.groupedRecommendations[activeGroup] ?? [];

  return (
    <div className={styles.dashboard}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>Executive Dashboard</h1>
            <p className={styles.heroSubtitle}>
              Your AI COO briefing. Read what happened, why it happened, what to do next, and the expected
              business impact — without waiting for AI to run.
            </p>
          </div>
          {dashboard.lastUpdatedAt ? (
            <div className={styles.cardMeta}>Last AI analysis: {new Date(dashboard.lastUpdatedAt).toLocaleString()}</div>
          ) : null}
        </header>

        <section aria-label="Executive summary cards">
          <div className={styles.gridCards}>
            {SUMMARY_CARD_CONFIG.map((card, index) => {
              const rawValue = dashboard.summaryCards[card.key];
              const value =
                "format" in card && card.format ? card.format(rawValue as number) : String(rawValue);

              return (
                <div
                  key={card.key}
                  className={styles.card}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className={styles.cardLabel}>{card.label}</div>
                  <div className={styles.cardValue}>{value}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${styles.section} ${styles.briefing}`} aria-label="Today's AI briefing">
          <h2 className={styles.sectionTitle}>Today&apos;s AI Briefing</h2>
          <div className={styles.briefingLead}>{dashboard.briefing.greeting}</div>
          <div className={styles.briefingHealth}>Store Health {dashboard.briefing.storeHealth} / 100</div>
          <ul className={styles.briefingList}>
            {dashboard.briefing.summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {dashboard.briefing.highestPriorities.length > 0 ? (
            <div>
              <div className={styles.cardLabel}>Highest priority</div>
              <ul className={styles.briefingList}>
                {dashboard.briefing.highestPriorities.map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={styles.section} aria-label="Executive Decisions">
          <h2 className={styles.sectionTitle}>Executive Decisions</h2>
          {dashboard.collaborationSummary ? (
            <p className={styles.heroSubtitle}>{dashboard.collaborationSummary.summary}</p>
          ) : null}
          {dashboard.executiveDecisions.length === 0 ? (
            <div className={styles.emptyState}>
              Run the AI Collaboration Engine after specialist agents have produced recommendations to see
              cross-agent executive decisions here.
            </div>
          ) : (
            <div className={styles.recommendationGrid}>
              {dashboard.executiveDecisions.map((decision) => (
                <article
                  key={decision.id}
                  className={`${styles.card} ${styles.recommendationCard}`}
                  aria-label={decision.title}
                >
                  <div className={styles.chipRow}>
                    <span className={styles.chip}>{decision.group}</span>
                    <span className={styles.chip}>Priority {decision.priority}</span>
                    <span className={styles.chip}>{Math.round(decision.confidence * 100)}% confidence</span>
                    {decision.hasConflict ? (
                      <span className={`${styles.chip} ${styles.chipCritical}`}>Conflict</span>
                    ) : null}
                    {decision.hasDependency ? <span className={styles.chip}>Dependency</span> : null}
                    {decision.reinforced ? <span className={styles.chip}>Reinforced</span> : null}
                  </div>
                  <div>
                    <h3 className={styles.sectionTitle}>{decision.title}</h3>
                    <p className={styles.cardMeta}>{decision.reason}</p>
                  </div>
                  <div className={styles.cardMeta}>
                    Agents: {decision.agentsInvolved.join(", ").replace(/_/g, " ")}
                  </div>
                  <div className={styles.cardMeta}>
                    Expected ROI: {formatCurrency(decision.estimatedRevenueImpact, dashboard.currency)}
                  </div>
                  <div className={styles.cardMeta}>
                    Impact breakdown — Revenue: {formatCurrency(decision.estimatedRevenueImpact, dashboard.currency)}
                    {" · "}
                    Inventory: {formatCurrency(decision.estimatedInventoryImpact, dashboard.currency)}
                    {" · "}
                    Conversion: {decision.estimatedConversionImpact.toFixed(2)}
                  </div>
                  {decision.supportingEvidence.length > 0 ? (
                    <div>
                      <div className={styles.cardLabel}>Evidence</div>
                      <ul className={styles.evidenceList}>
                        {decision.supportingEvidence.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {dashboard.collaborationCharts?.consensusGauge.some((item) => item.value > 0) ? (
            <div className={styles.chartGrid} style={{ marginTop: 24 }}>
              <ExecutiveChart
                title="Consensus Gauge"
                points={dashboard.collaborationCharts.consensusGauge}
                ariaLabel="Collaboration consensus gauge"
              />
              <ExecutiveChart
                title="Agent Influence"
                points={dashboard.collaborationCharts.agentInfluenceRadar}
                ariaLabel="Agent influence radar"
              />
              <ExecutiveChart
                title="ROI Waterfall"
                points={dashboard.collaborationCharts.roiWaterfall}
                ariaLabel="Executive ROI waterfall"
              />
              <ExecutiveChart
                title="Confidence Distribution"
                points={dashboard.collaborationCharts.confidenceDistribution}
                ariaLabel="Decision confidence distribution"
              />
            </div>
          ) : null}
        </section>

        <section className={styles.section} aria-label="AI recommendation center">
          <h2 className={styles.sectionTitle}>Specialist Recommendations</h2>
          <div className={styles.groupTabs} role="tablist" aria-label="Recommendation groups">
            {EXECUTIVE_RECOMMENDATION_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                className={`${styles.groupTab} ${activeGroup === group ? styles.groupTabActive : ""}`}
                onClick={() => setActiveGroup(group)}
                role="tab"
                aria-selected={activeGroup === group}
              >
                {group} ({dashboard.groupedRecommendations[group].length})
              </button>
            ))}
          </div>
          {activeRecommendations.length === 0 ? (
            <div className={styles.emptyState}>
              No recommendations in this group yet. Product Intelligence outputs will appear here after analysis
              runs.
            </div>
          ) : (
            <div className={styles.recommendationGrid}>
              {activeRecommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.stableId}
                  recommendation={recommendation}
                  onOpenRecommendation={onOpenRecommendation}
                />
              ))}
            </div>
          )}
        </section>

        {dashboard.productSpotlight ? (
          <section className={styles.section} aria-label="Product spotlight">
            <h2 className={styles.sectionTitle}>Product Spotlight</h2>
            <div className={styles.spotlight}>
              <div>
                <h3 className={styles.heroTitle}>{dashboard.productSpotlight.title}</h3>
                <p className={styles.heroSubtitle}>
                  Highest-impact product opportunity from persisted Product Intelligence recommendations.
                </p>
                <div className={styles.spotlightMetrics}>
                  <div className={styles.metricTile}>
                    <div className={styles.cardLabel}>Health Score</div>
                    <div className={styles.cardValue}>
                      {dashboard.productSpotlight.healthScore ?? "—"}
                    </div>
                  </div>
                  <div className={styles.metricTile}>
                    <div className={styles.cardLabel}>Inventory Days</div>
                    <div className={styles.cardValue}>
                      {dashboard.productSpotlight.inventoryDays ?? "—"}
                    </div>
                  </div>
                  <div className={styles.metricTile}>
                    <div className={styles.cardLabel}>Risk</div>
                    <div className={styles.cardMeta}>{dashboard.productSpotlight.risk ?? "None flagged"}</div>
                  </div>
                  <div className={styles.metricTile}>
                    <div className={styles.cardLabel}>Expected Revenue Impact</div>
                    <div className={styles.cardValue}>
                      {formatCurrency(
                        dashboard.productSpotlight.expectedRevenueImpact,
                        dashboard.currency,
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className={styles.cardLabel}>Recommendations</div>
                <ul className={styles.actionList}>
                  {dashboard.productSpotlight.recommendations.map((item) => (
                    <li key={item.stableId}>{item.title}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-label="Executive analytics">
          <h2 className={styles.sectionTitle}>Executive Analytics</h2>
          <div className={styles.analyticsGrid}>
            <ExecutiveChart
              title="Revenue trend"
              points={dashboard.analytics.revenueTrend}
              ariaLabel="Revenue trend chart"
              formatValue={(value) => formatCurrency(value, dashboard.currency)}
            />
            <ExecutiveChart
              title="Inventory trend"
              points={dashboard.analytics.inventoryTrend}
              ariaLabel="Inventory trend chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Health score history"
              points={dashboard.analytics.healthScoreHistory}
              ariaLabel="Health score history chart"
            />
            <ExecutiveChart
              title="Recommendation impact"
              points={dashboard.analytics.recommendationImpact}
              ariaLabel="Recommendation impact chart"
              variant="bar"
              formatValue={(value) => formatCurrency(value, dashboard.currency)}
            />
            <ExecutiveChart
              title="Top products"
              points={dashboard.analytics.topProducts}
              ariaLabel="Top products chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Bottom products"
              points={dashboard.analytics.bottomProducts}
              ariaLabel="Bottom products chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Velocity trend"
              points={dashboard.analytics.velocityTrend}
              ariaLabel="Velocity trend chart"
            />
            <ExecutiveChart
              title="Refund trend"
              points={dashboard.analytics.refundTrend}
              ariaLabel="Refund trend chart"
              formatValue={(value) => formatCurrency(value, dashboard.currency)}
            />
            <ExecutiveChart
              title="Inventory ageing"
              points={dashboard.analytics.inventoryAge}
              ariaLabel="Inventory ageing chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Product health distribution"
              points={dashboard.analytics.healthDistribution}
              ariaLabel="Product health distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Inventory health history"
              points={dashboard.analytics.inventoryHealthHistory}
              ariaLabel="Inventory health history chart"
            />
            <ExecutiveChart
              title="Dead stock count"
              points={dashboard.analytics.deadStockCount}
              ariaLabel="Dead stock count chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Stock coverage trend"
              points={dashboard.analytics.stockCoverageTrend}
              ariaLabel="Stock coverage trend chart"
            />
            <ExecutiveChart
              title="Reorder timeline"
              points={dashboard.analytics.reorderTimeline}
              ariaLabel="Reorder timeline chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Inventory risk distribution"
              points={dashboard.analytics.inventoryRiskDistribution}
              ariaLabel="Inventory risk distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Top bundle opportunities"
              points={dashboard.analytics.topBundleOpportunities}
              ariaLabel="Top bundle opportunities chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Bundle success rate"
              points={dashboard.analytics.bundleSuccessRate}
              ariaLabel="Bundle success rate chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Potential inventory reduction"
              points={dashboard.analytics.potentialInventoryReduction}
              ariaLabel="Potential inventory reduction chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Potential attach rate"
              points={dashboard.analytics.potentialAttachRate}
              ariaLabel="Potential attach rate chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Bundle health"
              points={dashboard.analytics.bundleHealth}
              ariaLabel="Bundle health chart"
            />
            <ExecutiveChart
              title="ABC distribution"
              points={dashboard.analytics.abcDistribution}
              ariaLabel="ABC distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Weeks of cover"
              points={dashboard.analytics.weeksOfCover}
              ariaLabel="Weeks of cover chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Capital locked"
              points={dashboard.analytics.capitalLocked}
              ariaLabel="Capital locked in inventory chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Inventory timeline"
              points={dashboard.analytics.inventoryTimeline}
              ariaLabel="Inventory timeline chart"
            />
          </div>
          <div className={styles.cardMeta}>
            Recommendation completion rate: {dashboard.analytics.recommendationCompletionRate}%
          </div>
        </section>

        <section className={styles.section} aria-label="Store Audit">
          <h2 className={styles.sectionTitle}>Store Audit</h2>
          <div className={styles.executiveGrid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Store Audit Score</div>
              <div className={styles.cardValue}>{dashboard.storeAuditPanel.overallAuditScore}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Audit Health</div>
              <div className={styles.cardValue}>{dashboard.storeAuditPanel.auditHealth}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Critical Issues</div>
              <div className={styles.cardValue}>{dashboard.storeAuditPanel.criticalIssues}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>SEO Health</div>
              <div className={styles.cardValue}>{dashboard.storeAuditPanel.seoHealth}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Performance Health</div>
              <div className={styles.cardValue}>{dashboard.storeAuditPanel.performanceHealth}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Accessibility</div>
              <div className={styles.cardValue}>{dashboard.storeAuditPanel.accessibilityHealth}</div>
            </div>
          </div>
          <div className={styles.chartGrid}>
            <ExecutiveChart
              title="Audit History"
              points={dashboard.storeAuditPanel.auditHistory}
              ariaLabel="Store audit history chart"
            />
            <ExecutiveChart
              title="Audit Timeline"
              points={dashboard.storeAuditPanel.auditTimeline}
              ariaLabel="Store audit timeline chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Audit Trend"
              points={dashboard.storeAuditPanel.trendChart}
              ariaLabel="Store audit trend chart"
            />
            <ExecutiveChart
              title="Homepage Score"
              points={dashboard.analytics.homepageScore}
              ariaLabel="Homepage score chart"
            />
            <ExecutiveChart
              title="SEO Score"
              points={dashboard.analytics.seoScoreHistory}
              ariaLabel="SEO score chart"
            />
            <ExecutiveChart
              title="Accessibility Score"
              points={dashboard.analytics.accessibilityScoreHistory}
              ariaLabel="Accessibility score chart"
            />
            <ExecutiveChart
              title="Performance Score"
              points={dashboard.analytics.performanceScoreHistory}
              ariaLabel="Performance score chart"
            />
            <ExecutiveChart
              title="Theme Score"
              points={dashboard.analytics.themeScoreHistory}
              ariaLabel="Theme score chart"
            />
            <ExecutiveChart
              title="Conversion Score"
              points={dashboard.analytics.conversionScoreHistory}
              ariaLabel="Conversion score chart"
            />
            <ExecutiveChart
              title="Mobile Score"
              points={dashboard.analytics.mobileScoreHistory}
              ariaLabel="Mobile score chart"
            />
            <ExecutiveChart
              title="Issue Distribution"
              points={dashboard.analytics.storeAuditIssueDistribution}
              ariaLabel="Store audit issue distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Recommendation Trend"
              points={dashboard.analytics.storeAuditRecommendationTrend}
              ariaLabel="Store audit recommendation trend chart"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="SEO Intelligence">
          <h2 className={styles.sectionTitle}>SEO Intelligence</h2>
          <div className={styles.executiveGrid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>SEO Health</div>
              <div className={styles.cardValue}>{dashboard.seoIntelligencePanel.seoHealth}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Organic Opportunity</div>
              <div className={styles.cardValue}>{dashboard.seoIntelligencePanel.organicOpportunity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Search Visibility</div>
              <div className={styles.cardValue}>{dashboard.seoIntelligencePanel.searchVisibility}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Core Web Vitals</div>
              <div className={styles.cardValue}>{dashboard.seoIntelligencePanel.coreWebVitals}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Technical SEO</div>
              <div className={styles.cardValue}>{dashboard.seoIntelligencePanel.technicalSeo}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Content Quality</div>
              <div className={styles.cardValue}>{dashboard.seoIntelligencePanel.contentQuality}</div>
            </div>
          </div>
          <div className={styles.chartGrid}>
            <ExecutiveChart
              title="SEO Score History"
              points={dashboard.seoIntelligencePanel.seoHistory}
              ariaLabel="SEO score history chart"
            />
            <ExecutiveChart
              title="Visibility Trend"
              points={dashboard.analytics.seoVisibilityTrend}
              ariaLabel="SEO visibility trend chart"
            />
            <ExecutiveChart
              title="Organic Opportunity"
              points={dashboard.analytics.seoOrganicOpportunity}
              ariaLabel="Organic opportunity chart"
            />
            <ExecutiveChart
              title="Core Web Vitals"
              points={dashboard.analytics.seoCoreWebVitalsTrend}
              ariaLabel="Core web vitals chart"
            />
            <ExecutiveChart
              title="Technical SEO Radar"
              points={dashboard.analytics.seoTechnicalRadar}
              ariaLabel="Technical SEO radar chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Issue Distribution"
              points={dashboard.analytics.seoIssueDistribution}
              ariaLabel="SEO issue distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Index Coverage"
              points={dashboard.analytics.seoIndexCoverage}
              ariaLabel="Index coverage chart"
            />
            <ExecutiveChart
              title="Content Quality"
              points={dashboard.analytics.seoContentQuality}
              ariaLabel="Content quality chart"
            />
            <ExecutiveChart
              title="Quick Wins"
              points={dashboard.seoIntelligencePanel.quickWins}
              ariaLabel="SEO quick wins chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Opportunity Timeline"
              points={dashboard.seoIntelligencePanel.opportunityTimeline}
              ariaLabel="SEO opportunity timeline chart"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Pricing Strategy Intelligence">
          <h2 className={styles.sectionTitle}>Pricing Strategy Intelligence</h2>
          <div className={styles.executiveGrid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Pricing Health</div>
              <div className={styles.cardValue}>{dashboard.pricingIntelligencePanel.pricingHealth}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Margin</div>
              <div className={styles.cardValue}>{dashboard.pricingIntelligencePanel.marginPercent}%</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Profit Opportunity</div>
              <div className={styles.cardValue}>{dashboard.pricingIntelligencePanel.profitOpportunity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Revenue Opportunity</div>
              <div className={styles.cardValue}>{dashboard.pricingIntelligencePanel.revenueOpportunity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Average Discount</div>
              <div className={styles.cardValue}>{dashboard.pricingIntelligencePanel.averageDiscountPercent}%</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Discount Dependence</div>
              <div className={styles.cardValue}>{dashboard.pricingIntelligencePanel.discountDependence}</div>
            </div>
          </div>
          <div className={styles.chartGrid}>
            <ExecutiveChart
              title="Pricing Health"
              points={dashboard.pricingIntelligencePanel.pricingHealthTrend}
              ariaLabel="Pricing health trend chart"
            />
            <ExecutiveChart
              title="Margin Trend"
              points={dashboard.pricingIntelligencePanel.marginTrend}
              ariaLabel="Margin trend chart"
            />
            <ExecutiveChart
              title="Revenue vs Profit"
              points={dashboard.pricingIntelligencePanel.revenueVsProfit}
              ariaLabel="Revenue vs profit chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Discount Trend"
              points={dashboard.pricingIntelligencePanel.discountTrend}
              ariaLabel="Discount trend chart"
            />
            <ExecutiveChart
              title="Price Distribution"
              points={dashboard.pricingIntelligencePanel.priceDistribution}
              ariaLabel="Price distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Pricing Risk"
              points={dashboard.pricingIntelligencePanel.pricingRisk}
              ariaLabel="Pricing risk chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Opportunity Funnel"
              points={dashboard.pricingIntelligencePanel.opportunityFunnel}
              ariaLabel="Pricing opportunity funnel chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Margin Distribution"
              points={dashboard.pricingIntelligencePanel.marginDistribution}
              ariaLabel="Margin distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Discount Dependence"
              points={dashboard.pricingIntelligencePanel.discountDependenceTrend}
              ariaLabel="Discount dependence chart"
            />
            <ExecutiveChart
              title="Pricing Timeline"
              points={dashboard.pricingIntelligencePanel.pricingTimeline}
              ariaLabel="Pricing timeline chart"
            />
            <ExecutiveChart
              title="Critical Pricing Risks"
              points={dashboard.pricingIntelligencePanel.criticalPricingRisks}
              ariaLabel="Critical pricing risks chart"
              variant="bar"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Revenue Growth Strategy">
          <h2 className={styles.sectionTitle}>Revenue Growth Strategy</h2>
          <div className={styles.executiveGrid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Growth Score</div>
              <div className={styles.cardValue}>{dashboard.growthIntelligencePanel.growthScore}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Monthly Revenue Opportunity</div>
              <div className={styles.cardValue}>{dashboard.growthIntelligencePanel.monthlyRevenueOpportunity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>AOV Opportunity</div>
              <div className={styles.cardValue}>{dashboard.growthIntelligencePanel.aovOpportunity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Repeat Purchase Opportunity</div>
              <div className={styles.cardValue}>{dashboard.growthIntelligencePanel.repeatPurchaseOpportunity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Expansion Readiness</div>
              <div className={styles.cardValue}>{dashboard.growthIntelligencePanel.expansionReadiness}</div>
            </div>
          </div>
          <div className={styles.chartGrid}>
            <ExecutiveChart
              title="Growth Trend"
              points={dashboard.growthIntelligencePanel.growthTrend}
              ariaLabel="Growth trend chart"
            />
            <ExecutiveChart
              title="Opportunity Funnel"
              points={dashboard.growthIntelligencePanel.opportunityFunnel}
              ariaLabel="Growth opportunity funnel chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Growth Categories"
              points={dashboard.growthIntelligencePanel.growthCategories}
              ariaLabel="Growth categories chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Revenue Lift Forecast"
              points={dashboard.growthIntelligencePanel.revenueLiftForecast}
              ariaLabel="Revenue lift forecast chart"
            />
            <ExecutiveChart
              title="Growth ROI"
              points={dashboard.growthIntelligencePanel.growthRoi}
              ariaLabel="Growth ROI chart"
            />
            <ExecutiveChart
              title="Campaign Timeline"
              points={dashboard.growthIntelligencePanel.campaignTimeline}
              ariaLabel="Campaign timeline chart"
            />
            <ExecutiveChart
              title="Collection Performance"
              points={dashboard.growthIntelligencePanel.collectionPerformance}
              ariaLabel="Collection performance chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Growth Capacity"
              points={dashboard.growthIntelligencePanel.growthCapacity}
              ariaLabel="Growth capacity chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Revenue Sources"
              points={dashboard.growthIntelligencePanel.revenueSources}
              ariaLabel="Revenue sources chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Priority Distribution"
              points={dashboard.growthIntelligencePanel.priorityDistribution}
              ariaLabel="Priority distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Critical Growth Risks"
              points={dashboard.growthIntelligencePanel.criticalGrowthRisks}
              ariaLabel="Critical growth risks chart"
              variant="bar"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Executive COO">
          <h2 className={styles.sectionTitle}>Executive COO</h2>
          <div className={styles.executiveGrid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Today&apos;s Priority</div>
              <div className={styles.cardMeta}>
                {dashboard.executiveCooPanel.todaysPriority ?? "No executive priority yet"}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Business Health</div>
              <div className={styles.cardValue}>{dashboard.executiveCooPanel.businessHealth}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Executive Confidence</div>
              <div className={styles.cardValue}>{dashboard.executiveCooPanel.executiveConfidence}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Merchant Capacity</div>
              <div className={styles.cardValue}>{dashboard.executiveCooPanel.merchantCapacity}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Business Momentum</div>
              <div className={styles.cardValue}>{dashboard.executiveCooPanel.businessMomentum}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Critical Path</div>
              <div className={styles.cardValue}>{dashboard.executiveCooPanel.criticalPathLength}</div>
            </div>
          </div>
          <div className={styles.chartGrid}>
            <ExecutiveChart
              title="Execution Timeline"
              points={dashboard.executiveCooPanel.executionTimeline}
              ariaLabel="Executive execution timeline chart"
            />
            <ExecutiveChart
              title="Priority Distribution"
              points={dashboard.executiveCooPanel.priorityDistribution}
              ariaLabel="Executive priority distribution chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Business Health Trend"
              points={dashboard.executiveCooPanel.businessHealthTrend}
              ariaLabel="Executive business health trend chart"
            />
            <ExecutiveChart
              title="Capacity Usage"
              points={dashboard.executiveCooPanel.capacityUsage}
              ariaLabel="Executive capacity usage chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Opportunity Cost"
              points={dashboard.executiveCooPanel.opportunityCostChart}
              ariaLabel="Executive opportunity cost chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Dependency Graph"
              points={dashboard.executiveCooPanel.dependencyGraph}
              ariaLabel="Executive dependency graph chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Execution Funnel"
              points={dashboard.executiveCooPanel.executionFunnel}
              ariaLabel="Executive execution funnel chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Business Momentum"
              points={dashboard.executiveCooPanel.businessMomentumChart}
              ariaLabel="Executive business momentum chart"
            />
            <ExecutiveChart
              title="Critical Path"
              points={dashboard.executiveCooPanel.criticalPathChart}
              ariaLabel="Executive critical path chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Blocked Tasks"
              points={dashboard.executiveCooPanel.blockedTasksChart}
              ariaLabel="Executive blocked tasks chart"
              variant="bar"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Trend Intelligence">
          <h2 className={styles.sectionTitle}>Trend Intelligence</h2>
          <div className={styles.chartGrid}>
            <ExecutiveChart
              title="Trend Health"
              points={dashboard.analytics.trendHealth}
              ariaLabel="Trend health chart"
            />
            <ExecutiveChart
              title="Emerging Products"
              points={dashboard.analytics.emergingProductsTrend}
              ariaLabel="Emerging products chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Declining Products"
              points={dashboard.analytics.decliningProductsTrend}
              ariaLabel="Declining products chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Momentum"
              points={dashboard.analytics.momentumTrend}
              ariaLabel="Momentum chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Growth vs Decline"
              points={dashboard.analytics.growthVsDeclineTrend}
              ariaLabel="Growth vs decline chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Revenue Trend"
              points={dashboard.analytics.trendRevenueTrend}
              ariaLabel="Trend revenue chart"
            />
            <ExecutiveChart
              title="Velocity Trend"
              points={dashboard.analytics.trendVelocityTrend}
              ariaLabel="Trend velocity chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Seasonality"
              points={dashboard.analytics.seasonalityTrend}
              ariaLabel="Seasonality chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Category Trend"
              points={dashboard.analytics.categoryTrendChart}
              ariaLabel="Category trend chart"
              variant="bar"
            />
            <ExecutiveChart
              title="Trend Timeline"
              points={dashboard.analytics.trendTimeline}
              ariaLabel="Trend timeline chart"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Recommendation timeline">
          <h2 className={styles.sectionTitle}>Recommendation Timeline</h2>
          <div className={styles.timeline}>
            {dashboard.timeline.length === 0 ? (
              <div className={styles.emptyState}>Timeline activity will appear as recommendations move through their lifecycle.</div>
            ) : (
              dashboard.timeline.map((event) => (
                <div key={event.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} aria-hidden="true" />
                  <div>
                    <div>{event.message}</div>
                    <div className={styles.cardMeta}>
                      {event.title} · {new Date(event.at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={styles.section} aria-label="Merchant tasks">
          <h2 className={styles.sectionTitle}>Merchant Tasks</h2>
          <div className={styles.taskGrid}>
            {dashboard.tasks.length === 0 ? (
              <div className={styles.emptyState}>AI tasks will appear from recommendation merchant actions.</div>
            ) : (
              dashboard.tasks.map((task) => (
                <div key={task.id} className={styles.card}>
                  <div className={styles.cardLabel}>Priority {task.priority}</div>
                  <div className={styles.sectionTitle}>{task.title}</div>
                  <div className={styles.cardMeta}>
                    Impact: {formatCurrency(task.estimatedImpact, dashboard.currency)} · {task.difficulty}
                  </div>
                  <div className={styles.cardMeta}>Related: {task.relatedRecommendationTitle}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
