import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const n = (v) => Number(v);

const store = await prisma.store.findFirst({
  select: {
    id: true,
    shopifyDomain: true,
    active: true,
    accessToken: true,
    ga4RefreshToken: true,
    updatedAt: true,
  },
});

const counts = await prisma.$queryRaw`
  SELECT
    (SELECT COUNT(*)::bigint FROM stores) AS stores,
    (SELECT COUNT(*)::bigint FROM "Session") AS session,
    (SELECT COUNT(*)::bigint FROM users) AS users
`;

const owners = await prisma.user.findMany({
  where: { role: "owner" },
  select: { id: true, email: true, storeId: true, lastLoginAt: true },
});

console.log(
  JSON.stringify(
    {
      counts: {
        stores: n(counts[0].stores),
        session: n(counts[0].session),
        users: n(counts[0].users),
      },
      store: store
        ? {
            id: store.id,
            shopifyDomain: store.shopifyDomain,
            active: store.active,
            accessTokenLength: store.accessToken.length,
            ga4RefreshToken: store.ga4RefreshToken,
            updatedAt: store.updatedAt,
          }
        : null,
      owners,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
