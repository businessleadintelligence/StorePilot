import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sessionCount = await prisma.session.count();
const storeCount = await prisma.store.count();
const sessions = await prisma.session.findMany({
  select: { shop: true, id: true },
});
const stores = await prisma.store.findMany({
  select: {
    shopifyDomain: true,
    storeName: true,
    active: true,
    id: true,
  },
});

console.log("SESSION_COUNT", sessionCount);
for (const session of sessions) {
  console.log("SESSION", session.shop, session.id.slice(0, 12));
}
console.log("STORE_COUNT", storeCount);
for (const store of stores) {
  console.log("STORE", store.shopifyDomain, store.storeName, store.active, store.id);
}

await prisma.$disconnect();
