export type IntelligenceFlowStep =
  | "summary"
  | "details"
  | "evidence"
  | "timeline"
  | "related"
  | "actions"
  | "learning";

export type TimelineEventView = {
  id: string;
  title: string;
  category: string;
  occurredAt: string;
  description?: string;
  severity?: string;
  link?: string;
};

export type EvidenceItemView = {
  id: string;
  label: string;
  source: string;
  confidence?: number;
  detail?: string;
};

export type RelationshipNodeView = {
  id: string;
  nodeType: string;
  displayName: string;
  canonicalKey: string;
  link?: string;
};

export type CrossLinkView = {
  label: string;
  href: string;
  description?: string;
};

export type IntelligenceEntityView = {
  id: string;
  entityType: string;
  title: string;
  summary: string;
  confidencePercent?: number;
  revenueImpact?: number;
  severity?: string;
  evidenceIds: string[];
  graphNodeIds: string[];
  memoryIds: string[];
  relatedLinks: CrossLinkView[];
};

export type ActionCenterItem = {
  id: string;
  title: string;
  description: string;
  entityType: "experiment" | "prediction" | "decision" | "recommendation";
  entityId: string;
  confidencePercent?: number;
  revenueImpact?: number;
};

export type SearchResultView = {
  id: string;
  title: string;
  entityType: string;
  href: string;
  snippet?: string;
};

export type WorkspaceContextValue = {
  activeStep: IntelligenceFlowStep;
  setActiveStep: (step: IntelligenceFlowStep) => void;
  drawerOpen: boolean;
  openDrawer: (entity: IntelligenceEntityView) => void;
  closeDrawer: () => void;
  selectedEntity: IntelligenceEntityView | null;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

export type StoreContext = {
  storeId: string;
  currency: string;
};
