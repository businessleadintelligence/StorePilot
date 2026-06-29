import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const targetRel = process.argv[2]?.replace(/\\/g, "/");
const baseRel = process.argv[3]?.replace(/\\/g, "/");
const toLF = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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

let content = baseRel
  ? toLF(fs.readFileSync(path.join(path.resolve("store-pilot"), baseRel), "utf8"))
  : "";

const ops = [];
for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split("\n")) {
    if (!line.includes(path.basename(targetRel))) continue;
    try {
      const obj = JSON.parse(line);
      for (const part of obj.message?.content || []) {
        if (part.type !== "tool_use") continue;
        if (normalizeRel(part.input?.path ?? "") !== targetRel) continue;
        if (part.name === "Write" && part.input?.contents != null) {
          content = toLF(part.input.contents);
        } else if (part.name === "StrReplace" && part.input?.old_string != null) {
          ops.push({
            old: toLF(part.input.old_string),
            new: toLF(part.input.new_string ?? ""),
          });
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
  if (!content.includes(op.old)) {
    skipped += 1;
    continue;
  }
  content = content.replace(op.old, op.new);
  applied += 1;
}

const outPath = path.join(path.resolve("store-pilot"), targetRel);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content);
console.log(JSON.stringify({ applied, skipped, bytes: content.length }, null, 2));
