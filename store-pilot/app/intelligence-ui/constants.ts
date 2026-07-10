import type { IntelligenceFlowStep } from "./types";

export const INTELLIGENCE_FLOW_STEPS: Array<{
  key: IntelligenceFlowStep;
  label: string;
}> = [
  { key: "summary", label: "Summary" },
  { key: "details", label: "Details" },
  { key: "evidence", label: "Evidence" },
  { key: "timeline", label: "Timeline" },
  { key: "related", label: "Related Intelligence" },
  { key: "actions", label: "Recommended Actions" },
  { key: "learning", label: "Learning History" },
];

export const WORKSPACE_ROUTES = {
  dashboard: "/app",
  executive: "/app/executive",
  inventory: "/app/inventory",
  pricing: "/app/pricing",
  seo: "/app/seo",
  products: "/app/products",
  productDetail: (id: string) => `/app/products/${id}`,
  collections: "/app/collections",
  rootCauses: "/app/root-causes",
  predictions: "/app/predictions",
  experiments: "/app/experiments",
  businessMemory: "/app/business-memory",
  knowledgeGraph: "/app/knowledge-graph",
  merchantIntelligence: "/app/merchant-intelligence",
  timeline: "/app/timeline",
  settings: "/app/settings",
  coo: "/app/coo",
} as const;

export const WORKSPACE_NAV = [
  { label: "Executive", href: WORKSPACE_ROUTES.executive },
  { label: "Inventory", href: WORKSPACE_ROUTES.inventory },
  { label: "Pricing", href: WORKSPACE_ROUTES.pricing },
  { label: "SEO", href: WORKSPACE_ROUTES.seo },
  { label: "Products", href: WORKSPACE_ROUTES.products },
  { label: "Collections", href: WORKSPACE_ROUTES.collections },
  { label: "Root Causes", href: WORKSPACE_ROUTES.rootCauses },
  { label: "Predictions", href: WORKSPACE_ROUTES.predictions },
  { label: "Experiments", href: WORKSPACE_ROUTES.experiments },
  { label: "Business Memory", href: WORKSPACE_ROUTES.businessMemory },
  { label: "Knowledge Graph", href: WORKSPACE_ROUTES.knowledgeGraph },
  { label: "Merchant Profile", href: WORKSPACE_ROUTES.merchantIntelligence },
  { label: "Timeline", href: WORKSPACE_ROUTES.timeline },
] as const;
