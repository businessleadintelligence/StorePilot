import { Form } from "react-router";

import type { ActionCenterItem } from "../types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RevenueBadge } from "./RevenueBadge";
import styles from "../intelligence-workspace.module.css";

type ActionCenterProps = {
  items: ActionCenterItem[];
  currency: string;
};

export function ActionCenter({ items, currency }: ActionCenterProps) {
  if (items.length === 0) {
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-text color="subdued">No recommended actions at this time.</s-text>
      </s-box>
    );
  }

  return (
    <div className={styles.entityList}>
      {items.map((item) => (
        <s-box
          key={item.id}
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="small-200">
            <div className={styles.entityRowHeader}>
              <s-text type="strong">{item.title}</s-text>
              {item.confidencePercent != null ? (
                <ConfidenceBadge confidencePercent={item.confidencePercent} />
              ) : null}
            </div>
            <s-text color="subdued">{item.description}</s-text>
            {item.revenueImpact != null && item.revenueImpact > 0 ? (
              <RevenueBadge amount={item.revenueImpact} currency={currency} />
            ) : null}
            <div className={styles.actionRow}>
              {item.entityType === "experiment" ? (
                <>
                  <Form method="post">
                    <input type="hidden" name="intent" value="approve" />
                    <input type="hidden" name="experimentId" value={item.entityId} />
                    <s-button type="submit" variant="primary">
                      Approve
                    </s-button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="dismiss" />
                    <input type="hidden" name="experimentId" value={item.entityId} />
                    <s-button type="submit" variant="secondary">
                      Dismiss
                    </s-button>
                  </Form>
                </>
              ) : (
                <>
                  <s-button variant="primary">Approve</s-button>
                  <s-button variant="secondary">Dismiss</s-button>
                </>
              )}
              <s-button variant="tertiary">Postpone</s-button>
              <s-button variant="tertiary">View Evidence</s-button>
              <s-button variant="tertiary">Explain</s-button>
            </div>
          </s-stack>
        </s-box>
      ))}
    </div>
  );
}
