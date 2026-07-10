export type GraphEventType =
  | "GraphNodeCreated"
  | "GraphNodeUpdated"
  | "GraphEdgeCreated"
  | "GraphEdgeUpdated"
  | "GraphSnapshotCreated"
  | "GraphIntegrityChecked"
  | "GraphIncrementalUpdate";

export type GraphEvent = {
  type: GraphEventType;
  storeId: string;
  timestamp: string;
  nodeId?: string;
  edgeId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export class GraphEventEmitter {
  emit(event: Omit<GraphEvent, "timestamp"> & { timestamp?: string }): void {
    console.info("[knowledge-graph-event]", {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    });
  }
}

export function createGraphEventEmitter(): GraphEventEmitter {
  return new GraphEventEmitter();
}
