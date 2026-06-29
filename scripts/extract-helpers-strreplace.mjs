import fs from "node:fs";

const file =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b/subagents/4dd38d40-585e-470b-9dbc-43f87db64b2a.jsonl";
const target = "executive-coo/helpers.ts";

for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line.includes(target)) continue;
  const obj = JSON.parse(line);
  for (const part of obj.message?.content || []) {
    if (part.type !== "tool_use" || part.name !== "StrReplace") continue;
    if (!String(part.input?.path ?? "").includes("helpers.ts")) continue;
    const oldStr = part.input.old_string ?? "";
    const newStr = part.input.new_string ?? "";
    console.log("=== OLD length", oldStr.length, "NEW length", newStr.length);
    fs.writeFileSync("store-pilot/_helpers-old.ts", oldStr);
    fs.writeFileSync("store-pilot/_helpers-new.ts", newStr);
  }
}
