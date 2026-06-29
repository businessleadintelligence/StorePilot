-- F.6.16 critical elimination: stale uninstall protection + GDPR export persistence

ALTER TABLE "stores"
ADD COLUMN "lastAuthenticatedAt" TIMESTAMPTZ;

CREATE TABLE "customer_data_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "shopifyCustomerId" VARCHAR(100) NOT NULL,
    "dataRequestId" VARCHAR(100),
    "shopifyWebhookId" VARCHAR(255) NOT NULL,
    "exportPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_data_exports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_data_exports_store_webhook_unique"
ON "customer_data_exports"("storeId", "shopifyWebhookId");

CREATE INDEX "customer_data_exports_store_customer_idx"
ON "customer_data_exports"("storeId", "shopifyCustomerId");

ALTER TABLE "customer_data_exports"
ADD CONSTRAINT "customer_data_exports_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
