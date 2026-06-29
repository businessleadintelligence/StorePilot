-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "historicalOrdersImportDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ordersSyncCursor" TEXT;

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "shopifyOrderId" VARCHAR(100) NOT NULL,
    "orderName" VARCHAR(50) NOT NULL,
    "shopifyCreatedAt" TIMESTAMPTZ NOT NULL,
    "shopifyUpdatedAt" TIMESTAMPTZ NOT NULL,
    "processedAt" TIMESTAMPTZ NOT NULL,
    "cancelledAt" TIMESTAMPTZ,
    "metricDate" DATE NOT NULL,
    "displayFinancialStatus" VARCHAR(50),
    "currencyCode" VARCHAR(10) NOT NULL,
    "subtotalAmount" DECIMAL(14,2) NOT NULL,
    "totalTaxAmount" DECIMAL(14,2) NOT NULL,
    "totalDiscountAmount" DECIMAL(14,2) NOT NULL,
    "totalPriceAmount" DECIMAL(14,2) NOT NULL,
    "totalRefundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "shopifyLineItemId" VARCHAR(100) NOT NULL,
    "shopifyOrderId" VARCHAR(100) NOT NULL,
    "shopifyProductId" VARCHAR(100),
    "shopifyVariantId" VARCHAR(100),
    "sku" VARCHAR(255),
    "title" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "originalUnitPrice" DECIMAL(12,2) NOT NULL,
    "discountedUnitPrice" DECIMAL(12,2) NOT NULL,
    "isGiftCard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_store_id_idx" ON "orders"("storeId");

-- CreateIndex
CREATE INDEX "orders_store_metric_date_idx" ON "orders"("storeId", "metricDate");

-- CreateIndex
CREATE INDEX "orders_store_updated_at_idx" ON "orders"("storeId", "shopifyUpdatedAt");

-- CreateIndex
CREATE INDEX "orders_store_paid_metric_date_idx" ON "orders"("storeId", "isPaid", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "orders_store_order_unique" ON "orders"("storeId", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "order_line_items_store_id_idx" ON "order_line_items"("storeId");

-- CreateIndex
CREATE INDEX "order_line_items_order_id_idx" ON "order_line_items"("orderId");

-- CreateIndex
CREATE INDEX "order_line_items_store_variant_idx" ON "order_line_items"("storeId", "shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_items_store_line_unique" ON "order_line_items"("storeId", "shopifyLineItemId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
