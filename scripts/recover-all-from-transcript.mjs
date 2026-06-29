import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const storePilotRoot = path.resolve("store-pilot");

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

function listSourceFiles(dir, base = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const rel = path.join(base, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listSourceFiles(full, rel));
    else if (/\.(ts|tsx|toml|md)$/.test(entry.name)) results.push(rel.replace(/\\/g, "/"));
  }
  return results;
}

let improved = 0;
let skippedWrites = 0;
for (const rel of listSourceFiles(storePilotRoot)) {
  const relNorm = normalize(`store-pilot/${rel}`);
  const fileOps = ops.filter((op) => normalize(op.filePath).endsWith(relNorm));
  if (fileOps.length === 0) continue;

  const existingPath = path.join(storePilotRoot, rel);
  let content = fs.existsSync(existingPath) ? fs.readFileSync(existingPath, "utf8") : "";
  const beforeBytes = Buffer.byteLength(content, "utf8");

  for (const op of fileOps) {
    if (op.type === "write") {
      const writeBytes = Buffer.byteLength(op.contents, "utf8");
      if (beforeBytes > 0 && writeBytes < beforeBytes) {
        skippedWrites += 1;
        continue;
      }
      content = op.contents;
      continue;
    }
    if (content.includes(op.old_string)) {
      content = content.replace(op.old_string, op.new_string);
    }
  }

  const out = path.join(storePilotRoot, rel);
  const afterBytes = Buffer.byteLength(content, "utf8");
  if (afterBytes === beforeBytes && content === (fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "")) {
    continue;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  if (afterBytes !== beforeBytes) improved += 1;
}

console.log(
  JSON.stringify(
    {
      filesProcessed: listSourceFiles(storePilotRoot).length,
      filesUpdated: improved,
      skippedDestructiveWrites: skippedWrites,
    },
    null,
    2,
  ),
);
