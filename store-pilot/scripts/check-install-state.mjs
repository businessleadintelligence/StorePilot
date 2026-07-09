import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shop = "storepilot-pe9x0muw.myshopify.com";

const store = await prisma.store.findFirst({
  where: { shopifyDomain: shop },
  include: {
    users: true,
    subscription: true,
    storeOnboarding: true,
  },
});

const sessions = await prisma.session.findMany({
  where: { shop },
  take: 5,
  orderBy: { expires: "desc" },
});

const jobs = await prisma.syncJob.findMany({
  where: { store: { shopifyDomain: shop } },
  take: 15,
  orderBy: { createdAt: "desc" },
});

const webhooks = await prisma.webhookEvent.findMany({
  where: { store: { shopifyDomain: shop } },
  take: 15,
  orderBy: { createdAt: "desc" },
});

const productCount = store
  ? await prisma.product.count({ where: { storeId: store.id } })
  : 0;
const orderCount = store
  ? await prisma.order.count({ where: { storeId: store.id } })
  : 0;
const inventoryCount = store
  ? await prisma.inventoryItem.count({ where: { storeId: store.id } })
  : 0;

console.log(
  JSON.stringify(
    {
      store: store
        ? {
            id: store.id,
            shopifyDomain: store.shopifyDomain,
            active: store.active,
            subscriptionPlan: store.subscriptionPlan,
            subscriptionStatus: store.subscriptionStatus,
            currency: store.currency,
            timezone: store.timezone,
            userCount: store.users.length,
            users: store.users.map((u) => ({
              id: u.id,
              role: u.role,
              email: u.email,
            })),
            onboarding: store.storeOnboarding
              ? {
                  status: store.storeOnboarding.status,
                  progressPercent: store.storeOnboarding.progressPercent,
                  productSyncStatus: store.storeOnboarding.productSyncStatus,
                  inventorySyncStatus: store.storeOnboarding.inventorySyncStatus,
                  ordersSyncStatus: store.storeOnboarding.ordersSyncStatus,
                  completedAt: store.storeOnboarding.completedAt,
                }
              : null,
            subscriptions: store.subscription
              ? [
                  {
                    id: store.subscription.id,
                    status: store.subscription.status,
                    planId: store.subscription.planId,
                  },
                ]
              : [],
          }
        : null,
      sessions: sessions.map((s) => ({
        id: s.id,
        isOnline: s.isOnline,
        scope: s.scope,
        expires: s.expires,
        hasAccessToken: Boolean(s.accessToken),
      })),
      counts: { products: productCount, orders: orderCount, inventory: inventoryCount },
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      })),
      webhookEvents: webhooks.map((w) => ({
        id: w.id,
        topic: w.topic,
        status: w.status,
        createdAt: w.createdAt,
      })),
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
