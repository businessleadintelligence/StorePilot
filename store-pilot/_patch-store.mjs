const fs = require("fs");
const p = "c:/Users/Soham/Documents/KALPESH/STOREPILOT/store-pilot/prisma/schema.prisma";
let s = fs.readFileSync(p, "utf8");
if (s.includes("aiResultCacheEntries")) {
  console.log("already patched");
  process.exit(0);
}
const block = `  storeOnboarding               StoreOnboarding?
  subscription                  Subscription?
  usageRecords                  UsageRecord[]
  googleIntegration             GoogleIntegration?
  microsoftClarityIntegration   MicrosoftClarityIntegration?
  customerDataExports           CustomerDataExport[]
  aiAgentRuns                   AiAgentRun[]
  aiAgentResults                AiAgentResult[]
  aiRecommendations             AiRecommendation[]
  aiMemoryRecords               AiMemoryRecord[]
  aiResultCacheEntries          AiResultCacheEntry[]

  @@index([active, subscriptionPlan])`;
s = s.replace(
  /  storeOnboarding      StoreOnboarding\?\r?\n\r?\n  @@index\(\[active, subscriptionPlan\]\)/,
  block
);
fs.writeFileSync(p, s);
console.log("patched");
