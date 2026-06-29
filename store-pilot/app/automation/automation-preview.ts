import type { AutomationPreview, StoreAutomation } from "./automation-types";
import type { AutomationTemplate } from "./automation-templates";

export function buildAutomationPreview(input: {
  template: AutomationTemplate;
  title: string;
  products: string[];
}): AutomationPreview {
  return {
    title: input.title,
    summary: `Preview for ${input.template.name}. No Shopify changes will be executed until merchant approval.`,
    products: input.products.length > 0 ? input.products : input.template.defaultProducts,
    expectedChanges: input.template.expectedChanges,
    estimatedTimeSavedMinutes: input.template.estimatedTimeSavedMinutes,
    noChangesExecuted: true,
  };
}

export function serializePreviewForMerchant(automation: StoreAutomation): string {
  const lines = [
    automation.preview.title,
    automation.preview.summary,
    `Products: ${automation.preview.products.join(", ") || "None"}`,
    "Expected Changes:",
    ...automation.preview.expectedChanges.map(
      (change) => `- ${change.field}: ${change.before ?? "none"} -> ${change.after}`,
    ),
    "No changes executed.",
  ];
  return lines.join("\n");
}

export function previewHasChanges(automation: StoreAutomation): boolean {
  return automation.preview.expectedChanges.length > 0;
}
