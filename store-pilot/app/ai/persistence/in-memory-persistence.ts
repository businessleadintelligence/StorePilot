import type {
  AgentResultRecord,
  AgentRunRecord,
  AIPersistenceRepositories,
  MemoryRecordData,
  PromptVersionRecord,
  RecommendationRecord,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryAIPersistence implements AIPersistenceRepositories {
  readonly runs = {
    records: new Map<string, AgentRunRecord>(),
    create: async (
      input: Omit<AgentRunRecord, "createdAt" | "startedAt"> & Partial<Pick<AgentRunRecord, "startedAt">>,
    ): Promise<AgentRunRecord> => {
      const created: AgentRunRecord = {
        ...input,
        startedAt: input.startedAt ?? nowIso(),
        createdAt: nowIso(),
      };
      this.runs.records.set(created.id, created);
      return created;
    },
    update: async (id: string, patch: Partial<AgentRunRecord>): Promise<AgentRunRecord> => {
      const current = this.runs.records.get(id);
      if (!current) {
        throw new Error(`run_not_found:${id}`);
      }
      const updated = { ...current, ...patch };
      this.runs.records.set(id, updated);
      return updated;
    },
    findById: async (id: string): Promise<AgentRunRecord | null> => {
      return this.runs.records.get(id) ?? null;
    },
  };

  readonly results = {
    records: new Map<string, AgentResultRecord>(),
    create: async (input: Omit<AgentResultRecord, "createdAt">): Promise<AgentResultRecord> => {
      const created: AgentResultRecord = {
        ...input,
        createdAt: nowIso(),
      };
      this.results.records.set(created.id, created);
      return created;
    },
    findLatestSuccess: async (input: {
      storeId: string;
      agentId: string;
      inputFingerprint: string;
    }): Promise<AgentResultRecord | null> => {
      const matches = [...this.results.records.values()]
        .filter(
          (record) =>
            record.storeId === input.storeId &&
            record.agentId === input.agentId &&
            record.inputFingerprint === input.inputFingerprint &&
            record.isSuccess,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return matches[0] ?? null;
    },
  };

  readonly promptVersions = {
    records: new Map<string, PromptVersionRecord>(),
    upsert: async (
      input: Omit<PromptVersionRecord, "id" | "createdAt">,
    ): Promise<PromptVersionRecord> => {
      const key = `${input.promptId}:${input.version}`;
      const existing = [...this.promptVersions.records.values()].find(
        (record) => `${record.promptId}:${record.version}` === key,
      );
      if (existing) {
        return existing;
      }

      const created: PromptVersionRecord = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: nowIso(),
      };
      this.promptVersions.records.set(created.id, created);
      return created;
    },
    findByPrompt: async (input: {
      promptId: string;
      version: string;
    }): Promise<PromptVersionRecord | null> => {
      return (
        [...this.promptVersions.records.values()].find(
          (record) => record.promptId === input.promptId && record.version === input.version,
        ) ?? null
      );
    },
  };

  readonly recommendations = {
    records: new Map<string, RecommendationRecord>(),
    upsertMany: async (
      input: Array<
        Omit<
          RecommendationRecord,
          "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt" | "statusChangedAt"
        > & { status?: string }
      >,
    ): Promise<RecommendationRecord[]> => {
      const output: RecommendationRecord[] = [];

      for (const candidate of input) {
        const key = `${candidate.storeId}:${candidate.stableId}`;
        const existing = [...this.recommendations.records.values()].find(
          (record) => `${record.storeId}:${record.stableId}` === key,
        );

        if (existing) {
          const updated: RecommendationRecord = {
            ...existing,
            runId: candidate.runId,
            summary: candidate.summary,
            priority: candidate.priority,
            confidence: candidate.confidence,
            payloadJson: candidate.payloadJson,
            lastSeenAt: nowIso(),
            updatedAt: nowIso(),
          };
          this.recommendations.records.set(updated.id, updated);
          output.push(updated);
          continue;
        }

        const created: RecommendationRecord = {
          id: crypto.randomUUID(),
          stableId: candidate.stableId,
          storeId: candidate.storeId,
          agentId: candidate.agentId,
          runId: candidate.runId,
          subjectKey: candidate.subjectKey,
          title: candidate.title,
          summary: candidate.summary,
          category: candidate.category,
          priority: candidate.priority,
          confidence: candidate.confidence,
          status: candidate.status ?? "open",
          payloadJson: candidate.payloadJson,
          firstSeenAt: nowIso(),
          lastSeenAt: nowIso(),
          statusChangedAt: nowIso(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        this.recommendations.records.set(created.id, created);
        output.push(created);
      }

      return output;
    },
    updateStatus: async (input: {
      storeId: string;
      stableId: string;
      status: string;
    }): Promise<RecommendationRecord | null> => {
      const existing = [...this.recommendations.records.values()].find(
        (record) => record.storeId === input.storeId && record.stableId === input.stableId,
      );
      if (!existing) {
        return null;
      }

      const updated: RecommendationRecord = {
        ...existing,
        status: input.status,
        statusChangedAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.recommendations.records.set(updated.id, updated);
      return updated;
    },
    listBySubject: async (input: {
      storeId: string;
      subjectKey: string;
      statuses?: string[];
    }): Promise<RecommendationRecord[]> => {
      return [...this.recommendations.records.values()].filter((record) => {
        if (record.storeId !== input.storeId || record.subjectKey !== input.subjectKey) {
          return false;
        }

        if (input.statuses && !input.statuses.includes(record.status)) {
          return false;
        }

        return true;
      });
    },
  };

  readonly memory = {
    records: new Map<string, MemoryRecordData>(),
    upsert: async (
      input: Omit<MemoryRecordData, "id" | "createdAt" | "updatedAt"> & { id?: string },
    ): Promise<MemoryRecordData> => {
      const existing = input.id ? this.memory.records.get(input.id) : undefined;
      if (existing) {
        const updated: MemoryRecordData = {
          ...existing,
          ...input,
          updatedAt: nowIso(),
        };
        this.memory.records.set(updated.id, updated);
        return updated;
      }

      const created: MemoryRecordData = {
        id: input.id ?? crypto.randomUUID(),
        storeId: input.storeId,
        scope: input.scope,
        subjectKey: input.subjectKey,
        payloadJson: input.payloadJson,
        expiresAt: input.expiresAt ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.memory.records.set(created.id, created);
      return created;
    },
    list: async (input: {
      storeId: string;
      scope: string;
      subjectKey?: string;
    }): Promise<MemoryRecordData[]> => {
      return [...this.memory.records.values()].filter((record) => {
        if (record.storeId !== input.storeId || record.scope !== input.scope) {
          return false;
        }

        if (input.subjectKey && record.subjectKey !== input.subjectKey) {
          return false;
        }

        return true;
      });
    },
  };

  readonly cache = {
    entries: new Map<string, { resultId: string; runId: string | null; validUntil?: string | null }>(),
    lookup: async (input: {
      storeId: string;
      agentId: string;
      subjectKey: string;
      inputFingerprint: string;
    }): Promise<{ result: AgentResultRecord | null; runId: string | null }> => {
      const key = `${input.storeId}:${input.agentId}:${input.subjectKey}:${input.inputFingerprint}`;
      const entry = this.cache.entries.get(key);
      if (!entry) {
        return { result: null, runId: null };
      }

      if (entry.validUntil && new Date(entry.validUntil).getTime() <= Date.now()) {
        return { result: null, runId: null };
      }

      const result = this.results.records.get(entry.resultId) ?? null;
      return { result, runId: entry.runId };
    },
    store: async (input: {
      storeId: string;
      agentId: string;
      subjectKey: string;
      inputFingerprint: string;
      resultId: string;
      validUntil?: Date | null;
    }): Promise<void> => {
      const key = `${input.storeId}:${input.agentId}:${input.subjectKey}:${input.inputFingerprint}`;
      const result = this.results.records.get(input.resultId);
      this.cache.entries.set(key, {
        resultId: input.resultId,
        runId: result?.runId ?? null,
        validUntil: input.validUntil?.toISOString() ?? null,
      });
    },
  };
}

export function createInMemoryAIPersistence(): InMemoryAIPersistence {
  return new InMemoryAIPersistence();
}
