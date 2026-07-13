import { FeatureUpgradePanel } from "../components/billing/FeatureGate";
import {
  CrossLinks,
  KnowledgeGraphViewer,
  WorkspaceLayout,
  type WorkspacePageData,
} from "../intelligence-ui";
import { WORKSPACE_ROUTES } from "../intelligence-ui/constants";
import type {
  ActionCenterItem,
  IntelligenceEntityView,
} from "../intelligence-ui/types";
import type { IntelligenceWorkspaceLoaderData, IntelligenceWorkspacePayload } from "./intelligence-workspace-types";
import {
  buildExecutiveActions,
  buildExecutiveEntities,
  buildExperimentActions,
  defaultRelatedLinks,
  evidenceFromIds,
  jsonArray,
} from "./intelligence-workspace-ui-helpers";

function relatedNodeList(nodes: Array<{ id: string; nodeType: string; displayName: string }>) {
  return (
    <KnowledgeGraphViewer
      nodes={nodes.map((node) => ({
        id: node.id,
        nodeType: node.nodeType,
        displayName: node.displayName,
        canonicalKey: node.id,
      }))}
    />
  );
}

function relatedLinksPanel() {
  return <CrossLinks links={defaultRelatedLinks()} />;
}

type ResolvedWorkspaceLoaderData = {
  workspace: IntelligenceWorkspacePayload | null;
  searchResults: import("../intelligence-ui/types").SearchResultView[];
  timeline: import("../intelligence-ui/types").TimelineEventView[];
  currency: string;
  featureGate?: IntelligenceWorkspaceLoaderData["featureGate"];
};

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

function normalizeWorkspaceLoaderData(
  data: IntelligenceWorkspaceLoaderData,
): ResolvedWorkspaceLoaderData {
  if (isPromiseLike(data.workspace)) {
    throw new Error("workspace Promise must be resolved before renderIntelligenceWorkspace");
  }

  return {
    workspace: data.workspace,
    searchResults: Array.isArray(data.searchResults) ? data.searchResults : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    currency: data.currency,
    featureGate: data.featureGate,
  };
}

