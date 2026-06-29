import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const replacer = (_key, value) => {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
};

const BASELINE = {
  stores: 1,
  users: 1,
  session: 1,
  products: 27,
  orders: 0,
  order_line_items: 0,
  webhook_events: 1,
};

const EXPECTED_ENUMS = [
  "JobType",
  "JobStatus",
  "JobPriority",
  "OnboardingStatus",
  "OnboardingPhaseStatus",
  "JobEventType",
  "JobEventActor",
];

const EXPECTED_TABLES = ["sync_jobs", "store_onboarding", "job_events"];

try {
  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    WHERE rolled_back_at IS NULL
    ORDER BY finished_at
  `;

  const counts = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM stores) AS stores,
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM "Session") AS session,
      (SELECT COUNT(*)::int FROM products) AS products,
      (SELECT COUNT(*)::int FROM orders) AS orders,
      (SELECT COUNT(*)::int FROM order_line_items) AS order_line_items,
      (SELECT COUNT(*)::int FROM webhook_events) AS webhook_events,
      (SELECT COUNT(*)::int FROM sync_jobs) AS sync_jobs,
      (SELECT COUNT(*)::int FROM store_onboarding) AS store_onboarding,
      (SELECT COUNT(*)::int FROM job_events) AS job_events
  `;

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${EXPECTED_TABLES})
    ORDER BY table_name
  `;

  const enums = await prisma.$queryRaw`
    SELECT t.typname AS enum_name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
      AND t.typname = ANY(${EXPECTED_ENUMS})
    ORDER BY t.typname
  `;

  const store = await prisma.$queryRaw`
    SELECT id, "shopifyDomain", active, "historicalImportDone", "lastProductsSyncAt"
    FROM stores
    LIMIT 5
  `;

  const integrity = {};
  for (const [key, expected] of Object.entries(BASELINE)) {
    integrity[key] = {
      expected,
      actual: counts[0][key],
      match: counts[0][key] === expected,
    };
  }

  const newTablesEmpty =
    counts[0].sync_jobs === 0 &&
    counts[0].store_onboarding === 0 &&
    counts[0].job_events === 0;

  console.log(
    JSON.stringify(
      {
        migrations: {
          appliedCount: migrations.length,
          names: migrations.map((m) => m.migration_name),
        },
        tables: {
          expected: EXPECTED_TABLES,
          found: tables.map((t) => t.table_name),
          allPresent: EXPECTED_TABLES.every((name) =>
            tables.some((t) => t.table_name === name),
          ),
        },
        enums: {
          expected: EXPECTED_ENUMS,
          found: enums.map((e) => e.enum_name),
          allPresent: EXPECTED_ENUMS.every((name) =>
            enums.some((e) => e.enum_name === name),
          ),
        },
        rowCounts: counts[0],
        dataIntegrity: integrity,
        newTablesEmpty,
        store,
      },
      replacer,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
