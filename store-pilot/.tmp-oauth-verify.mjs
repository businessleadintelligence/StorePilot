import { PrismaClient } from "@prisma/client";
import { upsertStoreFromSession } from "./app/services/store.server.ts";

const prisma = new PrismaClient();
const dbSession = await prisma.session.findFirst({
  orderBy: { id: "asc" },
});

if (!dbSession) {
  console.error("NO_SESSION: install app in dev store first");
  process.exit(1);
}

const shopifySession = {
  shop: dbSession.shop,
  accessToken: dbSession.accessToken,
};

const admin = {
  graphql: async (query) => {
    const response = await fetch(
      `https://${dbSession.shop}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": dbSession.accessToken,
        },
        body: JSON.stringify({ query }),
      },
    );
    return response;
  },
};

await upsertStoreFromSession(shopifySession, admin);
await upsertStoreFromSession(shopifySession, admin);

const storeCount = await prisma.store.count();
const stores = await prisma.store.findMany({
  select: {
    id: true,
    shopifyDomain: true,
    shopifyId: true,
    storeName: true,
    currency: true,
    timezone: true,
    active: true,
  },
});

console.log("STORE_COUNT_AFTER_UPSERT", storeCount);
console.log("STORES", JSON.stringify(stores, null, 2));
console.log(storeCount === 1 ? "PASS: single store row" : "FAIL: duplicate or missing stores");

await prisma.$disconnect();
