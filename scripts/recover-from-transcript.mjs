import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";

function listJsonlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listJsonlFiles(full));
    } else if (entry.name.endsWith(".jsonl")) {
      results.push(full);
    }
  }
  return results;
}

const writes = new Map();
for (const file of listJsonlFiles(transcriptRoot)) {
  const lines = fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (
          part.type === "tool_use" &&
          part.name === "Write" &&
          part.input?.path &&
          part.input?.contents
        ) {
          const normalized = part.input.path.replace(/\\/g, "/");
          writes.set(normalized, part.input.contents);
        }
      }
    } catch {
      // ignore malformed lines
    }
  }
}

const outRoot = path.resolve("recovery-from-transcript/store-pilot");
let restored = 0;
for (const [filePath, contents] of writes) {
  const match = filePath.match(/store-pilot\/(.+)$/i);
  if (!match) continue;
  const out = path.join(outRoot, match[1]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, contents);
  restored += 1;
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(full);
    else count += 1;
  }
  return count;
}

console.log(
  JSON.stringify(
    {
      jsonlFiles: listJsonlFiles(transcriptRoot).length,
      uniqueWrites: writes.size,
      restored,
      recoveryFileCount: fs.existsSync(outRoot) ? countFiles(outRoot) : 0,
      outRoot,
    },
    null,
    2,
  ),
);
