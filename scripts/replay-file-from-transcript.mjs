import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const storePilotRoot = path.resolve("store-pilot");

const targetRel = process.argv[2]?.replace(/\\/g, "/");
if (!targetRel) {
  console.error("Usage: node replay-file-from-transcript.mjs <path-under-store-pilot>");
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

function toLF(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

let content = "";
const diskPath = path.join(storePilotRoot, targetRel);
const useDiskBase = process.argv.includes("--disk-base");
if (useDiskBase && fs.existsSync(diskPath)) {
  content = toLF(fs.readFileSync(diskPath, "utf8"));
}

const hasWrite = ops.some((op) => op.type === "write");
if (!hasWrite && content.length === 0 && fs.existsSync(diskPath)) {
  content = toLF(fs.readFileSync(diskPath, "utf8"));
}

let writes = 0;
let applied = 0;
let skipped = 0;

for (const op of ops) {
  if (op.type === "write") {
    content = toLF(op.contents);
    writes += 1;
    applied += 1;
    continue;
  }
  const oldStr = toLF(op.old_string);
  const newStr = toLF(op.new_string);
  if (!content.includes(oldStr)) {
    skipped += 1;
    continue;
  }
  content = content.replace(oldStr, newStr);
  applied += 1;
}

const outPath = path.join(storePilotRoot, targetRel);
if (content.length === 0 && fs.existsSync(diskPath) && fs.readFileSync(diskPath, "utf8").trim().length > 0) {
  console.error(`Refusing to write empty content over existing file: ${targetRel}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content);

const hasSeed = content.includes("seedSyncJob");
const hasJobEvents = content.includes("getJobEvents");
const hasClarity = content.includes("microsoftClarityIntegrations");

console.log(
  JSON.stringify(
    {
      file: targetRel,
      operations: ops.length,
      writes,
      applied,
      skipped,
      bytes: Buffer.byteLength(content, "utf8"),
      lines: content.split(/\n/).length,
      hasSeedSyncJob: hasSeed,
      hasGetJobEvents: hasJobEvents,
      hasMicrosoftClarityIntegrations: hasClarity,
    },
    null,
    2,
  ),
);
