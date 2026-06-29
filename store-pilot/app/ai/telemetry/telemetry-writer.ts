export type TelemetryRecord = {
  runId: string;
  storeId: string;
  merchantId?: string | null;
  agentId: string;
  providerId: string;
  modelId: string;
  promptId: string;
  promptVersion: string;
  promptChecksum: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  retryCount: number;
  validationStatus: string;
  executionStatus: string;
  createdAt: string;
};

export interface TelemetryWriter {
  write(record: TelemetryRecord): Promise<void>;
}

export class ConsoleTelemetryWriter implements TelemetryWriter {
  async write(record: TelemetryRecord): Promise<void> {
    console.info("[ai-telemetry]", record);
  }
}

export function buildTelemetryRecord(input: Omit<TelemetryRecord, "createdAt">): TelemetryRecord {
  return {
    ...input,
    createdAt: new Date().toISOString(),
  };
}