export function renderIntelligenceWorkspace(data: IntelligenceWorkspaceLoaderData | null) {
  if (!data) {
    return (
      <s-page heading="Intelligence Workspace">
        <s-section>
          <s-paragraph>Store data is not available yet.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  if (data.featureGate && !data.featureGate.available) {
    return (
      <s-page heading={data.featureGate.featureName}>
        <FeatureUpgradePanel gate={data.featureGate} />
      </s-page>
    );
  }

  if (!data.workspace) {
    return (
      <s-page heading="Intelligence Workspace">
        <s-section>
          <s-paragraph>Store data is not available yet.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  const pageData = mapWorkspacePayload(normalizeWorkspaceLoaderData(data));
  return <WorkspaceLayout data={pageData} />;
}

function mapWorkspacePayload(
  data: ResolvedWorkspaceLoaderData,
): WorkspacePageData {
  const { workspace, searchResults, timeline, currency } = data;
  if (!workspace) {
    throw new Error("workspace payload required");
  }

  switch (workspace.kind) {
    case "executive":
      return {
        title: "Executive Intelligence",
        subtitle: "Decision-first operating view — briefing, readiness, and decision queue.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Executive" },
        ],
        currency,
        searchResults,
        timeline,
        evidence: workspace.decisions.flatMap((d) =>
          evidenceFromIds(jsonArray(d.evidenceIds), "Executive decision engine"),
        ),
        entities: buildExecutiveEntities(workspace.decisions),
        actions: buildExecutiveActions(workspace.decisions),
        summary: (
          <s-stack gap="base">
            <s-query-container>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
                <MetricCard label="Operational readiness" value={workspace.executive?.operationalReadinessScore ?? 0} />
                <MetricCard label="Business stability" value={workspace.stabilityScore} />
                <MetricCard label="Adaptive intelligence" value={workspace.merchant?.adaptiveScore ?? 0} />
              </s-grid>
            </s-query-container>
            {workspace.executive?.briefing ? (
              <InfoCard
                title="Executive briefing"
                body={workspace.executive.briefing.headline}
                detail={workspace.executive.briefing.businessOutlook}
              />
            ) : null}
            {workspace.executive?.operatingPlan ? (
              <InfoCard
                title="Today's operating plan"
                body={workspace.executive.operatingPlan.title}
              />
            ) : null}
          </s-stack>
        ),
        details: (
          <s-stack gap="base">
            {workspace.decisions.slice(0, 8).map((decision) => (
              <InfoCard
                key={decision.id}
                title={decision.title}
                body={decision.recommendation}
                detail={decision.category}
              />
            ))}
          </s-stack>
        ),
        related: relatedLinksPanel(),
        learning: (
          <s-stack gap="small-200">
            <s-text color="subdued">Learning stage: {workspace.merchant?.learningStage ?? "initializing"}</s-text>
            <s-text color="subdued">Journal entries: {workspace.merchant?.decisionJournalCount ?? 0}</s-text>
          </s-stack>
        ),
        aside: (
          <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
            <s-stack gap="base">
              <s-text type="strong">Decision queue</s-text>
              {workspace.queue.slice(0, 6).map((task) => (
                <s-stack key={task.id} direction="inline" justifyContent="space-between">
                  <s-text>{task.title}</s-text>
                  <s-badge>{task.status}</s-badge>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        ),
      };

    case "domain":
      return mapDomainWorkspace(workspace, searchResults, timeline, currency);

    case "root-causes":
      return {
        title: "Root Cause Intelligence",
        subtitle: "Drill from outcomes to signals, evidence, and recommended actions.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Root Causes" },
        ],
        currency,
        searchResults,
        timeline: workspace.timeline.length > 0 ? workspace.timeline : timeline,
        evidence: workspace.causes.flatMap((c) => evidenceFromIds(jsonArray(c.evidenceIds), "Root cause")),
        entities: workspace.causes.map(mapRootCauseEntity),
        actions: [],
        summary: (
          <s-stack gap="base">
            {workspace.causes.slice(0, 6).map((cause) => (
              <InfoCard
                key={cause.id}
                title={cause.primaryCause}
                detail={`Outcome: ${cause.businessOutcome.replace(/_/g, " ")}`}
              />
            ))}
          </s-stack>
        ),
        details: (
          <s-stack gap="base">
            {workspace.causes.map((cause) => (
              <InfoCard
                key={cause.id}
                title={cause.primaryCause}
                body={Array.isArray(cause.causalChain) ? cause.causalChain.slice(0, 6).map(String).join(" → ") : ""}
              />
            ))}
          </s-stack>
        ),
        related: relatedNodeList(workspace.graphNodes),
        learning: <s-text color="subdued">{workspace.items.length} detected causes</s-text>,
        aside: undefined,
      };

    case "predictions":
      return {
        title: "Prediction Intelligence",
        subtitle: "Forecasts, confidence evolution, prevention actions, and outcomes.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Predictions" },
        ],
        currency,
        searchResults,
        timeline,
        evidence: workspace.predictions.flatMap((p) =>
          evidenceFromIds(jsonArray(p.evidenceIds), "Prediction"),
        ),
        entities: workspace.predictions.map((p) => ({
          id: p.id,
          entityType: "Prediction",
          title: p.title,
          summary: p.description,
          confidencePercent: Math.round(Number(p.confidence) * 100),
          revenueImpact: Number(p.expectedBusinessImpact),
          evidenceIds: jsonArray(p.evidenceIds),
          graphNodeIds: jsonArray(p.graphNodeIds),
          memoryIds: [],
          relatedLinks: defaultRelatedLinks(),
        })),
        actions: [],
        summary: (
          <s-stack gap="base">
            <s-text type="strong">Business stability: {workspace.stabilityScore}</s-text>
            <s-text color="subdued">{workspace.items.length} active predictions</s-text>
          </s-stack>
        ),
        details: (
          <s-stack gap="base">
            {workspace.predictions.map((p) => (
              <InfoCard key={p.id} title={p.title} body={p.predictedOutcome} detail={p.description} />
            ))}
          </s-stack>
        ),
        related: relatedLinksPanel(),
        learning: <s-text color="subdued">Historical accuracy tracked in merchant intelligence.</s-text>,
        aside: undefined,
      };

    case "experiments":
      return {
        title: "Experiment Intelligence",
        subtitle: "Shadow-mode experiments — approve, dismiss, or learn before any store change.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Experiments" },
        ],
        currency,
        searchResults,
        timeline,
        evidence: [],
        entities: [],
        actions: buildExperimentActions(workspace.items),
        summary: (
          <s-stack gap="base">
            <s-text color="subdued">
              {workspace.items.length} experiments · {workspace.recommendationCount} recommendations
            </s-text>
            {workspace.items.slice(0, 3).map((item) => (
              <InfoCard key={item.experimentId} title={item.title} body={item.proposedChange} />
            ))}
          </s-stack>
        ),
        details: (
          <s-stack gap="base">
            {workspace.items.map((item) => (
              <s-box key={item.experimentId} padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">{item.title}</s-text>
                  <s-text color="subdued">{item.reason}</s-text>
                  <s-badge>{item.status}</s-badge>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ),
        related: relatedLinksPanel(),
        learning: <s-text color="subdued">Experiment learning updates business memory after completion.</s-text>,
        aside: undefined,
      };

    case "merchant-intelligence":
      return mapMerchantWorkspace(workspace, searchResults, timeline, currency);

    case "business-memory":
      return mapBusinessMemoryWorkspace(workspace, searchResults, timeline, currency);

    case "knowledge-graph":
      return {
        title: "Knowledge Graph",
        subtitle: "Interactive relationship explorer — products, vendors, evidence, and decisions.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Knowledge Graph" },
        ],
        currency,
        searchResults,
        timeline,
        evidence: [],
        entities: [],
        actions: [],
        summary: (
          <s-stack gap="base">
            <s-text type="strong">
              {workspace.totalNodes} nodes · {workspace.totalEdges} edges
            </s-text>
          </s-stack>
        ),
        details: relatedNodeList(workspace.nodes),
        related: relatedLinksPanel(),
        learning: <s-text color="subdued">Graph neighborhoods cached for fast exploration.</s-text>,
        aside: undefined,
      };

    case "products":
      return {
        title: "Products Intelligence",
        subtitle: "Every product is an intelligence page.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Products" },
        ],
        currency,
        searchResults,
        timeline,
        evidence: [],
        entities: [],
        actions: [],
        summary: (
          <s-stack gap="base">
            <s-text color="subdued">
              {workspace.total ?? workspace.products.length} active products
              {workspace.page && workspace.pageSize
                ? ` · page ${workspace.page} (${workspace.pageSize} per page)`
                : ""}
            </s-text>
            {workspace.products.slice(0, 10).map((product) => (
              <s-link key={product.id} href={WORKSPACE_ROUTES.productDetail(product.id)}>
                {product.title}
              </s-link>
            ))}
          </s-stack>
        ),
        details: (
          <s-stack gap="base">
            {workspace.products.map((product) => (
              <s-box key={product.id} padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
                <s-link href={WORKSPACE_ROUTES.productDetail(product.id)}>
                  <s-text type="strong">{product.title}</s-text>
                </s-link>
                <s-text color="subdued">Inventory: {product.inventoryQuantity ?? "—"}</s-text>
              </s-box>
            ))}
          </s-stack>
        ),
        related: relatedLinksPanel(),
        learning: <s-text color="subdued">Product learning accumulates via experiments and decisions.</s-text>,
        aside: undefined,
      };

    case "product-detail":
      return {
        title: workspace.product.title,
        subtitle: "Product intelligence — overview, risks, predictions, and graph relationships.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Products", href: WORKSPACE_ROUTES.products },
          { label: workspace.product.title },
        ],
        currency,
        searchResults,
        timeline,
        evidence: [],
        entities: [],
        actions: [],
        summary: (
          <s-stack gap="base">
            <s-text color="subdued">SKU: {workspace.product.sku ?? "—"}</s-text>
            <s-text color="subdued">Inventory: {workspace.product.inventoryQuantity ?? "—"}</s-text>
            <s-text color="subdued">Price: {workspace.product.price ?? "—"}</s-text>
          </s-stack>
        ),
        details: (
          <s-stack gap="base">
            {workspace.predictions.map((p) => (
              <InfoCard key={p.id} title={p.title} />
            ))}
            {workspace.experiments.map((e) => (
              <InfoCard key={e.id} title={e.title} />
            ))}
          </s-stack>
        ),
        related: relatedNodeList(workspace.graphNodes),
        learning: <s-text color="subdued">Adaptive learning tracks decisions on this product.</s-text>,
        aside: undefined,
      };

    case "collections":
      return {
        title: "Collections Intelligence",
        subtitle: "Collection health, revenue relationships, and graph connections.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Collections" },
        ],
        currency,
        searchResults,
        timeline,
        evidence: [],
        entities: [],
        actions: [],
        summary: (
          <s-text color="subdued">{workspace.collections.length} collections in knowledge graph</s-text>
        ),
        details: (
          <s-stack gap="base">
            {workspace.collections.map((collection) => (
              <InfoCard
                key={collection.id}
                title={collection.displayName}
                detail={collection.canonicalKey}
              />
            ))}
          </s-stack>
        ),
        related: relatedLinksPanel(),
        learning: <s-text color="subdued">Collection patterns stored in business memory.</s-text>,
        aside: undefined,
      };

    case "timeline":
      return {
        title: "Business Timeline",
        subtitle: "Unified chronological view across intelligence systems.",
        breadcrumbs: [
          { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
          { label: "Timeline" },
        ],
        currency,
        searchResults,
        timeline: workspace.timeline,
        evidence: [],
        entities: [],
        actions: [],
        summary: (
          <s-text color="subdued">{workspace.timeline.length} events · {workspace.journalCount} journal entries</s-text>
        ),
        details: (
          <s-stack gap="small-200">
            {workspace.timeline.map((event) => (
              <InfoCard
                key={event.id}
                title={event.title}
                detail={new Date(event.occurredAt).toLocaleString()}
              />
            ))}
          </s-stack>
        ),
        related: relatedLinksPanel(),
        learning: <s-text color="subdued">Timeline links every intelligence object together.</s-text>,
        aside: undefined,
      };

    default:
      return exhaustiveCheck(workspace);
  }
}

