import type { FactBuilder } from "./types";

export type InventoryFacts = Record<string, never>;

export const buildInventoryFacts: FactBuilder<InventoryFacts> = {
  agentId: "inventory_intelligence",
  async build() {
    throw new Error("inventory_facts_not_implemented");
  },
  fingerprint() {
    return "";
  },
};

export type OrdersFacts = Record<string, never>;

export const buildOrdersFacts: FactBuilder<OrdersFacts> = {
  agentId: "offer_intelligence",
  async build() {
    throw new Error("orders_facts_not_implemented");
  },
  fingerprint() {
    return "";
  },
};

export type StoreFacts = Record<string, never>;

export const buildStoreFacts: FactBuilder<StoreFacts> = {
  agentId: "store_audit",
  async build() {
    throw new Error("store_facts_not_implemented");
  },
  fingerprint() {
    return "";
  },
};

export type SeoFacts = Record<string, never>;

export const buildSeoFacts: FactBuilder<SeoFacts> = {
  agentId: "seo_audit",
  async build() {
    throw new Error("seo_facts_not_implemented");
  },
  fingerprint() {
    return "";
  },
};

export type TrendFacts = Record<string, never>;

export const buildTrendFacts: FactBuilder<TrendFacts> = {
  agentId: "trend_intelligence",
  async build() {
    throw new Error("trend_facts_not_implemented");
  },
  fingerprint() {
    return "";
  },
};
