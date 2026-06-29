import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const targetRel = "app/services/__tests__/setup/vitest.setup.ts";

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

const toLF = (s) => s.replace(/\r\n/g, "\n");

const ops = [];
for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  for (const line of fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const obj = JSON.parse(line);
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part.type !== "tool_use") continue;
        const rel = normalizeRel(part.input?.path ?? "");
        if (rel !== targetRel) continue;
        if (part.name === "Write" && part.input?.contents != null) {
          ops.push({ type: "write", contents: part.input.contents });
        } else if (part.name === "StrReplace" && part.input?.old_string != null) {
          ops.push({
            type: "replace",
            old_string: part.input.old_string,
            new_string: part.input.new_string ?? "",
          });
        }
      }
    } catch {
      // ignore
    }
  }
}

let content = "";
let idx = 0;
for (const op of ops) {
  idx++;
  if (op.type === "write") {
    content = toLF(op.contents);
    continue;
  }
  const oldStr = toLF(op.old_string);
  const newStr = toLF(op.new_string);
  const key =
    newStr.includes("seedSyncJob") ||
    oldStr.includes("seedSyncJob") ||
    newStr.includes("getJobEvents") ||
    newStr.includes("microsoftClarity");
  const ok = content.includes(oldStr);
  if (key) {
    console.log(`${ok ? "OK" : "FAIL"} op ${idx}/${ops.length}`);
    if (!ok) {
      console.log("  old preview:", JSON.stringify(oldStr.slice(0, 150)));
      const anchor = oldStr.split("\n")[0];
      const pos = content.indexOf(anchor.trim());
      console.log("  anchor in content:", pos >= 0, pos >= 0 ? JSON.stringify(content.slice(pos, pos + 200)) : "");
    }
  }
  if (!ok) continue;
  content = content.replace(oldStr, newStr);
}

console.log("\nfinal:", {
  bytes: content.length,
  seedSyncJob: content.includes("seedSyncJob"),
  getJobEvents: content.includes("getJobEvents"),
  microsoftClarityIntegrations: content.includes("microsoftClarityIntegrations"),
});
