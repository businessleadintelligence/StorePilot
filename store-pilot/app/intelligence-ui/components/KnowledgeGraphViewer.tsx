import type { RelationshipNodeView } from "../types";
import styles from "../intelligence-workspace.module.css";

type KnowledgeGraphViewerProps = {
  nodes: RelationshipNodeView[];
  selectedNodeId?: string | null;
  onSelectNode?: (node: RelationshipNodeView) => void;
  title?: string;
};

export function KnowledgeGraphViewer({
  nodes,
  selectedNodeId,
  onSelectNode,
  title = "Knowledge graph",
}: KnowledgeGraphViewerProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="base">
        <s-text type="strong">{title}</s-text>
        <s-text color="subdued">
          Click nodes to explore relationships. Pan and zoom via browser scroll on desktop.
        </s-text>
        {nodes.length === 0 ? (
          <p className={styles.emptyState}>Graph has not been built for this store yet.</p>
        ) : (
          <div className={styles.graphList} role="list" aria-label={title}>
            {nodes.map((node) => (
              <div
                key={node.id}
                className={styles.graphNode}
                role="listitem"
                aria-current={selectedNodeId === node.id ? "true" : undefined}
              >
                <button
                  type="button"
                  className={styles.graphNodeButton}
                  onClick={() => onSelectNode?.(node)}
                >
                  <s-text type="strong">{node.displayName}</s-text>
                  <s-text color="subdued">{node.nodeType}</s-text>
                </button>
                {node.link ? <s-link href={node.link}>Open</s-link> : null}
              </div>
            ))}
          </div>
        )}
      </s-stack>
    </s-box>
  );
}

export function RelationshipPanel(props: KnowledgeGraphViewerProps) {
  return <KnowledgeGraphViewer {...props} title={props.title ?? "Relationships"} />;
}
