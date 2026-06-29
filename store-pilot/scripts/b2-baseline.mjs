import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [storesCount, sessionCount] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM stores`,
    prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM "Session"`,
  ]);

  console.log(
    JSON.stringify({
      stores: Number(storesCount[0].count),
      session: Number(sessionCount[0].count),
    }),
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
