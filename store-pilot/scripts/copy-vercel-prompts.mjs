import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "app", "ai", "prompts");
const serverRoot = join(root, "build", "server");

if (!existsSync(source) || !existsSync(serverRoot)) {
  process.exit(0);
}

const flatTarget = join(serverRoot, "app", "ai", "prompts");
mkdirSync(join(serverRoot, "app", "ai"), { recursive: true });
cpSync(source, flatTarget, { recursive: true });

for (const entry of readdirSync(serverRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "app") continue;
  const target = join(serverRoot, entry.name, "app", "ai", "prompts");
  mkdirSync(join(serverRoot, entry.name, "app", "ai"), { recursive: true });
  cpSync(source, target, { recursive: true });
}

console.log("Copied AI prompt files into server build output");
