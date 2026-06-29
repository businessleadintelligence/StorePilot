/**
 * Read-only probe for Real Store Validation Sprint.
 * Outputs JSON — no secrets logged.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = {
    probedAt: new Date().toISOString(),
    database: { connected: false },
    stores: [],
    sessions: [],
    counts: {},
    errors: [],
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database.connected = true;
  } catch (error) {
    result.errors.push(`database: ${error instanceof Error ? error.message : "unknown"}`);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  try {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        shopifyDomain: true,
        active: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        lastProductsSyncAt: true,
        lastOrdersSyncAt: true,
        lastGa4SyncAt: true,
        ga4PropertyId: true,
        ga4ConnectedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true, webhookEvents: true, aiAgentRuns: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    result.stores = stores.map((store) => ({
      id: store.id,
      shopifyDomain: store.shopifyDomain,
      active: store.active,
      subscriptionPlan: store.subscriptionPlan,
      subscriptionStatus: store.subscriptionStatus,
      lastProductsSyncAt: store.lastProductsSyncAt,
      lastOrdersSyncAt: store.lastOrdersSyncAt,
      lastGa4SyncAt: store.lastGa4SyncAt,
      hasGa4: Boolean(store.ga4PropertyId),
      ga4ConnectedAt: store.ga4ConnectedAt,
      productCount: store._count.products,
      webhookCount: store._count.webhookEvents,
      aiRunCount: store._count.aiAgentRuns,
    }));

    const sessions = await prisma.session.findMany({
      orderBy: { expires: "desc" },
      take: 5,
      select: { shop: true, isOnline: true, expires: true, scope: true },
    });

    result.sessions = sessions.map((session) => ({
      shop: session.shop,
      isOnline: session.isOnline,
      expires: session.expires,
      scope: session.scope,
      expired: session.expires ? new Date(session.expires) < new Date() : null,
    }));

    result.counts = {
      stores: stores.length,
      products: await prisma.product.count(),
      webhooks: await prisma.webhookEvent.count(),
    };
  } catch (error) {
    result.errors.push(`probe: ${error instanceof Error ? error.message : "unknown"}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
