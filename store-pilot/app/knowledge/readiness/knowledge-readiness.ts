import type { KnowledgeIntelligenceDomain } from "@prisma/client";

import prisma from "../../db.server";
import { orderWhereForMetrics } from "../../lib/order-query-filters.server";
import { KNOWLEDGE_FACT_TYPES } from "../shared/types";

const DOMAIN_FACT_MAP: Record<KnowledgeIntelligenceDomain, string[]> = {
  product_intelligence: [
    "NeverSold",
    "RecentlyPublished",
    "MissingSEO",
    "MissingMetaDescription",
    "NoDescription",
    "MissingAltText",
    "LowMediaCoverage",
    "LowVariantCoverage",
    "InactiveProduct",
    "DraftTooLong",
    "BundleCandidateSeed",
    "SeasonalCandidate",
    "Discontinued",
    "SingleProductCollection",
    "OrphanCollection",
  ],
  inventory_intelligence: [
    "InventoryLow",
    "InventoryCritical",
    "HighInventory",
    "OutOfStock",
  ],
  pricing_intelligence: [
    "PriceChanged",
    "MarginRiskCandidate",
    "PriceAboveCategoryAverage",
  ],
  operations_intelligence: [
    "RefundRiskSeed",
    "OrderImported",
  ],
  executive_coo: KNOWLEDGE_FACT_TYPES,
};

export type ReadinessComputationInput = {
  storeId: string;
  productCount: number;
  orderCount: number;
  evidenceCounts: Record<string, number>;
};

export async function computeKnowledgeReadiness(
  input: ReadinessComputationInput,
): Promise<{
  productIntelligencePercent: number;
  inventoryIntelligencePercent: number;
  pricingIntelligencePercent: number;
  operationsIntelligencePercent: number;
  executiveCooPercent: number;
  overallPercent: number;
}> {
  const productIntelligencePercent = scoreDomain(
    "product_intelligence",
    input,
  );
  const inventoryIntelligencePercent = scoreDomain(
    "inventory_intelligence",
    input,
  );
  const pricingIntelligencePercent = scoreDomain(
    "pricing_intelligence",
    input,
  );
  const operationsIntelligencePercent = scoreDomain(
    "operations_intelligence",
    input,
    input.orderCount > 0,
  );
  const executiveCooPercent = Math.round(
    (productIntelligencePercent +
      inventoryIntelligencePercent +
      pricingIntelligencePercent +
      operationsIntelligencePercent) /
      4,
  );
  const overallPercent = Math.round(
    productIntelligencePercent * 0.25 +
      inventoryIntelligencePercent * 0.25 +
      pricingIntelligencePercent * 0.2 +
      operationsIntelligencePercent * 0.2 +
      executiveCooPercent * 0.1,
  );

  return {
    productIntelligencePercent,
    inventoryIntelligencePercent,
    pricingIntelligencePercent,
    operationsIntelligencePercent,
    executiveCooPercent,
    overallPercent,
  };
}

export async function persistKnowledgeReadiness(storeId: string): Promise<void> {
  const [productCount, orderCount, evidenceGroups] = await Promise.all([
    prisma.product.count({ where: { storeId } }),
    prisma.order.count({ where: orderWhereForMetrics(storeId, { isTest: false }) }),
    prisma.evidence.groupBy({
      by: ["factType"],
      where: { storeId, active: true },
      _count: { factType: true },
    }),
  ]);

  const evidenceCounts = Object.fromEntries(
    evidenceGroups.map((group) => [group.factType, group._count.factType]),
  );

  const readiness = await computeKnowledgeReadiness({
    storeId,
    productCount,
    orderCount,
    evidenceCounts,
  });

  await prisma.knowledgeReadiness.upsert({
    where: { storeId },
    create: { storeId, ...readiness, lastComputedAt: new Date() },
    update: { ...readiness, lastComputedAt: new Date() },
  });
}

export async function getKnowledgeReadiness(storeId: string) {
  return prisma.knowledgeReadiness.findUnique({ where: { storeId } });
}

export async function getIntelligenceDomainReadiness(storeId: string) {
  const readiness = await getKnowledgeReadiness(storeId);
  if (!readiness) {
    return [
      domainRow("product_intelligence", "Product Intelligence", 0),
      domainRow("inventory_intelligence", "Inventory Intelligence", 0),
      domainRow("pricing_intelligence", "Pricing Intelligence", 0),
      domainRow("operations_intelligence", "Operations Intelligence", 0),
      domainRow("executive_coo", "Executive COO", 0),
    ];
  }
  return [
    domainRow(
      "product_intelligence",
      "Product Intelligence",
      readiness.productIntelligencePercent,
    ),
    domainRow(
      "inventory_intelligence",
      "Inventory Intelligence",
      readiness.inventoryIntelligencePercent,
    ),
    domainRow(
      "pricing_intelligence",
      "Pricing Intelligence",
      readiness.pricingIntelligencePercent,
    ),
    domainRow(
      "operations_intelligence",
      "Operations Intelligence",
      readiness.operationsIntelligencePercent,
    ),
    domainRow("executive_coo", "Executive COO", readiness.executiveCooPercent),
  ];
}

function scoreDomain(
  domain: KnowledgeIntelligenceDomain,
  input: ReadinessComputationInput,
  prerequisite = true,
): number {
  if (!prerequisite || input.productCount === 0) {
    return input.productCount > 0 ? 5 : 0;
  }
  const facts = DOMAIN_FACT_MAP[domain];
  const observed = facts.filter((factType) => (input.evidenceCounts[factType] ?? 0) > 0).length;
  const coverage = facts.length > 0 ? observed / facts.length : 0;
  const catalogCoverage = Math.min(1, input.productCount / Math.max(input.productCount, 50));
  return Math.max(
    0,
    Math.min(100, Math.round(coverage * 60 + catalogCoverage * 40)),
  );
}

function domainRow(
  domain: KnowledgeIntelligenceDomain,
  label: string,
  percent: number,
) {
  return { domain, label, percent };
}
