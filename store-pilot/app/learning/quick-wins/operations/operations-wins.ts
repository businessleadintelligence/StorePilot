import { QUICK_WIN_DEFINITIONS } from "../shared/constants";

export function getOperationsWinTypes() {
  return QUICK_WIN_DEFINITIONS.filter(
    (definition) => definition.category === "operations",
  );
}
