import { useIntelligenceWorkspace } from "../context/IntelligenceWorkspaceProvider";
import type { IntelligenceEntityView } from "../types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { CrossLinks } from "./CrossLinks";
import { RevenueBadge } from "./RevenueBadge";
import styles from "../intelligence-workspace.module.css";

type EntityInspectorProps = {
  entity: IntelligenceEntityView;
  currency: string;
};

export function EntityInspector({ entity, currency }: EntityInspectorProps) {
  const { openDrawer } = useIntelligenceWorkspace();

  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="base">
        <div className={styles.entityRowHeader}>
          <s-text type="strong">{entity.title}</s-text>
          {entity.confidencePercent != null ? (
            <ConfidenceBadge confidencePercent={entity.confidencePercent} />
          ) : null}
        </div>
        <s-text color="subdued">{entity.summary}</s-text>
        <div className={styles.badgeRow}>
          {entity.revenueImpact != null && entity.revenueImpact > 0 ? (
            <RevenueBadge amount={entity.revenueImpact} currency={currency} />
          ) : null}
          {entity.severity ? <s-badge tone="warning">{entity.severity}</s-badge> : null}
        </div>
        <CrossLinks links={entity.relatedLinks} />
        <s-button variant="tertiary" onClick={() => openDrawer(entity)}>
          Learn more
        </s-button>
      </s-stack>
    </s-box>
  );
}
