import { useIntelligenceWorkspace } from "../context/IntelligenceWorkspaceProvider";
import type { EvidenceItemView, TimelineEventView } from "../types";
import { CrossLinks } from "./CrossLinks";
import { TimelinePanel } from "./TimelinePanel";
import styles from "../intelligence-workspace.module.css";

type EvidenceDrawerProps = {
  evidence: EvidenceItemView[];
  timeline: TimelineEventView[];
};

export function EvidenceDrawer({ evidence, timeline }: EvidenceDrawerProps) {
  const { drawerOpen, selectedEntity, closeDrawer } = useIntelligenceWorkspace();

  if (!drawerOpen || !selectedEntity) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={styles.drawerOverlay}
        aria-label="Close evidence drawer"
        onClick={closeDrawer}
      />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence for ${selectedEntity.title}`}
      >
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerSectionTitle}>{selectedEntity.entityType}</p>
            <h2 className={styles.title}>{selectedEntity.title}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={closeDrawer}>
            Close
          </button>
        </div>
        <div className={styles.drawerBody}>
          <section className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Overview</h3>
            <s-text>{selectedEntity.summary}</s-text>
          </section>

          <section className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Evidence</h3>
            {evidence.length === 0 ? (
              <p className={styles.emptyState}>No evidence items linked yet.</p>
            ) : (
              <ul>
                {evidence.map((item) => (
                  <li key={item.id}>
                    <s-text type="strong">{item.label}</s-text>
                    <s-text color="subdued">
                      {item.source}
                      {item.confidence != null ? ` · ${item.confidence}% confidence` : ""}
                    </s-text>
                    {item.detail ? <s-text>{item.detail}</s-text> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Timeline</h3>
            <TimelinePanel events={timeline.slice(0, 8)} title="" />
          </section>

          <section className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Related intelligence</h3>
            <CrossLinks links={selectedEntity.relatedLinks} />
          </section>
        </div>
      </aside>
    </>
  );
}
