import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const outRoot = path.resolve("store-pilot/app/ai/tests/executive-coo");
const toLF = (value) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

function listJsonlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listJsonlFiles(full));
    else if (entry.name.endsWith(".jsonl")) results.push(full);
  }
  return results.sort();
}

function normalizeRel(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/store-pilot\/(.+)$/i);
  return match ? match[1] : null;
}

const files = new Map();

for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      for (const part of obj.message?.content || []) {
        if (part.type !== "tool_use") continue;
        const rel = normalizeRel(part.input?.path ?? "");
        if (!rel?.startsWith("app/ai/tests/executive-coo/")) continue;

        if (!files.has(rel)) {
          files.set(rel, "");
        }

        if (part.name === "Write" && part.input?.contents != null) {
          files.set(rel, toLF(part.input.contents));
        } else if (part.name === "StrReplace" && part.input?.old_string != null) {
          let content = files.get(rel);
          if (content.length === 0 && fs.existsSync(path.join(path.resolve("store-pilot"), rel))) {
            content = toLF(fs.readFileSync(path.join(path.resolve("store-pilot"), rel), "utf8"));
          }
          const oldStr = toLF(part.input.old_string);
          const newStr = toLF(part.input.new_string ?? "");
          if (content.includes(oldStr)) {
            files.set(rel, content.replace(oldStr, newStr));
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

for (const [rel, content] of files.entries()) {
  if (!content) continue;
  if (rel === "app/ai/tests/executive-coo/helpers.ts") continue;
  if (rel === "app/ai/tests/executive-coo/default-executive-coo-facts.json") continue;
  const outPath = path.join(path.resolve("store-pilot"), rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf8");
  console.log("Wrote", rel, content.length);
}
