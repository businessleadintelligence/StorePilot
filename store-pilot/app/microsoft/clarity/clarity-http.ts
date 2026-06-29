import {
  ClarityApiError,
  mapClarityFetchError,
  mapClarityHttpStatusToError,
} from "./clarity-api-error";

export type ClarityHttpRequest = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type ClarityHttpResponse<T> = {
  statusCode: number;
  data: T;
};

type FetchLike = typeof fetch;

let fetchImpl: FetchLike = fetch;

export function setClarityHttpFetchImplementation(next: FetchLike | null): void {
  fetchImpl = next ?? fetch;
}

export async function clarityHttpRequest<T>(request: ClarityHttpRequest): Promise<ClarityHttpResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 15_000);

  try {
    const response = await fetchImpl(request.url, {
      method: request.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...request.headers,
      },
      signal: controller.signal,
    });

    const rawBody = await response.text();
    const parsed = rawBody ? safeJsonParse(rawBody) : null;

    if (!response.ok) {
      throw mapClarityHttpStatusToError({
        statusCode: response.status,
        message: `Clarity API request failed (${response.status})`,
        body: rawBody,
      });
    }

    return {
      statusCode: response.status,
      data: parsed as T,
    };
  } catch (error) {
    if (error instanceof ClarityApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ClarityApiError({
        code: "network_failure",
        message: "Clarity API request timed out",
        retryable: true,
        cause: error,
      });
    }

    throw mapClarityFetchError(error);
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ClarityApiError({
      code: "invalid_response",
      message: "Clarity API returned invalid JSON",
      retryable: false,
    });
  }
}
