import { QUICK_WIN_DEFINITIONS } from "../shared/constants";

export function getCollectionWinTypes() {
  return QUICK_WIN_DEFINITIONS.filter(
    (definition) => definition.category === "collections",
  );
}
