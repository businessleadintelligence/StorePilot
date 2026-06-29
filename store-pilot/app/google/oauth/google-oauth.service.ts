import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getGoogleOAuthScopesForAnalytics } from "./google-scopes";
import { GoogleApiError } from "../shared/google-api-error";
import { googleHttpRequest } from "../shared/google-http";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleOAuthState = {
  storeId: string;
  shop: string;
  nonce: string;
  issuedAt: number;
};

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type GoogleUserInfo = {
  sub: string;
  email: string;
};

export type GoogleAnalyticsPropertySummary = {
  propertyId: string;
  displayName: string;
};

const OAUTH_STATE_TTL_MS = 1000 * 60 * 15;

function resolveOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = process.env.SHOPIFY_APP_URL?.trim()?.replace(/\/$/, "");

  if (!clientId || !clientSecret || !appUrl) {
    throw new GoogleApiError({
      code: "configuration_missing",
      message: "Google OAuth is not configured",
      retryable: false,
    });
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/auth/google/callback`,
  };
}

function resolveStateSecret(): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY?.trim() || process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) {
    throw new GoogleApiError({
      code: "configuration_missing",
      message: "OAuth state signing secret is not configured",
      retryable: false,
    });
  }

  return secret;
}

export function createGoogleOAuthState(input: {
  storeId: string;
  shop: string;
  now?: number;
}): string {
  const payload: GoogleOAuthState = {
    storeId: input.storeId,
    shop: input.shop,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: input.now ?? Date.now(),
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", resolveStateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function parseGoogleOAuthState(state: string, now = Date.now()): GoogleOAuthState {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Invalid OAuth state",
      retryable: false,
    });
  }

  const expected = createHmac("sha256", resolveStateSecret()).update(encoded).digest("base64url");
  const provided = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    provided.length !== expectedBuffer.length ||
    !timingSafeEqual(provided, expectedBuffer)
  ) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Invalid OAuth state signature",
      retryable: false,
    });
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GoogleOAuthState;

  if (now - payload.issuedAt > OAUTH_STATE_TTL_MS) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "OAuth state expired",
      retryable: false,
    });
  }

  return payload;
}

export function buildGoogleOAuthAuthorizationUrl(input: {
  storeId: string;
  shop: string;
}): string {
  const config = resolveOAuthConfig();
  const state = createGoogleOAuthState(input);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: getGoogleOAuthScopesForAnalytics().join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleOAuthCode(code: string): Promise<GoogleTokenResponse> {
  const config = resolveOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await googleHttpRequest<GoogleTokenResponse>({
    url: "https://oauth2.googleapis.com/token",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    rateLimitKey: "google-oauth-token",
  });

  if (!response.data.access_token) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Google OAuth token response missing access_token",
      retryable: false,
    });
  }

  return response.data;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await googleHttpRequest<GoogleUserInfo>({
    url: "https://www.googleapis.com/oauth2/v3/userinfo",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    rateLimitKey: "google-userinfo",
  });

  if (!response.data.sub || !response.data.email) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Google userinfo response missing account details",
      retryable: false,
    });
  }

  return response.data;
}

type AnalyticsAccountSummariesResponse = {
  accountSummaries?: Array<{
    account?: string;
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
    }>;
  }>;
};

export async function listGoogleAnalyticsProperties(
  accessToken: string,
): Promise<GoogleAnalyticsPropertySummary[]> {
  const response = await googleHttpRequest<AnalyticsAccountSummariesResponse>({
    url: "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    rateLimitKey: "google-analytics-admin",
  });

  const properties: GoogleAnalyticsPropertySummary[] = [];

  for (const account of response.data.accountSummaries ?? []) {
    for (const property of account.propertySummaries ?? []) {
      if (!property.property) continue;
      properties.push({
        propertyId: property.property.replace("properties/", ""),
        displayName: property.displayName ?? property.property,
      });
    }
  }

  return properties;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.SHOPIFY_APP_URL?.trim(),
  );
}
