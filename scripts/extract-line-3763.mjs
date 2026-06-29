import fs from "node:fs";

const file =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b/3b80edb1-bd7d-4211-b406-115ad2a0992b.jsonl";
const lineNo = 3763;

const line = fs.readFileSync(file, "utf8").split("\n")[lineNo - 1];
const obj = JSON.parse(line);
for (const part of obj.message?.content || []) {
  if (part.type !== "tool_use" || part.name !== "StrReplace") continue;
  const path = part.input?.path ?? "";
  if (!path.includes("executive-coo\\helpers") && !path.includes("executive-coo/helpers")) continue;
  console.log("found replace, old", part.input.old_string?.length, "new", part.input.new_string?.length);
  fs.writeFileSync("store-pilot/_exec-coo-helpers-old.ts", part.input.old_string ?? "");
  fs.writeFileSync("store-pilot/_exec-coo-helpers-new.ts", part.input.new_string ?? "");
}
