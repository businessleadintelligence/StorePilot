import type { KnowledgeGraphNodeType } from "@prisma/client";

import { createGraphNodeStore } from "../nodes/node-store";
import { createGraphQueryEngine } from "./graph-query-engine";

export class GraphResolver {
  private readonly nodes = createGraphNodeStore();
  private readonly query = createGraphQueryEngine();

  async getProductGraph(storeId: string, productId: string) {
    const node = await this.nodes.getByCanonicalKey({
      storeId,
      nodeType: "Product",
      canonicalKey: productId,
    });
    if (!node) {
      return null;
    }
    return this.query.findNeighbors({ storeId, nodeId: node.id, depth: 2 });
  }

  async getCollectionGraph(storeId: string, collectionId: string) {
    const node = await this.nodes.getByCanonicalKey({
      storeId,
      nodeType: "Collection",
      canonicalKey: collectionId,
    });
    if (!node) {
      return null;
    }
    return this.query.findNeighbors({ storeId, nodeId: node.id, depth: 2 });
  }

  async getInventoryGraph(storeId: string, variantId: string) {
    const node = await this.nodes.getByCanonicalKey({
      storeId,
      nodeType: "Variant",
      canonicalKey: variantId,
    });
    if (!node) {
      return null;
    }
    return this.query.findNeighbors({
      storeId,
      nodeId: node.id,
      depth: 2,
      relationship: "AFFECTS",
    });
  }

  async getRevenueGraph(storeId: string, orderId: string) {
    const node = await this.nodes.getByCanonicalKey({
      storeId,
      nodeType: "Order",
      canonicalKey: orderId,
    });
    if (!node) {
      return null;
    }
    return this.query.findNeighbors({
      storeId,
      nodeId: node.id,
      depth: 2,
      relationship: "GENERATES",
    });
  }

  async getVendorGraph(storeId: string, vendorKey: string) {
    const node = await this.nodes.getByCanonicalKey({
      storeId,
      nodeType: "Vendor",
      canonicalKey: vendorKey,
    });
    if (!node) {
      return null;
    }
    return this.query.findNeighbors({ storeId, nodeId: node.id, depth: 2 });
  }

  async getBusinessDnaGraph(storeId: string) {
    const node = await this.nodes.getByCanonicalKey({
      storeId,
      nodeType: "BusinessDNA",
      canonicalKey: storeId,
    });
    if (!node) {
      return null;
    }
    return { node, metadata: node.metadata };
  }

  async findDependencies(storeId: string, nodeId: string) {
    return this.query.findNeighbors({
      storeId,
      nodeId,
      depth: 3,
      relationship: "DEPENDS_ON",
    });
  }

  async getNodesByType(storeId: string, nodeType: KnowledgeGraphNodeType) {
    return this.query.getNodesByType({ storeId, nodeType });
  }
}

export function createGraphResolver(): GraphResolver {
  return new GraphResolver();
}
