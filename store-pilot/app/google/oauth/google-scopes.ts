export const GOOGLE_ANALYTICS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

export const GOOGLE_OPENID_SCOPE = "openid";

export const GOOGLE_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export const GOOGLE_OAUTH_SCOPES = [
  GOOGLE_OPENID_SCOPE,
  GOOGLE_EMAIL_SCOPE,
  GOOGLE_ANALYTICS_READONLY_SCOPE,
] as const;

export const GOOGLE_SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

export const GOOGLE_PAGESPEED_SCOPE = "openid";

export function getGoogleIntegrationOAuthScopes(): string[] {
  return [...GOOGLE_OAUTH_SCOPES, GOOGLE_SEARCH_CONSOLE_SCOPE];
}

export function getGoogleOAuthScopesForAnalytics(): string[] {
  return getGoogleIntegrationOAuthScopes();
}

export function scopesIncludeAnalyticsReadonly(scopes: string[]): boolean {
  return scopes.includes(GOOGLE_ANALYTICS_READONLY_SCOPE);
}
