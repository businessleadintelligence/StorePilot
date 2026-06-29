import fs from "node:fs";

const file =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b/subagents/4dd38d40-585e-470b-9dbc-43f87db64b2a.jsonl";
const lineNo = Number(process.argv[2] ?? 15);
const lines = fs.readFileSync(file, "utf8").split("\n");
const line = lines[lineNo - 1];
const obj = JSON.parse(line);
for (const part of obj.message?.content || []) {
  if (part.type !== "tool_use") continue;
  console.log("path:", part.input?.path);
  if (part.input?.path?.includes("helpers")) {
    fs.writeFileSync("store-pilot/_helpers-extract.ts", part.input.new_string ?? part.input.contents ?? "");
    console.log("wrote helpers", (part.input.new_string ?? part.input.contents ?? "").length);
  }
  if (part.input?.path?.includes("deterministic-coverage")) {
    const text = part.input.new_string ?? "";
    const idx = text.indexOf("buildMockExecutiveCooFacts");
    if (idx >= 0) {
      console.log(text.slice(Math.max(0, idx - 200), idx + 2000));
    }
  }
}
