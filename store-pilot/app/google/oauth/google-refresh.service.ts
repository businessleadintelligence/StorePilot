import { GoogleApiError } from "../shared/google-api-error";
import { googleHttpRequest } from "../shared/google-http";

export type GoogleRefreshTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleRefreshTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new GoogleApiError({
      code: "configuration_missing",
      message: "Google OAuth client credentials are not configured",
      retryable: false,
    });
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  try {
    const response = await googleHttpRequest<GoogleRefreshTokenResponse>({
      url: "https://oauth2.googleapis.com/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      rateLimitKey: "google-oauth-refresh",
    });

    if (!response.data.access_token || !response.data.expires_in) {
      throw new GoogleApiError({
        code: "invalid_response",
        message: "Google refresh response missing access token",
        retryable: false,
      });
    }

    return response.data;
  } catch (error) {
    if (error instanceof GoogleApiError && error.code === "invalid_grant") {
      throw new GoogleApiError({
        code: "revoked_consent",
        message: "Google refresh token is no longer valid",
        retryable: false,
        cause: error,
      });
    }

    throw error;
  }
}
