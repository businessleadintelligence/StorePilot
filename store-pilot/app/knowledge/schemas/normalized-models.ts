import { z } from "zod";

export const storePilotMoneySchema = z.object({
  amount: z.number(),
  currencyCode: z.string().min(3).max(10),
});

export const storePilotSeoSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
});

export const storePilotMediaSchema = z.object({
  id: z.string(),
  alt: z.string().nullable(),
  mediaContentType: z.string().nullable(),
});

export const storePilotCollectionSchema = z.object({
  shopifyCollectionId: z.string(),
  title: z.string(),
  productCount: z.number().int().nonnegative(),
});

export const storePilotVariantSchema = z.object({
  shopifyVariantId: z.string(),
  shopifyProductId: z.string(),
  sku: z.string().nullable(),
  price: z.number().nullable(),
  compareAtPrice: z.number().nullable(),
  cost: z.number().nullable(),
  inventoryQuantity: z.number().int().nullable(),
  inventoryTracked: z.boolean(),
  shopifyInventoryItemId: z.string().nullable(),
});

export const storePilotProductSchema = z.object({
  shopifyProductId: z.string(),
  title: z.string(),
  handle: z.string().nullable(),
  status: z.enum(["active", "archived", "draft", "unknown"]),
  productType: z.string().nullable(),
  vendor: z.string().nullable(),
  tags: z.array(z.string()),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  descriptionHtml: z.string().nullable(),
  seo: storePilotSeoSchema,
  collections: z.array(storePilotCollectionSchema),
  media: z.array(storePilotMediaSchema),
  variants: z.array(storePilotVariantSchema),
  totalInventory: z.number().int().nonnegative(),
});

export const storePilotOrderSchema = z.object({
  shopifyOrderId: z.string(),
  orderName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  processedAt: z.string(),
  cancelledAt: z.string().nullable(),
  currencyCode: z.string(),
  subtotalAmount: z.number(),
  totalPriceAmount: z.number(),
  totalRefundedAmount: z.number(),
  isTest: z.boolean(),
  isPaid: z.boolean(),
  lineItemCount: z.number().int().nonnegative(),
  variantIdsSold: z.array(z.string()),
});

export const storePilotLocationSchema = z.object({
  shopifyLocationId: z.string(),
  name: z.string(),
  active: z.boolean(),
});

export type StorePilotProduct = z.infer<typeof storePilotProductSchema>;
export type StorePilotVariant = z.infer<typeof storePilotVariantSchema>;
export type StorePilotOrder = z.infer<typeof storePilotOrderSchema>;
export type StorePilotCollection = z.infer<typeof storePilotCollectionSchema>;
export type StorePilotLocation = z.infer<typeof storePilotLocationSchema>;
