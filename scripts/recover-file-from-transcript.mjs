import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";

const targetFiles = process.argv.slice(2);
if (targetFiles.length === 0) {
  console.error("Usage: node recover-file-from-transcript.mjs <relative-path-under-store-pilot>...");
  process.exit(1);
}

function listJsonlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listJsonlFiles(full));
    else if (entry.name.endsWith(".jsonl")) results.push(full);
  }
  return results;
}

function normalize(p) {
  return p.replace(/\\/g, "/").toLowerCase();
}

function collectOps() {
  const ops = [];
  for (const file of listJsonlFiles(transcriptRoot)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const obj = JSON.parse(line);
        const content = obj.message?.content;
        if (!Array.isArray(content)) continue;
        for (const part of content) {
          const filePath = part.input?.path?.replace(/\\/g, "/") ?? "";
          if (part.type === "tool_use" && part.name === "StrReplace" && part.input?.old_string) {
            ops.push({ type: "replace", filePath, ...part.input });
          }
          if (part.type === "tool_use" && part.name === "Write" && part.input?.contents) {
            ops.push({ type: "write", filePath, contents: part.input.contents });
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return ops;
}

const storePilotRoot = path.resolve("store-pilot");
const ops = collectOps();

for (const rel of targetFiles) {
  const relNorm = normalize(`store-pilot/${rel}`);
  const existingPath = path.join(storePilotRoot, rel);
  let content = fs.existsSync(existingPath) ? fs.readFileSync(existingPath, "utf8") : "";
  const baseBytes = Buffer.byteLength(content, "utf8");

  const fileOps = ops.filter((op) => normalize(op.filePath).endsWith(relNorm));
  let applied = 0;
  let skipped = 0;
  let skippedWrites = 0;

  for (const op of fileOps) {
    if (op.type === "write") {
      const writeBytes = Buffer.byteLength(op.contents, "utf8");
      if (baseBytes > 0 && writeBytes < baseBytes) {
        skippedWrites += 1;
        continue;
      }
      content = op.contents;
      applied += 1;
      continue;
    }
    if (!content.includes(op.old_string)) {
      skipped += 1;
      continue;
    }
    content = content.replace(op.old_string, op.new_string);
    applied += 1;
  }

  const out = path.resolve("store-pilot", rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  console.log(
    JSON.stringify({
      file: rel,
      operations: fileOps.length,
      applied,
      skipped,
      skippedWrites,
      lines: content.split(/\n/).length,
      bytes: Buffer.byteLength(content, "utf8"),
    }),
  );
}
