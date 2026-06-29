import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { GoogleApiError } from "../google/shared/google-api-error";
import { completeGoogleOAuthCallback } from "../services/google-integration.server";

function buildSettingsRedirect(shop: string, params: Record<string, string> = {}): Response {
  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  const apiKey = process.env.SHOPIFY_API_KEY?.trim();

  if (!appUrl || !apiKey) {
    throw new Response("Google OAuth callback is not configured", { status: 500 });
  }

  const search = new URLSearchParams(params);
  const query = search.toString();
  const settingsPath = query ? `/app/settings?${query}` : "/app/settings";

  return redirect(`https://${shop}/admin/apps/${apiKey}${settingsPath}`);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return new Response("Google OAuth authorization was declined", { status: 400 });
  }

  if (!code || !state) {
    return new Response("Missing Google OAuth parameters", { status: 400 });
  }

  try {
    const result = await completeGoogleOAuthCallback({ code, state });

    return buildSettingsRedirect(result.shop, {
      googleSetup: result.properties.length > 0 ? "select-property" : "connected",
    });
  } catch (error) {
    const message =
      error instanceof GoogleApiError
        ? error.code
        : error instanceof Error
          ? error.message
          : "google_oauth_failed";

    if (error instanceof GoogleApiError && error.code === "invalid_response") {
      return new Response(message, { status: 400 });
    }

    return new Response(message, { status: 400 });
  }
};
