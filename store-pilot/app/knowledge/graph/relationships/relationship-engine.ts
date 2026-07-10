import type { KnowledgeGraphEdgeType } from "@prisma/client";

import prisma from "../../../db.server";
import type { GraphEdgeStore } from "../edges/edge-store";
import type { GraphNodeStore } from "../nodes/node-store";
import {
  ENTITY_TO_NODE_TYPE,
  INVENTORY_FACT_TYPES,
  PRICE_FACT_TYPES,
  SEO_FACT_TYPES,
  type GraphNodeRecord,
} from "../shared/types";

export type EvidenceGraphInput = {
  id: string;
  storeId: string;
  entity: string;
  entityId: string;
  factType: string;
  confidence: number;
  version: number;
  freshnessMinutes: number | null;
  observationCount: number;
  sourceId: string | null;
  active: boolean;
  value: unknown;
};

export class RelationshipEngine {
  constructor(
    private readonly nodes: GraphNodeStore,
    private readonly edges: GraphEdgeStore,
  ) {}

  async bindEvidence(input: EvidenceGraphInput): Promise<{
    entityNode: GraphNodeRecord;
    evidenceNode: GraphNodeRecord;
    edgesCreated: number;
  }> {
    let edgesCreated = 0;
    const entityNodeType = ENTITY_TO_NODE_TYPE[input.entity] ?? "Product";
    const entityNode = (
      await this.nodes.upsert({
        storeId: input.storeId,
        nodeType: entityNodeType,
        canonicalKey: input.entityId,
        displayName: `${entityNodeType} ${input.entityId}`,
        confidence: input.confidence,
        metadata: { factTypes: [input.factType] },
      })
    ).node;

    const evidenceNode = (
      await this.nodes.upsert({
        storeId: input.storeId,
        nodeType: "Evidence",
        canonicalKey: input.id,
        displayName: input.factType,
        confidence: input.confidence,
        evidenceId: input.id,
        metadata: { factType: input.factType, value: input.value },
      })
    ).node;

    const observed = await this.edges.upsert({
      storeId: input.storeId,
      fromNodeId: entityNode.id,
      toNodeId: evidenceNode.id,
      relationship: "OBSERVED_BY",
      source: "evidence_store",
      confidence: input.confidence,
      evidenceId: input.id,
      evidenceVersion: input.version,
      evidenceSource: input.sourceId ?? "shopify",
      observationCount: input.observationCount,
      freshnessMinutes: input.freshnessMinutes,
      strength: input.confidence,
      weight: 1,
    });
    if (observed.created) {
      edgesCreated += 1;
    }

    edgesCreated += await this.createDerivedRelationships(input, entityNode, evidenceNode);

    await this.recordSemanticRelationship(
      input,
      entityNode.id,
      evidenceNode.id,
      `${input.factType}_observation`,
      "OBSERVED_BY",
    );

    return { entityNode, evidenceNode, edgesCreated };
  }

  private async createDerivedRelationships(
    input: EvidenceGraphInput,
    entityNode: GraphNodeRecord,
    evidenceNode: GraphNodeRecord,
  ): Promise<number> {
    let created = 0;
    const storeNode = await this.ensureStoreNode(input.storeId);
    const storeContains = await this.edges.upsert({
      storeId: input.storeId,
      fromNodeId: storeNode.id,
      toNodeId: entityNode.id,
      relationship: "CONTAINS",
      source: "relationship_engine",
      confidence: 1,
      evidenceId: input.id,
      evidenceVersion: input.version,
    });
    if (storeContains.created) {
      created += 1;
    }

    if (input.entity === "Variant") {
      const productId = await this.resolveVariantProductId(input.storeId, input.entityId);
      if (productId) {
        const productNode = (
          await this.nodes.upsert({
            storeId: input.storeId,
            nodeType: "Product",
            canonicalKey: productId,
            displayName: `Product ${productId}`,
          })
        ).node;
        const contains = await this.edges.upsert({
          storeId: input.storeId,
          fromNodeId: productNode.id,
          toNodeId: entityNode.id,
          relationship: "CONTAINS",
          source: "relationship_engine",
          evidenceId: input.id,
          evidenceVersion: input.version,
        });
        if (contains.created) {
          created += 1;
        }
      }
    }

    if (INVENTORY_FACT_TYPES.has(input.factType)) {
      created += await this.linkAffectsDimension(
        input,
        entityNode,
        "InventoryItem",
        input.entityId,
        "inventory",
      );
    }

    if (SEO_FACT_TYPES.has(input.factType)) {
      created += await this.linkAffectsDimension(
        input,
        entityNode,
        "SeoRecord",
        `${input.entityId}:seo`,
        "seo",
      );
    }

    if (PRICE_FACT_TYPES.has(input.factType)) {
      created += await this.linkAffectsDimension(
        input,
        entityNode,
        "Price",
        `${input.entityId}:price`,
        "price",
      );
    }

    if (input.factType === "SingleProductCollection" || input.factType === "OrphanCollection") {
      const collectionId = extractCollectionId(input.value);
      if (collectionId) {
        const collectionNode = (
          await this.nodes.upsert({
            storeId: input.storeId,
            nodeType: "Collection",
            canonicalKey: collectionId,
            displayName: `Collection ${collectionId}`,
          })
        ).node;
        const belongs = await this.edges.upsert({
          storeId: input.storeId,
          fromNodeId: entityNode.id,
          toNodeId: collectionNode.id,
          relationship: "BELONGS_TO",
          source: "relationship_engine",
          evidenceId: input.id,
          evidenceVersion: input.version,
        });
        if (belongs.created) {
          created += 1;
        }
      }
    }

    if (input.factType === "RefundRiskSeed" && input.entity === "Order") {
      const refundNode = (
        await this.nodes.upsert({
          storeId: input.storeId,
          nodeType: "Refund",
          canonicalKey: `${input.entityId}:refund`,
          displayName: `Refund ${input.entityId}`,
        })
      ).node;
      const generates = await this.edges.upsert({
        storeId: input.storeId,
        fromNodeId: entityNode.id,
        toNodeId: refundNode.id,
        relationship: "GENERATES",
        source: "relationship_engine",
        evidenceId: input.id,
        evidenceVersion: input.version,
      });
      if (generates.created) {
        created += 1;
      }
    }

    if (!input.active) {
      await this.edges.deactivateForNode(evidenceNode.id);
    }

    return created;
  }

