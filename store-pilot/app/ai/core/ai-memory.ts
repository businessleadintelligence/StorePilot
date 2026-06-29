export type MemoryScope = "store" | "recommendation" | "task" | "merchant_preference";

export type MemoryRecord<TPayload = Record<string, unknown>> = {
  id: string;
  scope: MemoryScope;
  storeId: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};

export type MemoryQuery = {
  storeId: string;
  scope: MemoryScope;
  limit?: number;
};

export interface StoreMemory {
  readonly scope: "store";
  get(query: MemoryQuery): Promise<MemoryRecord[]>;
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord>;
  delete(id: string): Promise<void>;
}

export interface RecommendationMemory {
  readonly scope: "recommendation";
  get(query: MemoryQuery): Promise<MemoryRecord[]>;
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord>;
  delete(id: string): Promise<void>;
}

export interface TaskMemory {
  readonly scope: "task";
  get(query: MemoryQuery): Promise<MemoryRecord[]>;
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord>;
  delete(id: string): Promise<void>;
}

export interface MerchantPreferenceMemory {
  readonly scope: "merchant_preference";
  get(query: MemoryQuery): Promise<MemoryRecord[]>;
  put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord>;
  delete(id: string): Promise<void>;
}

export type AIMemoryRegistry = {
  store: StoreMemory;
  recommendation: RecommendationMemory;
  task: TaskMemory;
  merchantPreference: MerchantPreferenceMemory;
};

export class InMemoryAIMemoryRegistry implements AIMemoryRegistry {
  readonly store: StoreMemory;
  readonly recommendation: RecommendationMemory;
  readonly task: TaskMemory;
  readonly merchantPreference: MerchantPreferenceMemory;

  constructor() {
    this.store = createNoOpMemory("store") as StoreMemory;
    this.recommendation = createNoOpMemory("recommendation") as RecommendationMemory;
    this.task = createNoOpMemory("task") as TaskMemory;
    this.merchantPreference = createNoOpMemory(
      "merchant_preference",
    ) as MerchantPreferenceMemory;
  }
}

function createNoOpMemory<TScope extends MemoryScope>(scope: TScope) {
  return {
    scope,
    async get(): Promise<MemoryRecord[]> {
      return [];
    },
    async put(record: Omit<MemoryRecord, "createdAt" | "updatedAt">): Promise<MemoryRecord> {
      const now = new Date().toISOString();
      return {
        ...record,
        scope,
        createdAt: now,
        updatedAt: now,
      };
    },
    async delete(): Promise<void> {
      return;
    },
  };
}
