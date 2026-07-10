import { QUICK_WIN_DEFINITIONS } from "../shared/constants";

export function getSeoWinTypes() {
  return QUICK_WIN_DEFINITIONS.filter((definition) => definition.category === "seo");
}
