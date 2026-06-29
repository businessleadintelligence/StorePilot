import fs from "node:fs";
import path from "node:path";

const roots = {
  current: path.resolve("store-pilot"),
  recovery: path.resolve("recovery-from-transcript/store-pilot"),
  backup: path.resolve("store-pilot.broken-backup"),
};

function listFiles(dir, base = "") {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const rel = path.join(base, entry.name).replace(/\\/g, "/");
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(full, rel));
    else results.push(rel);
  }
  return results;
}

const currentFiles = new Set(listFiles(roots.current));
const candidates = new Set([
  ...currentFiles,
  ...listFiles(roots.recovery),
  ...listFiles(roots.backup),
]);

let restored = 0;
const restoredFiles = [];

for (const rel of candidates) {
  if (!/\.(ts|tsx|toml|prisma|md|json)$/.test(rel)) continue;

  const sources = [];
  for (const [name, root] of Object.entries(roots)) {
    const filePath = path.join(root, rel);
    if (!fs.existsSync(filePath)) continue;
    const stat = fs.statSync(filePath);
    if (stat.size === 0) continue;
    sources.push({ name, filePath, size: stat.size });
  }

  if (sources.length === 0) continue;

  sources.sort((a, b) => b.size - a.size);
  const best = sources[0];
  const currentPath = path.join(roots.current, rel);
  const currentSize = fs.existsSync(currentPath) ? fs.statSync(currentPath).size : 0;

  if (best.size > currentSize) {
    fs.mkdirSync(path.dirname(currentPath), { recursive: true });
    fs.copyFileSync(best.filePath, currentPath);
    restored += 1;
    restoredFiles.push({ rel, from: best.name, bytes: best.size, previous: currentSize });
  }
}

restoredFiles.sort((a, b) => b.bytes - a.bytes - (a.bytes - a.previous));
console.log(
  JSON.stringify(
    {
      restored,
      topRestores: restoredFiles.slice(0, 40),
    },
    null,
    2,
  ),
);
