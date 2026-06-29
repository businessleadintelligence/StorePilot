import {
  DEFAULT_HTTP_RETRY_ATTEMPTS,
  executeWithRetry,
  isRetryableHttpStatus,
  isRetryableNetworkError,
  sleep,
} from "../lib/http-retry.server";

export type ShopifyGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const RETRY_DELAYS_MS = [500, 1500, 3000];

export async function shopifyGraphqlWithRetry(
  admin: ShopifyGraphqlClient,
  query: string,
  variables: Record<string, unknown>,
): Promise<Response> {
  return executeWithRetry(
    async () => {
      const response = await admin.graphql(query, { variables });
      if (isRetryableHttpStatus(response.status)) {
        throw response;
      }
      return response;
    },
    {
      maxAttempts: DEFAULT_HTTP_RETRY_ATTEMPTS,
      isRetryable: (error) => {
        if (error instanceof Response) {
          return isRetryableHttpStatus(error.status);
        }
        return isRetryableNetworkError(error);
      },
      onRetry: async ({ attempt }) => {
        await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 2000);
      },
    },
  );
}
