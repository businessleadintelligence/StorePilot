export type RollbackMetadata = {
  oldTags?: string[];
  oldProductType?: string | null;
  oldSeoTitle?: string | null;
  oldSeoDescription?: string | null;
  oldStatus?: string | null;
  oldPrice?: string | null;
  oldCompareAtPrice?: string | null;
  oldCollectionMembership?: {
    collectionId: string;
    action: "add" | "remove";
  } | null;
  manualRollbackRequired: true;
};

export function buildRollbackMetadata(input: {
  mutationType: string;
  oldValues: Record<string, unknown>;
}): RollbackMetadata {
  const metadata: RollbackMetadata = { manualRollbackRequired: true };

  if (Array.isArray(input.oldValues.tags)) {
    metadata.oldTags = input.oldValues.tags.map(String);
  }
  if (typeof input.oldValues.productType === "string" || input.oldValues.productType === null) {
    metadata.oldProductType = input.oldValues.productType as string | null;
  }
  if (typeof input.oldValues.seoTitle === "string" || input.oldValues.seoTitle === null) {
    metadata.oldSeoTitle = input.oldValues.seoTitle as string | null;
  }
  if (typeof input.oldValues.seoDescription === "string" || input.oldValues.seoDescription === null) {
    metadata.oldSeoDescription = input.oldValues.seoDescription as string | null;
  }
  if (typeof input.oldValues.status === "string" || input.oldValues.status === null) {
    metadata.oldStatus = input.oldValues.status as string | null;
  }
  if (typeof input.oldValues.price === "string" || input.oldValues.price === null) {
    metadata.oldPrice = input.oldValues.price as string | null;
  }
  if (typeof input.oldValues.compareAtPrice === "string" || input.oldValues.compareAtPrice === null) {
    metadata.oldCompareAtPrice = input.oldValues.compareAtPrice as string | null;
  }
  if (
    input.oldValues.collectionMembership &&
    typeof input.oldValues.collectionMembership === "object"
  ) {
    metadata.oldCollectionMembership = input.oldValues.collectionMembership as RollbackMetadata["oldCollectionMembership"];
  }

  void input.mutationType;
  return metadata;
}
