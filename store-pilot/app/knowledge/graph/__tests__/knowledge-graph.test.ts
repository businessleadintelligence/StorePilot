import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../../db.server";
import { createGraphEdgeStore } from "../edges/edge-store";
import { createGraphNodeStore } from "../nodes/node-store";
import { createRelationshipEngine } from "../relationships/relationship-engine";
import { runGraphBuilder, hashSnapshotPayload } from "../builder/graph-builder";
import { createGraphQueryEngine } from "../query/graph-query-engine";
import { runIntegrityCheck, repairGraphIntegrity } from "../integrity/integrity-engine";
import { bumpGraphVersion, createGraphSnapshot, diffGraphSnapshots } from "../versioning/version-manager";
import { buildNeighborhoodCacheKey } from "../cache/graph-cache";

const STORE_ID = "store-graph-test";

function mockPrismaMethod<T extends (...args: never[]) => unknown>(
  method: T,
  impl: (...args: Parameters<T>) => unknown,
): void {
  vi.mocked(method).mockImplementation(impl as T);
}

type LooseWhere = Record<string, unknown> & {
  storeId?: string;
  id?: string | { in?: string[] };
  status?: string;
  nodeType?: string | { in?: string[]; not?: string };
  active?: boolean;
  fromNodeId?: string;
  toNodeId?: string;
  evidenceId?: null | { not?: null };
  OR?: Array<Record<string, unknown>>;
  versionNumber?: number;
};

function asLooseWhere(where: unknown): LooseWhere {
  return (where ?? {}) as LooseWhere;
}

type GraphNodeRow = Record<string, unknown>;
type GraphEdgeRow = Record<string, unknown>;

const graphTestState = {
  nodes: new Map<string, GraphNodeRow>(),
  edges: new Map<string, GraphEdgeRow>(),
  relationships: new Map<string, GraphNodeRow>(),
  evidence: [] as Array<Record<string, unknown>>,
  metadata: new Map<string, Record<string, unknown>>(),
  checkpoints: new Map<string, Record<string, unknown>>(),
  snapshots: [] as Array<Record<string, unknown>>,
};

function findNodeByCompoundKey(input: {
  storeId: string;
  nodeType: string;
  canonicalKey: string;
}) {
  return [...graphTestState.nodes.values()].find(
    (node) =>
      node.storeId === input.storeId &&
      node.nodeType === input.nodeType &&
      node.canonicalKey === input.canonicalKey,
  );
}

function findEdgeByCompoundKey(input: {
  storeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: string;
}) {
  return [...graphTestState.edges.values()].find(
    (edge) =>
      edge.storeId === input.storeId &&
      edge.fromNodeId === input.fromNodeId &&
      edge.toNodeId === input.toNodeId &&
      edge.relationship === input.relationship,
  );
}

