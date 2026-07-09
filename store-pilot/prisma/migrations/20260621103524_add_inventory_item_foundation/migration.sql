-- AlterTable
ALTER TABLE "products" ADD COLUMN     "shopifyInventoryItemId" VARCHAR(100);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "shopifyWebhookId" VARCHAR(255) NOT NULL,
    "shop" VARCHAR(255) NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "processedSuccessfully" BOOLEAN NOT NULL DEFAULT true,
    "processedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_shopify_webhook_id_unique" ON "webhook_events"("shopifyWebhookId");

-- CreateIndex
CREATE INDEX "webhook_events_store_id_idx" ON "webhook_events"("storeId");

-- CreateIndex
CREATE INDEX "products_inventory_item_idx" ON "products"("storeId", "shopifyInventoryItemId");

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F.6.14 (moved from 20260620120000_f614_high_elimination): webhook single-flight processing
ALTER TABLE "webhook_events" ADD COLUMN "processingOwner" VARCHAR(100);
ALTER TABLE "webhook_events" ADD COLUMN "processingExpiresAt" TIMESTAMPTZ;
ALTER TABLE "webhook_events" ALTER COLUMN "processedAt" DROP NOT NULL;
ALTER TABLE "webhook_events" ALTER COLUMN "processedAt" DROP DEFAULT;
