/**
 * Seed products via Shopify Bulk API using StorePilot install session token.
 * Usage: npx tsx scripts/load-test/seed-via-app-session.ts [shop] [count]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { decryptSecretToken } from "../../app/services/token-crypto.server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const shop = process.argv[2] ?? "devstore-xbmz21nk.myshopify.com";
const count = Number(process.argv[3] ?? 5000);
const API_VERSION = "2025-10";

const prisma = new PrismaClient();

async function shopifyGraphql<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data as T;
}

async function getProductCount(token: string): Promise<number> {
  const data = await shopifyGraphql<{ productsCount: { count: number } }>(
    token,
    `{ productsCount { count } }`,
  );
  return data.productsCount.count;
}

async function runBulkProductImport(token: string, jsonlPath: string): Promise<string> {
  const fileBytes = readFileSync(jsonlPath);
  const filename = jsonlPath.split(/[/\\]/).pop() ?? "products.jsonl";

  const staged = await shopifyGraphql<{
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl: string;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ message: string }>;
    };
  }>(
    token,
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { message }
      }
    }`,
    {
      input: [
        {
          resource: "BULK_MUTATION_VARIABLES",
          filename,
          mimeType: "text/jsonl",
          httpMethod: "POST",
          fileSize: String(fileBytes.byteLength),
        },
      ],
    },
  );

  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    throw new Error(
      staged.stagedUploadsCreate.userErrors.map((e) => e.message).join("; ") ||
        "No staged upload target",
    );
  }

  const form = new FormData();
  for (const param of target.parameters) {
    form.append(param.name, param.value);
  }
  form.append("file", new Blob([fileBytes], { type: "text/jsonl" }), filename);

  const uploadRes = await fetch(target.url, { method: "POST", body: form });
  if (!uploadRes.ok) {
    throw new Error(`Upload failed HTTP ${uploadRes.status}`);
  }

  const mutation = readFileSync(join(__dirname, "productCreate.graphql"), "utf8")
    .replace(/\n/g, " ")
    .trim();

  const bulk = await shopifyGraphql<{
    bulkOperationRunMutation: {
      bulkOperation: { id: string; status: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    token,
    `mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
      bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }`,
    {
      mutation,
      stagedUploadPath: target.resourceUrl,
    },
  );

  const op = bulk.bulkOperationRunMutation.bulkOperation;
  if (!op) {
    throw new Error(
      bulk.bulkOperationRunMutation.userErrors.map((e) => e.message).join("; ") ||
        "bulkOperationRunMutation failed",
    );
  }

  return op.id;
}

async function pollBulk(token: string, bulkId: string, maxWaitMs = 600_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const data = await shopifyGraphql<{
      node: {
        id: string;
        status: string;
        errorCode?: string;
        objectCount?: string;
      } | null;
    }>(
      token,
      `query($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            id status errorCode objectCount
          }
        }
      }`,
      { id: bulkId },
    );

    const node = data.node;
    if (!node) throw new Error("Bulk operation not found");

    console.log(JSON.stringify({ status: node.status, objectCount: node.objectCount }));

    if (node.status === "COMPLETED") return;
    if (node.status === "FAILED" || node.status === "CANCELED") {
      throw new Error(`Bulk failed: ${node.status} ${node.errorCode ?? ""}`);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Bulk operation timed out");
}

async function main() {
  const session = await prisma.session.findFirst({
    where: { shop },
    orderBy: { expires: "desc" },
  });

  if (!session?.accessToken) {
    throw new Error(`No session for ${shop} — install StorePilot first`);
  }

  const token = decryptSecretToken(session.accessToken);
  console.log(JSON.stringify({ step: "start", shop, requestedCount: count }));
  const before = await getProductCount(token);
  console.log(JSON.stringify({ step: "before", shop, productCount: before }));

  const jsonlPath = join(__dirname, "products-5000.jsonl");
  if (!existsSync(jsonlPath)) {
    throw new Error(`Missing ${jsonlPath} — run generate-products-jsonl.mjs first`);
  }

  const bulkId = await runBulkProductImport(token, jsonlPath);
  console.log(JSON.stringify({ step: "bulk_started", bulkId }));

  await pollBulk(token, bulkId);

  const after = await getProductCount(token);
  console.log(JSON.stringify({ step: "done", shop, productCountBefore: before, productCountAfter: after, added: after - before }));
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
