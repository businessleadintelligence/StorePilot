export type CoPurchasePair = {
  primaryProductId: string;
  pairedProductId: string;
  coPurchaseCount: number;
  orderCount: number;
};

export function buildCoPurchasePairs(
  orders: Array<Array<{ productId: string }>>,
): CoPurchasePair[] {
  const pairCounts = new Map<string, CoPurchasePair>();
  const primaryOrderCounts = new Map<string, number>();

  for (const items of orders) {
    const uniqueProducts = [...new Set(items.map((item) => item.productId).filter(Boolean))];
    for (const productId of uniqueProducts) {
      primaryOrderCounts.set(productId, (primaryOrderCounts.get(productId) ?? 0) + 1);
    }

    for (let index = 0; index < uniqueProducts.length; index += 1) {
      for (let inner = index + 1; inner < uniqueProducts.length; inner += 1) {
        const left = uniqueProducts[index];
        const right = uniqueProducts[inner];
        const key = [left, right].sort().join(":");
        const existing = pairCounts.get(key) ?? {
          primaryProductId: left,
          pairedProductId: right,
          coPurchaseCount: 0,
          orderCount: 0,
        };
        existing.coPurchaseCount += 1;
        existing.orderCount = Math.max(
          primaryOrderCounts.get(left) ?? 0,
          primaryOrderCounts.get(right) ?? 0,
        );
        pairCounts.set(key, existing);
      }
    }
  }

  return [...pairCounts.values()].sort((left, right) => right.coPurchaseCount - left.coPurchaseCount);
}

export function extractSharedCollectionKey(input: {
  shopifyProductId: string;
  title: string;
}): string {
  return input.shopifyProductId || input.title.split(" ")[0]?.toLowerCase() || "unknown";
}

export function extractSharedTagKeys(input: { sku: string | null; title: string }): string[] {
  if (input.sku) {
    const prefix = input.sku.split("-")[0]?.trim().toLowerCase();
    if (prefix) {
      return [prefix];
    }
  }

  return input.title
    .split(" ")
    .slice(0, 2)
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

export function extractVendorKey(input: { sku: string | null; title: string }): string {
  if (input.sku?.includes("-")) {
    return input.sku.split("-")[0]?.trim().toLowerCase() ?? "unknown";
  }

  return input.title.split(" ")[0]?.toLowerCase() ?? "unknown";
}

export function inferProductType(title: string): string {
  const normalized = title.toLowerCase();
  if (/hoodie|shirt|tee|apparel|jacket/.test(normalized)) {
    return "apparel";
  }

  if (/bundle|kit|set|pack/.test(normalized)) {
    return "bundle";
  }

  if (/supplement|protein|vitamin|powder/.test(normalized)) {
    return "supplement";
  }

  return "general";
}

export function productsShareRelationship(input: {
  left: { shopifyProductId: string; sku: string | null; title: string };
  right: { shopifyProductId: string; sku: string | null; title: string };
}): string[] {
  const reasons: string[] = [];

  if (extractSharedCollectionKey(input.left) === extractSharedCollectionKey(input.right)) {
    reasons.push("shared_collection");
  }

  const leftTags = new Set(extractSharedTagKeys(input.left));
  if (extractSharedTagKeys(input.right).some((tag) => leftTags.has(tag))) {
    reasons.push("shared_tags");
  }

  if (extractVendorKey(input.left) === extractVendorKey(input.right)) {
    reasons.push("shared_vendor");
  }

  if (inferProductType(input.left.title) === inferProductType(input.right.title)) {
    reasons.push("shared_product_type");
  }

  return reasons;
}

export function isInventoryCompatible(
  leftInventory: number | null,
  rightInventory: number | null,
): boolean {
  return (leftInventory ?? 0) > 0 && (rightInventory ?? 0) > 0;
}

export function calculateAttachRate(coPurchaseCount: number, primaryOrderCount: number): number {
  if (primaryOrderCount <= 0) {
    return 0;
  }

  return Number((coPurchaseCount / primaryOrderCount).toFixed(2));
}