  private async linkAffectsDimension(
    input: EvidenceGraphInput,
    entityNode: GraphNodeRecord,
    nodeType: "InventoryItem" | "SeoRecord" | "Price",
    canonicalKey: string,
    semantic: string,
  ): Promise<number> {
    const dimensionNode = (
      await this.nodes.upsert({
        storeId: input.storeId,
        nodeType,
        canonicalKey,
        displayName: `${nodeType} ${canonicalKey}`,
      })
    ).node;
    const affects = await this.edges.upsert({
      storeId: input.storeId,
      fromNodeId: entityNode.id,
      toNodeId: dimensionNode.id,
      relationship: "AFFECTS",
      source: "relationship_engine",
      evidenceId: input.id,
      evidenceVersion: input.version,
      strength: input.confidence,
    });
    await this.recordSemanticRelationship(
      input,
      entityNode.id,
      dimensionNode.id,
      `${semantic}_${input.factType}`,
      "AFFECTS",
    );
    return affects.created ? 1 : 0;
  }

  private async ensureStoreNode(storeId: string): Promise<GraphNodeRecord> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, storeName: true },
    });
    return (
      await this.nodes.upsert({
        storeId,
        nodeType: "Store",
        canonicalKey: storeId,
        displayName: store?.storeName ?? "Store",
        confidence: 1,
      })
    ).node;
  }

  private async resolveVariantProductId(
    storeId: string,
    variantId: string,
  ): Promise<string | null> {
    const row = await prisma.product.findFirst({
      where: { storeId, shopifyVariantId: variantId },
      select: { shopifyProductId: true },
    });
    return row?.shopifyProductId ?? null;
  }

  private async recordSemanticRelationship(
    input: EvidenceGraphInput,
    fromNodeId: string,
    toNodeId: string,
    semanticLabel: string,
    relationship: KnowledgeGraphEdgeType,
  ): Promise<void> {
    await prisma.knowledgeGraphRelationship.upsert({
      where: {
        storeId_fromNodeId_toNodeId_relationship_semanticLabel: {
          storeId: input.storeId,
          fromNodeId,
          toNodeId,
          relationship,
          semanticLabel,
        },
      },
      create: {
        storeId: input.storeId,
        fromNodeId,
        toNodeId,
        relationship,
        semanticLabel,
        evidenceId: input.id,
        evidenceVersion: input.version,
        evidenceSource: input.sourceId ?? "shopify",
        confidence: input.confidence,
        observationCount: input.observationCount,
        freshnessMinutes: input.freshnessMinutes,
      },
      update: {
        evidenceVersion: input.version,
        observationCount: { increment: 1 },
        freshnessMinutes: input.freshnessMinutes,
        confidence: input.confidence,
        active: input.active,
      },
    });
  }
}

function extractCollectionId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.collectionId === "string") {
    return record.collectionId;
  }
  return null;
}

export function createRelationshipEngine(
  nodes: GraphNodeStore,
  edges: GraphEdgeStore,
): RelationshipEngine {
  return new RelationshipEngine(nodes, edges);
}
