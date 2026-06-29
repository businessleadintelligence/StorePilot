import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const targetRel = process.argv[2]?.replace(/\\/g, "/");
const outPath = process.argv[3];

if (!targetRel || !outPath) {
  console.error("Usage: node extract-replay-content.mjs <path> <out>");
  process.exit(1);
}

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

const toLF = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

let content = "";
let applied = 0;
let skipped = 0;

for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      for (const part of obj.message?.content || []) {
        if (part.type !== "tool_use") continue;
        if (normalizeRel(part.input?.path ?? "") !== targetRel) continue;
        if (part.name === "Write" && part.input?.contents != null) {
          content = toLF(part.input.contents);
          applied++;
        } else if (part.name === "StrReplace" && part.input?.old_string != null) {
          const oldStr = toLF(part.input.old_string);
          const newStr = toLF(part.input.new_string ?? "");
          if (!content.includes(oldStr)) {
            skipped++;
            continue;
          }
          content = content.replace(oldStr, newStr);
          applied++;
        }
      }
    } catch {
      // ignore
    }
  }
}

fs.writeFileSync(outPath, content, "utf8");
console.log(JSON.stringify({ applied, skipped, bytes: content.length }, null, 2));
