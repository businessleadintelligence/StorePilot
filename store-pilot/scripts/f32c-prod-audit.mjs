import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const replacer = (_key, value) => {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
};

try {
  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
    FROM _prisma_migrations
    ORDER BY finished_at
  `;
  console.log("=== APPLIED MIGRATIONS ===");
  console.log(JSON.stringify(migrations, replacer, 2));

  const counts = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM stores) AS stores,
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM "Session") AS session,
      (SELECT COUNT(*)::int FROM products) AS products,
      (SELECT COUNT(*)::int FROM orders) AS orders,
      (SELECT COUNT(*)::int FROM order_line_items) AS order_line_items,
      (SELECT COUNT(*)::int FROM webhook_events) AS webhook_events
  `;
  console.log("=== ROW COUNTS ===");
  console.log(JSON.stringify(counts[0], replacer, 2));

  const asyncTables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('sync_jobs', 'store_onboarding', 'job_events')
    ORDER BY table_name
  `;
  console.log("=== ASYNC TABLES PRESENT ===");
  console.log(JSON.stringify(asyncTables, replacer, 2));

  const storeCols = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stores'
    ORDER BY ordinal_position
  `;
  const colNames = storeCols.map((c) => c.column_name);
  console.log("=== STORES RELATION BACKING ===");
  console.log(
    JSON.stringify(
      {
        columnCount: colNames.length,
        hasSyncJobCols: colNames.some(
          (c) => c.includes("sync") && c.includes("job"),
        ),
        hasJobEventCols: colNames.some(
          (c) => c.includes("job") && c.includes("event"),
        ),
        hasOnboardingCols: colNames.some((c) => c.includes("onboarding")),
        note: "Prisma relations syncJobs/jobEvents/storeOnboarding are FK-backed on child tables, not columns on stores",
      },
      replacer,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
