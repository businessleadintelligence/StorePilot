import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "./client";
import { recordDatabaseRetry, recordDatabaseTransaction } from "./metrics";
import { withPrismaRetry } from "./retry";

export async function withPrismaTransaction<T>(
  label: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const client = getPrismaClient();
  const startedAt = performance.now();

  try {
    return await withPrismaRetry(
      () =>
        client.$transaction(
          async (tx) => operation(tx as Prisma.TransactionClient),
          {
            maxWait: 10_000,
            timeout: 30_000,
          },
        ),
      {
        label: `transaction:${label}`,
        onRetry: () => {
          recordDatabaseRetry();
        },
      },
    );
  } finally {
    recordDatabaseTransaction({
      label,
      durationMs: performance.now() - startedAt,
    });
  }
}
