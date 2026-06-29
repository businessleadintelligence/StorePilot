import { upsertStoreFromSession } from "./app/services/store.server.ts";

const session = {
  shop: "sim-test.myshopify.com",
  accessToken: "sim-token",
};

async function run(label, fn) {
  try {
    await fn();
    console.log(`PASS: ${label} - no throw`);
  } catch (error) {
    console.error(`FAIL: ${label}`, error);
    process.exitCode = 1;
  }
}

await run("GraphQL failure (mock errors)", () =>
  upsertStoreFromSession(session, {
    graphql: async () => ({
      json: async () => ({ errors: [{ message: "simulated_graphql_error" }] }),
    }),
  }),
);

process.env.STORE_SYNC_SIMULATE_PRISMA_FAILURE = "1";
await run("Prisma failure (simulated env)", () =>
  upsertStoreFromSession(session, {
    graphql: async () => ({
      json: async () => ({
        data: {
          shop: {
            id: "gid://shopify/Shop/999",
            name: "Sim Test Store",
            currencyCode: "USD",
            ianaTimezone: "UTC",
            myshopifyDomain: "sim-test.myshopify.com",
          },
        },
      }),
    }),
  }),
);
delete process.env.STORE_SYNC_SIMULATE_PRISMA_FAILURE;

process.env.STORE_SYNC_SIMULATE_GRAPHQL_FAILURE = "1";
await run("GraphQL failure (simulated env)", () =>
  upsertStoreFromSession(session, {
    graphql: async () => {
      throw new Error("should not be called");
    },
  }).finally(() => {
    delete process.env.STORE_SYNC_SIMULATE_GRAPHQL_FAILURE;
  }),
);
