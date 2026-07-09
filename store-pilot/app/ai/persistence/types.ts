export type AgentRunRecord = {
  id: string;
  storeId: string;
  merchantId?: string | null;
  agentId: string;
  status: string;
  validationStatus?: string | null;
  subjectKey: string;
  inputFingerprint: string;
  contextJson: Record<string, unknown>;
  promptId: string;
  promptVersion: string;
  promptChecksum: string;
  promptVersionId?: string | null;
  providerId: string;
  modelId: string;
  retryCount: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
};

export type AgentResultRecord = {
  id: string;
  runId: string;
  storeId: string;
  agentId: string;
  subjectKey: string;
  inputFingerprint: string;
  resultJson: Record<string, unknown>;
  summary?: string | null;
  priority?: number | null;
  confidence?: number | null;
  isSuccess: boolean;
  expiresAt?: string | null;
  createdAt: string;
};

export type PromptVersionRecord = {
  id: string;
  promptId: string;
  version: string;
  checksum: string;
  description: string;
  expectedSchema: string;
  createdAt: string;
};

export type RecommendationRecord = {
  id: string;
  stableId: string;
  storeId: string;
  agentId: string;
  runId: string;
  subjectKey: string;
  title: string;
  summary: string;
  category: string;
  priority: number;
  confidence: number;
  status: string;
  payloadJson: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryRecordData = {
  id: string;
  storeId: string;
  scope: string;
  subjectKey: string;
  payloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
};

export interface AgentRunRepository {
  create(input: Omit<AgentRunRecord, "createdAt" | "startedAt"> & Partial<Pick<AgentRunRecord, "startedAt">>): Promise<AgentRunRecord>;
  update(id: string, patch: Partial<AgentRunRecord>): Promise<AgentRunRecord>;
  findById(id: string): Promise<AgentRunRecord | null>;
}

export interface AgentResultRepository {
  create(input: Omit<AgentResultRecord, "createdAt">): Promise<AgentResultRecord>;
  findLatestSuccess(input: {
    storeId: string;
    agentId: string;
    inputFingerprint: string;
  }): Promise<AgentResultRecord | null>;
}

export interface PromptVersionRepository {
  upsert(input: Omit<PromptVersionRecord, "id" | "createdAt">): Promise<PromptVersionRecord>;
  findByPrompt(input: { promptId: string; version: string }): Promise<PromptVersionRecord | null>;
}

export interface RecommendationRepository {
  upsertMany(input: Array<Omit<RecommendationRecord, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt" | "statusChangedAt"> & {
    status?: string;
  }>): Promise<RecommendationRecord[]>;
  updateStatus(input: {
    storeId: string;
    stableId: string;
    status: string;
  }): Promise<RecommendationRecord | null>;
  listBySubject(input: {
    storeId: string;
    subjectKey: string;
    statuses?: string[];
  }): Promise<RecommendationRecord[]>;
}

export interface MemoryRepository {
  upsert(input: Omit<MemoryRecordData, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<MemoryRecordData>;
  list(input: {
    storeId: string;
    scope: string;
    subjectKey?: string;
  }): Promise<MemoryRecordData[]>;
}

export interface ResultCacheRepository {
  lookup<_T = unknown>(input: {
    storeId: string;
    agentId: string;
    subjectKey: string;
    inputFingerprint: string;
  }): Promise<{ result: AgentResultRecord | null; runId: string | null }>;
  store(input: {
    storeId: string;
    agentId: string;
    subjectKey: string;
    inputFingerprint: string;
    resultId: string;
    validUntil?: Date | null;
  }): Promise<void>;
}

export type AIPersistenceRepositories = {
  runs: AgentRunRepository;
  results: AgentResultRepository;
  promptVersions: PromptVersionRepository;
  recommendations: RecommendationRepository;
  memory: MemoryRepository;
  cache: ResultCacheRepository;
};
