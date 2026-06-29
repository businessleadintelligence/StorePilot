import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const n = (v) => Number(v);

const counts = await prisma.$queryRaw`
  SELECT
    (SELECT COUNT(*)::bigint FROM "Session") AS session,
    (SELECT COUNT(*)::bigint FROM stores) AS stores,
    (SELECT COUNT(*)::bigint FROM users) AS users
`;

const owners = await prisma.$queryRaw`
  SELECT id, email, role, "lastLoginAt", "createdAt"
  FROM users
  WHERE role = 'owner'
  ORDER BY "createdAt"
`;

const dupOwners = await prisma.$queryRaw`
  SELECT "storeId", COUNT(*)::bigint AS cnt
  FROM users
  WHERE role = 'owner'
  GROUP BY "storeId"
  HAVING COUNT(*) > 1
`;

const store = await prisma.store.findFirst({
  select: { shopifyDomain: true, updatedAt: true, storeName: true },
});

console.log(
  JSON.stringify(
    {
      counts: {
        session: n(counts[0].session),
        stores: n(counts[0].stores),
        users: n(counts[0].users),
      },
      store,
      owners,
      duplicateOwners: dupOwners,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
