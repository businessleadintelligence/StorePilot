import type { TrendDirection } from "../tools/trend-detection-tool";

export type TrendSearchSignal = {
  keyword: string;
  interestScore: number;
  direction: TrendDirection;
};

export type TrendProviderSnapshot = {
  provider: string;
  available: boolean;
  signals: TrendSearchSignal[];
};

export interface TrendProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  getTrendSignals(input: { storeId: string; keywords: string[] }): Promise<TrendProviderSnapshot>;
}

export interface SearchTrendProvider extends TrendProvider {
  readonly id: "google_trends" | "google_search_console" | "merchant_search";
}

export interface MarketTrendProvider extends TrendProvider {
  readonly id: "ga4" | "market_index";
}

export type TrendProviderRegistry = {
  listProviders(): TrendProvider[];
  getAvailableProviders(): Promise<TrendProvider[]>;
};

export function createEmptyTrendProviderRegistry(): TrendProviderRegistry {
  return {
    listProviders: () => [],
    getAvailableProviders: async () => [],
  };
}
