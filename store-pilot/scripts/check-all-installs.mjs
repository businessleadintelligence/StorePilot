import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [storeCount, sessionCount, jobCount, webhookCount] = await Promise.all([
  prisma.store.count(),
  prisma.session.count(),
  prisma.syncJob.count(),
  prisma.webhookEvent.count(),
]);

const stores = await prisma.store.findMany({
  orderBy: { createdAt: "desc" },
  take: 5,
  select: { shopifyDomain: true, active: true, createdAt: true, storeName: true },
});

const sessionShops = await prisma.session.groupBy({
  by: ["shop"],
  _count: { shop: true },
});

console.log(
  JSON.stringify(
    {
      counts: { storeCount, sessionCount, jobCount, webhookCount },
      stores,
      sessionShops,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
