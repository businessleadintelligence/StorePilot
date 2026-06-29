import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";

import { AutomationCenter } from "../components/automation/AutomationCenter";
import prisma from "../db.server";
import {
  approveAutomation,
  archiveAutomation,
  cancelAutomation,
  executeAutomation,
  getAutomationCenterData,
  listAutomations,
  previewAutomation,
  rejectAutomation,
  requestAutomationChanges,
  serializeAutomationCenterForLoader,
  verifyAutomation,
} from "../services/automation.server";
import { createInMemoryAutomationPersistence } from "../automation/automation-persistence";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const persistence = createInMemoryAutomationPersistence();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return { automationCenter: null };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return { automationCenter: null };
  }

  const automationCenter = serializeAutomationCenterForLoader(
    await getAutomationCenterData({
      storeId: store.id,
      persistence,
      syncFromOperations: false,
    }),
  );

  return { automationCenter };
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
  const automationId = String(formData.get("automationId") ?? "");

  if (!automationId && intent !== "list") {
    return Response.json({ ok: false, error: "missing_automation" }, { status: 400 });
  }

  const base = { storeId: store.id, automationId, persistence };

  switch (intent) {
    case "approve":
      await approveAutomation(base);
      break;
    case "reject":
      await rejectAutomation({ ...base, note: String(formData.get("note") ?? "Rejected") });
      break;
    case "request_changes":
      await requestAutomationChanges({
        ...base,
        note: String(formData.get("note") ?? "Changes requested"),
      });
      break;
    case "preview":
      return Response.json({ ok: true, preview: await previewAutomation(base) });
    case "execute":
      await executeAutomation(base);
      break;
    case "verify":
      await verifyAutomation(base);
      break;
    case "archive":
      await archiveAutomation(base);
      break;
    case "cancel":
      await cancelAutomation(base);
      break;
    case "list":
      return Response.json({ ok: true, automations: await listAutomations({ storeId: store.id, persistence }) });
    default:
      return Response.json({ ok: false, error: "unsupported_intent" }, { status: 400 });
  }

  return Response.json({ ok: true });
};

export default function AutomationRoute() {
  const { automationCenter } = useLoaderData<typeof loader>();

  if (!automationCenter) {
    return (
      <s-page heading="AI Automation Center">
        <s-section>
          <s-paragraph>Store data is not available yet.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  return <AutomationCenter data={automationCenter} />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
