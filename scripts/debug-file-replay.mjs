import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const targetRel = process.argv[2]?.replace(/\\/g, "/");
if (!targetRel) {
  console.error("Usage: node debug-file-replay.mjs <path>");
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

const ops = [];
for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      for (const part of obj.message?.content || []) {
        if (part.type !== "tool_use") continue;
        if (normalizeRel(part.input?.path ?? "") !== targetRel) continue;
        if (part.name === "Write" && part.input?.contents != null) {
          ops.push({ type: "write" });
        } else if (part.name === "StrReplace" && part.input?.old_string != null) {
          ops.push({
            type: "replace",
            old: toLF(part.input.old_string).slice(0, 80),
          });
        }
      }
    } catch {
      // ignore
    }
  }
}

let content = "";
const diskPath = path.join(path.resolve("store-pilot"), targetRel);
if (fs.existsSync(diskPath)) content = toLF(fs.readFileSync(diskPath, "utf8"));

let idx = 0;
let applied = 0;
let skipped = 0;
for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      for (const part of obj.message?.content || []) {
        if (part.type !== "tool_use") continue;
        if (normalizeRel(part.input?.path ?? "") !== targetRel) continue;
        idx++;
        if (part.name === "Write" && part.input?.contents != null) {
          content = toLF(part.input.contents);
          applied++;
          continue;
        }
        if (part.name !== "StrReplace" || part.input?.old_string == null) continue;
        const oldStr = toLF(part.input.old_string);
        const newStr = toLF(part.input.new_string ?? "");
        if (!content.includes(oldStr)) {
          skipped++;
          console.log(`SKIP ${idx}: ${JSON.stringify(oldStr.slice(0, 100))}`);
          continue;
        }
        content = content.replace(oldStr, newStr);
        applied++;
      }
    } catch {
      // ignore
    }
  }
}

console.log({ applied, skipped, bytes: content.length });
