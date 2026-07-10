import { QUICK_WIN_DEFINITIONS } from "../shared/constants";

export function getPricingWinTypes() {
  return QUICK_WIN_DEFINITIONS.filter(
    (definition) => definition.category === "pricing",
  );
}
