import type { KnowledgeGraphEdgeType, KnowledgeGraphNodeType } from "@prisma/client";

import { createGraphEdgeStore } from "../edges/edge-store";
import { createGraphNodeStore } from "../nodes/node-store";
import {
  MAX_GRAPH_NEIGHBORHOOD,
  MAX_GRAPH_TRAVERSAL_DEPTH,
} from "../shared/constants";
import type {
  GraphNeighborhood,
  GraphNodeRecord,
  GraphPath,
  GraphTraversalNode,
} from "../shared/types";

export class GraphQueryEngine {
  private readonly nodes = createGraphNodeStore();
  private readonly edges = createGraphEdgeStore();

  async findNeighbors(input: {
    storeId: string;
    nodeId: string;
    depth?: number;
    relationship?: KnowledgeGraphEdgeType;
  }): Promise<GraphNeighborhood> {
    const center = await this.nodes.getById(input.nodeId);
    if (!center || center.storeId !== input.storeId) {
      throw new Error("graph_node_not_found");
    }

    const maxDepth = Math.min(input.depth ?? 1, MAX_GRAPH_TRAVERSAL_DEPTH);
    const visitedNodes = new Map<string, GraphNodeRecord>([[center.id, center]]);
    const collectedEdges = new Map<string, ReturnType<typeof mapEdgeLite>>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: center.id, depth: 0 }];

    while (queue.length > 0 && visitedNodes.size < MAX_GRAPH_NEIGHBORHOOD) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) {
        continue;
      }
      const edgeList = await this.edges.listForNode({
        storeId: input.storeId,
        nodeId: current.nodeId,
        direction: "both",
      });
      for (const edge of edgeList) {
        if (input.relationship && edge.relationship !== input.relationship) {
          continue;
        }
        collectedEdges.set(edge.id, edge);
        const neighborId =
          edge.fromNodeId === current.nodeId ? edge.toNodeId : edge.fromNodeId;
        if (!visitedNodes.has(neighborId)) {
          const neighbor = await this.nodes.getById(neighborId);
          if (neighbor) {
            visitedNodes.set(neighborId, neighbor);
            queue.push({ nodeId: neighborId, depth: current.depth + 1 });
          }
        }
      }
    }

    return {
      center,
      nodes: [...visitedNodes.values()],
      edges: [...collectedEdges.values()],
    };
  }

  async depthSearch(input: {
    storeId: string;
    startNodeId: string;
    maxDepth?: number;
  }): Promise<GraphTraversalNode[]> {
    const neighborhood = await this.findNeighbors({
      storeId: input.storeId,
      nodeId: input.startNodeId,
      depth: input.maxDepth ?? MAX_GRAPH_TRAVERSAL_DEPTH,
    });
    return neighborhood.nodes.map((node, index) => ({
      ...node,
      depth: node.id === neighborhood.center.id ? 0 : Math.min(index, input.maxDepth ?? 3),
    }));
  }

  async shortestPath(input: {
    storeId: string;
    fromNodeId: string;
    toNodeId: string;
  }): Promise<GraphPath | null> {
    if (input.fromNodeId === input.toNodeId) {
      const node = await this.nodes.getById(input.fromNodeId);
      return node ? { nodes: [node], edges: [], length: 0 } : null;
    }

    const queue: string[] = [input.fromNodeId];
    const visited = new Set<string>([input.fromNodeId]);
    const previous = new Map<string, { nodeId: string; edgeId: string }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edgeList = await this.edges.listForNode({
        storeId: input.storeId,
        nodeId: current,
        direction: "both",
      });
      for (const edge of edgeList) {
        const neighborId = edge.fromNodeId === current ? edge.toNodeId : edge.fromNodeId;
        if (visited.has(neighborId)) {
          continue;
        }
        visited.add(neighborId);
        previous.set(neighborId, { nodeId: current, edgeId: edge.id });
        if (neighborId === input.toNodeId) {
          return reconstructPath(input, previous);
        }
        queue.push(neighborId);
      }
    }
    return null;
  }

  async influenceScore(input: { storeId: string; nodeId: string }): Promise<number> {
    const neighborhood = await this.findNeighbors({
      storeId: input.storeId,
      nodeId: input.nodeId,
      depth: 2,
    });
    const edgeWeight = neighborhood.edges.reduce(
      (sum, edge) => sum + (edge.weight ?? 1) * edge.confidence,
      0,
    );
    return round(neighborhood.nodes.length + edgeWeight);
  }

  async findConnectedComponents(storeId: string): Promise<number> {
    const { computeGraphStatistics } = await import("../metrics/graph-metrics");
    const stats = await computeGraphStatistics(storeId);
    return stats.connectedComponents;
  }

  async getNodesByType(input: {
    storeId: string;
    nodeType: KnowledgeGraphNodeType;
    take?: number;
  }): Promise<GraphNodeRecord[]> {
    return this.nodes.listByStore({
      storeId: input.storeId,
      nodeType: input.nodeType,
      take: input.take,
    });
  }
}

async function reconstructPath(
  input: { storeId: string; toNodeId: string },
  previous: Map<string, { nodeId: string; edgeId: string }>,
): Promise<GraphPath> {
  const nodes = createGraphNodeStore();
  const edges = createGraphEdgeStore();
  const pathNodeIds: string[] = [input.toNodeId];
  const pathEdgeIds: string[] = [];
  let cursor: string | undefined = input.toNodeId;
  while (cursor && previous.has(cursor)) {
    const step: { nodeId: string; edgeId: string } = previous.get(cursor)!;
    pathEdgeIds.unshift(step.edgeId);
    pathNodeIds.unshift(step.nodeId);
    cursor = step.nodeId;
  }
  const nodeRecords = (
    await Promise.all(pathNodeIds.map((nodeId) => nodes.getById(nodeId)))
  ).filter((node): node is GraphNodeRecord => Boolean(node));
  const edgeRecords = (
    await Promise.all(pathEdgeIds.map((edgeId) => edges.getById(edgeId)))
  ).filter((edge): edge is NonNullable<Awaited<ReturnType<typeof edges.getById>>> => Boolean(edge));
  return {
    nodes: nodeRecords,
    edges: edgeRecords,
    length: pathEdgeIds.length,
  };
}

function mapEdgeLite(edge: {
  id: string;
  storeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: KnowledgeGraphEdgeType;
  confidence: number;
  source: string;
  evidenceId: string | null;
  evidenceVersion: number | null;
  evidenceSource: string | null;
  observationCount: number;
  freshnessMinutes: number | null;
  strength: number | null;
  weight: number | null;
  active: boolean;
}) {
  return edge;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createGraphQueryEngine(): GraphQueryEngine {
  return new GraphQueryEngine();
}
