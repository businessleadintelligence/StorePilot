import type { FoundationLogEntry } from "../logging/foundation-logger";

export type FoundationTelemetryRecord = FoundationLogEntry & {
  downgradedTier: boolean;
  validationRetries: number;
};

export interface FoundationTelemetryWriter {
  write(record: FoundationTelemetryRecord): Promise<void> | void;
}

export class ConsoleFoundationTelemetryWriter implements FoundationTelemetryWriter {
  write(record: FoundationTelemetryRecord): void {
    console.info("[ai-foundation-telemetry]", record);
  }
}

export class CompositeFoundationTelemetryWriter implements FoundationTelemetryWriter {
  constructor(private readonly writers: FoundationTelemetryWriter[]) {}

  async write(record: FoundationTelemetryRecord): Promise<void> {
    await Promise.all(this.writers.map((writer) => writer.write(record)));
  }
}

export function createDefaultTelemetryWriter(): FoundationTelemetryWriter {
  return new ConsoleFoundationTelemetryWriter();
}
