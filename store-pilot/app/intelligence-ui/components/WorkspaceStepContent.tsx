import type { ReactNode } from "react";

import { ActionCenter } from "./ActionCenter";
import { EntityInspector } from "./EntityInspector";
import { TimelinePanel } from "./TimelinePanel";
import { useIntelligenceWorkspace } from "../context/IntelligenceWorkspaceProvider";
import type { ActionCenterItem, EvidenceItemView, IntelligenceEntityView, TimelineEventView } from "../types";
import styles from "../intelligence-workspace.module.css";

type WorkspaceStepContentProps = {
  summary: ReactNode;
  details: ReactNode;
  evidence: EvidenceItemView[];
  timeline: TimelineEventView[];
  related: ReactNode;
  actions: ActionCenterItem[];
  learning: ReactNode;
  currency: string;
  entities?: IntelligenceEntityView[];
};

export function WorkspaceStepContent({
  summary,
  details,
  evidence,
  timeline,
  related,
  actions,
  learning,
  currency,
  entities = [],
}: WorkspaceStepContentProps) {
  const { activeStep } = useIntelligenceWorkspace();

  switch (activeStep) {
    case "summary":
      return <>{summary}</>;
    case "details":
      return <>{details}</>;
    case "evidence":
      return (
        <s-stack gap="base">
          {evidence.length === 0 ? (
            <p className={styles.emptyState}>No evidence linked to this workspace yet.</p>
          ) : (
            evidence.map((item) => (
              <s-box
                key={item.id}
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text type="strong">{item.label}</s-text>
                  <s-text color="subdued">{item.source}</s-text>
                  {item.detail ? <s-text>{item.detail}</s-text> : null}
                </s-stack>
              </s-box>
            ))
          )}
          {entities.length > 0 ? (
            <s-stack gap="small-200">
              <s-text type="strong">Inspect entities</s-text>
              {entities.map((entity) => (
                <EntityInspector key={entity.id} entity={entity} currency={currency} />
              ))}
            </s-stack>
          ) : null}
        </s-stack>
      );
    case "timeline":
      return <TimelinePanel events={timeline} />;
    case "related":
      return <>{related}</>;
    case "actions":
      return <ActionCenter items={actions} currency={currency} />;
    case "learning":
      return <>{learning}</>;
    default:
      return <>{summary}</>;
  }
}

export function WorkspaceTabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  return (
    <s-stack gap="base">
      {tabs.map((tab) => (
        <s-box
          key={tab.id}
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="small-200">
            <s-text type="strong">{tab.label}</s-text>
            {tab.content}
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}

export function RecommendationPanel({
  title,
  recommendations,
}: {
  title: string;
  recommendations: Array<{ id: string; title: string; detail: string }>;
}) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="base">
        <s-text type="strong">{title}</s-text>
        {recommendations.length === 0 ? (
          <p className={styles.emptyState}>No recommendations yet.</p>
        ) : (
          recommendations.map((item) => (
            <s-stack key={item.id} gap="small-200">
              <s-text type="strong">{item.title}</s-text>
              <s-text color="subdued">{item.detail}</s-text>
            </s-stack>
          ))
        )}
      </s-stack>
    </s-box>
  );
}

export function OperationsQueue({
  tasks,
}: {
  tasks: Array<{ id: string; title: string; status: string }>;
}) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="base">
        <s-text type="strong">Operations queue</s-text>
        {tasks.length === 0 ? (
          <p className={styles.emptyState}>Queue is clear.</p>
        ) : (
          tasks.map((task) => (
            <s-stack key={task.id} direction="inline" justifyContent="space-between">
              <s-text>{task.title}</s-text>
              <s-badge>{task.status}</s-badge>
            </s-stack>
          ))
        )}
      </s-stack>
    </s-box>
  );
}
