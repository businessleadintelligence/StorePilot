import type { QuickWinUiSummary } from "../learning/quick-wins/shared/types";
import { getQuickWinsForUi } from "../learning/quick-wins/api/quick-wins-api";

export type { QuickWinUiSummary };

export async function getQuickWinsForDashboard(
  storeId: string,
  currency = "USD",
): Promise<QuickWinUiSummary | null> {
  return getQuickWinsForUi(storeId, currency);
}
