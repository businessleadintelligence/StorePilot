import type { TimelineEventView } from "../types";
import styles from "../intelligence-workspace.module.css";

type TimelinePanelProps = {
  events: TimelineEventView[];
  title?: string;
  emptyMessage?: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TimelinePanel({
  events,
  title = "Timeline",
  emptyMessage = "No timeline events yet.",
}: TimelinePanelProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="base">
        <s-text type="strong">{title}</s-text>
        {events.length === 0 ? (
          <p className={styles.emptyState}>{emptyMessage}</p>
        ) : (
          <ol className={styles.timelineList} aria-label={title}>
            {events.map((event) => (
              <li key={event.id} className={styles.timelineItem}>
                <span className={styles.timelineDot} aria-hidden="true" />
                <div className={styles.timelineContent}>
                  <s-text type="strong">{event.title}</s-text>
                  <span className={styles.timelineMeta}>
                    {formatDate(event.occurredAt)}
                    {event.category ? ` · ${event.category}` : ""}
                    {event.severity ? ` · ${event.severity}` : ""}
                  </span>
                  {event.description ? (
                    <s-text color="subdued">{event.description}</s-text>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </s-stack>
    </s-box>
  );
}

export function ActivityTimeline(props: TimelinePanelProps) {
  return <TimelinePanel {...props} title={props.title ?? "Activity timeline"} />;
}
