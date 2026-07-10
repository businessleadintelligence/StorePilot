import { scheduleIncrementalGraphUpdate } from "../knowledge/graph/scheduler/graph-scheduler";

const TOPIC_ENTITY_MAP: Record<string, { entityType: string; extractEntityId: (payload: Record<string, unknown>) => string | null }> = {
  "products/update": {
    entityType: "Product",
    extractEntityId: (payload) => extractNumericId(payload.id),
  },
  "products/create": {
    entityType: "Product",
    extractEntityId: (payload) => extractNumericId(payload.id),
  },
  "inventory_levels/update": {
    entityType: "Variant",
    extractEntityId: (payload) => extractNumericId(payload.variant_id ?? payload.inventory_item_id),
  },
  "orders/create": {
    entityType: "Order",
    extractEntityId: (payload) => extractNumericId(payload.id),
  },
  "orders/updated": {
    entityType: "Order",
    extractEntityId: (payload) => extractNumericId(payload.id),
  },
};

export async function scheduleGraphUpdateFromWebhook(input: {
  storeId: string;
  topic: string;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  const mapping = TOPIC_ENTITY_MAP[input.topic];
  if (!mapping) {
    return null;
  }
  const entityId = mapping.extractEntityId(input.payload);
  if (!entityId) {
    return null;
  }
  return scheduleIncrementalGraphUpdate({
    storeId: input.storeId,
    entityType: mapping.entityType,
    entityId,
    topic: input.topic,
  });
}

function extractNumericId(value: unknown): string | null {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    const parts = value.split("/");
    return parts.at(-1) ?? value;
  }
  return null;
}
