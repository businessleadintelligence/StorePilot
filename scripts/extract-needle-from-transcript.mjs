import fs from "node:fs";

const file =
  "C:/Users/Soham/.cursor/projects/c-Users-Soham-Documents-KALPESH-STOREPILOT/agent-transcripts/3b80edb1-bd7d-4211-b406-115ad2a0992b/subagents/4dd38d40-585e-470b-9dbc-43f87db64b2a.jsonl";
const needle = process.argv[2] ?? "buildMockExecutiveCooFacts";

for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line.includes(needle)) continue;
  const obj = JSON.parse(line);
  for (const part of obj.message?.content || []) {
    if (part.type !== "tool_use") continue;
    const path = part.input?.path ?? "";
    if (!path.includes("helpers")) continue;
    console.log("PATH:", path);
    console.log("TOOL:", part.name);
    if (part.input?.contents) {
      fs.writeFileSync("store-pilot/_helpers-from-transcript.ts", part.input.contents);
      console.log("Wrote contents", part.input.contents.length);
    }
    if (part.input?.new_string?.includes(needle)) {
      fs.writeFileSync("store-pilot/_helpers-new-string.ts", part.input.new_string);
      console.log("Wrote new_string", part.input.new_string.length);
    }
    if (part.input?.old_string?.includes(needle)) {
      fs.writeFileSync("store-pilot/_helpers-old-string.ts", part.input.old_string);
      console.log("Wrote old_string", part.input.old_string.length);
    }
  }
}
