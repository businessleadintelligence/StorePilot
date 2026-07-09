import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { FounderOperationsDashboard } from "../components/FounderOperationsDashboard";
import { getFounderOperationsSnapshot } from "../services/founder-ops.server";

function productionNotFoundResponse(): Response {
  return new Response(null, { status: 404, statusText: "Not Found" });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (process.env.NODE_ENV === "production") {
    throw productionNotFoundResponse();
  }

  if (request.method !== "GET") {
    throw new Response(null, { status: 405, statusText: "Method Not Allowed" });
  }

  const snapshot = await getFounderOperationsSnapshot();

  return { snapshot };
};

export default function FounderOperationsRoute() {
  const { snapshot } = useLoaderData<typeof loader>();

  return <FounderOperationsDashboard snapshot={snapshot} />;
}
