import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";

import { OperationsCenter } from "../components/operations/OperationsCenter";
import prisma from "../db.server";
import {
  approveOperation,
  archiveOperation,
  completeOperation,
  getOperationsCenterData,
  listOperations,
  pauseOperation,
  serializeOperationsCenterForLoader,
  startOperation,
  verifyOperation,
} from "../services/operations.server";
import { createInMemoryOperationsPersistence } from "../operations/operations-persistence";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const persistence = createInMemoryOperationsPersistence();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return { operationsCenter: null };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return { operationsCenter: null };
  }

  const operationsCenter = serializeOperationsCenterForLoader(
    await getOperationsCenterData({
      storeId: store.id,
      persistence,
      syncFromCollaboration: false,
    }),
  );

  return { operationsCenter };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return Response.json({ ok: false, error: "missing_shop" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return Response.json({ ok: false, error: "missing_store" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const operationId = String(formData.get("operationId") ?? "");

  if (!operationId) {
    return Response.json({ ok: false, error: "missing_operation" }, { status: 400 });
  }

  const base = { storeId: store.id, operationId, persistence };

  switch (intent) {
    case "approve":
      await approveOperation(base);
      break;
    case "start":
      await startOperation(base);
      break;
    case "pause":
      await pauseOperation(base);
      break;
    case "complete":
      await completeOperation(base);
      break;
    case "verify":
      await verifyOperation(base);
      break;
    case "archive":
      await archiveOperation(base);
      break;
    case "list":
      return Response.json({ ok: true, operations: await listOperations({ storeId: store.id, persistence }) });
    default:
      return Response.json({ ok: false, error: "unsupported_intent" }, { status: 400 });
  }

  return Response.json({ ok: true });
};

export default function OperationsRoute() {
  const { operationsCenter } = useLoaderData<typeof loader>();

  if (!operationsCenter) {
    return (
      <s-page heading="AI Operations Center">
        <s-section>
          <s-paragraph>Store data is not available yet.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  return <OperationsCenter data={operationsCenter} />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
