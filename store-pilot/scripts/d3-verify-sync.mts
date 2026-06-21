import prisma from "../app/db.server";
import { syncProductsFromShopify } from "../app/services/product.server";
import { unauthenticated } from "../app/shopify.server";

const SHOP = "storepilot-pe9x0muw.myshopify.com";
const STORE_ID = "d5e9f90a-5485-483e-96a9-cc2b0f39d8ee";

const productSyncLogs: Record<string, unknown>[] = [];

function captureProductSyncLogs() {
  const originalInfo = console.info.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  const capture = (level: string, args: unknown[]) => {
    const prefix = args[0];
    if (prefix === "[product-sync]" && args[1] && typeof args[1] === "object") {
      productSyncLogs.push({ level, ...(args[1] as Record<string, unknown>) });
    }
  };

  console.info = (...args: unknown[]) => {
    capture("info", args);
    originalInfo(...args);
  };
  console.error = (...args: unknown[]) => {
    capture("error", args);
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    capture("warn", args);
    originalWarn(...args);
  };
}

async function baseline() {
  const [stores, users, sessions, products] = await Promise.all([
    prisma.store.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.product.count(),
  ]);

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: SHOP },
    select: { id: true, lastProductsSyncAt: true },
  });

  return { stores, users, sessions, products, lastProductsSyncAt: store?.lastProductsSyncAt ?? null };
}

async function productAudit() {
  const [rowCount, distinctVariants, foreignRows, sample] = await Promise.all([
    prisma.product.count({ where: { storeId: STORE_ID } }),
    prisma.product.groupBy({
      by: ["shopifyVariantId"],
      where: { storeId: STORE_ID },
      _count: { shopifyVariantId: true },
    }),
    prisma.product.count({ where: { NOT: { storeId: STORE_ID } } }),
    prisma.product.findMany({
      where: { storeId: STORE_ID },
      select: {
        shopifyProductId: true,
        shopifyVariantId: true,
        title: true,
        sku: true,
        status: true,
        price: true,
        inventoryQuantity: true,
        inventoryTracked: true,
      },
      take: 5,
      orderBy: { shopifyVariantId: "asc" },
    }),
  ]);

  return {
    rowCount,
    distinctVariantCount: distinctVariants.length,
    foreignRows,
    sample,
  };
}

async function runSync(label: string) {
  const startedAt = Date.now();
  const { admin } = await unauthenticated.admin(SHOP);
  const result = await syncProductsFromShopify({
    storeId: STORE_ID,
    shop: SHOP,
    admin,
  });

  const logsForRun = productSyncLogs.filter((log) =>
    ["sync_started", "product_page", "sync_completed", "sync_summary", "sync_failed"].includes(
      String(log.operation),
    ),
  );

  return {
    label,
    durationMs: Date.now() - startedAt,
    result,
    logs: logsForRun,
  };
}

async function main() {
  const mode = process.argv[2] ?? "all";

  if (mode === "baseline") {
    console.log(JSON.stringify({ baseline: await baseline() }, null, 2));
    await prisma.$disconnect();
    return;
  }

  if (mode === "audit") {
    const store = await prisma.store.findUnique({
      where: { shopifyDomain: SHOP },
      select: { lastProductsSyncAt: true },
    });
    console.log(
      JSON.stringify(
        {
          audit: await productAudit(),
          lastProductsSyncAt: store?.lastProductsSyncAt ?? null,
        },
        null,
        2,
      ),
    );
    await prisma.$disconnect();
    return;
  }

  captureProductSyncLogs();

  const baselineResult = await baseline();
  const sync1 = await runSync("sync-1");
  const audit1 = await productAudit();
  const storeAfter1 = await prisma.store.findUnique({
    where: { shopifyDomain: SHOP },
    select: { lastProductsSyncAt: true },
  });

  const sync2 = await runSync("sync-2");
  const audit2 = await productAudit();
  const storeAfter2 = await prisma.store.findUnique({
    where: { shopifyDomain: SHOP },
    select: { lastProductsSyncAt: true },
  });

  console.log(
    JSON.stringify(
      {
        baseline: baselineResult,
        sync1,
        audit1,
        lastProductsSyncAtAfterSync1: storeAfter1?.lastProductsSyncAt ?? null,
        sync2,
        audit2,
        lastProductsSyncAtAfterSync2: storeAfter2?.lastProductsSyncAt ?? null,
        idempotentRowCount: audit1.rowCount === audit2.rowCount,
        idempotentDistinctVariants:
          audit1.distinctVariantCount === audit2.distinctVariantCount,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
