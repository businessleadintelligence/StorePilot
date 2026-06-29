import type { AutomationPreviewChange, AutomationVerificationRule } from "./automation-types";

export type AutomationTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  estimatedTimeSavedMinutes: number;
  defaultProducts: string[];
  expectedChanges: AutomationPreviewChange[];
  verificationRules: AutomationVerificationRule[];
  rollbackSteps: string[];
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "create_bundle",
    name: "Create Bundle",
    category: "Revenue",
    description: "Prepare a bundle product from selected SKUs",
    estimatedTimeSavedMinutes: 25,
    defaultProducts: ["Protein Powder", "Shaker Bottle"],
    expectedChanges: [
      { field: "Bundle Title", before: null, after: "Fitness Starter Bundle" },
      { field: "Bundle Image", before: null, after: "Generated bundle image" },
      { field: "Bundle Description", before: null, after: "Generated bundle description" },
    ],
    verificationRules: [
      { id: "bundle_exists", label: "Bundle exists", metric: "bundle_exists", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Unpublish bundle", "Restore original product listings"],
  },
  {
    id: "update_product_tags",
    name: "Update Product Tags",
    category: "SEO",
    description: "Add SEO and merchandising tags to products",
    estimatedTimeSavedMinutes: 10,
    defaultProducts: [],
    expectedChanges: [{ field: "Product Tags", before: "protein", after: "protein, fitness, bestseller" }],
    verificationRules: [
      { id: "tags_updated", label: "Tags updated", metric: "tags_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous product tags"],
  },
  {
    id: "generate_seo_metadata",
    name: "Generate SEO Metadata",
    category: "SEO",
    description: "Generate title and meta description updates",
    estimatedTimeSavedMinutes: 15,
    defaultProducts: [],
    expectedChanges: [
      { field: "Meta Title", before: "Protein Powder", after: "Premium Protein Powder | Fast Shipping" },
      { field: "Meta Description", before: null, after: "High-quality protein powder for fitness goals." },
    ],
    verificationRules: [
      { id: "seo_updated", label: "SEO updated", metric: "seo_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous SEO metadata"],
  },
  {
    id: "schedule_discount",
    name: "Schedule Discount",
    category: "Pricing",
    description: "Prepare a scheduled discount campaign",
    estimatedTimeSavedMinutes: 20,
    defaultProducts: [],
    expectedChanges: [
      { field: "Discount", before: "0%", after: "15% off" },
      { field: "Schedule", before: null, after: "Starts tomorrow 9:00 AM" },
    ],
    verificationRules: [
      { id: "discount_active", label: "Discount active", metric: "discount_active", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Disable discount", "Restore original pricing"],
  },
  {
    id: "update_product_price",
    name: "Update Product Price",
    category: "Pricing",
    description: "Prepare a product price update from pricing strategy recommendations",
    estimatedTimeSavedMinutes: 12,
    defaultProducts: [],
    expectedChanges: [
      { field: "Price", before: "$29.99", after: "$34.99" },
      { field: "Compare-at Price", before: null, after: "$39.99" },
    ],
    verificationRules: [
      { id: "price_updated", label: "Price updated", metric: "price_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous product price", "Restore previous compare-at price"],
  },
  {
    id: "remove_discount",
    name: "Remove Discount",
    category: "Pricing",
    description: "Remove a harmful or unnecessary discount from selected products",
    estimatedTimeSavedMinutes: 10,
    defaultProducts: [],
    expectedChanges: [
      { field: "Discount", before: "15% off", after: "0% off" },
      { field: "Price", before: "$25.49", after: "$29.99" },
    ],
    verificationRules: [
      { id: "discount_removed", label: "Discount removed", metric: "discount_removed", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous discount", "Restore discounted price"],
  },
  {
    id: "apply_compare_at_price",
    name: "Apply Compare-at Price",
    category: "Pricing",
    description: "Apply compare-at pricing for premium positioning or markdown campaigns",
    estimatedTimeSavedMinutes: 8,
    defaultProducts: [],
    expectedChanges: [
      { field: "Compare-at Price", before: null, after: "$49.99" },
      { field: "Price", before: "$39.99", after: "$44.99" },
    ],
    verificationRules: [
      { id: "compare_at_applied", label: "Compare-at price applied", metric: "compare_at_applied", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Remove compare-at price", "Restore previous price"],
  },
  {
    id: "adjust_bundle_price",
    name: "Adjust Bundle Price",
    category: "Pricing",
    description: "Adjust bundle pricing and savings messaging",
    estimatedTimeSavedMinutes: 15,
    defaultProducts: ["Protein Powder", "Shaker Bottle"],
    expectedChanges: [
      { field: "Bundle Price", before: "$54.99", after: "$49.99" },
      { field: "Bundle Savings", before: "5%", after: "12%" },
    ],
    verificationRules: [
      { id: "bundle_price_updated", label: "Bundle price updated", metric: "bundle_price_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous bundle price", "Restore previous savings messaging"],
  },
  {
    id: "create_collection",
    name: "Create Collection",
    category: "Merchandising",
    description: "Create a merchandised collection",
    estimatedTimeSavedMinutes: 18,
    defaultProducts: [],
    expectedChanges: [
      { field: "Collection Title", before: null, after: "Fitness Essentials" },
      { field: "Collection Products", before: null, after: "2 products assigned" },
    ],
    verificationRules: [
      { id: "collection_exists", label: "Collection exists", metric: "collection_exists", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Remove collection", "Restore previous navigation"],
  },
  {
    id: "publish_draft_product",
    name: "Publish Draft Product",
    category: "Catalog",
    description: "Publish a prepared draft product",
    estimatedTimeSavedMinutes: 8,
    defaultProducts: [],
    expectedChanges: [{ field: "Product Status", before: "draft", after: "active" }],
    verificationRules: [
      { id: "product_published", label: "Product published", metric: "product_published", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Revert product to draft"],
  },
  {
    id: "update_product_type",
    name: "Update Product Type",
    category: "Catalog",
    description: "Update product type for better merchandising",
    estimatedTimeSavedMinutes: 6,
    defaultProducts: [],
    expectedChanges: [{ field: "Product Type", before: "Supplements", after: "Fitness Nutrition" }],
    verificationRules: [
      { id: "type_updated", label: "Product type updated", metric: "type_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous product type"],
  },
  {
    id: "generate_product_description",
    name: "Generate Product Description",
    category: "Catalog",
    description: "Generate enriched product descriptions",
    estimatedTimeSavedMinutes: 12,
    defaultProducts: [],
    expectedChanges: [
      { field: "Description", before: "Short description", after: "AI-enriched product description" },
    ],
    verificationRules: [
      { id: "description_updated", label: "Description updated", metric: "description_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous product description"],
  },
  {
    id: "compress_images",
    name: "Compress Images",
    category: "Catalog",
    description: "Optimize product images for faster page loads",
    estimatedTimeSavedMinutes: 14,
    defaultProducts: [],
    expectedChanges: [
      { field: "Image Size", before: "2.4 MB", after: "420 KB optimized" },
    ],
    verificationRules: [
      { id: "images_optimized", label: "Images optimized", metric: "images_optimized", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore original image assets"],
  },
  {
    id: "move_product_between_collections",
    name: "Move Product Between Collections",
    category: "Merchandising",
    description: "Move products between collections",
    estimatedTimeSavedMinutes: 9,
    defaultProducts: [],
    expectedChanges: [
      { field: "Collection", before: "Summer Sale", after: "Fitness Essentials" },
    ],
    verificationRules: [
      { id: "collection_updated", label: "Collection updated", metric: "collection_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Move product back to original collection"],
  },
  {
    id: "archive_product",
    name: "Archive Product",
    category: "Catalog",
    description: "Archive discontinued products",
    estimatedTimeSavedMinutes: 5,
    defaultProducts: [],
    expectedChanges: [{ field: "Product Status", before: "active", after: "archived" }],
    verificationRules: [
      { id: "product_archived", label: "Product archived", metric: "product_archived", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore product to active status"],
  },
  {
    id: "unpublish_product",
    name: "Unpublish Product",
    category: "Catalog",
    description: "Unpublish a live product to draft",
    estimatedTimeSavedMinutes: 5,
    defaultProducts: [],
    expectedChanges: [{ field: "Product Status", before: "active", after: "draft" }],
    verificationRules: [
      { id: "product_unpublished", label: "Product unpublished", metric: "product_unpublished", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Republish product"],
  },
  {
    id: "homepage_hero_rotation",
    name: "Homepage Hero Rotation",
    category: "Growth",
    description: "Rotate homepage hero content for growth campaigns",
    estimatedTimeSavedMinutes: 18,
    defaultProducts: [],
    expectedChanges: [
      { field: "Hero Headline", before: "Welcome", after: "Summer Growth Collection" },
      { field: "Hero CTA", before: "Shop Now", after: "Explore Best Sellers" },
    ],
    verificationRules: [
      { id: "hero_updated", label: "Hero updated", metric: "hero_updated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous homepage hero"],
  },
  {
    id: "create_upsell_offer",
    name: "Create Upsell Offer",
    category: "Growth",
    description: "Create an upsell offer for high-velocity products",
    estimatedTimeSavedMinutes: 20,
    defaultProducts: [],
    expectedChanges: [
      { field: "Upsell Offer", before: null, after: "Add matching accessory at checkout" },
    ],
    verificationRules: [
      { id: "upsell_offer_created", label: "Upsell offer created", metric: "upsell_offer_created", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Disable upsell offer"],
  },
  {
    id: "create_cross_sell_offer",
    name: "Create Cross-sell Offer",
    category: "Growth",
    description: "Create a cross-sell offer for complementary products",
    estimatedTimeSavedMinutes: 20,
    defaultProducts: [],
    expectedChanges: [
      { field: "Cross-sell Offer", before: null, after: "Frequently bought together bundle" },
    ],
    verificationRules: [
      { id: "cross_sell_created", label: "Cross-sell offer created", metric: "cross_sell_created", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Disable cross-sell offer"],
  },
  {
    id: "feature_bundle",
    name: "Feature Bundle",
    category: "Growth",
    description: "Feature a bundle on homepage or collection pages",
    estimatedTimeSavedMinutes: 15,
    defaultProducts: ["Protein Powder", "Shaker Bottle"],
    expectedChanges: [
      { field: "Featured Bundle", before: null, after: "Fitness Starter Bundle" },
    ],
    verificationRules: [
      { id: "bundle_featured", label: "Bundle featured", metric: "bundle_featured", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Remove featured bundle placement"],
  },
  {
    id: "launch_promotion",
    name: "Launch Promotion",
    category: "Growth",
    description: "Launch a revenue growth promotion campaign",
    estimatedTimeSavedMinutes: 22,
    defaultProducts: [],
    expectedChanges: [
      { field: "Promotion", before: null, after: "10% off best sellers" },
      { field: "Schedule", before: null, after: "Starts tomorrow 9:00 AM" },
    ],
    verificationRules: [
      { id: "promotion_active", label: "Promotion active", metric: "promotion_active", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Disable promotion", "Restore original pricing"],
  },
  {
    id: "schedule_campaign",
    name: "Schedule Campaign",
    category: "Growth",
    description: "Schedule a timed growth campaign",
    estimatedTimeSavedMinutes: 18,
    defaultProducts: [],
    expectedChanges: [
      { field: "Campaign", before: null, after: "Weekend growth push" },
      { field: "Schedule", before: null, after: "Friday 8:00 AM" },
    ],
    verificationRules: [
      { id: "campaign_scheduled", label: "Campaign scheduled", metric: "campaign_scheduled", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Cancel scheduled campaign"],
  },
  {
    id: "highlight_collection",
    name: "Highlight Collection",
    category: "Growth",
    description: "Highlight a collection on homepage or navigation",
    estimatedTimeSavedMinutes: 12,
    defaultProducts: [],
    expectedChanges: [
      { field: "Featured Collection", before: null, after: "Growth Essentials" },
    ],
    verificationRules: [
      { id: "collection_highlighted", label: "Collection highlighted", metric: "collection_highlighted", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Remove collection highlight"],
  },
  {
    id: "rotate_featured_products",
    name: "Rotate Featured Products",
    category: "Growth",
    description: "Rotate featured products for merchandising freshness",
    estimatedTimeSavedMinutes: 14,
    defaultProducts: [],
    expectedChanges: [
      { field: "Featured Products", before: "3 products", after: "5 refreshed products" },
    ],
    verificationRules: [
      { id: "featured_rotated", label: "Featured products rotated", metric: "featured_rotated", target: "true", satisfied: false },
    ],
    rollbackSteps: ["Restore previous featured products"],
  },
];

export function getAutomationTemplate(templateId: string): AutomationTemplate {
  return AUTOMATION_TEMPLATES.find((template) => template.id === templateId) ?? AUTOMATION_TEMPLATES[0]!;
}

export function inferAutomationTemplateId(input: {
  title: string;
  category?: string;
  operationTemplateId?: string;
}): string {
  const haystack = `${input.title} ${input.category ?? ""} ${input.operationTemplateId ?? ""}`.toLowerCase();
  if (/homepage hero|rotate hero|hero rotation/.test(haystack)) return "homepage_hero_rotation";
  if (/upsell offer|create upsell/.test(haystack)) return "create_upsell_offer";
  if (/cross.?sell offer|create cross.?sell/.test(haystack)) return "create_cross_sell_offer";
  if (/feature bundle|featured bundle/.test(haystack)) return "feature_bundle";
  if (/launch promotion|growth promotion/.test(haystack)) return "launch_promotion";
  if (/schedule campaign|timed campaign/.test(haystack)) return "schedule_campaign";
  if (/highlight collection|feature collection/.test(haystack)) return "highlight_collection";
  if (/rotate featured|featured products/.test(haystack)) return "rotate_featured_products";
  if (/update product price|raise price|increase price|price update/.test(haystack)) return "update_product_price";
  if (/remove discount|stop discount|end discount/.test(haystack)) return "remove_discount";
  if (/compare-at|compare at|premium positioning/.test(haystack)) return "apply_compare_at_price";
  if (/adjust bundle price|bundle pricing|bundle price/.test(haystack)) return "adjust_bundle_price";
  if (/bundle|starter kit/.test(haystack) && !/bundle pric/.test(haystack)) return "create_bundle";
  if (/tag/.test(haystack)) return "update_product_tags";
  if (/seo|meta/.test(haystack)) return "generate_seo_metadata";
  if (/discount|campaign|offer|schedule discount/.test(haystack)) return "schedule_discount";
  if (/collection/.test(haystack)) return "create_collection";
  if (/publish|draft/.test(haystack)) return "publish_draft_product";
  if (/unpublish/.test(haystack)) return "unpublish_product";
  if (/archive/.test(haystack)) return "archive_product";
  if (/compress|image|optimize/.test(haystack)) return "compress_images";
  if (/description|copy/.test(haystack)) return "generate_product_description";
  if (/product type|type update/.test(haystack)) return "update_product_type";
  if (/move.*collection|between collection/.test(haystack)) return "move_product_between_collections";
  return "create_bundle";
}
