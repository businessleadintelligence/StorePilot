import fs from "node:fs";
import path from "node:path";

const prefix = process.argv[2]?.replace(/\\/g, "/").replace(/\/$/, "");
const onlyFilesArg = process.argv.slice(3);
const dryRun = process.argv.includes("--dry-run");

if (!prefix) {
  console.error("Usage: node apply-transcript-batch.mjs <folder-prefix-under-store-pilot> [rel-file...] [--dry-run]");
  process.exit(1);
}

const storePilotRoot = path.resolve("store-pilot");
const transcriptRoot = path.resolve("transcript-final/store-pilot");
const onlyFiles = new Set(onlyFilesArg.filter((f) => !f.startsWith("--")));

function listFiles(dir, base = "") {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name).replace(/\\/g, "/");
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(full, rel));
    else results.push(rel);
  }
  return results;
}

function duplicateDeclCount(content) {
  const lines = content.split(/\n/);
  const seen = new Set();
  let dups = 0;
  const patterns = [
    /^(export\s+)?async\s+function\s+(\w+)/,
    /^(export\s+)?function\s+(\w+)/,
    /^(export\s+)?const\s+(\w+)\s*=/,
    /^(export\s+)?type\s+(\w+)\s*=/,
    /^(export\s+)?interface\s+(\w+)\b/,
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const name = match[match.length - 1];
      if (seen.has(name)) dups += 1;
      else seen.add(name);
    }
  }
  return dups;
}

function shouldApply(rel, transcriptContent, currentContent) {
  const tBytes = Buffer.byteLength(transcriptContent, "utf8");
  const cBytes = Buffer.byteLength(currentContent, "utf8");

  if (cBytes === 0) return { apply: true, reason: "empty_current" };
  if (duplicateDeclCount(currentContent) > 0 && duplicateDeclCount(transcriptContent) === 0) {
    return { apply: true, reason: "current_has_duplicates" };
  }
  if (currentContent.includes("export export ")) {
    return { apply: true, reason: "corruption_marker" };
  }
  if (/\n  [a-zA-Z]+: .+;\n\};\n  [a-zA-Z]+:/.test(currentContent)) {
    return { apply: true, reason: "orphan_type_tail" };
  }

  // Transcript is canonical when clearly more complete.
  if (tBytes > cBytes * 1.05 && tBytes - cBytes > 200) {
    return { apply: true, reason: "transcript_larger" };
  }

  return { apply: false, reason: "current_kept" };
}

const candidates = onlyFiles.size
  ? [...onlyFiles]
  : listFiles(transcriptRoot).filter((rel) => rel.startsWith(prefix));

const applied = [];
const skipped = [];

for (const rel of candidates) {
  const src = path.join(transcriptRoot, rel);
  if (!fs.existsSync(src)) {
    skipped.push({ rel, reason: "missing_in_transcript_final" });
    continue;
  }

  const transcriptContent = fs.readFileSync(src, "utf8");
  const dest = path.join(storePilotRoot, rel);
  const currentContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
  const decision = shouldApply(rel, transcriptContent, currentContent);

  if (!decision.apply) {
    skipped.push({ rel, reason: decision.reason });
    continue;
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, transcriptContent);
  }

  applied.push({
    rel,
    reason: decision.reason,
    fromBytes: Buffer.byteLength(currentContent, "utf8"),
    toBytes: Buffer.byteLength(transcriptContent, "utf8"),
  });
}

console.log(JSON.stringify({ prefix, applied, skippedCount: skipped.length, skipped: skipped.slice(0, 20) }, null, 2));
