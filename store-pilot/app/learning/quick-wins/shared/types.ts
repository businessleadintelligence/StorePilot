import type { QuickWinCategory, QuickWinType } from "@prisma/client";

export type QuickWinEffort = 1 | 2 | 3;

export type QuickWinCandidate = {
  winType: QuickWinType;
  category: QuickWinCategory;
  title: string;
  description: string;
  affectedCount: number;
  evidenceIds: string[];
  sourceFactTypes: string[];
  avgConfidence: number;
  effort: QuickWinEffort;
  impactWeight: number;
  urgencyBoost: number;
  metadata?: Record<string, unknown>;
};

export type ScoredQuickWin = QuickWinCandidate & {
  businessImpact: number;
  estimatedEffort: QuickWinEffort;
  confidence: number;
  revenueOpportunity: number;
  urgency: number;
  rankScore: number;
};

export type QuickWinGenerationResult = {
  success: boolean;
  storeId: string;
  totalWins: number;
  estimatedRevenueOpportunity: number;
  wins: ScoredQuickWin[];
};

export type QuickWinUiItem = {
  winType: QuickWinType;
  category: QuickWinCategory;
  title: string;
  description: string;
  affectedCount: number;
  businessImpact: number;
  confidencePercent: number;
  revenueOpportunity: number;
  urgency: number;
};

export type QuickWinUiSummary = {
  headline: string;
  totalWins: number;
  estimatedRevenueOpportunity: number;
  currency: string;
  items: QuickWinUiItem[];
  highlights: Array<{ label: string; count: number }>;
  lastGeneratedAt: string | null;
};

export type EvidenceFactGroup = {
  factType: string;
  count: number;
  evidenceIds: string[];
  avgConfidence: number;
};

export type EvidenceRow = {
  id: string;
  factType: string;
  entityId: string;
  confidence: number;
};

export type QuickWinDefinition = {
  winType: QuickWinType;
  category: QuickWinCategory;
  factTypes: string[];
  title: (count: number) => string;
  description: string;
  effort: QuickWinEffort;
  impactWeight: number;
  urgencyBoost: number;
};
