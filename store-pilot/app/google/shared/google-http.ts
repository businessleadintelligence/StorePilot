import { GoogleApiError, mapGoogleFetchError, mapGoogleHttpStatusToError } from "./google-api-error";
import { assertGoogleRateLimit } from "./google-rate-limit";

export type GoogleHttpRequest = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  rateLimitKey?: string;
  timeoutMs?: number;
};

export type GoogleHttpResponse<T> = {
  statusCode: number;
  data: T;
};

type FetchLike = typeof fetch;

let fetchImpl: FetchLike = fetch;

export function setGoogleHttpFetchImplementation(next: FetchLike | null): void {
  fetchImpl = next ?? fetch;
}

export async function googleHttpRequest<T>(request: GoogleHttpRequest): Promise<GoogleHttpResponse<T>> {
  if (request.rateLimitKey) {
    assertGoogleRateLimit(request.rateLimitKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 15_000);

  try {
    const response = await fetchImpl(request.url, {
      method: request.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(request.body ? { "Content-Type": "application/json" } : {}),
        ...request.headers,
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: controller.signal,
    });

    const rawBody = await response.text();
    const parsed = rawBody ? safeJsonParse(rawBody) : null;

    if (!response.ok) {
      throw mapGoogleHttpStatusToError({
        statusCode: response.status,
        message: `Google API request failed (${response.status})`,
        body: rawBody,
      });
    }

    return {
      statusCode: response.status,
      data: parsed as T,
    };
  } catch (error) {
    if (error instanceof GoogleApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new GoogleApiError({
        code: "network_failure",
        message: "Google API request timed out",
        retryable: true,
        cause: error,
      });
    }

    throw mapGoogleFetchError(error);
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Google API returned invalid JSON",
      retryable: false,
    });
  }
}
