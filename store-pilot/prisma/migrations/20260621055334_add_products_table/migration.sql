-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'archived', 'draft');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "shopifyProductId" VARCHAR(100) NOT NULL,
    "shopifyVariantId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "sku" VARCHAR(255),
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "price" DECIMAL(12,2),
    "inventoryQuantity" INTEGER,
    "inventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_store_id_idx" ON "products"("storeId");

-- CreateIndex
CREATE INDEX "products_store_product_idx" ON "products"("storeId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("storeId", "status");

-- CreateIndex
CREATE INDEX "products_inventory_tracked_idx" ON "products"("storeId", "inventoryTracked");

-- CreateIndex
CREATE UNIQUE INDEX "products_store_variant_unique" ON "products"("storeId", "shopifyVariantId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
