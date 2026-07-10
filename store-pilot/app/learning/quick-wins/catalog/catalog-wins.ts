import { QUICK_WIN_DEFINITIONS } from "../shared/constants";

export function getCatalogWinTypes() {
  return QUICK_WIN_DEFINITIONS.filter(
    (definition) => definition.category === "catalog",
  );
}

export { detectSlowMovingProducts } from "./slow-moving";
