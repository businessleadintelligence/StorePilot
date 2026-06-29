import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const targetRel = process.argv[2]?.replace(/\\/g, "/");

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

let n = 0;
for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      for (const part of obj.message?.content || []) {
        if (part.type !== "tool_use") continue;
        if (normalizeRel(part.input?.path ?? "") !== targetRel) continue;
        n += 1;
        console.log(`OP ${n} ${part.name} file ${path.basename(jsonlFile)}`);
        if (part.name === "Write") {
          console.log(`WRITE LEN ${part.input.contents.length}`);
        }
        if (part.name === "StrReplace") {
          console.log("OLD---\n" + part.input.old_string.slice(0, 800));
          console.log("NEW---\n" + part.input.new_string.slice(0, 800));
        }
      }
    } catch {
      // ignore
    }
  }
}
console.log("total ops", n);
