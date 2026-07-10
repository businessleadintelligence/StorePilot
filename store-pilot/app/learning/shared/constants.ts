import type { LearningPriorityDomain } from "@prisma/client";

/** Products per minute processed during historical import (conservative worker estimate). */
export const PRODUCTS_PER_MINUTE = 120;

/** Orders per minute during historical import. */
export const ORDERS_PER_MINUTE = 400;

/** Base bootstrap profiling duration in minutes. */
export const BASE_BOOTSTRAP_MINUTES = 2;

/** Base graph build minutes per 1k products. */
export const GRAPH_BUILD_MINUTES_PER_1K_PRODUCTS = 3;

/** Quick win generation base minutes. */
export const QUICK_WIN_BASE_MINUTES = 5;

/** Estimated AI cost USD per 1k products for future planning (not billed in 4A). */
export const AI_COST_USD_PER_1K_PRODUCTS = 0.15;

export const LEARNING_PRIORITY_ORDER: LearningPriorityDomain[] = [
  "revenue",
  "inventory",
  "profitability",
  "pricing",
  "seo",
  "collections",
  "media",
  "operations",
  "seasonality",
];

export const STORE_SIZE_THRESHOLDS = {
  tiny: { maxProducts: 50 },
  small: { maxProducts: 500 },
  medium: { maxProducts: 5000 },
  large: { maxProducts: 25000 },
  enterprise: { maxProducts: Number.POSITIVE_INFINITY },
} as const;
