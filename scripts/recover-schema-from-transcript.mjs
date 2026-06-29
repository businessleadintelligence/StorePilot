import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";

function listJsonlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listJsonlFiles(full));
    else if (entry.name.endsWith(".jsonl")) results.push(full);
  }
  return results;
}

let schema = execSync("git show HEAD:store-pilot/prisma/schema.prisma", {
  encoding: "utf8",
});

const ops = [];
for (const file of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const filePath = part.input?.path?.replace(/\\/g, "/") ?? "";
        if (!filePath.toLowerCase().includes("schema.prisma")) continue;
        if (part.type === "tool_use" && part.name === "StrReplace" && part.input?.old_string) {
          ops.push({ type: "replace", ...part.input });
        }
        if (part.type === "tool_use" && part.name === "Write" && part.input?.contents) {
          ops.push({ type: "write", contents: part.input.contents });
        }
      }
    } catch {
      // ignore
    }
  }
}

let applied = 0;
let skipped = 0;
for (const op of ops) {
  if (op.type === "write") {
    schema = op.contents;
    applied += 1;
    continue;
  }
  if (!schema.includes(op.old_string)) {
    skipped += 1;
    continue;
  }
  schema = schema.replace(op.old_string, op.new_string);
  applied += 1;
}

const out = path.resolve("store-pilot/prisma/schema.prisma");
fs.writeFileSync(out, schema);
console.log(
  JSON.stringify(
    {
      operations: ops.length,
      applied,
      skipped,
      lines: schema.split(/\n/).length,
      models: (schema.match(/^model /gm) ?? []).length,
      out,
    },
    null,
    2,
  ),
);
