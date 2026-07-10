import { QUICK_WIN_DEFINITIONS } from "../shared/constants";

export function getInventoryWinTypes() {
  return QUICK_WIN_DEFINITIONS.filter(
    (definition) => definition.category === "inventory",
  );
}
