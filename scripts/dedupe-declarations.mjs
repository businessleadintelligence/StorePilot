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

const DECL_PATTERNS = [
  /^(export\s+)?async\s+function\s+(\w+)/,
  /^(export\s+)?function\s+(\w+)/,
  /^(export\s+)?const\s+(\w+)\s*=/,
  /^(export\s+)?type\s+(\w+)\s*=/,
  /^(export\s+)?interface\s+(\w+)\b/,
  /^(export\s+)?enum\s+(\w+)\b/,
];

function getDeclName(line) {
  for (const pattern of DECL_PATTERNS) {
    const match = line.match(pattern);
    if (match) return match[match.length - 1];
  }
  return null;
}

function findBlockEnd(lines, startIndex) {
  const line = lines[startIndex];
  if (/^(export\s+)?(async\s+)?function\s+/.test(line)) {
    let depth = 0;
    let started = false;
    for (let i = startIndex; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{") {
          depth += 1;
          started = true;
        } else if (ch === "}") {
          depth -= 1;
          if (started && depth === 0) return i;
        }
      }
    }
    return startIndex;
  }

  if (/^(export\s+)?interface\s+/.test(line) || /^(export\s+)?enum\s+/.test(line)) {
    let depth = 0;
    let started = false;
    for (let i = startIndex; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{") {
          depth += 1;
          started = true;
        } else if (ch === "}") {
          depth -= 1;
          if (started && depth === 0) return i;
        }
      }
    }
    return startIndex;
  }

  if (/^(export\s+)?type\s+/.test(line)) {
    let i = startIndex;
    while (i < lines.length) {
      if (lines[i].includes(";")) return i;
      i += 1;
    }
    return startIndex;
  }

  if (/^(export\s+)?const\s+/.test(line)) {
    let depth = 0;
    let started = false;
    for (let i = startIndex; i < lines.length; i++) {
      const text = lines[i];
      for (const ch of text) {
        if (ch === "{") {
          depth += 1;
          started = true;
        } else if (ch === "}") {
          depth -= 1;
        }
      }
      if (!started && text.trim().endsWith(";")) return i;
      if (started && depth === 0 && text.includes("}")) return i;
      if (started && depth === 0 && text.trim().endsWith(";")) return i;
    }
    return startIndex;
  }

  return startIndex;
}

function findDuplicateNames(lines) {
  const seen = new Map();
  const dups = new Set();
  for (let i = 0; i < lines.length; i++) {
    const name = getDeclName(lines[i]);
    if (!name) continue;
    if (seen.has(name)) dups.add(name);
    else seen.set(name, i);
  }
  return dups;
}

function dedupeFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let lines = original.split(/\n/);
  let changed = false;

  for (let pass = 0; pass < 20; pass += 1) {
    const duplicateNames = findDuplicateNames(lines);
    if (duplicateNames.size === 0) break;

    const seen = new Map();
    const rangesToRemove = [];

    for (let i = 0; i < lines.length; i++) {
      const name = getDeclName(lines[i]);
      if (!name || !duplicateNames.has(name)) continue;

      if (seen.has(name)) {
        const end = findBlockEnd(lines, i);
        rangesToRemove.push([i, end]);
      } else {
        seen.set(name, i);
      }
    }

    if (rangesToRemove.length === 0) break;

    rangesToRemove.sort((a, b) => b[0] - a[0]);
    for (const [start, end] of rangesToRemove) {
      let removeStart = start;
      while (removeStart > 0 && lines[removeStart - 1].trim() === "") {
        removeStart -= 1;
      }
      lines.splice(removeStart, end - removeStart + 1);
      changed = true;
    }
  }

  const next = lines.join("\n");
  if (changed && next !== original) {
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
