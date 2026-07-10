CREATE TABLE "ai_cost_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "merchantId" UUID,
    "agentId" VARCHAR(100),
    "feature" VARCHAR(100) NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "modelId" VARCHAR(100) NOT NULL,
    "modelTier" VARCHAR(50) NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_cost_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_merchant_budgets" (
    "storeId" UUID NOT NULL,
    "monthlyBudgetUsd" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "softLimitPercent" INTEGER NOT NULL DEFAULT 80,
    "hardLimitPercent" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_merchant_budgets_pkey" PRIMARY KEY ("storeId")
);

CREATE INDEX "ai_cost_ledger_store_created_idx" ON "ai_cost_ledger"("storeId", "createdAt");
CREATE INDEX "ai_cost_ledger_store_feature_created_idx" ON "ai_cost_ledger"("storeId", "feature", "createdAt");

ALTER TABLE "ai_cost_ledger" ADD CONSTRAINT "ai_cost_ledger_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_merchant_budgets" ADD CONSTRAINT "ai_merchant_budgets_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
