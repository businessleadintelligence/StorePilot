/**
 * React Router client navigations fetch route data from `*.data` endpoints.
 * Full document loads (embedded app first paint) use the HTML route path.
 */
export function isReactRouterDataRequest(request: Request): boolean {
  return new URL(request.url).pathname.endsWith(".data");
}
