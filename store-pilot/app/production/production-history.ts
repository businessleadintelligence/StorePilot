import type { ProductionHealthSnapshot } from "./production-types";

const history = new Map<string, ProductionHealthSnapshot[]>();

export function appendProductionHistory(snapshot: ProductionHealthSnapshot): void {
  const entries = history.get(snapshot.storeId) ?? [];
  entries.unshift(snapshot);
  history.set(snapshot.storeId, entries.slice(0, 50));
}

export function listProductionHistory(storeId: string, limit = 10): ProductionHealthSnapshot[] {
  return (history.get(storeId) ?? []).slice(0, limit);
}

export function clearProductionHistory(storeId?: string): void {
  if (storeId) {
    history.delete(storeId);
    return;
  }
  history.clear();
}
