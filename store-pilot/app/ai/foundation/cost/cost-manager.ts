import type { FoundationModelTier, FoundationProviderId } from "../types/foundation-types";
import { resolveTierCostRates } from "../model-router/model-config";
import { roundUsd } from "../utils/json";

export type CostLedgerEntry = {
  id: string;
  storeId: string;
  merchantId?: string;
  agentId?: string;
  feature: string;
  providerId: FoundationProviderId;
  modelId: string;
  modelTier: FoundationModelTier;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  success: boolean;
  createdAt: string;
};

export type MerchantSpendSnapshot = {
  storeId: string;
  dailySpendUsd: number;
  monthlySpendUsd: number;
  monthlyBudgetUsd: number;
  budgetPercentUsed: number;
};

export type CostManagerOptions = {
  monthlyBudgetUsd?: number;
  ledger?: CostLedgerStore;
};

export interface CostLedgerStore {
  append(entry: CostLedgerEntry): Promise<void> | void;
  getMerchantSnapshot(storeId: string): Promise<MerchantSpendSnapshot> | MerchantSpendSnapshot;
}

export class InMemoryCostLedger implements CostLedgerStore {
  private readonly entries: CostLedgerEntry[] = [];

  append(entry: CostLedgerEntry): void {
    this.entries.push(entry);
  }

  getMerchantSnapshot(storeId: string): MerchantSpendSnapshot {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const storeEntries = this.entries.filter((entry) => entry.storeId === storeId);
    const monthlySpendUsd = sumCost(
      storeEntries.filter((entry) => new Date(entry.createdAt) >= monthStart),
    );
    const dailySpendUsd = sumCost(
      storeEntries.filter((entry) => new Date(entry.createdAt) >= dayStart),
    );

    const monthlyBudgetUsd = 100;
    return {
      storeId,
      dailySpendUsd,
      monthlySpendUsd,
      monthlyBudgetUsd,
      budgetPercentUsed: monthlyBudgetUsd
        ? Math.min(100, (monthlySpendUsd / monthlyBudgetUsd) * 100)
        : 0,
    };
  }

  all(): CostLedgerEntry[] {
    return [...this.entries];
  }
}

export class CostManager {
  constructor(private readonly options: CostManagerOptions = {}) {}

  private get ledger(): CostLedgerStore {
    return this.options.ledger ?? defaultLedger;
  }

  estimateCost(input: {
    tier: FoundationModelTier;
    promptTokens: number;
    completionTokens: number;
    env?: NodeJS.ProcessEnv;
  }): number {
    const rates = resolveTierCostRates(input.tier, input.env);
    return roundUsd(
      (input.promptTokens / 1000) * rates.promptUsdPer1k +
        (input.completionTokens / 1000) * rates.completionUsdPer1k,
    );
  }

  async record(input: Omit<CostLedgerEntry, "id" | "createdAt">): Promise<CostLedgerEntry> {
    const entry: CostLedgerEntry = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await this.ledger.append(entry);
    return entry;
  }

  async getMerchantSnapshot(storeId: string): Promise<MerchantSpendSnapshot> {
    return this.ledger.getMerchantSnapshot(storeId);
  }
}

const defaultLedger = new InMemoryCostLedger();

export function createCostManager(options?: CostManagerOptions): CostManager {
  return new CostManager(options);
}

function sumCost(entries: CostLedgerEntry[]): number {
  return roundUsd(entries.reduce((total, entry) => total + entry.estimatedCostUsd, 0));
}
