import {
  handleRequest as vercelHandleRequest,
  streamTimeout,
} from "@vercel/react-router/entry.server";
import type { EntryContext } from "react-router";

import { addDocumentResponseHeaders } from "./shopify.server";

export { streamTimeout };

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);

  return vercelHandleRequest(
    request,
    responseStatusCode,
    responseHeaders,
    reactRouterContext,
  );
}
