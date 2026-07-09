import { secureCompareStrings } from "../lib/secure-compare.server";

export type CronAuthorizationResult = {
  authorized: boolean;
  reason?: string;
};

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token || null;
}

export function isAuthorizedCronRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): CronAuthorizationResult {
  const cronSecret = env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return { authorized: false, reason: "CRON_SECRET_missing" };
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (secureCompareStrings(headerSecret, cronSecret)) {
    return { authorized: true };
  }

  const bearerSecret = readBearerToken(request);
  if (secureCompareStrings(bearerSecret, cronSecret)) {
    return { authorized: true };
  }

  return { authorized: false, reason: "invalid_cron_secret" };
}
