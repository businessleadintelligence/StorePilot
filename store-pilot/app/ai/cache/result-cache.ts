export type CacheLookupInput = {
  storeId: string;
  agentId: string;
  subjectKey: string;
  inputFingerprint: string;
  force?: boolean;
};

export type CacheLookupResult<T = unknown> = {
  hit: boolean;
  result: T | null;
  resultId: string | null;
  runId: string | null;
};

export interface ResultCacheRepository {
  lookup<T = unknown>(input: CacheLookupInput): Promise<CacheLookupResult<T>>;
  store(input: {
    storeId: string;
    agentId: string;
    subjectKey: string;
    inputFingerprint: string;
    resultId: string;
    validUntil?: Date | null;
  }): Promise<void>;
}

export class ResultCacheService {
  constructor(private readonly repository: ResultCacheRepository) {}

  async lookup<T = unknown>(input: CacheLookupInput): Promise<CacheLookupResult<T>> {
    if (input.force) {
      return { hit: false, result: null, resultId: null, runId: null };
    }

    return this.repository.lookup<T>(input);
  }

  async remember(input: {
    storeId: string;
    agentId: string;
    subjectKey: string;
    inputFingerprint: string;
    resultId: string;
    validUntil?: Date | null;
  }): Promise<void> {
    await this.repository.store(input);
  }
}