function mapDomainWorkspace(
  workspace: Extract<IntelligenceWorkspacePayload, { kind: "domain" }>,
  searchResults: ResolvedWorkspaceLoaderData["searchResults"],
  timeline: ResolvedWorkspaceLoaderData["timeline"],
  currency: string,
): WorkspacePageData {
  const title =
    workspace.domain === "inventory"
      ? "Inventory Intelligence"
      : workspace.domain === "pricing"
        ? "Pricing Intelligence"
        : "SEO Intelligence";

  const entities: IntelligenceEntityView[] = [
    ...workspace.predictions.map((p) => ({
      id: p.id,
      entityType: "Prediction",
      title: p.title,
      summary: p.description,
      confidencePercent: Math.round(p.confidence * 100),
      revenueImpact: p.expectedBusinessImpact,
      evidenceIds: p.evidenceIds,
      graphNodeIds: p.graphNodeIds,
      memoryIds: [],
      relatedLinks: defaultRelatedLinks(),
    })),
    ...workspace.rootCauses.map(mapRootCauseEntity),
  ];

  const actions: ActionCenterItem[] = workspace.experiments
    .filter((e) => e.status === "shadow_simulated" || e.status === "suggested")
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.proposedChange,
      entityType: "experiment" as const,
      entityId: e.id,
      confidencePercent: Math.round(e.confidence * 100),
      revenueImpact: e.expectedRevenueImpact,
    }));

  return {
    title,
    subtitle: `Explore ${workspace.domain} risks, evidence, predictions, and recommended experiments.`,
    breadcrumbs: [
      { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
      { label: title },
    ],
    currency,
    searchResults,
    timeline,
    evidence: [
      ...workspace.predictions.flatMap((p) => evidenceFromIds(p.evidenceIds, "Prediction engine")),
      ...workspace.rootCauses.flatMap((r) => evidenceFromIds(r.evidenceIds, "Root cause engine")),
    ],
    entities,
    actions,
    summary: (
      <s-stack gap="base">
        <s-text color="subdued">
          {workspace.predictions.length} predictions · {workspace.rootCauses.length} root causes ·{" "}
          {workspace.experiments.length} experiments
        </s-text>
        {workspace.rootCauses[0] ? (
          <InfoCard title={`Primary issue: ${workspace.rootCauses[0].primaryCause}`} />
        ) : null}
      </s-stack>
    ),
    details: (
      <s-stack gap="base">
        {workspace.predictions.map((p) => (
          <InfoCard key={p.id} title={p.title} body={p.description} detail={p.predictedOutcome} />
        ))}
        {workspace.experiments.map((e) => (
          <s-box key={e.id} padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
            <s-text type="strong">{e.title}</s-text>
            <s-badge>{e.status}</s-badge>
          </s-box>
        ))}
      </s-stack>
    ),
    related: relatedNodeList(workspace.graphNodes),
    learning: (
      <s-stack gap="small-200">
        {workspace.patterns.map((pattern, index) => (
          <s-text key={`${pattern.patternType}-${index}`} color="subdued">
            {pattern.semanticLabel} ({Math.round(pattern.confidence * 100)}%)
          </s-text>
        ))}
      </s-stack>
    ),
    aside: undefined,
  };
}

