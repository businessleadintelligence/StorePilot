import prisma from "../app/db.server";
import {
  handleProductCreateWebhook,
  handleProductDeleteWebhook,
  handleProductUpdateWebhook,
} from "../app/services/product.server";

const SHOP = "storepilot-pe9x0muw.myshopify.com";
const STORE_ID = "d5e9f90a-5485-483e-96a9-cc2b0f39d8ee";
const TEST_PRODUCT_GID = "gid://shopify/Product/9999999001";
const TEST_VARIANT_GID = "gid://shopify/ProductVariant/9999999001";

const logs: Record<string, unknown>[] = [];

function captureLogs() {
  for (const fn of ["info", "warn", "error"] as const) {
    const original = console[fn].bind(console);
    console[fn] = (...args: unknown[]) => {
      if (args[0] === "[product-webhook]" && args[1] && typeof args[1] === "object") {
        logs.push({ level: fn, ...(args[1] as Record<string, unknown>) });
      }
      original(...args);
    };
  }
}

async function audit(label: string) {
  const [rowCount, distinctVariants, foreignRows, rows] = await Promise.all([
    prisma.product.count({ where: { storeId: STORE_ID } }),
    prisma.product.count({
      where: { storeId: STORE_ID, shopifyVariantId: TEST_VARIANT_GID },
    }),
    prisma.product.count({ where: { NOT: { storeId: STORE_ID } } }),
    prisma.product.findMany({
      where: { storeId: STORE_ID, shopifyProductId: TEST_PRODUCT_GID },
      select: {
        shopifyProductId: true,
        shopifyVariantId: true,
        title: true,
        status: true,
        price: true,
        updatedAt: true,
      },
    }),
  ]);

  return { label, rowCount, distinctVariants, foreignRows, testRows: rows };
}

async function main() {
  captureLogs();
  const baseline = await audit("baseline");

  const createPayload = {
    admin_graphql_api_id: TEST_PRODUCT_GID,
    title: "D43 Webhook Test Product",
    status: "active",
    variants: [
      {
        admin_graphql_api_id: TEST_VARIANT_GID,
        sku: "D43-TEST-001",
        price: "19.99",
        inventory_quantity: 5,
        inventory_management: "shopify",
      },
    ],
  };

  const createResult = await handleProductCreateWebhook({
    shop: SHOP,
    topic: "products/create",
    webhookId: "d43-verify-create-1",
    payload: createPayload,
  });
  const afterCreate = await audit("after_create");
  const createdRow = afterCreate.testRows[0];
  const createdUpdatedAt = createdRow?.updatedAt;

  const updatePayload = {
    ...createPayload,
    title: "D43 Webhook Test Product Updated",
    variants: [
      {
        ...createPayload.variants[0],
        price: "29.99",
      },
    ],
  };

  const updateResult = await handleProductUpdateWebhook({
    shop: SHOP,
    topic: "products/update",
    webhookId: "d43-verify-update-1",
    payload: updatePayload,
  });
  const afterUpdate = await audit("after_update");
  const updatedRow = afterUpdate.testRows[0];

  const deleteResult = await handleProductDeleteWebhook({
    shop: SHOP,
    topic: "products/delete",
    webhookId: "d43-verify-delete-1",
    payload: { admin_graphql_api_id: TEST_PRODUCT_GID },
  });
  const afterDelete = await audit("after_delete");

  console.log(
    JSON.stringify(
      {
        baseline,
        createResult,
        afterCreate,
        updateResult,
        afterUpdate,
        updatedAtChanged:
          !!createdUpdatedAt &&
          !!updatedRow?.updatedAt &&
          updatedRow.updatedAt.getTime() > createdUpdatedAt.getTime(),
        titleUpdated: updatedRow?.title === "D43 Webhook Test Product Updated",
        priceUpdated: updatedRow?.price?.toString() === "29.99",
        deleteResult,
        afterDelete,
        rowCountDelta: afterCreate.rowCount - baseline.rowCount,
        deleteSoftArchive:
          afterDelete.testRows.length === 1 &&
          afterDelete.testRows[0]?.status === "archived",
        rowNotHardDeleted: afterDelete.rowCount === afterCreate.rowCount,
        tenantForeignRows: afterDelete.foreignRows,
        logs: logs.filter((log) =>
          [
            "webhook_received",
            "webhook_upsert",
            "webhook_reconcile",
            "webhook_archive",
            "webhook_completed",
            "webhook_summary",
            "webhook_failed",
            "webhook_skipped",
          ].includes(String(log.operation)),
        ),
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
