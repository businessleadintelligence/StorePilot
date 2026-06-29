import type {
  CollaborationExecutiveGroup,
  CollaborationRecommendationInput,
} from "./collaboration-types";

export function assignCollaborationExecutiveGroup(
  recommendation: Pick<CollaborationRecommendationInput, "category" | "group" | "agentId">,
): CollaborationExecutiveGroup {
  const haystack = `${recommendation.category} ${recommendation.group} ${recommendation.agentId}`.toLowerCase();

  if (/critical|stockout|dead stock|risk/.test(haystack)) return "Critical";
  if (/revenue|pricing|margin|recovery/.test(haystack)) return "Revenue";
  if (/trend|growth|emerging|momentum|seasonal/.test(haystack)) return "Growth";
  if (/inventory|reorder|replenish|overstock|stock/.test(haystack)) return "Inventory";
  if (/conversion|social proof|checkout|cta/.test(haystack)) return "Conversion";
  if (/bundle|attach|cross/.test(haystack)) return "Revenue";
  if (/marketing|campaign|promote|feature|merchandis/.test(haystack)) return "Marketing";
  if (/seo|search|meta/.test(haystack)) return "SEO";
  if (/audit|theme|accessibility|performance|mobile|homepage|store health/.test(haystack)) {
    return "Store Health";
  }
  if (/quick|easy|immediate/.test(haystack)) return "Quick Wins";
  if (/long|strategy|seasonal plays/.test(haystack)) return "Long-Term";
  return "Revenue";
}

export function buildCollaborationRecommendationGroups(
  actions: Array<{ id: string; group: CollaborationExecutiveGroup }>,
) {
  return {
    critical: actions.filter((item) => item.group === "Critical").map((item) => item.id),
    revenue: actions.filter((item) => item.group === "Revenue").map((item) => item.id),
    growth: actions.filter((item) => item.group === "Growth").map((item) => item.id),
    inventory: actions.filter((item) => item.group === "Inventory").map((item) => item.id),
    conversion: actions.filter((item) => item.group === "Conversion").map((item) => item.id),
    marketing: actions.filter((item) => item.group === "Marketing").map((item) => item.id),
    seo: actions.filter((item) => item.group === "SEO").map((item) => item.id),
    storeHealth: actions.filter((item) => item.group === "Store Health").map((item) => item.id),
    quickWins: actions.filter((item) => item.group === "Quick Wins").map((item) => item.id),
    longTerm: actions.filter((item) => item.group === "Long-Term").map((item) => item.id),
  };
}
