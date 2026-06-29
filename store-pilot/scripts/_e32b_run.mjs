import { PrismaClient } from "@prisma/client";
import { syncOrdersFromShopify } from "../app/services/orders.server.ts";
import { unauthenticated } from "../app/shopify.server.ts";
import { graphqlWithRetry } from "../app/services/product.server.ts";

const SHOP = "storepilot-dev-1mfgthy7.myshopify.com";
const bigintReplacer = (_k, v) => (typeof v === "bigint" ? Number(v) : v);

const ORDERS_COUNT_QUERY = `#graphql
  query StorePilotCountOrders {
    orders(first: 1) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: SHOP },
    select: {
      id: true,
      shopifyDomain: true,
      active: true,
      historicalOrdersImportDone: true,
      lastOrdersSyncAt: true,
      ordersSyncCursor: true,
    },
  });

  const session = await prisma.session.findFirst({
    where: { shop: SHOP },
    select: { shop: true, scope: true, isOnline: true },
  });

  console.log(
    JSON.stringify(
      { step: "store_lookup", store, session },
      bigintReplacer,
      2,
    ),
  );

  if (!store) {
    console.log(JSON.stringify({ error: "store_not_in_database" }));
    process.exit(1);
  }

  const { admin } = await unauthenticated.admin(SHOP);
  const response = await graphqlWithRetry(
    admin,
    ORDERS_COUNT_QUERY,
    {},
    { shop: SHOP, storeId: store.id },
  );
  const body = await response.json();

  console.log(
    JSON.stringify({ step: "shopify_orders_probe", body }, bigintReplacer, 2),
  );

  const hasOrders = (body.data?.orders?.edges?.length ?? 0) > 0;
  const graphQlErrors = body.errors ?? [];

  if (graphQlErrors.length > 0 || !hasOrders) {
    console.log(
      JSON.stringify({
        step: "stop_no_orders_or_scope",
        hasOrders,
        graphQlErrors,
      }),
    );
    process.exit(2);
  }

  console.log(JSON.stringify({ step: "sync_start" }));

  const result = await syncOrdersFromShopify({
    storeId: store.id,
    shop: SHOP,
    admin,
  });

  console.log(JSON.stringify({ step: "sync_result", result }, bigintReplacer, 2));

  const orderCount = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint AS count FROM orders WHERE "storeId" = ${store.id}::uuid
  `;
  const lineCount = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint AS count FROM order_line_items WHERE "storeId" = ${store.id}::uuid
  `;
  const orders = await prisma.$queryRaw`
    SELECT id, "shopifyOrderId", "orderName", "processedAt", "metricDate", "isPaid"
    FROM orders WHERE "storeId" = ${store.id}::uuid
    ORDER BY "processedAt" DESC
    LIMIT 10
  `;
  const lineItems = await prisma.$queryRaw`
    SELECT oli.id, oli."orderId", oli."shopifyLineItemId", oli.quantity,
           oli."originalUnitPrice", oli."discountedUnitPrice", o."orderName"
    FROM order_line_items oli
    JOIN orders o ON o.id = oli."orderId"
    WHERE oli."storeId" = ${store.id}::uuid
    ORDER BY o."processedAt" DESC
    LIMIT 20
  `;
  const storeAfter = await prisma.store.findUnique({
    where: { id: store.id },
    select: {
      historicalOrdersImportDone: true,
      lastOrdersSyncAt: true,
      ordersSyncCursor: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        step: "db_verification",
        orderCount,
        lineCount,
        orders,
        lineItems,
        storeAfter,
      },
      bigintReplacer,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ step: "fatal", message: String(error) }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
