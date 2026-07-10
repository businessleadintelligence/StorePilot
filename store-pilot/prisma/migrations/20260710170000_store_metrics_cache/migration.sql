-- P1: Materialized store metrics for fast dashboard reads (single findUnique vs 7 counts)

CREATE TABLE IF NOT EXISTS store_metrics_cache (
  "storeId" UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE ON UPDATE CASCADE,
  products INTEGER NOT NULL DEFAULT 0,
  "activeProducts" INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  "grossRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "averageOrderValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "lowStockProducts" INTEGER NOT NULL DEFAULT 0,
  "outOfStockProducts" INTEGER NOT NULL DEFAULT 0,
  "inventoryUnits" INTEGER NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_metrics_cache_computed_at_idx
  ON store_metrics_cache ("computedAt");
