export type TagMutationAction = "add" | "remove" | "replace";

export type AutomationMutationPayload = {
  shopifyProductId?: string;
  productId?: string;
  shopifyVariantId?: string;
  shopifyCollectionId?: string;
  collectionId?: string;
  merchantId?: string;
  merchantApprovedAt?: string;
  tags?: {
    action: TagMutationAction;
    values: string[];
  };
  productType?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  publicationAction?: "publish" | "unpublish" | "draft" | "active";
  price?: string;
  compareAtPrice?: string | null;
  collectionAction?: "add" | "remove";
};

export type MutationExecutionResult = {
  mutationType: string;
  shopifyRequestId: string | null;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  appliedChanges: string[];
};

export const PRODUCTION_MUTATION_TEMPLATES = new Set([
  "update_product_tags",
  "update_product_type",
  "generate_seo_metadata",
  "publish_draft_product",
  "unpublish_product",
  "apply_compare_at_price",
  "update_product_price",
  "move_product_between_collections",
]);

export function parseAutomationMutationPayload(
  beforeState: Record<string, unknown>,
  previewChanges: Array<{ field: string; before: string | null; after: string }>,
): AutomationMutationPayload {
  const payload = (beforeState.payload ?? {}) as Record<string, unknown>;
  const parsed: AutomationMutationPayload = {
    shopifyProductId: readString(payload.shopifyProductId),
    productId: readString(payload.productId),
    shopifyVariantId: readString(payload.shopifyVariantId),
    shopifyCollectionId: readString(payload.shopifyCollectionId),
    collectionId: readString(payload.collectionId),
    merchantId: readString(payload.merchantId),
    merchantApprovedAt: readString(payload.merchantApprovedAt),
    productType: readString(payload.productType),
    seoTitle: readString(payload.seoTitle),
    seoDescription: readString(payload.seoDescription),
    price: readString(payload.price),
    compareAtPrice: payload.compareAtPrice === null ? null : readString(payload.compareAtPrice),
    collectionAction: readCollectionAction(payload.collectionAction),
    publicationAction: readPublicationAction(payload.publicationAction),
    status: readStatus(payload.status),
  };

  if (payload.tags && typeof payload.tags === "object") {
    const tagsPayload = payload.tags as Record<string, unknown>;
    const action = readTagAction(tagsPayload.action);
    const values = Array.isArray(tagsPayload.values) ? tagsPayload.values.map(String) : [];
    if (action) parsed.tags = { action, values };
  }

  for (const change of previewChanges) {
    const field = change.field.toLowerCase();
    if (field.includes("tag") && !parsed.tags) {
      parsed.tags = {
        action: "replace",
        values: change.after.split(",").map((value) => value.trim()).filter(Boolean),
      };
    }
    if (field.includes("product type") && !parsed.productType) parsed.productType = change.after;
    if (field.includes("meta title") && !parsed.seoTitle) parsed.seoTitle = change.after;
    if (field.includes("meta description") && !parsed.seoDescription) parsed.seoDescription = change.after;
    if (field.includes("price") && !field.includes("compare") && !parsed.price) parsed.price = normalizeMoney(change.after);
    if (field.includes("compare-at") && parsed.compareAtPrice === undefined) {
      parsed.compareAtPrice = normalizeMoney(change.after);
    }
    if (field.includes("product status")) {
      if (!parsed.status) parsed.status = mapStatusLabel(change.after);
      if (!parsed.publicationAction) parsed.publicationAction = mapPublicationLabel(change.after);
    }
  }

  return parsed;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readTagAction(value: unknown): TagMutationAction | undefined {
  return value === "add" || value === "remove" || value === "replace" ? value : undefined;
}

function readCollectionAction(value: unknown): "add" | "remove" | undefined {
  return value === "add" || value === "remove" ? value : undefined;
}

function readPublicationAction(value: unknown): AutomationMutationPayload["publicationAction"] {
  if (value === "publish" || value === "unpublish" || value === "draft" || value === "active") return value;
  return undefined;
}

function readStatus(value: unknown): AutomationMutationPayload["status"] {
  if (value === "ACTIVE" || value === "DRAFT" || value === "ARCHIVED") return value;
  return undefined;
}

function normalizeMoney(value: string): string {
  return value.replace(/^\$/, "").trim();
}

function mapStatusLabel(value: string): AutomationMutationPayload["status"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "active" || normalized === "published") return "ACTIVE";
  if (normalized === "draft") return "DRAFT";
  if (normalized === "archived") return "ARCHIVED";
  return undefined;
}

function mapPublicationLabel(value: string): AutomationMutationPayload["publicationAction"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "active" || normalized === "published") return "publish";
  if (normalized === "draft") return "draft";
  if (normalized === "unpublished") return "unpublish";
  return undefined;
}
