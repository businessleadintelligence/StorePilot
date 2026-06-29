import type { OperationVerificationRule, OperationTask } from "./operations-types";

export type WorkflowTemplate = {
  id: string;
  name: string;
  category: string;
  estimatedMinutes: number;
  difficulty: string;
  tasks: Array<{ title: string }>;
  checklist: string[];
  verificationRules: OperationVerificationRule[];
  completionRules: string[];
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "bundle_launch",
    name: "Bundle Launch",
    category: "Revenue",
    estimatedMinutes: 45,
    difficulty: "Medium",
    tasks: [
      { title: "Choose bundle products" },
      { title: "Create bundle offer" },
      { title: "Create bundle image" },
      { title: "Publish bundle" },
      { title: "Verify sales after 7 days" },
    ],
    checklist: ["Products selected", "Pricing set", "Creative approved", "Published"],
    verificationRules: [
      { id: "bundle_exists", label: "Bundle published", metric: "bundle_published", target: "true", satisfied: false },
      { id: "bundle_sales", label: "Bundle sales recorded", metric: "bundle_sales", target: ">0", satisfied: false },
    ],
    completionRules: ["All launch tasks complete", "Bundle visible on storefront"],
  },
  {
    id: "inventory_cleanup",
    name: "Inventory Cleanup",
    category: "Inventory",
    estimatedMinutes: 35,
    difficulty: "Medium",
    tasks: [
      { title: "Identify dead stock SKUs" },
      { title: "Create recovery offer" },
      { title: "Update inventory plan" },
      { title: "Verify inventory reduction" },
    ],
    checklist: ["SKUs reviewed", "Offer launched", "Inventory updated"],
    verificationRules: [
      { id: "inventory_reduced", label: "Inventory reduced", metric: "inventory_units", target: "decreased", satisfied: false },
      { id: "sales_recovered", label: "Sales increased", metric: "sku_sales", target: "increased", satisfied: false },
    ],
    completionRules: ["Recovery action launched", "Inventory trend improves"],
  },
  {
    id: "seo_improvement",
    name: "SEO Improvement",
    category: "SEO",
    estimatedMinutes: 30,
    difficulty: "Easy",
    tasks: [
      { title: "Audit target pages" },
      { title: "Update titles and meta descriptions" },
      { title: "Publish changes" },
      { title: "Verify search visibility" },
    ],
    checklist: ["Pages selected", "Metadata updated", "Changes published"],
    verificationRules: [
      { id: "seo_score", label: "SEO score improved", metric: "seo_score", target: "increased", satisfied: false },
    ],
    completionRules: ["Metadata updated on target pages"],
  },
  {
    id: "homepage_optimization",
    name: "Homepage Optimization",
    category: "Conversion",
    estimatedMinutes: 40,
    difficulty: "Medium",
    tasks: [
      { title: "Review homepage sections" },
      { title: "Update hero and social proof" },
      { title: "Publish homepage changes" },
      { title: "Verify conversion lift" },
    ],
    checklist: ["Hero updated", "Social proof added", "Published"],
    verificationRules: [
      { id: "conversion_lift", label: "Conversion improved", metric: "conversion_rate", target: "increased", satisfied: false },
    ],
    completionRules: ["Homepage changes published"],
  },
  {
    id: "pricing_review",
    name: "Pricing Review",
    category: "Revenue",
    estimatedMinutes: 25,
    difficulty: "Easy",
    tasks: [
      { title: "Review pricing benchmarks" },
      { title: "Adjust target prices" },
      { title: "Publish pricing updates" },
    ],
    checklist: ["Benchmarks reviewed", "Prices updated"],
    verificationRules: [
      { id: "margin_improved", label: "Margin improved", metric: "margin", target: "increased", satisfied: false },
    ],
    completionRules: ["Pricing updates published"],
  },
  {
    id: "discount_campaign",
    name: "Discount Campaign",
    category: "Marketing",
    estimatedMinutes: 30,
    difficulty: "Easy",
    tasks: [
      { title: "Define campaign offer" },
      { title: "Configure discount" },
      { title: "Launch campaign" },
      { title: "Verify campaign performance" },
    ],
    checklist: ["Offer defined", "Discount configured", "Campaign launched"],
    verificationRules: [
      { id: "campaign_sales", label: "Campaign sales recorded", metric: "campaign_sales", target: ">0", satisfied: false },
    ],
    completionRules: ["Campaign live"],
  },
  {
    id: "price_increase",
    name: "Price Increase",
    category: "Pricing",
    estimatedMinutes: 30,
    difficulty: "Medium",
    tasks: [
      { title: "Review margin and demand signals" },
      { title: "Set target price increases" },
      { title: "Publish updated prices" },
      { title: "Monitor conversion and revenue impact" },
    ],
    checklist: ["Targets reviewed", "Prices updated", "Impact monitored"],
    verificationRules: [
      { id: "margin_improved", label: "Margin improved", metric: "margin", target: "increased", satisfied: false },
      { id: "revenue_stable", label: "Revenue stable or improved", metric: "revenue", target: "stable_or_up", satisfied: false },
    ],
    completionRules: ["Price increases published", "Impact verified"],
  },
  {
    id: "price_reduction",
    name: "Price Reduction",
    category: "Pricing",
    estimatedMinutes: 25,
    difficulty: "Easy",
    tasks: [
      { title: "Identify overpriced SKUs" },
      { title: "Set revised prices" },
      { title: "Publish price reductions" },
      { title: "Verify conversion lift" },
    ],
    checklist: ["SKUs reviewed", "Prices reduced", "Conversion monitored"],
    verificationRules: [
      { id: "conversion_lift", label: "Conversion improved", metric: "conversion_rate", target: "increased", satisfied: false },
    ],
    completionRules: ["Price reductions published"],
  },
  {
    id: "markdown_campaign",
    name: "Markdown Campaign",
    category: "Pricing",
    estimatedMinutes: 35,
    difficulty: "Medium",
    tasks: [
      { title: "Select markdown candidates" },
      { title: "Define markdown schedule" },
      { title: "Launch markdown pricing" },
      { title: "Verify sell-through improvement" },
    ],
    checklist: ["Candidates selected", "Schedule defined", "Markdown live"],
    verificationRules: [
      { id: "sell_through", label: "Sell-through improved", metric: "sell_through", target: "increased", satisfied: false },
      { id: "inventory_reduced", label: "Inventory reduced", metric: "inventory_units", target: "decreased", satisfied: false },
    ],
    completionRules: ["Markdown campaign active", "Inventory trend improves"],
  },
  {
    id: "premium_positioning",
    name: "Premium Positioning",
    category: "Pricing",
    estimatedMinutes: 40,
    difficulty: "Hard",
    tasks: [
      { title: "Identify premium candidates" },
      { title: "Adjust pricing and compare-at positioning" },
      { title: "Update merchandising copy" },
      { title: "Verify margin and demand stability" },
    ],
    checklist: ["Candidates selected", "Premium pricing applied", "Copy updated"],
    verificationRules: [
      { id: "margin_improved", label: "Margin improved", metric: "margin", target: "increased", satisfied: false },
      { id: "demand_stable", label: "Demand remains stable", metric: "demand", target: "stable", satisfied: false },
    ],
    completionRules: ["Premium positioning published"],
  },
  {
    id: "bundle_pricing",
    name: "Bundle Pricing",
    category: "Pricing",
    estimatedMinutes: 35,
    difficulty: "Medium",
    tasks: [
      { title: "Review bundle pricing opportunities" },
      { title: "Set bundle price and savings" },
      { title: "Publish bundle pricing updates" },
      { title: "Verify bundle attach rate" },
    ],
    checklist: ["Bundle pricing reviewed", "Savings defined", "Pricing published"],
    verificationRules: [
      { id: "bundle_attach", label: "Bundle attach rate improved", metric: "bundle_attach_rate", target: "increased", satisfied: false },
      { id: "aov_lift", label: "AOV improved", metric: "aov", target: "increased", satisfied: false },
    ],
    completionRules: ["Bundle pricing live"],
  },
  {
    id: "discount_optimization",
    name: "Discount Optimization",
    category: "Pricing",
    estimatedMinutes: 30,
    difficulty: "Medium",
    tasks: [
      { title: "Audit discount dependence" },
      { title: "Remove or reduce harmful discounts" },
      { title: "Protect high-demand SKUs from discounting" },
      { title: "Verify profit recovery" },
    ],
    checklist: ["Discounts audited", "Harmful discounts reduced", "Profit monitored"],
    verificationRules: [
      { id: "discount_dependence", label: "Discount dependence reduced", metric: "discount_dependence", target: "decreased", satisfied: false },
      { id: "profit_improved", label: "Profit improved", metric: "gross_profit", target: "increased", satisfied: false },
    ],
    completionRules: ["Discount optimization applied"],
  },
  {
    id: "launch_upsell_campaign",
    name: "Launch Upsell Campaign",
    category: "Growth",
    estimatedMinutes: 35,
    difficulty: "Medium",
    tasks: [
      { title: "Identify upsell candidates" },
      { title: "Configure upsell offers" },
      { title: "Publish upsell placements" },
      { title: "Verify AOV lift" },
    ],
    checklist: ["Candidates selected", "Offers configured", "Campaign live"],
    verificationRules: [
      { id: "aov_lift", label: "AOV improved", metric: "aov", target: "increased", satisfied: false },
    ],
    completionRules: ["Upsell campaign live"],
  },
  {
    id: "launch_cross_sell_campaign",
    name: "Launch Cross-sell Campaign",
    category: "Growth",
    estimatedMinutes: 35,
    difficulty: "Medium",
    tasks: [
      { title: "Identify complementary pairs" },
      { title: "Configure cross-sell offers" },
      { title: "Publish cross-sell placements" },
      { title: "Verify attach rate" },
    ],
    checklist: ["Pairs selected", "Offers configured", "Campaign live"],
    verificationRules: [
      { id: "attach_rate", label: "Attach rate improved", metric: "attach_rate", target: "increased", satisfied: false },
    ],
    completionRules: ["Cross-sell campaign live"],
  },
  {
    id: "improve_aov",
    name: "Improve AOV",
    category: "Growth",
    estimatedMinutes: 30,
    difficulty: "Medium",
    tasks: [
      { title: "Review basket depth signals" },
      { title: "Launch AOV growth tactics" },
      { title: "Verify average order value" },
    ],
    checklist: ["Signals reviewed", "Tactics launched"],
    verificationRules: [
      { id: "aov_improved", label: "AOV improved", metric: "aov", target: "increased", satisfied: false },
    ],
    completionRules: ["AOV improvement verified"],
  },
  {
    id: "improve_repeat_purchases",
    name: "Improve Repeat Purchases",
    category: "Growth",
    estimatedMinutes: 40,
    difficulty: "Medium",
    tasks: [
      { title: "Segment repeat buyers" },
      { title: "Launch win-back and replenishment flows" },
      { title: "Verify repeat purchase rate" },
    ],
    checklist: ["Segments defined", "Flows launched"],
    verificationRules: [
      { id: "repeat_rate", label: "Repeat rate improved", metric: "repeat_purchase_rate", target: "increased", satisfied: false },
    ],
    completionRules: ["Repeat purchase improvement verified"],
  },
  {
    id: "optimize_collections",
    name: "Optimize Collections",
    category: "Growth",
    estimatedMinutes: 35,
    difficulty: "Medium",
    tasks: [
      { title: "Audit collection performance" },
      { title: "Rebalance collection merchandising" },
      { title: "Verify collection conversion" },
    ],
    checklist: ["Collections audited", "Merchandising updated"],
    verificationRules: [
      { id: "collection_performance", label: "Collection performance improved", metric: "collection_conversion", target: "increased", satisfied: false },
    ],
    completionRules: ["Collection updates published"],
  },
  {
    id: "optimize_merchandising",
    name: "Optimize Merchandising",
    category: "Growth",
    estimatedMinutes: 40,
    difficulty: "Medium",
    tasks: [
      { title: "Review hero and slow movers" },
      { title: "Update merchandising placements" },
      { title: "Verify revenue lift" },
    ],
    checklist: ["Placements reviewed", "Updates published"],
    verificationRules: [
      { id: "revenue_lift", label: "Revenue improved", metric: "revenue", target: "increased", satisfied: false },
    ],
    completionRules: ["Merchandising updates live"],
  },
  {
    id: "homepage_campaign",
    name: "Homepage Campaign",
    category: "Growth",
    estimatedMinutes: 45,
    difficulty: "Medium",
    tasks: [
      { title: "Review homepage growth opportunities" },
      { title: "Launch homepage campaign" },
      { title: "Verify conversion lift" },
    ],
    checklist: ["Homepage reviewed", "Campaign launched"],
    verificationRules: [
      { id: "conversion_lift", label: "Conversion improved", metric: "conversion_rate", target: "increased", satisfied: false },
    ],
    completionRules: ["Homepage campaign live"],
  },
  {
    id: "seasonal_campaign",
    name: "Seasonal Campaign",
    category: "Growth",
    estimatedMinutes: 50,
    difficulty: "Hard",
    tasks: [
      { title: "Identify seasonal demand peaks" },
      { title: "Plan seasonal merchandising" },
      { title: "Launch seasonal campaign" },
      { title: "Verify seasonal revenue lift" },
    ],
    checklist: ["Seasonality reviewed", "Campaign launched"],
    verificationRules: [
      { id: "seasonal_revenue", label: "Seasonal revenue improved", metric: "revenue", target: "increased", satisfied: false },
    ],
    completionRules: ["Seasonal campaign live"],
  },
  {
    id: "customer_retention_campaign",
    name: "Customer Retention Campaign",
    category: "Growth",
    estimatedMinutes: 40,
    difficulty: "Medium",
    tasks: [
      { title: "Identify retention risks" },
      { title: "Launch retention offers" },
      { title: "Verify returning customer rate" },
    ],
    checklist: ["Risks identified", "Retention campaign live"],
    verificationRules: [
      { id: "retention_lift", label: "Retention improved", metric: "retention_rate", target: "increased", satisfied: false },
    ],
    completionRules: ["Retention campaign verified"],
  },
];

