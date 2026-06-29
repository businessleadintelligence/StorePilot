import prisma from "../app/db.server";

const SHOP = "storepilot-pe9x0muw.myshopify.com";

async function main() {
  const [stores, users, sessions, products] = await Promise.all([
    prisma.store.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.product.count(),
  ]);

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: SHOP },
    select: {
      id: true,
      shopifyDomain: true,
      active: true,
      lastProductsSyncAt: true,
    },
  });

  const duplicateVariants = store
    ? await prisma.$queryRaw<Array<{ shopifyVariantId: string; cnt: bigint }>>`
        SELECT "shopifyVariantId", COUNT(*)::bigint AS cnt
        FROM products
        WHERE "storeId" = ${store.id}::uuid
        GROUP BY "shopifyVariantId"
        HAVING COUNT(*) > 1
      `
    : [];

  const activeStoreProducts = store
    ? await prisma.product.count({ where: { storeId: store.id } })
    : null;

  const statusBreakdown = store
    ? await prisma.product.groupBy({
        by: ["status"],
        where: { storeId: store.id },
        _count: { _all: true },
      })
    : [];

  console.log(
    JSON.stringify(
      {
        counts: { stores, users, Session: sessions, products },
        activeStore: store,
        activeStoreProductCount: activeStoreProducts,
        productStatusBreakdown: statusBreakdown,
        duplicateVariantRows: duplicateVariants.map((row) => ({
          shopifyVariantId: row.shopifyVariantId,
          cnt: Number(row.cnt),
        })),
        duplicateVariantCount: duplicateVariants.length,
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
