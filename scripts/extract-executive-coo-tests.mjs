import fs from "node:fs";
import path from "node:path";

const file =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b/subagents/4dd38d40-585e-470b-9dbc-43f87db64b2a.jsonl";
const outDir = path.resolve("store-pilot/_transcript-extract");

function normalizeRel(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/store-pilot\/(.+)$/i);
  return match ? match[1] : null;
}

fs.mkdirSync(outDir, { recursive: true });

for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    for (const part of obj.message?.content || []) {
      if (part.type !== "tool_use") continue;
      const rel = normalizeRel(part.input?.path ?? "");
      if (!rel?.includes("tests/executive-coo/")) continue;
      const base = path.basename(rel);
      if (part.name === "Write" && part.input?.contents != null) {
        fs.writeFileSync(path.join(outDir, base), part.input.contents);
        console.log("Write", base, part.input.contents.length);
      }
      if (part.name === "StrReplace" && part.input?.new_string != null) {
        const existing = fs.readFileSync(path.join(outDir, base), "utf8");
        const oldStr = part.input.old_string ?? "";
        if (existing.includes(oldStr)) {
          fs.writeFileSync(
            path.join(outDir, base),
            existing.replace(oldStr, part.input.new_string),
          );
          console.log("Replace", base, oldStr.length, "->", part.input.new_string.length);
        } else {
          console.log("Skip replace", base, oldStr.slice(0, 60));
        }
      }
    }
  } catch {
    // ignore
  }
}
