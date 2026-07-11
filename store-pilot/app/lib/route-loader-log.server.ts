type RouteLoaderLogContext = {
  route: string;
  function: string;
  shop?: string | null;
  storeId?: string;
  requestId?: string | null;
  operation: string;
  reason?: string;
  stack?: string;
};

export function getRequestLogContext(request: Request): {
  route: string;
  requestId: string | null;
} {
  return {
    route: new URL(request.url).pathname,
    requestId:
      request.headers.get("x-vercel-id") ??
      request.headers.get("x-request-id") ??
      null,
  };
}

export function logRouteLoader(
  level: "info" | "error",
  message: string,
  context: RouteLoaderLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[route-loader]", payload);
    return;
  }

  console.info("[route-loader]", payload);
}

export function deferIntelligenceSection<T>(
  section: string,
  context: {
    shop: string | null;
    storeId: string;
    route: string;
    requestId: string | null;
  },
  load: () => Promise<T>,
): Promise<T | null> {
  return load().catch((error: unknown) => {
    logRouteLoader("error", "Deferred intelligence section failed", {
      route: context.route,
      function: section,
      shop: context.shop,
      storeId: context.storeId,
      requestId: context.requestId,
      operation: "intelligence_deferred_failed",
      reason: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  });
}

export type LoaderTimingCategory =
  | "auth"
  | "store"
  | "billing"
  | "database"
  | "api"
  | "cache"
  | "render"
  | "total";

export async function timeLoaderSection<T>(
  section: string,
  context: {
    route: string;
    shop?: string | null;
    storeId?: string;
    requestId?: string | null;
    category?: LoaderTimingCategory;
  },
  load: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await load();
  } finally {
    logRouteLoader("info", "Loader section timing", {
      route: context.route,
      function: section,
      shop: context.shop ?? null,
      storeId: context.storeId,
      requestId: context.requestId ?? null,
      operation: "loader_section_timing",
      reason: `${Date.now() - startedAt}ms`,
      stack: context.category,
    });
  }
}
