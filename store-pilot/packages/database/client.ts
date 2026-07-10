import { PrismaClient, type Prisma } from "@prisma/client";

import {
  markDatabaseConnectionAcquired,
  markDatabaseConnectionReleased,
  recordConnectionWait,
  recordDatabaseQuery,
} from "./metrics";
import { auditDatabaseUrl } from "./pool-config";

const GLOBAL_CLIENT_KEY = "__storePilotPrismaClient__";

type GlobalPrismaState = {
  client?: ReturnType<typeof createInstrumentedPrismaClient>;
  disconnectHookRegistered?: boolean;
};

function getGlobalState(): GlobalPrismaState {
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_CLIENT_KEY]?: GlobalPrismaState;
  };

  if (!globalScope[GLOBAL_CLIENT_KEY]) {
    globalScope[GLOBAL_CLIENT_KEY] = {};
  }

  return globalScope[GLOBAL_CLIENT_KEY]!;
}

function buildPrismaClientOptions(): ConstructorParameters<typeof PrismaClient>[0] {
  const logLevels: Array<"error" | "warn"> = ["error", "warn"];

  if (process.env.PRISMA_LOG_QUERIES === "1") {
    return {
      log: [...logLevels, { emit: "event", level: "query" }],
    };
  }

  return { log: logLevels };
}

function logPoolWarnings(): void {
  const audit = auditDatabaseUrl();
  for (const warning of audit.warnings) {
    console.warn("[db-pool-config]", warning);
  }
}

export function createInstrumentedPrismaClient() {
  logPoolWarnings();

  const baseClient = new PrismaClient(buildPrismaClientOptions());

  if (process.env.PRISMA_LOG_QUERIES === "1") {
    (baseClient as PrismaClient & {
      $on(event: "query", callback: (event: Prisma.QueryEvent) => void): void;
    }).$on("query", (event) => {
      console.info("[db-query]", {
        query: event.query,
        durationMs: event.duration,
      });
    });
  }

  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const waitStartedAt = performance.now();
          markDatabaseConnectionAcquired();
          recordConnectionWait(performance.now() - waitStartedAt);

          const startedAt = performance.now();
          try {
            return await query(args);
          } finally {
            recordDatabaseQuery({
              model,
              operation,
              durationMs: performance.now() - startedAt,
            });
            markDatabaseConnectionReleased();
          }
        },
      },
    },
  });

  return client;
}

export function getPrismaClient() {
  const state = getGlobalState();

  if (!state.client) {
    state.client = createInstrumentedPrismaClient();
    registerGracefulDisconnect(state);
  }

  return state.client;
}

function registerGracefulDisconnect(state: GlobalPrismaState): void {
  if (state.disconnectHookRegistered) {
    return;
  }

  state.disconnectHookRegistered = true;

  const disconnect = async () => {
    if (!state.client) {
      return;
    }

    await state.client.$disconnect();
    state.client = undefined;
  };

  process.once("beforeExit", disconnect);
  process.once("SIGINT", async () => {
    await disconnect();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    await disconnect();
    process.exit(0);
  });
}

export async function disconnectPrismaClient(): Promise<void> {
  const state = getGlobalState();
  if (!state.client) {
    return;
  }

  await state.client.$disconnect();
  state.client = undefined;
}
