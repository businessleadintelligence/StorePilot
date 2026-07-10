import type { KnowledgeGraphNodeType } from "@prisma/client";

import { runGraphBuilder, runIncrementalGraphUpdate } from "../builder/graph-builder";
import { repairGraphIntegrity, runIntegrityCheck } from "../integrity/integrity-engine";
import { computeGraphStatistics } from "../metrics/graph-metrics";
import { createGraphResolver } from "../query/graph-resolver";
import { createGraphQueryEngine } from "../query/graph-query-engine";
import { searchGraph } from "../search/graph-search";
import { diffGraphSnapshots, getCurrentGraphVersion } from "../versioning/version-manager";
import type { GraphBuildInput, GraphBuildResult } from "../shared/types";

export type KnowledgeGraphApi = {
  buildGraph(input: GraphBuildInput): Promise<GraphBuildResult>;
  incrementalUpdate(input: {
    storeId: string;
    entityType: string;
    entityId: string;
  }): Promise<GraphBuildResult>;
  getProductGraph(storeId: string, productId: string): ReturnType<GraphResolver["getProductGraph"]>;
  getStatistics(storeId: string): ReturnType<typeof computeGraphStatistics>;
  getIntegrity(storeId: string): ReturnType<typeof runIntegrityCheck>;
  repair(storeId: string): ReturnType<typeof repairGraphIntegrity>;
  search(input: Parameters<typeof searchGraph>[0]): ReturnType<typeof searchGraph>;
  getVersion(storeId: string): ReturnType<typeof getCurrentGraphVersion>;
  diffSnapshots(input: Parameters<typeof diffGraphSnapshots>[0]): ReturnType<typeof diffGraphSnapshots>;
  queryEngine: ReturnType<typeof createGraphQueryEngine>;
};

type GraphResolver = ReturnType<typeof createGraphResolver>;

export function createKnowledgeGraphApi(): KnowledgeGraphApi {
  const resolver = createGraphResolver();
  const queryEngine = createGraphQueryEngine();
  return {
    buildGraph: runGraphBuilder,
    incrementalUpdate: runIncrementalGraphUpdate,
    getProductGraph: resolver.getProductGraph.bind(resolver),
    getStatistics: computeGraphStatistics,
    getIntegrity: runIntegrityCheck,
    repair: repairGraphIntegrity,
    search: searchGraph,
    getVersion: getCurrentGraphVersion,
    diffSnapshots: diffGraphSnapshots,
    queryEngine,
  };
}

export type FutureEngineGraphConsumer = {
  readonly engineId: string;
  getSubgraph(nodeType: KnowledgeGraphNodeType, canonicalKey: string): Promise<unknown>;
};

export function createFutureEngineConsumer(
  engineId: string,
  storeId: string,
): FutureEngineGraphConsumer {
  const api = createKnowledgeGraphApi();
  return {
    engineId,
    async getSubgraph(nodeType, canonicalKey) {
      if (nodeType === "Product") {
        return api.getProductGraph(storeId, canonicalKey);
      }
      return api.queryEngine.getNodesByType({ storeId, nodeType });
    },
  };
}
