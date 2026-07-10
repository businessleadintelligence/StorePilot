import type { FoundationRequest, FoundationResponse } from "../types/foundation-types";

export type FoundationLogEntry = {
  timestamp: string;
  requestId: string;
  storeId: string;
  merchantId?: string;
  agentId?: string;
  feature: string;
  providerId?: string;
  modelId?: string;
  modelTier?: string;
  promptId: string;
  promptVersion: string;
  latencyMs: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  promptTokens: number;
  completionTokens: number;
  responseSizeBytes: number;
  retryCount: number;
  success: boolean;
  failureCode?: string;
};

export class FoundationLogger {
  private readonly entries: FoundationLogEntry[] = [];

  logRequestStart(input: {
    requestId: string;
    request: FoundationRequest;
  }): void {
    console.info("[ai-foundation]", {
      operation: "request_started",
      requestId: input.requestId,
      storeId: input.request.context.storeId,
      feature: input.request.context.feature,
      promptId: input.request.promptId,
    });
  }

  logRequestComplete(input: {
    requestId: string;
    request: FoundationRequest;
    response: FoundationResponse<unknown>;
    responseSizeBytes?: number;
  }): void {
    const entry = toLogEntry(input);
    this.entries.push(entry);
    console.info("[ai-foundation]", entry);
  }

  getEntries(): FoundationLogEntry[] {
    return [...this.entries];
  }
}

function toLogEntry(input: {
  requestId: string;
  request: FoundationRequest;
  response: FoundationResponse<unknown>;
  responseSizeBytes?: number;
}): FoundationLogEntry {
  const base = {
    timestamp: new Date().toISOString(),
    requestId: input.requestId,
    storeId: input.request.context.storeId,
    merchantId: input.request.context.merchantId,
    agentId: input.request.context.agentId,
    feature: input.request.context.feature,
    promptId: input.request.promptId,
    promptVersion: input.response.ok
      ? input.response.promptVersion
      : input.request.promptVersion ?? "unknown",
  };

  if (!input.response.ok) {
    return {
      ...base,
      latencyMs: input.response.latencyMs,
      estimatedCostUsd: 0,
      cacheHit: false,
      promptTokens: 0,
      completionTokens: 0,
      responseSizeBytes: 0,
      retryCount: input.response.retryCount,
      success: false,
      failureCode: input.response.errorCode,
    };
  }

  return {
    ...base,
    providerId: input.response.providerId,
    modelId: input.response.modelId,
    modelTier: input.response.modelTier,
    latencyMs: input.response.latencyMs,
    estimatedCostUsd: input.response.estimatedCostUsd,
    cacheHit: input.response.cache === "hit",
    promptTokens: input.response.usage.promptTokens,
    completionTokens: input.response.usage.completionTokens,
    responseSizeBytes:
      input.responseSizeBytes ??
      JSON.stringify(input.response.data).length,
    retryCount: input.response.retryCount,
    success: true,
  };
}

export function createFoundationLogger(): FoundationLogger {
  return new FoundationLogger();
}
