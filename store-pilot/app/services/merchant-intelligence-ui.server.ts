import { getMerchantIntelligenceUiData } from "../merchant-intelligence/api/merchant-intelligence-api";
import type { MerchantIntelligenceUiData } from "../merchant-intelligence/shared/types";

export type { MerchantIntelligenceUiData };

export async function getMerchantIntelligenceDashboardForUi(
  storeId: string,
): Promise<MerchantIntelligenceUiData | null> {
  return getMerchantIntelligenceUiData(storeId);
}