function installGraphPrismaMocks() {
  mockPrismaMethod(prisma.store.findUnique, async ({ where }) => ({
    id: where.id as string,
    storeName: "Test Store",
  }));

  vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

  mockPrismaMethod(prisma.evidence.findMany, async (args) => {
    const where = args?.where ?? {};
    const take = args?.take;
    let rows = graphTestState.evidence.filter((row) => row.storeId === where.storeId);
    if (where.active) {
      rows = rows.filter((row) => row.active === true);
    }
    if (where.entity) {
      rows = rows.filter((row) => row.entity === where.entity);
    }
    if (where.entityId) {
      rows = rows.filter((row) => row.entityId === where.entityId);
    }
    return rows.slice(0, take ?? rows.length);
  });

  mockPrismaMethod(prisma.evidence.count, async (args) => {
    const where = args?.where ?? {};
    let rows = graphTestState.evidence.filter((row) => row.storeId === where.storeId);
    if (where.active !== undefined) {
      rows = rows.filter((row) => row.active === where.active);
    }
    return rows.length;
  });

  mockPrismaMethod(prisma.knowledgeGraphNode.findUnique, async ({ where }) => {
    if ("id" in where) {
      return graphTestState.nodes.get(where.id as string) ?? null;
    }
    const compound = where.storeId_nodeType_canonicalKey as {
      storeId: string;
      nodeType: string;
      canonicalKey: string;
    };
    return findNodeByCompoundKey(compound) ?? null;
  });

  mockPrismaMethod(prisma.knowledgeGraphNode.findMany, async (args) => {
    const where = args?.where ?? {};
    return [...graphTestState.nodes.values()].filter((node) => {
      if (where.storeId && node.storeId !== where.storeId) return false;
      if (where.status && node.status !== where.status) return false;
      if (where.nodeType && node.nodeType !== where.nodeType) return false;
      if (
        where.nodeType &&
        typeof where.nodeType === "object" &&
        "not" in where.nodeType &&
        node.nodeType === where.nodeType.not
      ) {
        return false;
      }
      return true;
    });
  });

  mockPrismaMethod(prisma.knowledgeGraphNode.create, async ({ data }) => {
    const id = crypto.randomUUID();
    const row = {
      id,
      version: 1,
      status: "active",
      confidence: 1,
      metadata: {},
      evidenceId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    graphTestState.nodes.set(id, row);
    return row;
  });

  mockPrismaMethod(prisma.knowledgeGraphNode.update, async ({ where, data }) => {
    const nodeId = where.id as string;
    const existing = graphTestState.nodes.get(nodeId)!;
    const updated = { ...existing, ...data };
    graphTestState.nodes.set(nodeId, updated);
    return updated;
  });

  mockPrismaMethod(prisma.knowledgeGraphNode.count, async (args) => {
    const where = asLooseWhere(args?.where);
    const nodeTypeIn =
      typeof where.nodeType === "object" && where.nodeType !== null && "in" in where.nodeType
        ? where.nodeType.in
        : undefined;
    return [...graphTestState.nodes.values()].filter((node) => {
      if (where.storeId && node.storeId !== where.storeId) return false;
      if (where.status && node.status !== where.status) return false;
      if (nodeTypeIn && !nodeTypeIn.includes(node.nodeType as string)) {
        return false;
      }
      return true;
    }).length;
  });

  vi.mocked(prisma.knowledgeGraphNode.groupBy).mockResolvedValue([] as never);

  mockPrismaMethod(prisma.knowledgeGraphEdge.findUnique, async ({ where }) => {
    if ("id" in where) {
      return graphTestState.edges.get(where.id as string) ?? null;
    }
    const compound = where.storeId_fromNodeId_toNodeId_relationship as {
      storeId: string;
      fromNodeId: string;
      toNodeId: string;
      relationship: string;
    };
    return findEdgeByCompoundKey(compound) ?? null;
  });

  mockPrismaMethod(prisma.knowledgeGraphEdge.findMany, async (args) => {
    const where = args?.where ?? {};
    return [...graphTestState.edges.values()].filter((edge) => {
      if (where.storeId && edge.storeId !== where.storeId) return false;
      if (where.active === true && edge.active !== true) return false;
      if (where.fromNodeId && edge.fromNodeId !== where.fromNodeId) return false;
      if (where.toNodeId && edge.toNodeId !== where.toNodeId) return false;
      if (where.evidenceId === null && edge.evidenceId !== null) return false;
      if (where.OR) {
        const or = where.OR as Array<Record<string, unknown>>;
        const match = or.some(
          (clause) =>
            edge.fromNodeId === clause.fromNodeId || edge.toNodeId === clause.toNodeId,
        );
        if (!match) return false;
      }
      return true;
    });
  });

  mockPrismaMethod(prisma.knowledgeGraphEdge.create, async ({ data }) => {
    const id = crypto.randomUUID();
    const row = { id, active: true, observationCount: 1, confidence: 1, ...data };
    graphTestState.edges.set(id, row);
    return row;
  });

  mockPrismaMethod(prisma.knowledgeGraphEdge.update, async ({ where, data }) => {
    const edgeId = where.id as string;
    const existing = graphTestState.edges.get(edgeId)!;
    const updated = { ...existing, ...data };
    graphTestState.edges.set(edgeId, updated);
    return updated;
  });

  mockPrismaMethod(prisma.knowledgeGraphEdge.updateMany, async ({ where, data }) => {
    const filter = asLooseWhere(where);
    let count = 0;
    for (const [id, edge] of graphTestState.edges.entries()) {
      const idFilter = filter.id;
      if (typeof idFilter === "object" && idFilter?.in?.includes(id)) {
        graphTestState.edges.set(id, { ...edge, ...data });
        count += 1;
      }
      if (filter.storeId && edge.storeId === filter.storeId && filter.active === true) {
        if (filter.evidenceId === null && edge.evidenceId === null) {
          graphTestState.edges.set(id, { ...edge, ...data });
          count += 1;
        }
      }
    }
    return { count };
  });

  mockPrismaMethod(prisma.knowledgeGraphEdge.count, async (args) => {
    const where = asLooseWhere(args?.where);
    const evidenceNotNull =
      typeof where.evidenceId === "object" && where.evidenceId !== null && "not" in where.evidenceId
        ? where.evidenceId.not
        : undefined;
    return [...graphTestState.edges.values()].filter((edge) => {
      if (where.storeId && edge.storeId !== where.storeId) return false;
      if (where.active === true && edge.active !== true) return false;
      if (evidenceNotNull === null && edge.evidenceId === null) return false;
      return true;
    }).length;
  });

  mockPrismaMethod(prisma.knowledgeGraphRelationship.upsert, async ({ create }) => {
    const key = `${create.storeId}:${create.fromNodeId}:${create.toNodeId}:${create.relationship}:${create.semanticLabel}`;
    graphTestState.relationships.set(key, create as GraphNodeRow);
    return create;
  });

  mockPrismaMethod(prisma.knowledgeGraphRelationship.count, async () => graphTestState.relationships.size);

  mockPrismaMethod(prisma.knowledgeGraphMetadata.upsert, async ({ create }) => {
    graphTestState.metadata.set(create.storeId as string, {
      currentVersion: 0,
      ...create,
    });
    return graphTestState.metadata.get(create.storeId as string);
  });

  mockPrismaMethod(prisma.knowledgeGraphMetadata.update, async ({ where, data }) => {
    const storeId = where.storeId as string;
    const existing = graphTestState.metadata.get(storeId) ?? { storeId };
    const updated = { ...existing, ...data };
    graphTestState.metadata.set(storeId, updated);
    return updated;
  });

  mockPrismaMethod(
    prisma.knowledgeGraphMetadata.findUnique,
    async ({ where }) => graphTestState.metadata.get(where.storeId as string) ?? null,
  );

  mockPrismaMethod(prisma.knowledgeGraphBuildCheckpoint.upsert, async ({ create }) => {
    graphTestState.checkpoints.set(create.storeId as string, {
      evidenceProcessed: 0,
      nodesCreated: 0,
      edgesCreated: 0,
      ...create,
    });
    return graphTestState.checkpoints.get(create.storeId as string);
  });

  mockPrismaMethod(prisma.knowledgeGraphBuildCheckpoint.update, async ({ where, data }) => {
    const storeId = where.storeId as string;
    const existing = graphTestState.checkpoints.get(storeId)!;
    const updated = { ...existing, ...data };
    graphTestState.checkpoints.set(storeId, updated);
    return updated;
  });

  mockPrismaMethod(prisma.knowledgeGraphVersion.create, async ({ data }) => data);

  mockPrismaMethod(prisma.knowledgeGraphSnapshot.create, async ({ data }) => {
    const row = { id: crypto.randomUUID(), ...data };
    graphTestState.snapshots.push(row);
    return row;
  });

  mockPrismaMethod(prisma.knowledgeGraphSnapshot.findFirst, async (args) => {
    const where = args?.where ?? {};
    return (
      graphTestState.snapshots.find(
        (snapshot) =>
          snapshot.storeId === where.storeId && snapshot.versionNumber === where.versionNumber,
      ) ?? null
    );
  });

  mockPrismaMethod(prisma.knowledgeGraphIntegrity.upsert, async ({ create }) => create);
  mockPrismaMethod(prisma.knowledgeGraphIntegrity.update, async () => ({}));
  mockPrismaMethod(prisma.knowledgeGraphStatistics.upsert, async ({ create }) => create);
  mockPrismaMethod(prisma.knowledgeGraphSearchIndex.create, async ({ data }) => ({
    id: crypto.randomUUID(),
    ...data,
  }));
}

function seedEvidence(overrides: Partial<Record<string, unknown>> = {}) {
  const row = {
    id: crypto.randomUUID(),
    storeId: STORE_ID,
    entity: "Product",
    entityId: "100",
    factType: "InventoryLow",
    confidence: 0.9,
    version: 1,
    freshnessMinutes: 10,
    observationCount: 1,
    sourceId: "shopify",
    active: true,
    value: { quantity: 2 },
    ...overrides,
  };
  graphTestState.evidence.push(row);
  return row;
}

describe("Store Knowledge Graph", () => {
  beforeEach(() => {
    graphTestState.nodes.clear();
    graphTestState.edges.clear();
    graphTestState.relationships.clear();
    graphTestState.evidence.length = 0;
    graphTestState.metadata.clear();
    graphTestState.checkpoints.clear();
    graphTestState.snapshots.length = 0;
    installGraphPrismaMocks();
  });

  describe("node and edge stores", () => {
    it("creates nodes idempotently by canonical key", async () => {
      const nodes = createGraphNodeStore();
      const first = await nodes.upsert({
        storeId: STORE_ID,
        nodeType: "Product",
        canonicalKey: "100",
        displayName: "Product 100",
      });
      const second = await nodes.upsert({
        storeId: STORE_ID,
        nodeType: "Product",
        canonicalKey: "100",
        displayName: "Product 100 Updated",
      });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.node.id).toBe(first.node.id);
      expect(second.node.displayName).toBe("Product 100 Updated");
    });

    it("creates edges with evidence binding", async () => {
      const nodes = createGraphNodeStore();
      const edges = createGraphEdgeStore();
      const from = (
        await nodes.upsert({
          storeId: STORE_ID,
          nodeType: "Product",
          canonicalKey: "100",
          displayName: "Product 100",
        })
      ).node;
      const to = (
        await nodes.upsert({
          storeId: STORE_ID,
          nodeType: "Evidence",
          canonicalKey: "ev-1",
          displayName: "InventoryLow",
        })
      ).node;
      const edge = await edges.upsert({
        storeId: STORE_ID,
        fromNodeId: from.id,
        toNodeId: to.id,
        relationship: "OBSERVED_BY",
        source: "evidence_store",
        evidenceId: "ev-1",
        evidenceVersion: 1,
      });
      expect(edge.created).toBe(true);
      expect(edge.edge.evidenceId).toBe("ev-1");
    });
  });

  describe("relationship engine", () => {
    it("binds evidence to entity and creates derived AFFECTS edges", async () => {
      const evidence = seedEvidence();
      const nodes = createGraphNodeStore();
      const edges = createGraphEdgeStore();
      const engine = createRelationshipEngine(nodes, edges);
      const result = await engine.bindEvidence({
        id: evidence.id as string,
        storeId: STORE_ID,
        entity: "Product",
        entityId: "100",
        factType: "InventoryLow",
        confidence: 0.9,
        version: 1,
        freshnessMinutes: 10,
        observationCount: 1,
        sourceId: "shopify",
        active: true,
        value: evidence.value,
      });
      expect(result.entityNode.nodeType).toBe("Product");
      expect(result.evidenceNode.nodeType).toBe("Evidence");
      expect(result.edgesCreated).toBeGreaterThan(0);
      const inventoryEdges = [...graphTestState.edges.values()].filter(
        (edge) => edge.relationship === "AFFECTS",
      );
      expect(inventoryEdges.length).toBeGreaterThan(0);
    });

    it("creates BELONGS_TO collection relationship from collection facts", async () => {
      const evidence = seedEvidence({
        factType: "SingleProductCollection",
        value: { collectionId: "200" },
      });
      const nodes = createGraphNodeStore();
      const edges = createGraphEdgeStore();
      const engine = createRelationshipEngine(nodes, edges);
      await engine.bindEvidence({
        id: evidence.id as string,
        storeId: STORE_ID,
        entity: "Product",
        entityId: "100",
        factType: "SingleProductCollection",
        confidence: 1,
        version: 1,
        freshnessMinutes: 5,
        observationCount: 1,
        sourceId: "shopify",
        active: true,
        value: evidence.value,
      });
      const belongs = [...graphTestState.edges.values()].find(
        (edge) => edge.relationship === "BELONGS_TO",
      );
      expect(belongs).toBeTruthy();
    });
  });

  describe("graph builder", () => {
    it("builds graph incrementally from evidence store", async () => {
      seedEvidence();
      seedEvidence({ entityId: "101", factType: "MissingSEO" });
      const result = await runGraphBuilder({ storeId: STORE_ID, batchSize: 10 });
      expect(result.success).toBe(true);
      expect(result.hasMoreWork).toBe(false);
      expect(result.evidenceProcessed).toBe(2);
      expect(graphTestState.nodes.size).toBeGreaterThan(2);
      expect(result.snapshotVersion).toBeDefined();
    });

    it("produces deterministic snapshot hashes", () => {
      const payload = { nodes: [{ id: "a" }], edges: [{ id: "b" }] };
      expect(hashSnapshotPayload(payload)).toBe(hashSnapshotPayload(payload));
    });
  });

  describe("query engine", () => {
    it("finds neighbors and shortest path", async () => {
      seedEvidence();
      await runGraphBuilder({ storeId: STORE_ID, batchSize: 10 });
      const productNode = [...graphTestState.nodes.values()].find(
        (node) => node.nodeType === "Product",
      )!;
      const evidenceNode = [...graphTestState.nodes.values()].find(
        (node) => node.nodeType === "Evidence",
      )!;
      const query = createGraphQueryEngine();
      const neighborhood = await query.findNeighbors({
        storeId: STORE_ID,
        nodeId: productNode.id as string,
        depth: 2,
      });
      expect(neighborhood.nodes.length).toBeGreaterThan(1);
      const path = await query.shortestPath({
        storeId: STORE_ID,
        fromNodeId: productNode.id as string,
        toNodeId: evidenceNode.id as string,
      });
      expect(path?.length).toBeGreaterThan(0);
    });

    it("computes influence score from neighborhood weight", async () => {
      seedEvidence();
      await runGraphBuilder({ storeId: STORE_ID, batchSize: 10 });
      const productNode = [...graphTestState.nodes.values()].find(
        (node) => node.nodeType === "Product",
      )!;
      const query = createGraphQueryEngine();
      const score = await query.influenceScore({
        storeId: STORE_ID,
        nodeId: productNode.id as string,
      });
      expect(score).toBeGreaterThan(0);
    });
  });

  describe("versioning and snapshots", () => {
    it("bumps version and diffs snapshots", async () => {
      seedEvidence();
      await runGraphBuilder({ storeId: STORE_ID, batchSize: 10 });
      const stats = {
        totalNodes: graphTestState.nodes.size,
        totalEdges: graphTestState.edges.size,
        averageDegree: 2,
        connectedComponents: 1,
        disconnectedNodes: 0,
        graphDensity: 0.01,
        evidenceCoverage: 1,
        businessCoverage: 0.5,
        relationshipCoverage: 0.5,
      };
      const v1 = await bumpGraphVersion(STORE_ID, {
        label: "test",
        nodeCount: stats.totalNodes,
        edgeCount: stats.totalEdges,
      });
      await createGraphSnapshot(STORE_ID, v1.versionNumber, stats);
      seedEvidence({ entityId: "102" });
      await runGraphBuilder({ storeId: STORE_ID, batchSize: 10 });
      const v2 = await bumpGraphVersion(STORE_ID, {
        label: "test2",
        nodeCount: graphTestState.nodes.size,
        edgeCount: graphTestState.edges.size,
      });
      await createGraphSnapshot(STORE_ID, v2.versionNumber, stats);
      const diff = await diffGraphSnapshots({
        storeId: STORE_ID,
        fromVersion: v1.versionNumber,
        toVersion: v2.versionNumber,
      });
      expect(diff.toVersion).toBe(v2.versionNumber);
    });
  });

  describe("integrity engine", () => {
    it("flags edges missing evidence", async () => {
      const nodes = createGraphNodeStore();
      const edges = createGraphEdgeStore();
      const from = (
        await nodes.upsert({
          storeId: STORE_ID,
          nodeType: "Product",
          canonicalKey: "orphan",
          displayName: "Orphan",
        })
      ).node;
      const to = (
        await nodes.upsert({
          storeId: STORE_ID,
          nodeType: "Evidence",
          canonicalKey: "ev-orphan",
          displayName: "Evidence",
        })
      ).node;
      await edges.upsert({
        storeId: STORE_ID,
        fromNodeId: from.id,
        toNodeId: to.id,
        relationship: "OBSERVED_BY",
        source: "test",
        evidenceId: null,
      });
      const report = await runIntegrityCheck(STORE_ID);
      expect(report.issues.some((issue) => issue.code === "missing_evidence")).toBe(true);
      const repaired = await repairGraphIntegrity(STORE_ID);
      expect(repaired).toBeGreaterThan(0);
    });
  });

  describe("cache and webhook helpers", () => {
    it("builds deterministic neighborhood cache keys", () => {
      const key = buildNeighborhoodCacheKey({
        storeId: STORE_ID,
        nodeId: "node-1",
        depth: 2,
      });
      expect(key).toBe(`${STORE_ID}:graph:neighborhood:node-1:2`);
    });

    it("schedules incremental graph jobs from product webhooks", async () => {
      const { scheduleGraphUpdateFromWebhook } = await import(
        "../../../services/knowledge-graph-webhook.server"
      );
      const jobId = await scheduleGraphUpdateFromWebhook({
        storeId: STORE_ID,
        topic: "products/update",
        payload: { id: "gid://shopify/Product/555" },
      });
      expect(jobId).toBeTruthy();
    });

    it("ignores unsupported webhook topics", async () => {
      const { scheduleGraphUpdateFromWebhook } = await import(
        "../../../services/knowledge-graph-webhook.server"
      );
      const jobId = await scheduleGraphUpdateFromWebhook({
        storeId: STORE_ID,
        topic: "customers/create",
        payload: { id: "1" },
      });
      expect(jobId).toBeNull();
    });
  });
});
