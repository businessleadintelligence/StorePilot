import fs from "node:fs";
import path from "node:path";

function listTsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listTsFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function findDuplicateNames(lines) {
  const seen = new Map();
  const dups = new Set();
  for (let i = 0; i < lines.length; i++) {
    const match =
      lines[i].match(/^(export\s+)?function\s+(\w+)/) ??
      lines[i].match(/^export\s+const\s+(\w+)\s*=/);
    if (!match) continue;
    const name = match[match.length - 1];
    if (seen.has(name)) dups.add(name);
    else seen.set(name, i);
  }
  return dups;
}

function findFunctionEnd(lines, startIndex) {
  let depth = 0;
  let started = false;
  for (let i = startIndex; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth += 1;
        started = true;
      } else if (ch === "}") {
        depth -= 1;
        if (started && depth === 0) {
          return i;
        }
      }
    }
  }
  return startIndex;
}

function dedupeFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let lines = original.split(/\n/);
  const duplicateNames = findDuplicateNames(lines);
  if (duplicateNames.size === 0) return false;

  const seen = new Map();
  const rangesToRemove = [];

  for (let i = 0; i < lines.length; i++) {
    const match =
      lines[i].match(/^(export\s+)?function\s+(\w+)/) ??
      lines[i].match(/^export\s+const\s+(\w+)\s*=/);
    if (!match) continue;
    const name = match[match.length - 1];
    if (!duplicateNames.has(name)) continue;

    if (seen.has(name)) {
      const end = findFunctionEnd(lines, i);
      rangesToRemove.push([i, end]);
    } else {
      seen.set(name, i);
    }
  }

  if (rangesToRemove.length === 0) return false;

  rangesToRemove.sort((a, b) => b[0] - a[0]);
  for (const [start, end] of rangesToRemove) {
    let removeStart = start;
    while (removeStart > 0 && lines[removeStart - 1].trim() === "") {
      removeStart -= 1;
    }
    lines.splice(removeStart, end - removeStart + 1);
  }

  const next = lines.join("\n");
  if (next !== original) {
    fs.writeFileSync(filePath, next);
    return true;
  }
  return false;
}

const root = path.resolve("store-pilot/app");
let fixed = 0;
for (const file of listTsFiles(root)) {
  if (dedupeFile(file)) {
    fixed += 1;
    console.log("deduped", path.relative(root, file));
  }
}

console.log(JSON.stringify({ fixed }, null, 2));