function mapMerchantWorkspace(
  workspace: Extract<IntelligenceWorkspacePayload, { kind: "merchant-intelligence" }>,
  searchResults: ResolvedWorkspaceLoaderData["searchResults"],
  timeline: ResolvedWorkspaceLoaderData["timeline"],
  currency: string,
): WorkspacePageData {
  const characteristics =
    workspace.dna?.dnaJson && typeof workspace.dna.dnaJson === "object"
      ? (workspace.dna.dnaJson as Record<string, unknown>)
      : {};

  return {
    title: "Merchant Intelligence",
    subtitle: "Your decision style, risk profile, adaptive learning, and business DNA.",
    breadcrumbs: [
      { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
      { label: "Merchant Profile" },
    ],
    currency,
    searchResults,
    timeline,
    evidence: workspace.journal.flatMap((j) => evidenceFromIds(jsonArray(j.evidenceIds), "Decision journal")),
    entities: [],
    actions: [],
    summary: (
      <s-stack gap="base">
        <s-text type="strong">Adaptive score: {workspace.dashboard?.adaptiveScore ?? 0}</s-text>
        <s-text color="subdued">Stage: {workspace.dashboard?.learningStage ?? "initializing"}</s-text>
      </s-stack>
    ),
    details: (
      <s-stack gap="base">
        {workspace.journal.map((entry) => (
          <InfoCard key={entry.id} title={entry.title} body={entry.recommendation} />
        ))}
      </s-stack>
    ),
    related: relatedLinksPanel(),
    learning: (
      <s-stack gap="small-200">
        {workspace.confidence.slice(0, 8).map((row) => (
          <s-text key={row.id} color="subdued">
            {row.domain}: {Math.round(Number(row.confidenceScore) * 100)}%
          </s-text>
        ))}
        {Object.entries(characteristics).slice(0, 6).map(([key, value]) => (
          <s-text key={key} color="subdued">
            {key}: {String(value)}
          </s-text>
        ))}
      </s-stack>
    ),
    aside: undefined,
  };
}

function mapBusinessMemoryWorkspace(
  workspace: Extract<IntelligenceWorkspacePayload, { kind: "business-memory" }>,
  searchResults: ResolvedWorkspaceLoaderData["searchResults"],
  timeline: ResolvedWorkspaceLoaderData["timeline"],
  currency: string,
): WorkspacePageData {
  return {
    title: "Business Memory",
    subtitle: "Patterns, seasonality, confidence, snapshots, and learning history.",
    breadcrumbs: [
      { label: "Dashboard", href: WORKSPACE_ROUTES.dashboard },
      { label: "Business Memory" },
    ],
    currency,
    searchResults,
    timeline,
    evidence: workspace.patterns.flatMap((p) => evidenceFromIds(jsonArray(p.evidenceIds), "Pattern seed")),
    entities: [],
    actions: [],
    summary: (
      <s-stack gap="base">
        <s-text type="strong">{workspace.patterns.length} active patterns</s-text>
        <s-text color="subdued">{workspace.snapshots.length} memory snapshots</s-text>
      </s-stack>
    ),
    details: (
      <s-stack gap="base">
        {workspace.patterns.map((pattern) => (
          <InfoCard key={pattern.id} title={pattern.semanticLabel} detail={pattern.patternType} />
        ))}
      </s-stack>
    ),
    related: relatedLinksPanel(),
    learning: (
      <s-stack gap="small-200">
        {workspace.dnaVersions.map((version) => (
          <s-text key={version.id} color="subdued">
            DNA v{version.versionNumber}
          </s-text>
        ))}
      </s-stack>
    ),
    aside: undefined,
  };
}

function mapRootCauseEntity(cause: {
  id: string;
  primaryCause: string;
  businessOutcome: string;
  confidence?: number | { toString(): string };
  severity?: string;
  evidenceIds?: unknown;
  graphNodeIds?: unknown;
  businessMemoryIds?: unknown;
}): IntelligenceEntityView {
  return {
    id: cause.id,
    entityType: "Root Cause",
    title: cause.primaryCause,
    summary: cause.businessOutcome,
    confidencePercent: Math.round(Number(cause.confidence ?? 0) * 100),
    severity: cause.severity,
    evidenceIds: jsonArray(cause.evidenceIds),
    graphNodeIds: jsonArray(cause.graphNodeIds),
    memoryIds: jsonArray(cause.businessMemoryIds),
    relatedLinks: defaultRelatedLinks(),
  };
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}

function InfoCard({
  title,
  body,
  detail,
}: {
  title: string;
  body?: string;
  detail?: string;
}) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">{title}</s-text>
        {body ? <s-text>{body}</s-text> : null}
        {detail ? <s-text color="subdued">{detail}</s-text> : null}
      </s-stack>
    </s-box>
  );
}

function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled workspace kind: ${String(value)}`);
}
