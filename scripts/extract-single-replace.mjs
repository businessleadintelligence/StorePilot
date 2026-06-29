import fs from "node:fs";

const file =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b/subagents/4dd38d40-585e-470b-9dbc-43f87db64b2a.jsonl";
const target = "executive-coo/deterministic-coverage.test.ts";
const lineNo = Number(process.argv[2] ?? 15);

const line = fs.readFileSync(file, "utf8").split("\n")[lineNo - 1];
const obj = JSON.parse(line);
for (const part of obj.message?.content || []) {
  if (part.type !== "tool_use" || part.name !== "StrReplace") continue;
  if (!String(part.input?.path ?? "").includes(target)) continue;
  fs.writeFileSync(
    "store-pilot/app/ai/tests/executive-coo/deterministic-coverage.test.ts",
    part.input.new_string ?? "",
  );
  console.log("wrote", (part.input.new_string ?? "").length, "old was", (part.input.old_string ?? "").length);
}
