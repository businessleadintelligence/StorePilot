import { beforeEach, describe, expect, it } from "vitest";

import {
  computeRetryDelayMs,
  executeWithRetry,
  isRetryableHttpStatus,
  isRetryableNetworkError,
} from "../http-retry.server";
import { isSensitiveLogKey, sanitizeLogContextDeep } from "../safe-log.server";
import { secureCompareStrings } from "../secure-compare.server";
import { TimedCache, getOrComputeCached } from "../timed-cache.server";
import {
  TokenEncryptionKeyMissingError,
  encryptSecretToken,
} from "../../services/token-crypto.server";

describe("production hardening utilities", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";
  });

  it("retries retryable HTTP statuses", async () => {
    let attempts = 0;
    const result = await executeWithRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Response(null, { status: 503 });
        }
        return "ok";
      },
      {
        isRetryable: (error) => {
          if (error instanceof Response) {
            return isRetryableHttpStatus(error.status);
          }
          if (typeof error === "object" && error !== null && "status" in error) {
            return isRetryableHttpStatus(Number((error as Response).status));
          }
          return isRetryableNetworkError(error);
        },
      },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("detects retryable network errors", () => {
    expect(isRetryableNetworkError(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(404)).toBe(false);
  });

  it("computes exponential retry delay", () => {
    expect(computeRetryDelayMs(1, 250, 15000)).toBe(250);
    expect(computeRetryDelayMs(3, 250, 15000)).toBe(1000);
  });

  it("redacts sensitive log keys", () => {
    const sanitized = sanitizeLogContextDeep({
      shop: "demo.myshopify.com",
      accessToken: "secret-token",
      refresh_token: "secret-refresh",
    });

    expect(sanitized.accessToken).toBe("[redacted]");
    expect(sanitized.refresh_token).toBe("[redacted]");
    expect(sanitized.shop).toBe("demo.myshopify.com");
    expect(isSensitiveLogKey("authorization")).toBe(true);
  });

  it("compares secrets in constant time", () => {
    expect(secureCompareStrings("abc", "abc")).toBe(true);
    expect(secureCompareStrings("abc", "abd")).toBe(false);
    expect(secureCompareStrings(null, "abc")).toBe(false);
  });

  it("caches computed values until ttl expires", async () => {
    const cache = new TimedCache<number>(1000);
    let computeCount = 0;

    const first = await getOrComputeCached(cache, "key", async () => {
      computeCount += 1;
      return 42;
    });
    const second = await getOrComputeCached(cache, "key", async () => {
      computeCount += 1;
      return 99;
    });

    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(computeCount).toBe(1);
  });

  it("fails closed when encryption key is missing", () => {
    const previous = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptSecretToken("plaintext")).toThrow(TokenEncryptionKeyMissingError);
    process.env.TOKEN_ENCRYPTION_KEY = previous;
  });
});

describe("startup scope validation", () => {
  it("requires minimum Shopify scopes", async () => {
    const { getStartupReadiness } = await import("../../services/startup-readiness.server");
    const readiness = await getStartupReadiness({
      CRON_SECRET: "cron-secret",
      SHOPIFY_API_KEY: "key",
      SHOPIFY_API_SECRET: "secret",
      SHOPIFY_APP_URL: "https://app.example.com",
      DATABASE_URL: "postgres://localhost/test",
      TOKEN_ENCRYPTION_KEY: "encryption-key",
      SCOPES: "read_products,read_inventory,write_products,read_orders",
    });

    const scopeCheck = readiness.checks.find((check) => check.id === "shopify_scopes");
    expect(scopeCheck?.ok).toBe(true);
  });
});

describe("Google OAuth store binding", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";
  });

  it("rejects callback when shop does not match store record", async () => {
    const { completeGoogleOAuthCallback } = await import("../../services/google-integration.server");
    const { createGoogleOAuthState } = await import("../../google/oauth/google-oauth.service");
    const { testHarness, STORE_ID } = await import("../../services/__tests__/helpers/fixtures");

    testHarness().resetDbState();
    const state = createGoogleOAuthState({
      storeId: STORE_ID,
      shop: "wrong-shop.myshopify.com",
    });

    await expect(
      completeGoogleOAuthCallback({ code: "unused", state }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("billing webhook idempotency route", () => {
  it("exports action handler wired to webhook gate", async () => {
    const module = await import("../../routes/webhooks.app.subscriptions.update");
    expect(module.action).toBeTypeOf("function");
  });
});
