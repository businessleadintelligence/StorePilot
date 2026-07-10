import { PrismaClient } from "@prisma/client";

import { getPrismaClient } from "../packages/database/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = getPrismaClient() as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;

export {
  auditDatabaseUrl,
  disconnectPrismaClient,
  getDatabaseMetricsSnapshot,
  getDatabasePoolRecommendations,
  runInParallelBatches,
  withPrismaRetry,
  withPrismaTransaction,
} from "../packages/database";