export function getWorkflowTemplate(templateId: string): WorkflowTemplate {
  return (
    WORKFLOW_TEMPLATES.find((template) => template.id === templateId) ??
    WORKFLOW_TEMPLATES[0]!
  );
}

export function inferWorkflowTemplateId(input: {
  title: string;
  category?: string;
  templateHint?: string;
}): string {
  const haystack = `${input.title} ${input.category ?? ""} ${input.templateHint ?? ""}`.toLowerCase();
  if (/upsell campaign|launch upsell/.test(haystack)) return "launch_upsell_campaign";
  if (/cross.?sell campaign|launch cross.?sell/.test(haystack)) return "launch_cross_sell_campaign";
  if (/improve aov|lift aov|average order value/.test(haystack)) return "improve_aov";
  if (/repeat purchase|win-back|winback|replenishment/.test(haystack)) return "improve_repeat_purchases";
  if (/optimize collection|collection performance/.test(haystack)) return "optimize_collections";
  if (/optimize merchandising|merchandising placement/.test(haystack)) return "optimize_merchandising";
  if (/homepage campaign|homepage growth/.test(haystack)) return "homepage_campaign";
  if (/seasonal campaign|seasonal growth|seasonality/.test(haystack)) return "seasonal_campaign";
  if (/retention campaign|customer retention|churn/.test(haystack)) return "customer_retention_campaign";
  if (/premium positioning|premium price|premium pricing/.test(haystack)) return "premium_positioning";
  if (/bundle pricing|bundle price|adjust bundle/.test(haystack)) return "bundle_pricing";
  if (/markdown|clearance|liquidat/.test(haystack)) return "markdown_campaign";
  if (/discount optim|discount abuse|remove discount|never discount|discount dependence/.test(haystack)) {
    return "discount_optimization";
  }
  if (/price increase|raise price|increase price/.test(haystack)) return "price_increase";
  if (/price reduction|reduce price|lower price/.test(haystack)) return "price_reduction";
  if (/bundle|starter kit|pair/.test(haystack) && !/bundle pric/.test(haystack)) return "bundle_launch";
  if (/dead stock|inventory|overstock/.test(haystack)) return "inventory_cleanup";
  if (/seo|meta|search/.test(haystack)) return "seo_improvement";
  if (/homepage|hero|social proof/.test(haystack)) return "homepage_optimization";
  if (/margin protection|pricing strategy|pricing review|price consistency/.test(haystack)) return "pricing_review";
  if (/discount|campaign|offer/.test(haystack)) return "discount_campaign";
  if (/pricing|price|margin/.test(haystack)) return "pricing_review";
  return "bundle_launch";
}

export function buildTasksFromTemplate(templateId: string): OperationTask[] {
  const template = getWorkflowTemplate(templateId);
  return template.tasks.map((task, index) => ({
    id: `${templateId}_task_${index + 1}`,
    title: task.title,
    completed: false,
    completedAt: null,
    order: index + 1,
  }));
}
