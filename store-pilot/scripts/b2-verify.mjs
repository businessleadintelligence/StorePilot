import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [storesCount, sessionCount, usersCount] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM stores`,
    prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM "Session"`,
    prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM users`,
  ]);

  const userRoleEnum = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'UserRole'
    ) AS exists
  `;

  const usersTable = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `;

  const storeColumns = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stores'
    ORDER BY ordinal_position
  `;

  const sessionColumns = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Session'
    ORDER BY ordinal_position
  `;

  const storeQuery = await prisma.store.findMany({ take: 1, select: { id: true, shopifyDomain: true } });
  const userQuery = await prisma.user.findMany({ take: 1, select: { id: true, email: true } });

  console.log(
    JSON.stringify(
      {
        counts: {
          stores: Number(storesCount[0].count),
          session: Number(sessionCount[0].count),
          users: Number(usersCount[0].count),
        },
        userRoleEnumExists: Boolean(userRoleEnum[0].exists),
        usersTableExists: Boolean(usersTable[0].exists),
        storeColumnCount: storeColumns.length,
        sessionColumnCount: sessionColumns.length,
        prismaStoreQueryOk: Array.isArray(storeQuery),
        prismaUserQueryOk: Array.isArray(userQuery),
        sampleStore: storeQuery[0] ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
