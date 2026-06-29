import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("tsx/esm", pathToFileURL("./"));

const { createMockExecutiveCooSnapshot, buildExecutiveCooFactsFromSnapshot } = await import(
  "../store-pilot/app/ai/tests/executive-coo/helpers.ts"
);

const facts = await buildExecutiveCooFactsFromSnapshot(createMockExecutiveCooSnapshot());
process.stdout.write(JSON.stringify(facts, null, 2));
