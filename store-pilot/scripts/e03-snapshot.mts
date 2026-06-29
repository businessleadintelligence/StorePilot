import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [stores, users, sessions, products, webhookEvents] = await Promise.all([
    prisma.store.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.product.count(),
    prisma.webhookEvent.count(),
  ]);

  const dupVariants = await prisma.$queryRaw<
    Array<{ shopifyVariantId: string; cnt: number }>
  >`
    SELECT "shopifyVariantId", COUNT(*)::int AS cnt
    FROM products
    GROUP BY "shopifyVariantId"
    HAVING COUNT(*) > 1
  `;

  const dupInventory = await prisma.$queryRaw<
    Array<{ shopifyInventoryItemId: string; cnt: number }>
  >`
    SELECT "shopifyInventoryItemId", COUNT(*)::int AS cnt
    FROM products
    WHERE "shopifyInventoryItemId" IS NOT NULL
    GROUP BY "shopifyInventoryItemId"
    HAVING COUNT(*) > 1
  `;

  const archived = await prisma.product.count({ where: { status: "archived" } });
  const active = await prisma.product.count({ where: { status: "active" } });

  const storeRows = await prisma.store.findMany({
    select: {
      shopifyDomain: true,
      active: true,
      lastProductsSyncAt: true,
      lastInventorySyncAt: true,
      historicalImportDone: true,
      lastOrdersSyncAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        counts: { stores, users, sessions, products, webhookEvents },
        product_integrity: {
          duplicate_shopifyVariantId_groups: dupVariants.length,
          duplicate_shopifyVariantId_details: dupVariants,
          duplicate_shopifyInventoryItemId_groups: dupInventory.length,
          duplicate_shopifyInventoryItemId_details: dupInventory,
          archived_products: archived,
          active_products: active,
        },
        stores: storeRows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
