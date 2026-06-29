import fs from "node:fs";
import path from "node:path";

const transcriptRoot =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b";
const storePilotRoot = path.resolve("store-pilot");
const outRoot = path.resolve("transcript-final/store-pilot");

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

function toLF(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

const fileStates = new Map();
let opIndex = 0;

for (const jsonlFile of listJsonlFiles(transcriptRoot)) {
  const lines = fs.readFileSync(jsonlFile, "utf8").split(/\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;

      for (const part of content) {
        if (part.type !== "tool_use") continue;
        const rel = normalizeRel(part.input?.path ?? "");
        if (!rel) continue;

        opIndex += 1;
        const state = fileStates.get(rel) ?? {
          content: null,
          writes: 0,
          replaces: 0,
          lastOp: null,
        };

        if (part.name === "Write" && part.input?.contents != null) {
          state.content = toLF(part.input.contents);
          state.writes += 1;
          state.lastOp = "write";
          state.lastOpIndex = opIndex;
        } else if (part.name === "StrReplace" && part.input?.old_string != null) {
          if (state.content == null) {
            const diskPath = path.join(storePilotRoot, rel);
            if (fs.existsSync(diskPath)) {
              state.content = toLF(fs.readFileSync(diskPath, "utf8"));
            } else {
              continue;
            }
          }
          const oldStr = toLF(part.input.old_string);
          const newStr = toLF(part.input.new_string ?? "");
          if (state.content.includes(oldStr)) {
            state.content = state.content.replace(oldStr, newStr);
            state.replaces += 1;
            state.lastOp = "replace";
            state.lastOpIndex = opIndex;
          }
        }

        fileStates.set(rel, state);
      }
    } catch {
      // ignore malformed lines
    }
  }
}

const prefix = process.argv[2]?.replace(/\\/g, "/").replace(/\/$/, "") ?? "";
let written = 0;

for (const [rel, state] of fileStates) {
  if (!state.content || state.content.trim().length === 0) continue;
  if (prefix && !rel.startsWith(prefix)) continue;
  if (!/\.(ts|tsx|toml|md|json|prisma)$/.test(rel)) continue;

  const out = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, state.content);
  written += 1;
}

console.log(
  JSON.stringify(
    {
      prefix: prefix || "(all)",
      filesWithFinalContent: written,
      totalTracked: fileStates.size,
      outRoot,
    },
    null,
    2,
  ),
);
